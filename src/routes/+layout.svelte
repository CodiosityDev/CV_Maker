<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { initLocale } from '#lib/i18n/index.svelte.ts';
	import { t } from '#lib/i18n/index.svelte.ts';
	import Toaster from '#lib/ui/Toaster.svelte';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	onMount(() => {
		initLocale();
	});
</script>

<a class="skip-link" href="#main">{t('a11y.skipToContent')}</a>
{@render children()}
<Toaster />
