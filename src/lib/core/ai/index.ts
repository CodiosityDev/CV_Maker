/**
 * AI assist — browser side. The UI must show a consent dialog BEFORE the first `run()` of a
 * session (CV content leaves the device). Never call `run()` automatically.
 *
 *   import { aiClient, aiErrorMessageKey, AiError } from '#lib/core/ai/index.ts';
 *   const quota = await aiClient.quota();                       // { limit: 3, remaining: 2, resetsAt }
 *   try {
 *     const { result, quota } = await aiClient.run('headline', store.cv);
 *     if (result.task === 'headline') showChoices(result.headlines);
 *   } catch (error) {
 *     if (error instanceof AiError) toast.error(t(aiErrorMessageKey(error.code)));
 *   }
 *
 * Results are SUGGESTIONS: show them, let the user pick/edit, then apply with one `store.update`.
 */
import { incognito } from '../storage/index';
import { LIMITS } from '../schema/limits';
import type { CVDocument } from '../schema/types';
import {
	AI_DEVICE_STORAGE_KEY,
	AI_ERROR_CODES,
	AI_PROFILE_LIMITS,
	type AiErrorCode,
	type AiProfile,
	type AiQuota,
	type AiResult,
	type AiRewardStart,
	type AiTask
} from './types';

export * from './types';

const API_BASE = '/api/ai';
const REQUEST_TIMEOUT_MS = 70_000;

const clip = (value: string | undefined, max: number): string =>
	(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max).trim();
const clipList = (items: readonly string[] | undefined, max: number, length: number): string[] =>
	(items ?? [])
		.map((item) => clip(item, length))
		.filter(Boolean)
		.slice(0, max);

/**
 * The part of the CV the AI may see. Contact details (name, email, phone, city, links, photo),
 * languages, awards and custom sections are never included.
 */
export function aiProfileFromCv(cv: CVDocument): AiProfile {
	const bullets = (items: readonly string[]) =>
		clipList(items, AI_PROFILE_LIMITS.bulletsPerItem, LIMITS.bullet);
	const skills = (items: readonly string[]) =>
		clipList(items, AI_PROFILE_LIMITS.skillsPerGroup, LIMITS.title);
	return {
		locale: cv.locale,
		targetRole: clip(cv.targetRole, LIMITS.title),
		education: cv.education
			.map((e) => ({
				degree: clip(e.degree, LIMITS.short),
				major: clip(e.major, LIMITS.title),
				institution: clip(e.institution, LIMITS.title),
				gpa: clip(e.gpa, LIMITS.gpa)
			}))
			.filter((e) => e.degree || e.major || e.institution)
			.slice(0, AI_PROFILE_LIMITS.education),
		experience: cv.experience
			.map((e) => ({
				type: e.type,
				role: clip(e.role, LIMITS.title),
				company: clip(e.company, LIMITS.title),
				bullets: bullets(e.bullets)
			}))
			.filter((e) => e.role || e.company)
			.slice(0, AI_PROFILE_LIMITS.experience),
		organizations: cv.organizations
			.map((o) => ({
				role: clip(o.role, LIMITS.title),
				name: clip(o.name, LIMITS.title),
				bullets: bullets(o.bullets)
			}))
			.filter((o) => o.role || o.name)
			.slice(0, AI_PROFILE_LIMITS.organizations),
		projects: cv.projects
			.map((p) => ({
				name: clip(p.name, LIMITS.title),
				role: clip(p.role, LIMITS.title),
				bullets: bullets(p.bullets)
			}))
			.filter((p) => p.name)
			.slice(0, AI_PROFILE_LIMITS.projects),
		skills: {
			hard: skills(cv.skills.hard),
			tools: skills(cv.skills.tools),
			soft: skills(cv.skills.soft)
		},
		certifications: clipList(
			cv.certifications.map((c) => c.name),
			AI_PROFILE_LIMITS.certifications,
			LIMITS.title
		),
		summary: clip(cv.summary, LIMITS.summary)
	};
}

/** True when the CV has enough for the task to give a useful answer (enable the AI button). */
export function aiCanRun(task: AiTask, cv: CVDocument): boolean {
	const p = aiProfileFromCv(cv);
	const background =
		p.education.length + p.experience.length + p.organizations.length + p.projects.length > 0;
	if (task === 'skills') return Boolean(p.targetRole) || background;
	return Boolean(p.targetRole) && background;
}

export class AiError extends Error {
	constructor(
		readonly code: AiErrorCode,
		/** Present when the server reported it (e.g. with 'quota'). */
		readonly quota?: AiQuota
	) {
		super(`AI request failed: ${code}`);
		this.name = 'AiError';
	}
}

/** i18n key for an error code (namespace `ai`, owned by core). */
export function aiErrorMessageKey(code: AiErrorCode): `ai.errors.${AiErrorCode}` {
	return `ai.errors.${code}`;
}

// ---------------------------------------------------------------------------
// Device token: anonymous, random, signed by the server. Counts the daily quota per device.
// Kept in localStorage normally; only in memory in incognito mode (nothing left on the computer).
// ---------------------------------------------------------------------------

let memoryToken: string | undefined;

function readToken(): string | undefined {
	if (incognito.active) return memoryToken;
	try {
		return localStorage.getItem(AI_DEVICE_STORAGE_KEY) ?? undefined;
	} catch {
		return memoryToken;
	}
}

function writeToken(token: string | undefined): void {
	memoryToken = token;
	if (incognito.active) return;
	try {
		if (token) localStorage.setItem(AI_DEVICE_STORAGE_KEY, token);
		else localStorage.removeItem(AI_DEVICE_STORAGE_KEY);
	} catch {
		// Storage blocked: the in-memory token still works for this tab.
	}
}

export interface AiClientOptions {
	fetch?: typeof fetch;
	baseUrl?: string;
	/** For tests; defaults to `window.open`. */
	openWindow?: (url: string, target: string) => Window | null;
}

export interface AiClient {
	/** Uses left today for this device (no token needed; does not use a quota). */
	quota(): Promise<AiQuota>;
	/** Runs one task (uses 1 of today's quota on success only). Throws AiError. */
	run(task: AiTask, cv: CVDocument): Promise<{ result: AiResult; quota: AiQuota }>;
	/**
	 * Watch an ad for one more use (only when `quota.rewards.remaining > 0`). Opens the ad page
	 * (separate origin: ad scripts never see CV data) in a NEW TAB. Call it DIRECTLY in the click
	 * handler — the tab is opened before any `await`, otherwise browsers block it. The reward is
	 * added by the ad page; refresh `quota()` when this tab becomes visible again.
	 * Throws AiError ('busy' when the browser blocked the tab, 'quota' when today's ads are used up).
	 */
	openRewardAd(locale: CVDocument['locale']): Promise<void>;
}

interface ErrorBody {
	error?: unknown;
	quota?: AiQuota;
}

function isErrorCode(value: unknown): value is AiErrorCode {
	return typeof value === 'string' && (AI_ERROR_CODES as readonly string[]).includes(value);
}

export function createAiClient(options: AiClientOptions = {}): AiClient {
	const base = options.baseUrl ?? API_BASE;
	const openWindow =
		options.openWindow ?? ((url: string, target: string) => window.open(url, target));
	const doFetch = (input: string, init?: RequestInit) =>
		(options.fetch ?? globalThis.fetch)(input, init);

	async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
		let response: Response;
		try {
			response = await doFetch(`${base}${path}`, {
				...init,
				credentials: 'omit',
				cache: 'no-store',
				signal: controller.signal,
				headers: { Accept: 'application/json', ...init.headers }
			});
		} catch {
			throw new AiError(navigator.onLine === false ? 'offline' : 'unavailable');
		} finally {
			clearTimeout(timer);
		}
		let body: unknown;
		try {
			body = await response.json();
		} catch {
			body = undefined;
		}
		if (response.ok && body && typeof body === 'object') return body as T;
		const error = (body ?? {}) as ErrorBody;
		if (response.status === 401) throw new AiError('invalid');
		if (isErrorCode(error.error)) throw new AiError(error.error, error.quota);
		// No JSON from our API: nginx answered because the AI server is down or restarting.
		throw new AiError(response.status >= 500 ? 'unavailable' : 'failed');
	}

	async function deviceToken(): Promise<string> {
		const existing = readToken();
		if (existing) return existing;
		const { token } = await request<{ token: string }>('/device', { method: 'POST' });
		writeToken(token);
		return token;
	}

	return {
		async quota() {
			const token = readToken();
			return request<AiQuota>('/quota', token ? { headers: { 'X-Device-Token': token } } : {});
		},
		async run(task, cv) {
			const body = JSON.stringify({ task, profile: aiProfileFromCv(cv) });
			const send = async () =>
				request<{ result: AiResult; quota: AiQuota }>('/run', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json', 'X-Device-Token': await deviceToken() },
					body
				});
			try {
				return await send();
			} catch (error) {
				// Token rejected (server secret rotated, or tampered): get a fresh one and retry once.
				if (error instanceof AiError && error.code === 'invalid' && readToken()) {
					writeToken(undefined);
					return send();
				}
				throw error;
			}
		},
		async openRewardAd(locale) {
			// Synchronously, inside the user's click: an empty tab is never blocked.
			const tab = openWindow('about:blank', '_blank');
			if (!tab) throw new AiError('busy');
			// The ad page must not be able to reach back into this tab.
			tab.opener = null;
			try {
				const { adUrl } = await request<AiRewardStart>('/reward/start', {
					method: 'POST',
					headers: { 'X-Device-Token': await deviceToken() }
				});
				const url = new URL(adUrl);
				if (url.protocol !== 'https:' && url.hostname !== 'localhost') throw new AiError('failed');
				url.searchParams.set('lang', locale);
				tab.location.replace(url.href);
			} catch (error) {
				tab.close();
				throw error instanceof AiError ? error : new AiError('failed');
			}
		}
	};
}

/** Shared client for the app. */
export const aiClient: AiClient = createAiClient();
