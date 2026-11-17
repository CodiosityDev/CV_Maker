// Shared CV pages (/u/<slug>): rendered in the browser from the API, never prerendered.
// i18n: only the small 'viewer' namespace (visitors do not need the app's text).
import { ensureMessages, registerNamespace } from '#lib/i18n/index.svelte.ts';
import { viewerId } from '#lib/i18n/messages/viewer.id.ts';

export const prerender = false;
export const ssr = false;

registerNamespace('viewer', viewerId);

export const load = async () => {
	await ensureMessages();
};
