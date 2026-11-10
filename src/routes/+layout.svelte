<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { onNavigate } from '$app/navigation';
	import { initLocale } from '#lib/i18n/index.svelte.ts';
	import { t } from '#lib/i18n/index.svelte.ts';
	import Toaster from '#lib/ui/Toaster.svelte';
	import { incognito } from '#lib/core/storage/incognito.svelte.ts';
	import { initThemeContext } from '#lib/ui/theme.svelte.ts';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
	const theme = initThemeContext();
	$effect(() => theme.syncMode(incognito.active, incognito.expiredAt));
	type PendingTransition = { resume: () => void; snapshot?: ViewTransition };
	let pendingTransition: PendingTransition | undefined;
	function finishTransition() {
		const pending = pendingTransition;
		if (!pending) return;
		pendingTransition = undefined;
		try {
			pending.snapshot?.skipTransition();
		} catch {
			// A discarded snapshot must not cancel the next navigation.
		} finally {
			pending.resume();
		}
	}

	onNavigate((navigation) => {
		finishTransition();
		if (
			!navigation.to ||
			!document.startViewTransition ||
			window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
			navigation.from?.url.pathname === navigation.to.url.pathname ||
			navigation.from?.route.id === '/(app)/cv/[id]/print' ||
			navigation.to.route.id === '/(app)/cv/[id]/print' ||
			document.querySelector('dialog[open]')
		)
			return;

		return new Promise<void>((resume) => {
			const pending: PendingTransition = { resume };
			pendingTransition = pending;
			const finished = () => {
				resume();
				if (pendingTransition === pending) pendingTransition = undefined;
			};
			try {
				const transition = document.startViewTransition(async () => {
					resume();
					await navigation.complete.catch(() => {});
				});
				pending.snapshot = transition;
				// A skipped snapshot must not hold up navigation or reject without a handler.
				void transition.ready.catch(() => resume());
				void transition.updateCallbackDone.catch(() => resume());
				void transition.finished.then(finished, finished);
			} catch {
				finished();
			}
		});
	});

	onMount(() => {
		void initLocale();
		void import('#lib/core/stats/index.ts')
			.then(({ visitorCount }) => visitorCount())
			.catch(() => {
				// An unavailable counter must not interrupt the rest of the application.
			});
		const stopTheme = theme.start();
		const beforeToggle = (event: Event) => {
			if (event.target instanceof HTMLDialogElement && (event as ToggleEvent).newState === 'open')
				finishTransition();
		};
		document.addEventListener('beforetoggle', beforeToggle, true);
		return () => {
			document.removeEventListener('beforetoggle', beforeToggle, true);
			finishTransition();
			stopTheme();
		};
	});
</script>

<a class="skip-link" href="#main">{t('a11y.skipToContent')}</a>
{@render children()}
<Toaster />
