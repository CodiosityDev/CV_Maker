/**
 * HTTP API (behind nginx at https://cvmaker.codiosity.com/api/…):
 *   GET  /api/health      → { ok: true }
 *   GET  /api/ai/quota    → AiQuota            (header X-Device-Token optional)
 *   POST /api/ai/device   → { token }          (anonymous device token)
 *   POST /api/ai/run      → { result, quota }  (body AiRequest, header X-Device-Token)
 * Errors: { error: AiErrorCode, quota? } with 400/401/403/413/429/502/503.
 *
 * The server stores counters only (no CV content) and logs metadata only (task, model, ms, status).
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ChatProvider } from './ai';
import type { ServerConfig } from './config';
import {
	ipSubject,
	issueDeviceToken,
	nextWibMidnight,
	verifyDeviceToken,
	wibDay
} from './identity';
import { consume, refund, type QuotaKey, type QuotaStore } from './quota';
import { buildMessages, parseAnswer } from './tasks';
import { parseAiRequest } from '../../src/lib/core/ai/schema';
import type { AiErrorCode, AiQuota } from '../../src/lib/core/ai/types';

const MAX_BODY_BYTES = 32 * 1024;
/** Short-term burst limit per IP (in memory): requests per minute. */
const BURST = { run: 6, other: 30 } as const;

export interface AppDeps {
	config: Pick<ServerConfig, 'appOrigin' | 'appSecret' | 'limits'>;
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

function send(res: ServerResponse, status: number, body: unknown): void {
	const json = JSON.stringify(body);
	res.writeHead(status, {
		'Content-Type': 'application/json; charset=utf-8',
		'Content-Length': Buffer.byteLength(json),
		'Cache-Control': 'no-store',
		'X-Content-Type-Options': 'nosniff'
	});
	res.end(json);
}

/** Client IP: nginx sets X-Real-IP (Cloudflare's CF-Connecting-IP after real_ip). */
function clientIp(req: IncomingMessage): string {
	const header = req.headers['x-real-ip'];
	const value = Array.isArray(header) ? header[0] : header;
	return value?.trim() || req.socket.remoteAddress || 'unknown';
}

async function readJson(req: IncomingMessage): Promise<unknown> {
	const type = req.headers['content-type'] ?? '';
	if (!type.toLowerCase().startsWith('application/json')) throw new HttpError(400, 'invalid');
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
		const used = device ? await store.used('device', device, wibDay(now())) : 0;
		return {
			limit: config.limits.device,
			remaining: Math.max(0, config.limits.device - used),
			resetsAt: nextWibMidnight(now())
		};
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
		const keys: QuotaKey[] = [
			{ scope: 'device', subject: device, limit: config.limits.device },
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

	return async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
		const ip = clientIp(req);
		const path = (req.url ?? '/').split('?')[0];
		try {
			if (req.method === 'GET' && path === '/api/health') return send(res, 200, { ok: true });
			if (req.method === 'GET' && path === '/api/ai/quota') {
				burst(ip, 'other');
				return send(res, 200, await quotaFor(deviceFrom(req)));
			}
			if (req.method === 'POST' && path === '/api/ai/device')
				return send(res, 200, await issue(req, ip));
			if (req.method === 'POST' && path === '/api/ai/run')
				return send(res, 200, await run(req, ip));
			return send(res, 404, { error: 'invalid' });
		} catch (error) {
			if (error instanceof HttpError) {
				return send(
					res,
					error.status,
					error.quota ? { error: error.code, quota: error.quota } : { error: error.code }
				);
			}
			log({ event: 'error', path, message: error instanceof Error ? error.message : 'unknown' });
			return send(res, 500, { error: 'failed' });
		}
	};
}
