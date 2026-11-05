// i18n wiring (owned by core/i18n): content pages ship only the 'site' namespace.
import { ensureMessages, registerNamespace } from '#lib/i18n/index.svelte.ts';
import { siteId } from '#lib/i18n/messages/site.id.ts';

registerNamespace('site', siteId);

export const load = async () => {
	await ensureMessages();
};
