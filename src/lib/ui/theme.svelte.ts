import { getContext, setContext } from 'svelte';
import { incognito } from '#lib/core/storage/incognito.svelte.ts';

type Theme = 'dark' | 'light';
const storageKey = 'cvmaker.theme';
const contextKey = Symbol('theme');

interface ThemeController {
	readonly current: Theme;
	start(): () => void;
	syncMode(active: boolean, expiredAt?: string): void;
	toggle(): void;
	reset(): void;
}

function readPreference(): Theme {
	try {
		return localStorage.getItem(storageKey) === 'light' ? 'light' : 'dark';
	} catch {
		return 'dark';
	}
}

export function initThemeContext(): ThemeController {
	// Match prerendered controls during hydration; the head script already styled the page.
	let current = $state<Theme>('dark');
	let privateMode = incognito.active;
	let initialized = false;
	let lastExpired: string | undefined;

	function apply(theme: Theme) {
		current = theme;
		if (typeof document === 'undefined') return;
		document.documentElement.dataset.theme = theme;
		document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', theme);
		const canvas = getComputedStyle(document.documentElement)
			.getPropertyValue('--color-canvas')
			.trim();
		document.querySelector('meta[name="theme-color"]')?.setAttribute('content', canvas);
	}
	const controller: ThemeController = {
		get current() {
			return current;
		},
		start() {
			initialized = true;
			privateMode = incognito.active;
			apply(privateMode ? 'dark' : readPreference());
			function storage(event: StorageEvent) {
				if (!incognito.active && (event.key === storageKey || event.key === null)) {
					apply(readPreference());
				}
			}
			window.addEventListener('storage', storage);
			return () => window.removeEventListener('storage', storage);
		},
		syncMode(active, expiredAt) {
			if (!initialized) return;
			if (active && expiredAt && expiredAt !== lastExpired) {
				lastExpired = expiredAt;
				apply('dark');
			}
			if (privateMode === active) return;
			privateMode = active;
			apply(active ? 'dark' : readPreference());
		},
		toggle() {
			controller.syncMode(incognito.active, incognito.expiredAt);
			const next = current === 'dark' ? 'light' : 'dark';
			apply(next);
			if (incognito.active) return;
			try {
				localStorage.setItem(storageKey, next);
			} catch {
				// The current tab can still change theme when storage is unavailable.
			}
		},
		reset() {
			apply('dark');
			if (incognito.active) return;
			try {
				localStorage.removeItem(storageKey);
			} catch {
				// Reset the visible theme even if browser preferences are blocked.
			}
		}
	};
	setContext(contextKey, controller);
	return controller;
}

export function getThemeContext(): ThemeController {
	return getContext<ThemeController>(contextKey);
}
