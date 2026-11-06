import { getContext, setContext } from 'svelte';

interface IncognitoUiContext {
	registerBeforeEnd: (callback: () => void) => () => void;
	prepareToEnd: () => void;
}

const key = Symbol('incognito-ui');

export function initIncognitoUiContext(): void {
	// Store guards belong to this layout instance, including during SSR.
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	const guards = new Set<() => void>();
	setContext<IncognitoUiContext>(key, {
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
