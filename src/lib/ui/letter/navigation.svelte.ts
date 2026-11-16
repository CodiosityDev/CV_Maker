import { getContext, setContext } from 'svelte';
import { goto } from '$app/navigation';
import type { ResolvedPathname } from '$app/types';
import type { CvStore } from '#lib/core/store/cv-store.svelte.ts';
import { incognito } from '#lib/core/storage/index.ts';
import { t } from '#lib/i18n/index.svelte.ts';
import { toast } from '#lib/ui/toast.svelte.ts';

const key = Symbol('letter-navigation');
interface LetterNavigation {
	readonly busy: boolean;
	go: (href: ResolvedPathname) => Promise<boolean>;
	click: (event: MouseEvent, anchor?: HTMLAnchorElement) => void;
}

/** Save the current workspace before reading another route, including previously preloaded data. */
export function initLetterNavigation(store: CvStore, available: () => boolean): LetterNavigation {
	let busy = $state(false);
	async function go(href: ResolvedPathname): Promise<boolean> {
		if (busy || !available()) return false;
		const id = store.cv.id;
		const mode = incognito.active;
		const expiry = incognito.expiredAt;
		const valid = () =>
			available() &&
			store.cv.id === id &&
			incognito.active === mode &&
			incognito.expiredAt === expiry;
		busy = true;
		try {
			let before: string;
			do {
				before = JSON.stringify(store.cv);
				await store.flush();
				if (!valid()) return false;
				if (store.saveState === 'error') {
					toast.error(t('wizard.saveError'));
					return false;
				}
			} while (before !== JSON.stringify(store.cv));
			await goto(href, { invalidateAll: true });
			return true;
		} catch {
			if (valid()) toast.error(t('dashboard.actionError'));
			return false;
		} finally {
			busy = false;
		}
	}
	function click(event: MouseEvent, anchor?: HTMLAnchorElement): void {
		const link =
			anchor ??
			(event.currentTarget instanceof HTMLAnchorElement ? event.currentTarget : undefined);
		if (
			!link ||
			event.defaultPrevented ||
			event.button !== 0 ||
			event.ctrlKey ||
			event.metaKey ||
			event.shiftKey ||
			event.altKey ||
			link.hasAttribute('download') ||
			(link.target && link.target !== '_self') ||
			link.origin !== location.origin ||
			link.hasAttribute('data-sveltekit-reload') ||
			(link.hash && link.pathname === location.pathname && link.search === location.search)
		)
			return;
		event.preventDefault();
		void go((link.pathname + link.search + link.hash) as ResolvedPathname);
	}
	const navigation = {
		get busy() {
			return busy;
		},
		go,
		click
	};
	setContext(key, navigation);
	return navigation;
}

export function getLetterNavigation(): LetterNavigation {
	return getContext<LetterNavigation>(key);
}
