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
 *
 * CV review ("Cek ATS" page, also 1 of today's uses):
 *   const input = aiReviewInputFromScan(extracted, jobPost, targetRole);   // a CV file (core/scan)
 *   const input = aiReviewInputFromCv(cv, jobPost);                        // a CV made in the app
 *   const { result } = await aiClient.review(input);   // result.task === 'review'
 *   Show `input.cvText` in the consent dialog ("this is what is sent") — contact details are removed.
 */
import { incognito } from '../storage/index';
import { LIMITS } from '../schema/limits';
import type { CVDocument, Locale } from '../schema/types';
import type { ExtractedCv } from '../scan/types';
import { redactContacts as redactContactsOnly, redactCvText } from './redact';
import {
	AI_DEVICE_STORAGE_KEY,
	AI_ERROR_CODES,
	AI_PROFILE_LIMITS,
	AI_REVIEW_LIMITS,
	type AiErrorCode,
	type AiProfile,
	type AiQuota,
	type AiResult,
	type AiReviewInput,
	type ReviewResult,
	type ConvertResult,
	type AiJobStarted,
	type AiRewardStart,
	type AiTask
} from './types';

export * from './types';
export { redactContacts, redactCvText } from './redact';

const API_BASE = '/api/ai';
const REQUEST_TIMEOUT_MS = 70_000;
/** CV conversion: how often and how long the browser asks for the background result. */
const JOB_POLL_MS = 2_000;
const JOB_MAX_WAIT_MS = 180_000;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
	// Headline and skills work from the target role alone: the headline field is on step 2,
	// before any education/experience exists. A summary needs real background to write about.
	if (task === 'summary') return Boolean(p.targetRole) && background;
	return Boolean(p.targetRole) || background;
}

/** Review input for a CV FILE (see core/scan). Contact details are removed. */
export function aiReviewInputFromScan(
	cv: Pick<ExtractedCv, 'text'>,
	jobPost = '',
	targetRole = '',
	locale?: Locale
): AiReviewInput {
	const cvText = redactCvText(cv.text, AI_REVIEW_LIMITS.cvText);
	return {
		locale: locale ?? guessLocale(cvText),
		targetRole: clip(targetRole, LIMITS.title),
		cvText,
		jobPost: jobPost.trim().slice(0, AI_REVIEW_LIMITS.jobPost)
	};
}

/** Review input for a CV made in the app: built from `aiProfileFromCv` (never contact details). */
export function aiReviewInputFromCv(cv: CVDocument, jobPost = ''): AiReviewInput {
	const p = aiProfileFromCv(cv);
	const lines: string[] = [];
	const section = (title: string, body: string[]) => {
		if (body.length) lines.push(title, ...body, '');
	};
	section('SUMMARY', p.summary ? [p.summary] : []);
	section(
		'EDUCATION',
		p.education.map((e) =>
			[e.degree, e.major, e.institution, e.gpa && `GPA ${e.gpa}`].filter(Boolean).join(', ')
		)
	);
	const items = (list: { title: string; bullets: string[] }[]) =>
		list.flatMap((item) => [item.title, ...item.bullets.map((b) => `• ${b}`)]);
	section(
		'EXPERIENCE',
		items(
			p.experience.map((e) => ({
				title: [e.role, e.company].filter(Boolean).join(' — '),
				bullets: e.bullets
			}))
		)
	);
	section(
		'ORGANIZATIONS',
		items(
			p.organizations.map((o) => ({
				title: [o.role, o.name].filter(Boolean).join(' — '),
				bullets: o.bullets
			}))
		)
	);
	section(
		'PROJECTS',
		items(
			p.projects.map((x) => ({
				title: [x.name, x.role].filter(Boolean).join(' — '),
				bullets: x.bullets
			}))
		)
	);
	section(
		'SKILLS',
		[p.skills.hard, p.skills.tools, p.skills.soft].filter((g) => g.length).map((g) => g.join(', '))
	);
	section('CERTIFICATIONS', p.certifications);
	// Not in the AI profile (headline/summary tasks don't need them), but part of a review.
	const clipped = (value: string | undefined) => clip(value, LIMITS.title);
	section(
		'LANGUAGES',
		cv.languages
			.map((l) => [clipped(l.name), l.level, clipped(l.score)].filter(Boolean).join(', '))
			.filter(Boolean)
			.slice(0, 10)
	);
	section(
		'AWARDS',
		cv.awards
			.map((a) => [clipped(a.title), clipped(a.issuer)].filter(Boolean).join(' — '))
			.filter(Boolean)
			.slice(0, 10)
	);
	for (const custom of cv.custom.slice(0, 5)) {
		section(
			clipped(custom.title).toUpperCase() || 'OTHER',
			custom.items
				.slice(0, 10)
				.flatMap((item) => [
					[clipped(item.title), clipped(item.subtitle)].filter(Boolean).join(' — '),
					...clipList(item.bullets, AI_PROFILE_LIMITS.bulletsPerItem, LIMITS.bullet).map(
						(b) => `• ${b}`
					)
				])
				.filter(Boolean)
		);
	}
	// Only contact details and a headline = nothing to review: keep the text empty (button off).
	const headline = clip(cv.personal.headline, LIMITS.headline);
	if (lines.length && headline) lines.unshift('HEADLINE', headline, '');
	return {
		locale: p.locale,
		targetRole: p.targetRole,
		cvText: redactContactsOnly(lines.join('\n').trim()).slice(0, AI_REVIEW_LIMITS.cvText),
		jobPost: jobPost.trim().slice(0, AI_REVIEW_LIMITS.jobPost)
	};
}

function guessLocale(text: string): Locale {
	const words = text.toLowerCase().split(/[^a-z]+/);
	const id = words.filter((w) =>
		['dan', 'yang', 'dengan', 'untuk', 'dalam', 'sebagai'].includes(w)
	).length;
	const en = words.filter((w) => ['and', 'the', 'with', 'for', 'of', 'as'].includes(w)).length;
	return en > id ? 'en' : 'id';
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
	/** CV review for the "Cek ATS" page (uses 1 of today's quota on success only). Throws AiError. */
	review(input: AiReviewInput): Promise<{ result: ReviewResult; quota: AiQuota }>;
	/**
	 * "Ubah jadi CV ATS" (uses 1 of today's quota on success only). Runs as a background job on the
	 * server; this promise resolves when it is done (usually 15–40 s). `onStarted` fires once the
	 * use is counted (show the new quota). Throws AiError. Prefer `convertWithAi` (core/convert).
	 */
	convert(
		input: AiReviewInput,
		options?: { onStarted?: (quota: AiQuota) => void; pollMs?: number; maxWaitMs?: number }
	): Promise<{ result: ConvertResult; quota: AiQuota }>;
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

	async function runTask<T = { result: AiResult; quota: AiQuota }>(body: string): Promise<T> {
		const send = async () =>
			request<T>('/run', {
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
	}

	/** Same input rules for review and convert: contact details removed again, lengths capped. */
	function prepareText(input: AiReviewInput): AiReviewInput {
		const text: AiReviewInput = {
			locale: input.locale,
			targetRole: clip(input.targetRole, LIMITS.title),
			// Redacted again here: callers may build the input by hand.
			cvText: redactCvText(input.cvText, AI_REVIEW_LIMITS.cvText),
			jobPost: input.jobPost.trim().slice(0, AI_REVIEW_LIMITS.jobPost)
		};
		if (!text.cvText) throw new AiError('invalid');
		return text;
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
			return runTask(JSON.stringify({ task, profile: aiProfileFromCv(cv) }));
		},
		async review(input) {
			const review = prepareText(input);
			const answer = await runTask(JSON.stringify({ task: 'review', review }));
			if (answer.result.task !== 'review') throw new AiError('failed');
			return { result: answer.result, quota: answer.quota };
		},
		async convert(input, options = {}) {
			const convert = prepareText(input);
			const { job, quota } = await runTask<AiJobStarted>(
				JSON.stringify({ task: 'convert', convert })
			);
			options.onStarted?.(quota);
			const deadline = Date.now() + (options.maxWaitMs ?? JOB_MAX_WAIT_MS);
			let transportErrors = 0;
			for (;;) {
				await sleep(options.pollMs ?? JOB_POLL_MS);
				let status: { status?: string; result?: AiResult; quota?: AiQuota };
				try {
					status = await request(`/job?id=${encodeURIComponent(job)}`, {
						headers: { 'X-Device-Token': readToken() ?? '' }
					});
					transportErrors = 0;
				} catch (error) {
					// A dropped connection (no answer from our API) is retried; a real job failure is not.
					const transport =
						error instanceof AiError &&
						error.quota === undefined &&
						(error.code === 'offline' || error.code === 'unavailable');
					if (!transport || ++transportErrors > 5 || Date.now() > deadline) throw error;
					continue;
				}
				if (status.status === 'done' && status.result?.task === 'convert' && status.quota)
					return { result: status.result, quota: status.quota };
				if (status.status !== 'pending') throw new AiError('failed');
				if (Date.now() > deadline) throw new AiError('unavailable');
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
