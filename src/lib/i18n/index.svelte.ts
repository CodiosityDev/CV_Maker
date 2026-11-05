/**
 * UI language (reactive).
 *
 * Usage in components:
 *   import { t, i18n, setLocale } from '#lib/i18n/index.svelte.ts';
 *   <h1>{t('app.name')}</h1>
 *   <button type="button" onclick={() => setLocale('en')}>EN</button>
 *   {i18n.locale}  // 'id' | 'en'
 *
 * CV CONTENT labels (section titles, "Sekarang"/"Present", ...) are NOT here:
 * they come from the render model (`#lib/core/render/index.ts`).
 */
import { loadDictionary, translate, type MessageKey } from './translate';
import {
	DEFAULT_LOCALE,
	UI_LOCALE_STORAGE_KEY,
	isLocale,
	type Locale,
	type MessageParams
} from './types';

export { translate, monthName, monthNames, type MessageKey, type Messages } from './translate';
export { LOCALES, DEFAULT_LOCALE, isLocale, type Locale, type MessageParams } from './types';

export const i18n = $state<{ locale: Locale }>({ locale: DEFAULT_LOCALE });

/** Reactive translation in the current UI language. */
export function t(key: MessageKey, params?: MessageParams): string {
	return translate(i18n.locale, key, params);
}

function applyToDocument(locale: Locale): void {
	if (typeof document !== 'undefined') document.documentElement.lang = locale;
}

let latestRequest = 0;

/**
 * Change UI language and remember it on this device.
 * The dictionary is loaded first, so the switch happens in one step (no mixed-language flash).
 * If called again before loading finishes, only the latest call wins.
 */
export async function setLocale(locale: Locale): Promise<void> {
	const request = ++latestRequest;
	try {
		localStorage.setItem(UI_LOCALE_STORAGE_KEY, locale);
	} catch {
		// Storage can be unavailable (privacy mode, blocked site data). The choice still applies for this visit.
	}
	try {
		await loadDictionary(locale);
	} catch {
		return; // Offline and not cached: stay on the current language.
	}
	if (request !== latestRequest) return;
	i18n.locale = locale;
	applyToDocument(locale);
}

/** Call once on the client (root layout). Restores the saved UI language, if any. */
export async function initLocale(): Promise<void> {
	let saved: string | null;
	try {
		saved = localStorage.getItem(UI_LOCALE_STORAGE_KEY);
	} catch {
		saved = null;
	}
	if (isLocale(saved) && saved !== i18n.locale) await setLocale(saved);
	else applyToDocument(i18n.locale);
}
