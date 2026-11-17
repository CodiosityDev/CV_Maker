import type { Component } from 'svelte';
import { hasRecentCvs } from '#lib/core/home/index.ts';
import { mountBanner } from '#lib/ui/ad-banner.ts';

/**
 * The home page's "your CVs" strip, or `undefined` for first-time visitors (who then download
 * nothing more). The landing page imports THIS module dynamically, after hydration.
 */
export async function loadHomeRecent(): Promise<Component | undefined> {
	// The landing's other lazy extra: a small banner at the bottom (owner), before the closing
	// links. Created here so the landing's initial JS stays within its budget.
	const closing = document.querySelector('main .closing-links');
	if (closing && !document.querySelector('main .ad-slot')) {
		const slot = document.createElement('div');
		slot.className = 'ad-slot';
		closing.before(slot);
		mountBanner(slot);
	}
	if (!(await hasRecentCvs())) return undefined;
	return (await import('./RecentCvs.svelte')).default;
}
