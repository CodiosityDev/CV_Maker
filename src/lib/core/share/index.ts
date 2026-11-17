/**
 * Sharing a CV by link, like Google Drive (PROJECT_SPEC §12 "Berbagi CV lewat link").
 *
 * The USER decides who can see it (`private` default / `link` / `public`) and what is shown
 * (phone, email, address, photo: all off by default). Only logged-in users can share.
 * Shared by the browser and the server: the server validates every upload with the SAME schema
 * and strips hidden fields again (never trust the client).
 *
 *   const snapshot = buildShareSnapshot(cv, settings);     // what leaves the device
 *   await shareClient.save(cv.id, { access, settings, snapshot, photo, ... });
 */
import * as v from 'valibot';
import { loadCvDocument } from '../schema/migrations';
import type { CVDocument } from '../schema/types';

export const SHARE_ACCESS = ['private', 'link', 'public'] as const;
export type ShareAccess = (typeof SHARE_ACCESS)[number];

/** What the shared page shows. Every toggle is the user's choice; defaults are the safe ones. */
export interface ShareSettings {
	showPhone: boolean;
	showEmail: boolean;
	/** City + province. */
	showAddress: boolean;
	/** Creative CVs only (ATS templates never show a photo). */
	showPhoto: boolean;
	/** "Unduh PDF" button on the shared page. */
	allowDownload: boolean;
	/** Re-upload automatically after each change in the editor (like Drive); off = snapshot. */
	autoUpdate: boolean;
}

export const DEFAULT_SHARE_SETTINGS: Readonly<ShareSettings> = Object.freeze({
	showPhone: false,
	showEmail: false,
	showAddress: false,
	showPhoto: false,
	allowDownload: true,
	autoUpdate: false
});

/**
 * Shared (published) CVs per account (owner decision 2026-11-17). Enforced by the server, so it
 * cannot be bypassed from the browser. Creating CVs locally is NOT limited.
 */
export const MAX_SHARED_CVS = 3;

export const SHARE_LIMITS = {
	slugMin: 3,
	slugMax: 40,
	/** Random slugs: 12 base32 chars = 60 bits, cannot be guessed. */
	randomSlugLength: 12,
	passwordMin: 4,
	passwordMax: 128,
	/** Processed photos are ≤ 300 KB; base64 adds a third. */
	photoDataUrl: 420_000,
	/** Latest allowed expiry, from now. */
	maxExpiryDays: 366,
	/** Body limit for an upload (CV JSON + photo). */
	requestBytes: 1_000_000
} as const;

export const REPORT_REASONS = [
	'spam',
	'impersonation',
	'offensive',
	'personal-data',
	'other'
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

/** Paths of the site and words that would confuse visitors. Custom slugs may not use them. */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
	'admin',
	'akun',
	'api',
	'app',
	'buat',
	'cek-ats',
	'codiosity',
	'cv',
	'cvmaker',
	'faq',
	'help',
	'login',
	'logout',
	'masuk',
	'privasi',
	'register',
	'root',
	'support',
	'surat',
	'tentang',
	'u'
]);

const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

/** True for a custom slug the user may pick: a–z, 0–9 and inner '-', 3–40 chars, not reserved. */
export function isValidCustomSlug(slug: string): boolean {
	return (
		slug.length >= SHARE_LIMITS.slugMin &&
		slug.length <= SHARE_LIMITS.slugMax &&
		SLUG_PATTERN.test(slug) &&
		!slug.includes('--') &&
		!RESERVED_SLUGS.has(slug)
	);
}

/** Any slug that may appear in a URL (random or custom). Used to reject junk before a lookup. */
export function isSlugShaped(slug: string): boolean {
	return (
		slug.length >= SHARE_LIMITS.slugMin &&
		slug.length <= SHARE_LIMITS.slugMax &&
		SLUG_PATTERN.test(slug)
	);
}

/**
 * The CV as it leaves the device: hidden contact fields emptied, cover letters and the local
 * photo reference removed (the photo travels separately, only when `showPhoto`). Pure.
 */
export function buildShareSnapshot(cv: CVDocument, settings: ShareSettings): CVDocument {
	const copy = structuredClone(cv);
	delete copy.letters;
	const personal = copy.personal;
	delete personal.photoAssetId;
	if (!settings.showEmail) personal.email = '';
	if (!settings.showPhone) personal.phone = '';
	if (!settings.showAddress) {
		personal.city = '';
		delete personal.province;
	}
	return copy;
}

/** The owner's view of one shared CV (GET /api/shares). */
export interface ShareInfo {
	cvId: string;
	slug: string;
	access: ShareAccess;
	/** `public` only: may appear in search engines. */
	discoverable: boolean;
	settings: ShareSettings;
	hasPassword: boolean;
	/** ISO date-time, or null = never. */
	expiresAt: string | null;
	viewCount: number;
	updatedAt: string;
}

/** PUT /api/shares/:cvId */
export interface ShareSaveRequest {
	access: ShareAccess;
	discoverable: boolean;
	settings: ShareSettings;
	/** Custom slug; absent = keep the current one (a random one is made the first time). */
	slug?: string;
	/** string = set, null = remove, absent = keep. */
	password?: string | null;
	/** ISO date-time, null = never, absent = keep. */
	expiresAt?: string | null;
	snapshot: CVDocument;
	/** data:image/…;base64 URL (Creative + showPhoto), or null. */
	photo: string | null;
}

/** GET/POST /api/s/:slug — what a visitor receives. */
export interface PublicShare {
	snapshot: CVDocument;
	photo: string | null;
	allowDownload: boolean;
	discoverable: boolean;
}

const settingsSchema = v.strictObject({
	showPhone: v.boolean(),
	showEmail: v.boolean(),
	showAddress: v.boolean(),
	showPhoto: v.boolean(),
	allowDownload: v.boolean(),
	autoUpdate: v.boolean()
});

const PHOTO_PATTERN = /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

const photoSchema = v.nullable(
	v.pipe(v.string(), v.maxLength(SHARE_LIMITS.photoDataUrl), v.regex(PHOTO_PATTERN))
);

const saveSchema = v.strictObject({
	access: v.picklist(SHARE_ACCESS),
	discoverable: v.boolean(),
	settings: settingsSchema,
	slug: v.optional(v.pipe(v.string(), v.check(isValidCustomSlug))),
	password: v.optional(
		v.nullable(
			v.pipe(
				v.string(),
				v.minLength(SHARE_LIMITS.passwordMin),
				v.maxLength(SHARE_LIMITS.passwordMax)
			)
		)
	),
	expiresAt: v.optional(v.nullable(v.pipe(v.string(), v.isoTimestamp()))),
	snapshot: v.unknown(),
	photo: photoSchema
});

/** Parses settings coming from storage or the network (unknown keys rejected). */
export function parseShareSettings(raw: unknown): ShareSettings | null {
	const result = v.safeParse(settingsSchema, raw);
	return result.success ? result.output : null;
}

/**
 * Validates an upload. The snapshot goes through the normal CV loader (schema + limits) and is
 * stripped again with its own settings, so a modified client cannot publish hidden fields.
 * `now` checks the expiry: it must be in the future and within `maxExpiryDays`.
 */
export function parseShareSaveRequest(
	raw: unknown,
	now: number = Date.now()
): ShareSaveRequest | null {
	const result = v.safeParse(saveSchema, raw);
	if (!result.success) return null;
	const input = result.output;
	const loaded = loadCvDocument(input.snapshot);
	if (!loaded.ok) return null;
	if (input.expiresAt) {
		const at = Date.parse(input.expiresAt);
		if (!(at > now) || at > now + SHARE_LIMITS.maxExpiryDays * 86_400_000) return null;
	}
	const discoverable = input.access === 'public' && input.discoverable;
	const photo = loaded.cv.kind === 'creative' && input.settings.showPhoto ? input.photo : null;
	return {
		access: input.access,
		discoverable,
		settings: input.settings,
		...(input.slug !== undefined ? { slug: input.slug } : {}),
		...(input.password !== undefined ? { password: input.password } : {}),
		...(input.expiresAt !== undefined ? { expiresAt: input.expiresAt } : {}),
		snapshot: buildShareSnapshot(loaded.cv, input.settings),
		photo
	};
}

/** Parses a visitor's response from the server. */
export function parsePublicShare(raw: unknown): PublicShare | null {
	if (typeof raw !== 'object' || raw === null) return null;
	const data = raw as Record<string, unknown>;
	const loaded = loadCvDocument(data.snapshot);
	const photo = v.safeParse(photoSchema, data.photo ?? null);
	if (!loaded.ok || !photo.success) return null;
	return {
		snapshot: loaded.cv,
		photo: photo.output,
		allowDownload: data.allowDownload === true,
		discoverable: data.discoverable === true
	};
}

/** The address of a shared CV. */
export function shareUrl(origin: string, slug: string): string {
	return `${origin}/u/${slug}`;
}
