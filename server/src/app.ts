/**
 * HTTP API (behind nginx at https://cvmaker.codiosity.com/api/…):
 *   GET  /api/health          → { ok: true } (503 when the quota database cannot be reached)
 *   GET  /api/ai/quota        → AiQuota            (header X-Device-Token optional)
 *   POST /api/ai/device       → { token }          (anonymous device token)
 *   POST /api/ai/run          → { result, quota }  (body AiRequest, header X-Device-Token)
 *                               task 'convert' → 202 { job, quota }; then poll
 *   GET  /api/ai/job?id=      → { status: 'pending' } | { status: 'done', result, quota } (same token)
 *   POST /api/ai/lite         → { result, lite }  (body { task: 'concise', concise }, X-Device-Token)
 *                               free light check: small model, own daily limit, no daily use spent
 *   POST /api/ai/reward/start → { adUrl }          (header X-Device-Token; open adUrl in a new tab)
 *   POST /api/ai/reward/claim → { quota }          (body { ticket }; called by the AD PAGE origin)
 *   GET  /api/hello           → { visitors, online } (all-time count + online now, counts nothing)
 *   POST /api/hello           → { visitors, online } (body { visitor }; counts this visitor once a day)
 *                               body { visitor, beat: true } → heartbeat only (memory, no database)
 * Errors: { error: AiErrorCode, quota? } with 400/401/403/413/429/502/503.
 *
 * Rewarded ads (owner: +1 use per ad, max 10 ads per device per day): Google gives no server-side
 * confirmation on the web, so a claim needs a signed, single-use ticket bound to the device, at
 * least `ads.minSeconds` after the start, within the daily caps. Cheating can at most reach the cap.
 *
 * Visitors (owner: a counter from 0 that never resets) = the sum of daily unique visitors, keyed by
 * a random id the browser keeps. Max `limits.visitorsPerIp` new visitors per IP per day stops a script
 * from inflating it. "hello" rather than "visit"/"stats": ad blockers drop requests to such paths.
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
	VISITOR_ID_PATTERN,
	visitorSubject,
	wibDay
} from './identity';
import { consume, refund, type QuotaKey, type QuotaStore } from './quota';
import {
	buildConciseMessages,
	buildMessages,
	conciseMaxTokens,
	maxTokensFor,
	parseAnswer,
	parseConcise
} from './tasks';
import { createJobStore } from './jobs';
import { createPresence } from './presence';
import { parseAiLiteRequest, parseAiRequest } from '../../src/lib/core/ai/schema';
import type { AiErrorCode, AiQuota, AiRequest, AiResult } from '../../src/lib/core/ai/types';

const MAX_BODY_BYTES = 32 * 1024;
/** A ticket older than this cannot be claimed (the ad tab was left open too long). */
const TICKET_MAX_AGE_MS = 30 * 60 * 1000;
/** Short-term burst limit per IP (in memory): requests per minute. */
const BURST = { run: 6, lite: 12, other: 30, poll: 90, beat: 60 } as const;
/** Light checks must answer fast; a small model needs little time. */
const LITE_TIMEOUT_MS = 20_000;
/** The all-time total is read from the database at most this often for heartbeats. */
const TOTAL_CACHE_MS = 30_000;
/** Long tasks get more time per model (they write a whole CV). */
const LONG_TASK_TIMEOUT_MS = 60_000;
const JOB_ID_PATTERN = /^[\w-]{22}$/;
const CLAIM_PATH = '/api/ai/reward/claim';
const HELLO_PATH = '/api/hello';

export interface AppDeps {
	config: Pick<ServerConfig, 'appOrigin' | 'appSecret' | 'limits' | 'ads'>;
	store: QuotaStore;
	provider: ChatProvider;
	/** Small model for the free light checks; defaults to `provider`. */
	liteProvider?: ChatProvider;
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
	const liteProvider = deps.liteProvider ?? provider;
	const now = deps.now ?? Date.now;
	const log = deps.log ?? (() => {});
	const bursts = new Map<string, { minute: number; count: number }>();
	const jobs = createJobStore<{ result: AiResult; quota: AiQuota }>(now);
	const presence = createPresence(now);
	let cachedTotal: { value: number; at: number } | undefined;

	async function visitorsTotal(fresh = false): Promise<number> {
		if (!fresh && cachedTotal && now() - cachedTotal.at < TOTAL_CACHE_MS) return cachedTotal.value;
		const value = await store.total('visitors');
		cachedTotal = { value, at: now() };
		return value;
	}

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
		quota.lite = await liteLeft(device);
		return quota;
	}

	async function liteLeft(
		device: string | undefined
	): Promise<{ limit: number; remaining: number }> {
		const limit = config.limits.lite.device;
		const used = device ? await store.used('lite', device, wibDay(now())) : 0;
		return { limit, remaining: Math.max(0, limit - used) };
	}

	/** Free light check (wordiness): own daily limits, small model, the use is given back on failure. */
	async function lite(req: IncomingMessage, ip: string): Promise<unknown> {
		sameOrigin(req);
		burst(ip, 'lite');
		const device = deviceFrom(req);
		if (!device) throw new HttpError(401, 'invalid');
		const request = parseAiLiteRequest(await readJson(req));
		if (!request) throw new HttpError(400, 'invalid');

		const day = wibDay(now());
		const keys: QuotaKey[] = [
			{ scope: 'lite', subject: device, limit: config.limits.lite.device },
			{ scope: 'liteip', subject: ipSubject(config.appSecret, ip), limit: config.limits.lite.ip },
			{ scope: 'liteall', subject: 'all', limit: config.limits.lite.global }
		];
		const full = await consume(store, keys, day);
		if (full === 'lite' || full === 'liteip') throw new HttpError(429, 'quota');
		if (full) throw new HttpError(503, 'unavailable');

		const started = now();
		try {
			const reply = await liteProvider.complete(buildConciseMessages(request.concise), {
				maxTokens: conciseMaxTokens(request.concise),
				timeoutMs: LITE_TIMEOUT_MS,
				// Rating needs consistency, not creativity.
				temperature: 0.1
			});
			const result = parseConcise(request.concise, reply.text);
			log({
				event: 'ai.lite',
				task: 'concise',
				model: reply.model,
				ms: now() - started,
				ok: !!result
			});
			if (!result) throw new HttpError(502, 'failed');
			return { result, lite: await liteLeft(device) };
		} catch (error) {
			await refund(store, keys, day);
			if (error instanceof HttpError) throw error;
			log({ event: 'ai.lite', task: 'concise', ms: now() - started, ok: false });
			throw new HttpError(503, 'unavailable');
		}
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
		if (request.task === 'convert') {
			const free = jobs.canStart(device);
			if (free === 'device') throw new HttpError(429, 'busy');
			if (free === 'full') throw new HttpError(503, 'unavailable');
		}

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

		if (request.task === 'convert') {
			// Answered at once; the browser polls GET /api/ai/job (no proxy timeout can cut it).
			const job = jobs.start(device, () => answer(request, keys, day, device));
			return { job, quota: await quotaFor(device) };
		}
		return answer(request, keys, day, device);
	}

	/** Calls the model and checks its answer. On any failure the use is given back. */
	async function answer(
		request: AiRequest,
		keys: QuotaKey[],
		day: string,
		device: string
	): Promise<{ result: AiResult; quota: AiQuota }> {
		const started = now();
		try {
			const long = request.task === 'convert';
			const reply = await provider.complete(buildMessages(request), {
				maxTokens: maxTokensFor(request),
				...(long ? { timeoutMs: LONG_TASK_TIMEOUT_MS } : {})
			});
			const result = parseAnswer(request, reply.text);
			log({
				event: 'ai.run',
				task: request.task,
				model: reply.model,
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

	async function jobStatus(req: IncomingMessage, ip: string): Promise<unknown> {
		burst(ip, 'poll');
		const device = deviceFrom(req);
		if (!device) throw new HttpError(401, 'invalid');
		const id = new URL(req.url ?? '/', 'http://local').searchParams.get('id') ?? '';
		if (!JOB_ID_PATTERN.test(id)) throw new HttpError(400, 'invalid');
		const view = jobs.get(id, device);
		if (!view) throw new HttpError(404, 'failed');
		if (view.status === 'pending') return { status: 'pending' };
		if (view.status === 'done') return { status: 'done', ...view.value };
		const error = view.error instanceof HttpError ? view.error : new HttpError(503, 'unavailable');
		throw new HttpError(error.status, error.code, await quotaFor(device));
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

	async function hello(
		req: IncomingMessage,
		ip: string
	): Promise<{ visitors: number; online: number }> {
		sameOrigin(req);
		const body = (await readJson(req)) as { visitor?: unknown; beat?: unknown } | null;
		const beat = body?.beat === true;
		burst(ip, beat ? 'beat' : 'other');
		const visitor = body?.visitor;
		if (typeof visitor !== 'string' || !VISITOR_ID_PATTERN.test(visitor)) {
			throw new HttpError(400, 'invalid');
		}
		const subject = visitorSubject(config.appSecret, visitor);
		presence.seen(subject, ipSubject(config.appSecret, ip));
		// Heartbeat: memory only, no database write.
		if (beat) return { visitors: await visitorsTotal(), online: presence.online() };

		const day = wibDay(now());
		const firstToday = await store.increment('visit', subject, day, 1);
		if (
			firstToday &&
			(await store.increment(
				'visitip',
				ipSubject(config.appSecret, ip),
				day,
				config.limits.visitorsPerIp
			))
		) {
			const visitors = await store.addTotal('visitors');
			cachedTotal = { value: visitors, at: now() };
			return { visitors, online: presence.online() };
		}
		return { visitors: await visitorsTotal(true), online: presence.online() };
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
			if (req.method === 'GET' && path === HELLO_PATH) {
				burst(ip, 'other');
				return send(res, 200, { visitors: await visitorsTotal(), online: presence.online() });
			}
			if (req.method === 'POST' && path === HELLO_PATH) {
				return send(res, 200, await hello(req, ip));
			}
			if (req.method === 'POST' && path === '/api/ai/device') {
				return send(res, 200, await issue(req, ip));
			}
			if (req.method === 'POST' && path === '/api/ai/run') {
				const body = await run(req, ip);
				return send(res, body && typeof body === 'object' && 'job' in body ? 202 : 200, body);
			}
			if (req.method === 'POST' && path === '/api/ai/lite') {
				return send(res, 200, await lite(req, ip));
			}
			if (req.method === 'GET' && path === '/api/ai/job') {
				return send(res, 200, await jobStatus(req, ip));
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
