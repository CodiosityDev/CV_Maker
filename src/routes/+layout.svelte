<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { initLocale } from '#lib/i18n/index.svelte.ts';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	onMount(() => {
		initLocale();
	});
</script>

{@render children()}
