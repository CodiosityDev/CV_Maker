/**
 * UI language (reactive). For CV content language use `translate(cv.locale, key)` instead.
 *
 * Usage in components:
 *   import { t, i18n, setLocale } from '#lib/i18n/index.svelte';
 *   <h1>{t('app.name')}</h1>
 *   <button type="button" onclick={() => setLocale('en')}>EN</button>
 *   {i18n.locale}  // 'id' | 'en'
 */
import { translate, type MessageKey } from './translate';
import { DEFAULT_LOCALE, isLocale, type Locale, type MessageParams } from './types';

export { translate, monthName, monthNames, type MessageKey, type Messages } from './translate';
export { LOCALES, DEFAULT_LOCALE, isLocale, type Locale, type MessageParams } from './types';

const STORAGE_KEY = 'cvmaker.uiLocale';

export const i18n = $state<{ locale: Locale }>({ locale: DEFAULT_LOCALE });

/** Reactive translation in the current UI language. */
export function t(key: MessageKey, params?: MessageParams): string {
	return translate(i18n.locale, key, params);
}

function applyToDocument(locale: Locale): void {
	if (typeof document !== 'undefined') document.documentElement.lang = locale;
}

/** Change UI language and remember it on this device. */
export function setLocale(locale: Locale): void {
	i18n.locale = locale;
	applyToDocument(locale);
	try {
		localStorage.setItem(STORAGE_KEY, locale);
	} catch {
		// Storage can be unavailable (privacy mode, blocked site data). The choice still applies for this visit.
	}
}

/** Call once on the client (root layout). Restores the saved UI language, if any. */
export function initLocale(): void {
	let saved: string | null;
	try {
		saved = localStorage.getItem(STORAGE_KEY);
	} catch {
		saved = null;
	}
	const locale = isLocale(saved) ? saved : DEFAULT_LOCALE;
	i18n.locale = locale;
	applyToDocument(locale);
}
