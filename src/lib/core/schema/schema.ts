/**
 * Valibot schema that NORMALIZES untrusted CV data (from IndexedDB or an imported backup).
 *
 * Philosophy: be lenient with content, strict with structure.
 * - Text that is too long is truncated, never rejected (users must not lose a CV over one long bullet).
 * - Wrong-typed optional fields fall back to safe defaults.
 * - Unknown keys are dropped (valibot `object` strips them), so `__proto__` & friends never survive.
 * - Values that reach CSS or URLs (accent color, font id, template id) are pattern-checked.
 * - Only `schemaVersion` and `id` are strict: without them the document is rejected.
 */
import * as v from 'valibot';
import {
	BUILTIN_SECTION_KEYS,
	DESIGN_SPACINGS,
	EXPERIENCE_TYPES,
	LANGUAGE_LEVELS,
	LETTER_ALIGNS,
	LETTER_ATTACHMENTS,
	LETTER_FONTS,
	LETTER_HIGHLIGHT_SECTIONS,
	LETTER_LINE_HEIGHTS,
	LETTER_SIZES,
	LETTER_SOURCES,
	LETTER_TEXT_KEYS,
	PHOTO_SHAPES,
	PHOTO_SIZES,
	SIDE_POSITIONS,
	type CVDesign,
	type CVDocument,
	type CoverLetter,
	type RichRun,
	type CustomSectionKey,
	type SectionKey
} from './types';
import {
	CUSTOM_SECTION_KEY_PATTERN,
	HEX_COLOR_PATTERN,
	ID_PATTERN,
	SLUG_PATTERN,
	YEAR_MONTH_PATTERN,
	newId
} from './ids';
import { DESIGN_LIMITS, FONT_SCALE, FOREIGN_LIMITS, LETTER_LIMITS, LIMITS } from './limits';
import { DEFAULT_SECTION_ORDER, DEFAULT_TEMPLATE_ID } from './defaults';

// ---------------------------------------------------------------------------
// Primitive helpers
// ---------------------------------------------------------------------------

// Control characters (keeps \n and \t) and the noncharacters U+FFFE/U+FFFF: invalid in DOCX/XML.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F￾￿]/g;
/** Half of a surrogate pair (emoji) without its other half — also invalid in XML. */
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

/** Removes control characters (keeps \n and \t) and truncates without leaving half an emoji. */
export function cleanText(value: string, max: number): string {
	return value.replace(CONTROL_CHARS, '').slice(0, max).replace(LONE_SURROGATE, '');
}

/** Required text: non-strings become '', long text is truncated. */
const text = (max: number) =>
	v.pipe(
		v.fallback(v.string(), ''),
		v.transform((s) => cleanText(s, max))
	);

/** Optional text: non-strings and empty strings become undefined. */
const optText = (max: number) =>
	v.pipe(
		v.fallback(v.optional(v.string()), undefined),
		v.transform((s) => {
			if (s === undefined) return undefined;
			const cleaned = cleanText(s, max);
			return cleaned === '' ? undefined : cleaned;
		})
	);

/** Array of strings, each cleaned/truncated; non-strings dropped; list truncated. */
const textList = (maxItems: number, maxLength: number) =>
	v.pipe(
		v.fallback(v.array(v.unknown()), []),
		v.transform((items) =>
			items
				.filter((item): item is string => typeof item === 'string')
				.map((item) => cleanText(item, maxLength))
				.slice(0, maxItems)
		)
	);

/** Array of objects: invalid entries are skipped (not the whole list), list truncated. */
function listOf<TSchema extends v.GenericSchema>(schema: TSchema, maxItems: number) {
	return v.pipe(
		v.fallback(v.array(v.unknown()), []),
		v.transform((items) => {
			const out: v.InferOutput<TSchema>[] = [];
			for (const item of items) {
				const result = v.safeParse(schema, item);
				if (result.success) out.push(result.output);
				if (out.length >= maxItems) break;
			}
			return out;
		})
	);
}

const itemId = v.fallback(v.pipe(v.string(), v.regex(ID_PATTERN)), () => newId());

const yearMonth = v.fallback(
	v.optional(v.pipe(v.string(), v.regex(YEAR_MONTH_PATTERN))),
	undefined
);

const dateRange = v.fallback(
	v.object({
		start: yearMonth,
		end: yearMonth,
		current: v.fallback(v.boolean(), false)
	}),
	{ current: false }
);

const optDateRange = v.fallback(v.optional(dateRange), undefined);

const isoTimestamp = v.fallback(v.pipe(v.string(), v.isoTimestamp()), () =>
	new Date().toISOString()
);

const builtinSectionKey = v.picklist(BUILTIN_SECTION_KEYS);
const customSectionKey = v.pipe(v.string(), v.regex(CUSTOM_SECTION_KEY_PATTERN));

function isSectionKey(value: unknown): value is SectionKey {
	return (
		v.is(builtinSectionKey, value) || (typeof value === 'string' && v.is(customSectionKey, value))
	);
}

// ---------------------------------------------------------------------------
// Entities
// ---------------------------------------------------------------------------

const linkSchema = v.object({
	id: itemId,
	label: text(LIMITS.short),
	url: text(LIMITS.url)
});

const personalSchema = v.fallback(
	v.object({
		fullName: text(LIMITS.fullName),
		headline: text(LIMITS.headline),
		email: text(LIMITS.email),
		phone: text(LIMITS.short),
		city: text(LIMITS.short),
		province: optText(LIMITS.short),
		links: listOf(linkSchema, LIMITS.links),
		photoAssetId: v.fallback(v.optional(v.pipe(v.string(), v.regex(ID_PATTERN))), undefined)
	}),
	{ fullName: '', headline: '', email: '', phone: '', city: '', links: [] }
);

const bullets = textList(LIMITS.bulletsPerItem, LIMITS.bullet);

const educationSchema = v.object({
	id: itemId,
	institution: text(LIMITS.title),
	degree: text(LIMITS.short),
	major: text(LIMITS.title),
	gpa: optText(LIMITS.gpa),
	gpaScale: optText(LIMITS.gpa),
	dates: dateRange,
	thesisTitle: optText(LIMITS.description),
	highlights: bullets
});

const experienceSchema = v.object({
	id: itemId,
	type: v.fallback(v.picklist(EXPERIENCE_TYPES), 'internship'),
	role: text(LIMITS.title),
	company: text(LIMITS.title),
	location: optText(LIMITS.short),
	dates: dateRange,
	bullets
});

const organizationSchema = v.object({
	id: itemId,
	name: text(LIMITS.title),
	role: text(LIMITS.title),
	dates: dateRange,
	bullets
});

const projectSchema = v.object({
	id: itemId,
	name: text(LIMITS.title),
	role: optText(LIMITS.title),
	url: optText(LIMITS.url),
	dates: optDateRange,
	bullets
});

const skillsSchema = v.fallback(
	v.object({
		hard: textList(LIMITS.skillsPerGroup, LIMITS.short),
		soft: textList(LIMITS.skillsPerGroup, LIMITS.short),
		tools: textList(LIMITS.skillsPerGroup, LIMITS.short)
	}),
	{ hard: [], soft: [], tools: [] }
);

const languageSchema = v.object({
	id: itemId,
	name: text(LIMITS.short),
	level: v.fallback(v.picklist(LANGUAGE_LEVELS), 'intermediate'),
	score: optText(LIMITS.short)
});

const certificationSchema = v.object({
	id: itemId,
	name: text(LIMITS.title),
	issuer: text(LIMITS.title),
	date: yearMonth,
	credentialUrl: optText(LIMITS.url)
});

const awardSchema = v.object({
	id: itemId,
	title: text(LIMITS.title),
	issuer: text(LIMITS.title),
	date: yearMonth,
	description: optText(LIMITS.description)
});

const customItemSchema = v.object({
	id: itemId,
	title: text(LIMITS.title),
	subtitle: optText(LIMITS.title),
	dates: optDateRange,
	bullets
});

const customSectionSchema = v.object({
	key: v.pipe(
		customSectionKey,
		v.transform((k) => k as CustomSectionKey)
	),
	title: text(LIMITS.title),
	items: listOf(customItemSchema, LIMITS.itemsPerSection)
});

const themeSchema = v.fallback(
	v.object({
		accentColor: v.fallback(v.optional(v.pipe(v.string(), v.regex(HEX_COLOR_PATTERN))), undefined),
		fontId: v.fallback(v.pipe(v.string(), v.regex(SLUG_PATTERN)), 'default'),
		fontScale: v.pipe(
			v.fallback(v.number(), FONT_SCALE.default),
			v.transform((n) =>
				Number.isFinite(n) ? Math.min(FONT_SCALE.max, Math.max(FONT_SCALE.min, n)) : 1
			)
		)
	}),
	{ fontId: 'default', fontScale: FONT_SCALE.default }
);

const statusSchema = v.fallback(
	v.object({
		wizardCompleted: v.fallback(v.boolean(), false),
		wizardStep: v.pipe(
			v.fallback(v.number(), 0),
			v.transform((n) => (Number.isInteger(n) ? Math.min(50, Math.max(0, n)) : 0))
		)
	}),
	{ wizardCompleted: false, wizardStep: 0 }
);

const layoutSchema = v.fallback(
	v.object({
		order: v.fallback(v.array(v.unknown()), []),
		hidden: v.fallback(v.array(v.unknown()), []),
		customTitles: v.fallback(v.record(v.string(), v.unknown()), {})
	}),
	{ order: [], hidden: [], customTitles: {} }
);

/** Creative design: each bad field falls back to "template default" (undefined), never an error. */
const optPick = <T extends readonly [string, ...string[]]>(options: T) =>
	v.fallback(v.optional(v.picklist(options)), undefined);
const designSchema = v.fallback(
	v.optional(
		v.object({
			side: v.fallback(v.optional(v.array(v.unknown())), undefined),
			sidePosition: optPick(SIDE_POSITIONS),
			sideWidth: v.pipe(
				v.fallback(v.optional(v.number()), undefined),
				v.transform((n) =>
					n === undefined || !Number.isFinite(n)
						? undefined
						: Math.round(
								Math.min(DESIGN_LIMITS.sideWidth.max, Math.max(DESIGN_LIMITS.sideWidth.min, n))
							)
				)
			),
			spacing: optPick(DESIGN_SPACINGS),
			photoShape: optPick(PHOTO_SHAPES),
			photoSize: optPick(PHOTO_SIZES)
		})
	),
	undefined
);

// ---------------------------------------------------------------------------
// Foreign terms & cover letters
// ---------------------------------------------------------------------------

/** Lowercase, single-spaced, unique terms. */
const termList = v.pipe(
	textList(FOREIGN_LIMITS.terms * 2, FOREIGN_LIMITS.term),
	v.transform((items) =>
		[
			...new Set(
				items.map((item) => item.toLowerCase().replace(/\s+/g, ' ').trim()).filter(Boolean)
			)
		].slice(0, FOREIGN_LIMITS.terms)
	)
);

const foreignSchema = v.fallback(
	v.optional(
		v.object({
			enabled: v.fallback(v.boolean(), true),
			extra: termList,
			ignore: termList
		})
	),
	undefined
);

/**
 * Formatted text: cleaned, empty pieces dropped, neighbours with the same marks joined, total length
 * capped at `LETTER_LIMITS.paragraph`. Only `true` survives for bold/underline.
 */
export function normalizeRuns(input: unknown): RichRun[] {
	const out: RichRun[] = [];
	let length = 0;
	const items = Array.isArray(input) ? input.slice(0, LETTER_LIMITS.runs * 2) : [];
	for (const item of items) {
		if (!item || typeof item !== 'object') continue;
		const raw = item as Record<string, unknown>;
		if (typeof raw.text !== 'string') continue;
		const text = cleanText(raw.text, LETTER_LIMITS.paragraph - length);
		if (!text) continue;
		const run: RichRun = { text };
		if (raw.bold === true) run.bold = true;
		if (typeof raw.italic === 'boolean') run.italic = raw.italic;
		if (raw.underline === true) run.underline = true;
		const last = out[out.length - 1];
		if (
			last &&
			last.bold === run.bold &&
			last.italic === run.italic &&
			last.underline === run.underline
		)
			last.text += text;
		else if (out.length < LETTER_LIMITS.runs) out.push(run);
		else break;
		length += text.length;
		if (length >= LETTER_LIMITS.paragraph) break;
	}
	return out;
}

const DATE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const dateString = v.fallback(v.pipe(v.string(), v.regex(DATE_PATTERN)), () =>
	new Date().toISOString().slice(0, 10)
);

const highlightSchema = v.object({
	section: v.picklist(LETTER_HIGHLIGHT_SECTIONS),
	id: v.pipe(v.string(), v.regex(ID_PATTERN))
});

const letterSchema = v.object({
	id: itemId,
	locale: v.fallback(v.picklist(['id', 'en'] as const), 'id'),
	position: text(LETTER_LIMITS.position),
	company: text(LETTER_LIMITS.company),
	recipient: text(LETTER_LIMITS.recipient),
	companyAddress: v.pipe(
		text(LETTER_LIMITS.companyAddress),
		v.transform((s) => s.split('\n').slice(0, LETTER_LIMITS.addressLines).join('\n'))
	),
	source: v.fallback(v.optional(v.picklist(LETTER_SOURCES)), undefined),
	sourceDetail: text(LETTER_LIMITS.sourceDetail),
	place: text(LETTER_LIMITS.place),
	date: dateString,
	highlights: v.pipe(
		v.fallback(v.array(v.unknown()), []),
		v.transform((items) => {
			const out: CoverLetter['highlights'] = [];
			for (const item of items) {
				const parsed = v.safeParse(highlightSchema, item);
				if (!parsed.success) continue;
				const ref = parsed.output;
				if (!out.some((h) => h.section === ref.section && h.id === ref.id)) out.push(ref);
				if (out.length >= LETTER_LIMITS.highlights) break;
			}
			return out;
		})
	),
	motivation: text(LETTER_LIMITS.motivation),
	availability: v.fallback(
		v.object({
			immediate: v.fallback(v.boolean(), false),
			relocate: v.fallback(v.boolean(), false)
		}),
		{ immediate: false, relocate: false }
	),
	includeIdentity: v.fallback(v.boolean(), false),
	identity: v.fallback(
		v.object({
			birthPlace: text(LETTER_LIMITS.birthPlace),
			birthDate: v.fallback(v.optional(v.pipe(v.string(), v.regex(DATE_PATTERN))), undefined),
			address: text(LETTER_LIMITS.address)
		}),
		{ birthPlace: '', address: '' }
	),
	attachments: v.pipe(
		v.fallback(v.array(v.unknown()), []),
		v.transform((items) => LETTER_ATTACHMENTS.filter((attachment) => items.includes(attachment)))
	),
	otherAttachments: textList(LETTER_LIMITS.otherAttachments, LETTER_LIMITS.otherAttachment),
	overrides: v.pipe(
		v.fallback(v.record(v.string(), v.unknown()), {}),
		v.transform((record) => {
			const out: CoverLetter['overrides'] = {};
			for (const key of LETTER_TEXT_KEYS) {
				if (!Object.hasOwn(record, key)) continue;
				const runs = normalizeRuns(record[key]);
				if (runs.length) out[key] = runs;
			}
			return out;
		})
	),
	style: v.fallback(
		v.object({
			font: v.fallback(v.picklist(LETTER_FONTS), 'times'),
			size: v.fallback(v.picklist(LETTER_SIZES), 12),
			lineHeight: v.fallback(v.picklist(LETTER_LINE_HEIGHTS), 1.15),
			align: v.fallback(v.picklist(LETTER_ALIGNS), 'left')
		}),
		{ font: 'times', size: 12, lineHeight: 1.15, align: 'left' }
	),
	createdAt: isoTimestamp,
	updatedAt: isoTimestamp
});

// ---------------------------------------------------------------------------
// Document
// ---------------------------------------------------------------------------

const documentObject = v.object({
	schemaVersion: v.literal(1),
	id: v.pipe(v.string(), v.regex(ID_PATTERN)),
	title: text(LIMITS.cvTitle),
	kind: v.fallback(v.picklist(['ats', 'creative'] as const), 'ats'),
	locale: v.fallback(v.picklist(['id', 'en'] as const), 'id'),
	targetRole: optText(LIMITS.title),
	templateId: v.fallback(v.optional(v.pipe(v.string(), v.regex(SLUG_PATTERN))), undefined),
	theme: themeSchema,
	status: statusSchema,
	layout: layoutSchema,
	design: designSchema,
	personal: personalSchema,
	summary: text(LIMITS.summary),
	education: listOf(educationSchema, LIMITS.itemsPerSection),
	experience: listOf(experienceSchema, LIMITS.itemsPerSection),
	organizations: listOf(organizationSchema, LIMITS.itemsPerSection),
	projects: listOf(projectSchema, LIMITS.itemsPerSection),
	skills: skillsSchema,
	languages: listOf(languageSchema, LIMITS.itemsPerSection),
	certifications: listOf(certificationSchema, LIMITS.itemsPerSection),
	awards: listOf(awardSchema, LIMITS.itemsPerSection),
	custom: listOf(customSectionSchema, LIMITS.customSections),
	foreign: foreignSchema,
	letters: v.fallback(v.optional(listOf(letterSchema, LETTER_LIMITS.perCv)), undefined),
	createdAt: isoTimestamp,
	updatedAt: isoTimestamp
});

type ParsedDocument = v.InferOutput<typeof documentObject>;

/**
 * Makes `layout` consistent with the content:
 * - order: valid keys only, no duplicates, every built-in + existing custom section present exactly once
 * - hidden: subset of order
 * - customTitles: only valid keys, cleaned text
 */
export function normalizeLayout(
	layout: ParsedDocument['layout'],
	customKeys: readonly CustomSectionKey[]
): CVDocument['layout'] {
	const allowed = new Set<SectionKey>([...BUILTIN_SECTION_KEYS, ...customKeys]);
	const order: SectionKey[] = [];
	for (const key of layout.order) {
		if (isSectionKey(key) && allowed.has(key) && !order.includes(key)) order.push(key);
	}
	for (const key of [...DEFAULT_SECTION_ORDER, ...BUILTIN_SECTION_KEYS, ...customKeys]) {
		if (!order.includes(key)) order.push(key);
	}

	const hidden: SectionKey[] = [];
	for (const key of layout.hidden) {
		if (isSectionKey(key) && allowed.has(key) && !hidden.includes(key)) hidden.push(key);
	}

	const customTitles: Partial<Record<SectionKey, string>> = {};
	for (const [key, value] of Object.entries(layout.customTitles)) {
		if (isSectionKey(key) && allowed.has(key) && typeof value === 'string') {
			const cleaned = cleanText(value, LIMITS.title).trim();
			if (cleaned) customTitles[key] = cleaned;
		}
	}
	return { order, hidden, customTitles };
}

/**
 * Keeps only meaningful design fields; `side` = existing section keys, no duplicates.
 * Returns undefined when nothing is set (the document then simply has no `design`).
 */
export function normalizeDesign(
	design: ParsedDocument['design'],
	order: readonly SectionKey[]
): CVDesign | undefined {
	if (!design) return undefined;
	const out: CVDesign = {};
	if (design.side) {
		const side: SectionKey[] = [];
		for (const key of design.side.slice(0, 64))
			if (isSectionKey(key) && order.includes(key) && !side.includes(key)) side.push(key);
		out.side = side;
	}
	for (const field of ['sidePosition', 'sideWidth', 'spacing', 'photoShape', 'photoSize'] as const)
		if (design[field] !== undefined) Object.assign(out, { [field]: design[field] });
	return Object.keys(out).length ? out : undefined;
}

/** Full schema: parse → normalize layout & template. Output is a valid `CVDocument`. */
export const cvDocumentSchema = v.pipe(
	documentObject,
	v.transform((doc): CVDocument => {
		// Drop duplicate custom section keys (keep the first).
		const seen = new Set<string>();
		const custom = doc.custom.filter((section) => {
			if (seen.has(section.key)) return false;
			seen.add(section.key);
			return true;
		});
		const layout = normalizeLayout(
			doc.layout,
			custom.map((section) => section.key)
		);
		const { design: rawDesign, foreign, letters: rawLetters, ...rest } = doc;
		const design = normalizeDesign(rawDesign, layout.order);
		// Duplicate letter ids (hand-edited backup): keep the first.
		const letterIds = new Set<string>();
		const letters = (rawLetters ?? []).filter((letter) => {
			if (letterIds.has(letter.id)) return false;
			letterIds.add(letter.id);
			return true;
		});
		return {
			...rest,
			templateId: doc.templateId ?? DEFAULT_TEMPLATE_ID[doc.kind],
			custom,
			layout,
			...(design ? { design } : {}),
			...(foreign ? { foreign } : {}),
			...(letters.length ? { letters } : {})
		};
	})
);
