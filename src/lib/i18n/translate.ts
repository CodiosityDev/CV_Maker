/**
 * Translation engine with code-split dictionaries.
 *
 * Messages are split by LANGUAGE and by NAMESPACE so each page only ships the text it uses:
 *   base  (messages/id.ts, en.ts)          — shared: app, common, nav, footer, ui, locale, validation, a11y
 *   site  (messages/site.id.ts, site.en.ts) — landing, privacy, about     → registered by (site) layout
 *   app   (messages/app.id.ts, app.en.ts)   — wizard, preview, editor, …  → registered by (app) layout
 *
 * Indonesian base is always bundled. A route group registers its Indonesian namespace synchronously
 * (static import → no flash, works in prerender) and English parts are loaded on demand.
 */
import { id as baseId } from './messages/id';
import type { siteId } from './messages/site.id';
import type { appId } from './messages/app.id';
import type { DeepStringRecord, LeafPaths, Locale, MessageParams } from './types';

export type BaseMessages = DeepStringRecord<typeof baseId>;
export type SiteMessages = DeepStringRecord<typeof siteId>;
export type AppMessages = DeepStringRecord<typeof appId>;
export type Messages = BaseMessages & SiteMessages & AppMessages;
export type MessageKey = LeafPaths<Messages>;

export type Namespace = 'site' | 'app';
type Part = 'base' | Namespace;
type Dict = Record<string, unknown>;

const dictionaries: Record<Locale, Dict> = { id: { ...baseId }, en: {} };
const loadedParts: Record<Locale, Set<Part>> = { id: new Set(['base']), en: new Set() };
/** Namespaces registered so far in this page session (any language). */
const activeNamespaces = new Set<Namespace>();

const englishLoaders: Record<Part, () => Promise<Dict>> = {
	base: () => import('./messages/en').then((m) => m.en),
	site: () => import('./messages/site.en').then((m) => m.siteEn),
	app: () => import('./messages/app.en').then((m) => m.appEn)
};

/**
 * Register a namespace's Indonesian messages (call at module level in the route group's +layout.ts
 * with a STATIC import). English is fetched by `loadDictionary` when needed.
 */
export function registerNamespace(namespace: Namespace, indonesian: Dict): void {
	activeNamespaces.add(namespace);
	if (loadedParts.id.has(namespace)) return;
	Object.assign(dictionaries.id, indonesian);
	loadedParts.id.add(namespace);
}

/** Loads every part (base + registered namespaces) of a locale that is not loaded yet. */
export async function loadDictionary(locale: Locale): Promise<void> {
	if (locale === 'id') return;
	const missing = (['base', ...activeNamespaces] as Part[]).filter(
		(part) => !loadedParts[locale].has(part)
	);
	await Promise.all(
		missing.map(async (part) => {
			const messages = await englishLoaders[part]();
			Object.assign(dictionaries[locale], messages);
			loadedParts[locale].add(part);
		})
	);
}

/** True when base + all registered namespaces are loaded for this locale. */
export function isDictionaryLoaded(locale: Locale): boolean {
	return (['base', ...activeNamespaces] as Part[]).every((part) => loadedParts[locale].has(part));
}

function lookup(messages: Dict | undefined, key: string): string | undefined {
	let node: unknown = messages;
	for (const part of key.split('.')) {
		if (node === null || typeof node !== 'object' || !Object.hasOwn(node, part)) return undefined;
		node = (node as Dict)[part];
	}
	return typeof node === 'string' ? node : undefined;
}

function interpolate(template: string, params?: MessageParams): string {
	if (!params) return template;
	return template.replace(/\{(\w+)\}/g, (match, name: string) =>
		Object.hasOwn(params, name) ? String(params[name]) : match
	);
}

/**
 * Pure, non-reactive translation of UI messages for an explicit locale.
 * Falls back to Indonesian (e.g. while another locale is still loading), then to the key itself.
 */
export function translate(locale: Locale, key: MessageKey, params?: MessageParams): string {
	const message = lookup(dictionaries[locale], key) ?? lookup(dictionaries.id, key);
	if (message === undefined) {
		if (import.meta.env?.DEV) console.warn(`[i18n] missing key (namespace registered?): ${key}`);
		return key;
	}
	return interpolate(message, params);
}

/** Month names via Intl (no dictionary needed). `month` is 1–12. */
export function monthName(locale: Locale, month: number, style: 'long' | 'short' = 'long'): string {
	const formatter = new Intl.DateTimeFormat(locale === 'id' ? 'id-ID' : 'en-US', {
		month: style,
		timeZone: 'UTC'
	});
	return formatter.format(new Date(Date.UTC(2000, month - 1, 1)));
}

/** All 12 month names for the given locale, January first. */
export function monthNames(locale: Locale, style: 'long' | 'short' = 'long'): string[] {
	return Array.from({ length: 12 }, (_, i) => monthName(locale, i + 1, style));
}
