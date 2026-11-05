import { id } from './messages/id';
import { en } from './messages/en';
import type { DeepStringRecord, LeafPaths, Locale, MessageParams } from './types';

export type Messages = DeepStringRecord<typeof id>;
export type MessageKey = LeafPaths<Messages>;

const dictionaries: Record<Locale, Messages> = { id, en };

function lookup(messages: Messages, key: string): string | undefined {
	let node: unknown = messages;
	for (const part of key.split('.')) {
		if (node === null || typeof node !== 'object' || !Object.hasOwn(node, part)) return undefined;
		node = (node as Record<string, unknown>)[part];
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
 * Pure, non-reactive translation for an explicit locale.
 * Use this for CV content (whose language can differ from the UI language).
 * Falls back to Indonesian, then to the key itself.
 */
export function translate(locale: Locale, key: MessageKey, params?: MessageParams): string {
	const message = lookup(dictionaries[locale], key) ?? lookup(dictionaries.id, key);
	if (message === undefined) {
		if (import.meta.env?.DEV) console.warn(`[i18n] missing key: ${key}`);
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

/** Exposed for tests (key-parity checks). */
export function getDictionary(locale: Locale): Messages {
	return dictionaries[locale];
}
