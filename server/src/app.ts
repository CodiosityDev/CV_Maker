/**
 * HTTP API (behind nginx at https://cvmaker.codiosity.com/api/…):
 *   GET  /api/health          → { ok: true } (503 when the quota database cannot be reached)
 *   GET  /api/ai/quota        → AiQuota            (header X-Device-Token optional)
 *   POST /api/ai/device       → { token }          (anonymous device token)
 *   POST /api/ai/run          → { result, quota }  (body AiRequest, header X-Device-Token)
 *   POST /api/ai/reward/start → { adUrl }          (header X-Device-Token; open adUrl in a new tab)
 *   POST /api/ai/reward/claim → { quota }          (body { ticket }; called by the AD PAGE origin)
 * Errors: { error: AiErrorCode, quota? } with 400/401/403/413/429/502/503.
 *
 * Rewarded ads (owner: +1 use per ad, max 10 ads per device per day): Google gives no server-side
 * confirmation on the web, so a claim needs a signed, single-use ticket bound to the device, at
 * least `ads.minSeconds` after the start, within the daily caps. Cheating can at most reach the cap.
 *
 * The server stores counters only (no CV content) and logs metadata only (task, model, ms, status).
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ChatProvider } from './ai';
import type { ServerConfig } from './config';
import {
	ipSubject,
	issueDeviceToken,
	issueRewardTicket,
	nextWibMidnight,
	verifyDeviceToken,
	verifyRewardTicket,
	wibDay
} from './identity';
import { consume, refund, type QuotaKey, type QuotaStore } from './quota';
import { buildMessages, parseAnswer } from './tasks';
import { parseAiRequest } from '../../src/lib/core/ai/schema';
import type { AiErrorCode, AiQuota } from '../../src/lib/core/ai/types';

const MAX_BODY_BYTES = 32 * 1024;
/** A ticket older than this cannot be claimed (the ad tab was left open too long). */
const TICKET_MAX_AGE_MS = 30 * 60 * 1000;
/** Short-term burst limit per IP (in memory): requests per minute. */
const BURST = { run: 6, other: 30 } as const;
const CLAIM_PATH = '/api/ai/reward/claim';

export interface AppDeps {
	config: Pick<ServerConfig, 'appOrigin' | 'appSecret' | 'limits' | 'ads'>;
	store: QuotaStore;
	provider: ChatProvider;
	now?: () => number;
	log?: (entry: Record<string, unknown>) => void;
}

class HttpError extends Error {
	constructor(
		readonly status: number,
		readonly code: AiErrorCode,
		readonly quota?: AiQuota
	) {
		super(code);
	}
}

function send(
	res: ServerResponse,
	status: number,
	body: unknown,
	headers: Record<string, string> = {}
): void {
	const json = JSON.stringify(body);
	res.writeHead(status, {
		'Content-Type': 'application/json; charset=utf-8',
		'Content-Length': Buffer.byteLength(json),
		'Cache-Control': 'no-store',
		'X-Content-Type-Options': 'nosniff',
		...headers
	});
	res.end(json);
}

/** Client IP: nginx sets X-Real-IP (Cloudflare's CF-Connecting-IP after real_ip). */
function clientIp(req: IncomingMessage): string {
	const header = req.headers['x-real-ip'];
	const value = Array.isArray(header) ? header[0] : header;
	return value?.trim() || req.socket.remoteAddress || 'unknown';
}

/**
 * `allowText`: the ad page posts `text/plain` (a CORS "simple" request: no preflight, no cookies).
 */
async function readJson(req: IncomingMessage, allowText = false): Promise<unknown> {
	const type = (req.headers['content-type'] ?? '').toLowerCase();
	const accepted =
		type.startsWith('application/json') || (allowText && type.startsWith('text/plain'));
	if (!accepted) throw new HttpError(400, 'invalid');
	const length = Number(req.headers['content-length'] ?? 0);
	if (length > MAX_BODY_BYTES) throw new HttpError(413, 'invalid');
	const chunks: Buffer[] = [];
	let size = 0;
	for await (const chunk of req) {
		size += (chunk as Buffer).length;
		if (size > MAX_BODY_BYTES) throw new HttpError(413, 'invalid');
		chunks.push(chunk as Buffer);
	}
	try {
		return JSON.parse(Buffer.concat(chunks).toString('utf8'));
	} catch {
		throw new HttpError(400, 'invalid');
	}
}

export function createApp(deps: AppDeps) {
	const { config, store, provider } = deps;
	const now = deps.now ?? Date.now;
	const log = deps.log ?? (() => {});
	const bursts = new Map<string, { minute: number; count: number }>();

	function burst(ip: string, kind: keyof typeof BURST): void {
		const minute = Math.floor(now() / 60_000);
		const key = `${kind}|${ip}`;
		const entry = bursts.get(key);
		if (!entry || entry.minute !== minute) {
			if (bursts.size > 10_000) bursts.clear();
			bursts.set(key, { minute, count: 1 });
			return;
		}
		entry.count += 1;
		if (entry.count > BURST[kind]) throw new HttpError(429, 'busy');
	}

	/** Browsers send Origin/Sec-Fetch-Site on POST: block other websites from spending quotas. */
	function sameOrigin(req: IncomingMessage): void {
		const origin = req.headers.origin;
		const site = req.headers['sec-fetch-site'];
		if (origin && origin !== config.appOrigin) throw new HttpError(403, 'invalid');
		if (site && site !== 'same-origin' && site !== 'none') throw new HttpError(403, 'invalid');
	}

	async function quotaFor(device: string | undefined): Promise<AiQuota> {
		const day = wibDay(now());
		const bonus = device ? await store.used('bonus', device, day) : 0;
		const used = device ? await store.used('device', device, day) : 0;
		const limit = config.limits.device + bonus;
		const quota: AiQuota = {
			limit,
			remaining: Math.max(0, limit - used),
			resetsAt: nextWibMidnight(now())
		};
		if (config.ads.enabled) {
			quota.rewards = {
				limit: config.ads.perDevice,
				remaining: Math.max(0, config.ads.perDevice - bonus)
			};
		}
		return quota;
	}

	function deviceFrom(req: IncomingMessage): string | undefined {
		const header = req.headers['x-device-token'];
		return verifyDeviceToken(config.appSecret, Array.isArray(header) ? header[0] : header);
	}

	async function run(req: IncomingMessage, ip: string): Promise<unknown> {
		sameOrigin(req);
		burst(ip, 'run');
		const device = deviceFrom(req);
		if (!device) throw new HttpError(401, 'invalid');
		const request = parseAiRequest(await readJson(req));
		if (!request) throw new HttpError(400, 'invalid');

		const day = wibDay(now());
		// Free uses + uses earned from ads today.
		const deviceLimit = config.limits.device + (await store.used('bonus', device, day));
		const keys: QuotaKey[] = [
			{ scope: 'device', subject: device, limit: deviceLimit },
			{ scope: 'ip', subject: ipSubject(config.appSecret, ip), limit: config.limits.ip },
			{ scope: 'global', subject: 'all', limit: config.limits.global }
		];
		const full = await consume(store, keys, day);
		if (full === 'device' || full === 'ip') {
			throw new HttpError(429, 'quota', { ...(await quotaFor(device)), remaining: 0 });
		}
		if (full === 'global') throw new HttpError(503, 'unavailable');

		const started = now();
		try {
			const answer = await provider.complete(buildMessages(request));
			const result = parseAnswer(request, answer.text);
			log({
				event: 'ai.run',
				task: request.task,
				model: answer.model,
				ms: now() - started,
				ok: !!result
			});
			if (!result) throw new HttpError(502, 'failed');
			return { result, quota: await quotaFor(device) };
		} catch (error) {
			await refund(store, keys, day);
			if (error instanceof HttpError) throw error;
			log({ event: 'ai.run', task: request.task, ms: now() - started, ok: false });
			throw new HttpError(503, 'unavailable');
		}
	}

	async function issue(req: IncomingMessage, ip: string): Promise<unknown> {
		sameOrigin(req);
		burst(ip, 'other');
		const day = wibDay(now());
		const key: QuotaKey = {
			scope: 'issue',
			subject: ipSubject(config.appSecret, ip),
			limit: config.limits.devicesPerIp
		};
		if (await consume(store, [key], day)) throw new HttpError(429, 'busy');
		return { token: issueDeviceToken(config.appSecret) };
	}

	async function rewardStart(req: IncomingMessage, ip: string): Promise<unknown> {
		sameOrigin(req);
		burst(ip, 'other');
		if (!config.ads.enabled) throw new HttpError(503, 'unavailable');
		const device = deviceFrom(req);
		if (!device) throw new HttpError(401, 'invalid');
		if ((await store.used('bonus', device, wibDay(now()))) >= config.ads.perDevice) {
			throw new HttpError(429, 'quota', await quotaFor(device));
		}
		// The ticket travels in the URL fragment, which browsers never send to any server.
		return { adUrl: `${config.ads.origin}/#${issueRewardTicket(config.appSecret, device, now())}` };
	}

	async function rewardClaim(req: IncomingMessage, ip: string): Promise<unknown> {
		const origin = req.headers.origin;
		if (origin && origin !== config.ads.origin) throw new HttpError(403, 'invalid');
		burst(ip, 'other');
		if (!config.ads.enabled) throw new HttpError(503, 'unavailable');
		const body = (await readJson(req, true)) as { ticket?: unknown } | null;
		const ticket = verifyRewardTicket(config.appSecret, body?.ticket);
		if (!ticket) throw new HttpError(400, 'invalid');
		const age = now() - ticket.issuedAt;
		if (age < config.ads.minSeconds * 1000 || age > TICKET_MAX_AGE_MS) {
			throw new HttpError(400, 'invalid');
		}
		const day = wibDay(now());
		// Single use: the nonce is remembered for the day.
		if (await consume(store, [{ scope: 'ticket', subject: ticket.nonce, limit: 1 }], day)) {
			throw new HttpError(400, 'invalid');
		}
		const full = await consume(
			store,
			[
				{ scope: 'bonus', subject: ticket.device, limit: config.ads.perDevice },
				{ scope: 'bonusip', subject: ipSubject(config.appSecret, ip), limit: config.ads.perIp }
			],
			day
		);
		if (full) throw new HttpError(429, 'quota', await quotaFor(ticket.device));
		log({ event: 'ai.reward' });
		return { quota: await quotaFor(ticket.device) };
	}

	/** CORS only for the claim endpoint and only for the ad page's origin (no credentials). */
	function corsHeaders(req: IncomingMessage, path: string): Record<string, string> {
		if (path !== CLAIM_PATH || req.headers.origin !== config.ads.origin) return {};
		return {
			'Access-Control-Allow-Origin': config.ads.origin,
			'Access-Control-Allow-Methods': 'POST',
			'Access-Control-Allow-Headers': 'Content-Type',
			'Access-Control-Max-Age': '600',
			Vary: 'Origin'
		};
	}

	return async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
		const ip = clientIp(req);
		const path = (req.url ?? '/').split('?')[0] ?? '/';
		const cors = corsHeaders(req, path);
		try {
			if (req.method === 'OPTIONS') {
				res.writeHead(cors['Access-Control-Allow-Origin'] ? 204 : 403, cors);
				res.end();
				return;
			}
			if (req.method === 'GET' && path === '/api/health') {
				// Also proves the database and its table work (the deploy checks this endpoint).
				try {
					await store.used('global', 'all', wibDay(now()));
				} catch {
					log({ event: 'error', path, message: 'quota database unreachable' });
					return send(res, 503, { ok: false });
				}
				return send(res, 200, { ok: true });
			}
			if (req.method === 'GET' && path === '/api/ai/quota') {
				burst(ip, 'other');
				return send(res, 200, await quotaFor(deviceFrom(req)));
			}
			if (req.method === 'POST' && path === '/api/ai/device') {
				return send(res, 200, await issue(req, ip));
			}
			if (req.method === 'POST' && path === '/api/ai/run') {
				return send(res, 200, await run(req, ip));
			}
			if (req.method === 'POST' && path === '/api/ai/reward/start') {
				return send(res, 200, await rewardStart(req, ip));
			}
			if (req.method === 'POST' && path === CLAIM_PATH) {
				return send(res, 200, await rewardClaim(req, ip), cors);
			}
			return send(res, 404, { error: 'invalid' });
		} catch (error) {
			if (error instanceof HttpError) {
				const body = error.quota
					? { error: error.code, quota: error.quota }
					: { error: error.code };
				return send(res, error.status, body, cors);
			}
			log({ event: 'error', path, message: error instanceof Error ? error.message : 'unknown' });
			return send(res, 500, { error: 'failed' }, cors);
		}
	};
}
