// The privacy text is its own i18n namespace so it is not part of the landing page's JS.
import { ensureMessages, registerNamespace } from '#lib/i18n/index.svelte.ts';
import { privacyId } from '#lib/i18n/messages/privacy.id.ts';

registerNamespace('privacy', privacyId);

export const load = async () => {
	await ensureMessages();
};
