import type { Component } from 'svelte';
import { hasRecentCvs } from '#lib/core/home/index.ts';

/**
 * The home page's "your CVs" strip, or `undefined` for first-time visitors (who then download
 * nothing more). The landing page imports THIS module dynamically, after hydration.
 */
export async function loadHomeRecent(): Promise<Component | undefined> {
	if (!(await hasRecentCvs())) return undefined;
	return (await import('./RecentCvs.svelte')).default;
}
