export const LOCALES = ['id', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'id';

/** localStorage key for the UI language preference (cleared by storage.wipeAll). */
export const UI_LOCALE_STORAGE_KEY = 'cvmaker.uiLocale';

export function isLocale(value: unknown): value is Locale {
	return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/** Same shape as the source dictionary, but every leaf is a plain `string`. */
export type DeepStringRecord<T> = {
	[K in keyof T]: T[K] extends string ? string : DeepStringRecord<T[K]>;
};

/** Union of all dot-separated leaf paths, e.g. `'common.next' | 'app.name'`. */
export type LeafPaths<T, Prefix extends string = ''> = {
	[K in keyof T & string]: T[K] extends string
		? `${Prefix}${K}`
		: LeafPaths<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

export type MessageParams = Record<string, string | number>;
