/**
 * Small banner ads on a few content pages only (owner: home page bottom, FAQ, About) — never in
 * the editor, wizard, ATS check, print or shared-CV pages.
 *
 * The ad runs in a CROSS-ORIGIN iframe (https://iklan.codiosity.com/banner.html), so the ad script
 * cannot read this page. The frame is created only when its slot comes near the viewport, only on
 * the production site, and stays collapsed (0 px, no empty box) until the ad page reports a filled
 * banner. Load lazily: `import('#lib/ui/ad-banner.ts').then((m) => m.mountBanner(slot, locale))`.
 */
import {
	ensureMessages,
	registerNamespace,
	translate,
	type Locale
} from '#lib/i18n/index.svelte.ts';
import { homeId } from '#lib/i18n/messages/home.id.ts';

// The frame title lives in the lazy 'home' namespace (nothing added to the landing's initial JS).
registerNamespace('home', homeId);

export const AD_ORIGIN = 'https://iklan.codiosity.com';
const PRODUCTION_HOST = 'cvmaker.codiosity.com';

/**
 * Returns a cleanup function (optional: it also cleans up by itself once the slot left the page).
 * Does nothing outside production (local dev, previews, e2e).
 */
export function mountBanner(
	slot: HTMLElement,
	locale: Locale = document.documentElement.lang === 'en' ? 'en' : 'id'
): () => void {
	if (location.hostname !== PRODUCTION_HOST) return () => {};
	let frame: HTMLIFrameElement | undefined;

	const onMessage = (event: MessageEvent) => {
		// The page left (client-side navigation): clean up without the caller's help.
		if (!slot.isConnected) return cleanup();
		if (event.origin !== AD_ORIGIN || !frame || event.source !== frame.contentWindow) return;
		const data = event.data as { type?: unknown; filled?: unknown; height?: unknown } | null;
		if (!data || data.type !== 'cvmaker-banner') return;
		const height = Number(data.height);
		if (data.filled === true && height >= 40 && height <= 140) {
			frame.style.height = `${height}px`;
			slot.classList.add('filled');
		} else {
			slot.classList.remove('filled');
			frame.remove();
			frame = undefined;
		}
	};

	const observer = new IntersectionObserver(
		(entries) => {
			if (!entries.some((entry) => entry.isIntersecting)) return;
			observer.disconnect();
			void ensureMessages().then(open);
		},
		{ rootMargin: '300px 0px' }
	);

	function open() {
		if (!slot.isConnected || frame) return;
		frame = document.createElement('iframe');
		frame.src = `${AD_ORIGIN}/banner.html?lang=${locale}`;
		frame.title = translate(locale, 'adFrame.title');
		frame.loading = 'lazy';
		frame.referrerPolicy = 'strict-origin';
		// Ads may open the advertiser in a new tab; nothing else.
		frame.setAttribute(
			'sandbox',
			'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation'
		);
		frame.style.height = '0px';
		slot.append(frame);
	}
	observer.observe(slot);
	window.addEventListener('message', onMessage);

	function cleanup() {
		observer.disconnect();
		window.removeEventListener('message', onMessage);
		frame?.remove();
		slot.classList.remove('filled');
	}
	return cleanup;
}
