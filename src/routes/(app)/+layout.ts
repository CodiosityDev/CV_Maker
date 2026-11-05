// i18n wiring (owned by core/i18n): app pages ship only the 'app' namespace.
import { ensureMessages, registerNamespace } from '#lib/i18n/index.svelte.ts';
import { appId } from '#lib/i18n/messages/app.id.ts';

export const prerender = false;
export const ssr = false;

registerNamespace('app', appId);

export const load = async () => {
	await ensureMessages();
};
