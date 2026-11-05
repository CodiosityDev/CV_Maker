/**
 * Wizard guidance (tips, example bullets, action verbs, summary examples), lazy-loaded per language.
 *
 *   import { loadGuidance } from '#lib/core/content/index.ts';
 *   const guidance = await loadGuidance(i18n.locale);   // in onMount / a client load function
 */
import type { Locale } from '../schema/types';
import type { Guidance } from './types';

export type { Guidance, ExampleBulletKind, SummaryExample } from './types';

const cache = new Map<Locale, Promise<Guidance>>();

const loaders: Record<Locale, () => Promise<Guidance>> = {
	id: () => import('./id').then((module) => module.guidance),
	en: () => import('./en').then((module) => module.guidance)
};

/** Loaded once per locale and cached. Each locale is a separate small chunk. */
export function loadGuidance(locale: Locale): Promise<Guidance> {
	let promise = cache.get(locale);
	if (!promise) {
		promise = loaders[locale]();
		promise.catch(() => cache.delete(locale)); // allow retry after a network error
		cache.set(locale, promise);
	}
	return promise;
}
