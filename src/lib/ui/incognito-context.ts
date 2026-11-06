import { getContext, setContext } from 'svelte';

interface IncognitoUiContext {
	registerBeforeStart: (callback: () => Promise<boolean>) => () => void;
	prepareToStart: () => Promise<boolean>;
	registerBeforeEnd: (callback: () => void) => () => void;
	prepareToEnd: () => void;
}

const key = Symbol('incognito-ui');

export function initIncognitoUiContext(): void {
	// Store guards belong to this layout instance, including during SSR.
	const guards = new Set<() => void>();
	const startGuards = new Set<() => Promise<boolean>>();
	setContext<IncognitoUiContext>(key, {
		registerBeforeStart(callback) {
			startGuards.add(callback);
			return () => {
				startGuards.delete(callback);
			};
		},
		async prepareToStart() {
			const results = await Promise.all(
				[...startGuards].map(async (guard) => {
					try {
						return await guard();
					} catch {
						return false;
					}
				})
			);
			return results.every(Boolean);
		},
		registerBeforeEnd(callback) {
			guards.add(callback);
			return () => {
				guards.delete(callback);
			};
		},
		prepareToEnd() {
			for (const guard of guards) guard();
		}
	});
}

export function getIncognitoUiContext(): IncognitoUiContext | undefined {
	return getContext<IncognitoUiContext | undefined>(key);
}
