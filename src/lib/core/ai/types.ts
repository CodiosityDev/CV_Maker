/**
 * AI assist contract shared by the browser (core/ai) and the API server (server/).
 *
 * Privacy (PROJECT_SPEC §12): only the CV CONTENT needed for the task is sent — never name, email,
 * phone, city, links or photo — and only after the user presses an AI button and agrees.
 */
import type { ExperienceType, Locale } from '../schema/types';

/** localStorage key of the anonymous AI device token (cleared by storage.wipeAll). */
export const AI_DEVICE_STORAGE_KEY = 'cvmaker.aiDevice';

/** Tasks that work on a CV made in the app (`aiClient.run`). */
export const AI_TASKS = ['headline', 'summary', 'skills'] as const;
export type AiTask = (typeof AI_TASKS)[number];

/** The part of a CV the AI may see. Built by `aiProfileFromCv`; validated again on the server. */
export interface AiProfile {
	/** Language to write in (the CV's language). */
	locale: Locale;
	targetRole: string;
	education: { degree: string; major: string; institution: string; gpa: string }[];
	experience: { type: ExperienceType; role: string; company: string; bullets: string[] }[];
	organizations: { role: string; name: string; bullets: string[] }[];
	projects: { name: string; role: string; bullets: string[] }[];
	skills: { hard: string[]; tools: string[]; soft: string[] };
	certifications: string[];
	/** Current summary, so the AI can improve it instead of starting over. */
	summary: string;
}

/**
 * Input of the CV review (`aiClient.review`, the "Cek ATS" page): CV TEXT with contact details
 * removed (`redactCvText`), from an uploaded file or a CV made in the app.
 */
export interface AiReviewInput {
	locale: Locale;
	/** Position the user is aiming for ('' when unknown). */
	targetRole: string;
	cvText: string;
	/** Pasted job post ('' when none): enables missing-keyword suggestions. */
	jobPost: string;
}

export type AiRequest =
	{ task: AiTask; profile: AiProfile } | { task: 'review'; review: AiReviewInput };

export interface HeadlineResult {
	task: 'headline';
	/** 1–3 options; the user picks one. */
	headlines: string[];
}
export interface SummaryResult {
	task: 'summary';
	summary: string;
}
export interface SkillsResult {
	task: 'skills';
	/** Skills NOT already in the CV, ready to show as one-tap chips. */
	hard: string[];
	tools: string[];
	soft: string[];
}
export interface ReviewResult {
	task: 'review';
	/** 2–3 sentences: the overall impression. */
	overview: string;
	/** Up to AI_REVIEW_LIMITS.strengths. */
	strengths: string[];
	/** Most important first; up to AI_REVIEW_LIMITS.improvements. */
	improvements: { title: string; detail: string }[];
	/** Weak lines of the CV (`before`, found in the CV text) rewritten; numbers never invented. */
	rewrites: { before: string; after: string }[];
	/** Skills/keywords from the job post the CV lacks (empty without a job post). */
	missingKeywords: string[];
}
export type AiResult = HeadlineResult | SummaryResult | SkillsResult | ReviewResult;

export interface AiQuota {
	/** Uses per device today: the free uses plus extra uses earned by watching ads. */
	limit: number;
	remaining: number;
	/** ISO time of the next reset (00:00 WIB). */
	resetsAt: string;
	/**
	 * Watch-an-ad-for-one-more-use. Absent when ads are switched off on the server; otherwise
	 * how many ads this device may still watch today (0 → hide the button).
	 */
	rewards?: { limit: number; remaining: number };
}

/** Answer of `POST /api/ai/reward/start`: open `adUrl` in a new tab (top-level, not an iframe). */
export interface AiRewardStart {
	adUrl: string;
}

/**
 * Why an AI call failed; the UI shows `t(aiErrorMessageKey(code))`.
 * quota: daily uses spent · busy: too many requests, wait a moment · offline: no connection ·
 * unavailable: AI switched off / overloaded · invalid: the request was rejected · failed: anything else.
 */
export const AI_ERROR_CODES = [
	'quota',
	'busy',
	'offline',
	'unavailable',
	'invalid',
	'failed'
] as const;
export type AiErrorCode = (typeof AI_ERROR_CODES)[number];

/** Limits of the profile sent to the AI (kept small: cost, speed, privacy). */
export const AI_PROFILE_LIMITS = {
	education: 3,
	experience: 5,
	organizations: 4,
	projects: 4,
	bulletsPerItem: 5,
	skillsPerGroup: 15,
	certifications: 5
} as const;

/** Max suggestions per skills group returned by the server. */
export const AI_SKILL_SUGGESTIONS = { hard: 6, tools: 6, soft: 4 } as const;

/** Limits of the CV review request and answer. */
export const AI_REVIEW_LIMITS = {
	cvText: 8000,
	jobPost: 4000,
	strengths: 3,
	improvements: 5,
	rewrites: 3,
	missingKeywords: 8
} as const;
