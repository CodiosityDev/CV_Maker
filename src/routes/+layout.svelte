<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { initLocale } from '#lib/i18n/index.svelte.ts';
	import { t } from '#lib/i18n/index.svelte.ts';
	import Toaster from '#lib/ui/Toaster.svelte';
	import { incognito } from '#lib/core/storage/incognito.svelte.ts';
	import { initThemeContext } from '#lib/ui/theme.svelte.ts';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
	const theme = initThemeContext();
	$effect(() => theme.syncMode(incognito.active, incognito.expiredAt));

	onMount(() => {
		void initLocale();
		void import('#lib/core/stats/index.ts')
			.then(({ visitorCount }) => visitorCount())
			.catch(() => {
				// An unavailable counter must not interrupt the rest of the application.
			});
		return theme.start();
	});
</script>

<a class="skip-link" href="#main">{t('a11y.skipToContent')}</a>
{@render children()}
<Toaster />
