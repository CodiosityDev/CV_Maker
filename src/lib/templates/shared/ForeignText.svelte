<script lang="ts">
	import { foreignParts, type ForeignMatcher } from '#lib/core/foreign/index.ts';

	let { text, matcher }: { text: string; matcher?: ForeignMatcher } = $props();
	const parts = $derived(foreignParts(text, matcher));
</script>

{#each parts as part, index (index)}{#if part.italic}<em>{part.text}</em
		>{:else}{part.text}{/if}{/each}

<style>
	em {
		font-style: italic;
		font-synthesis: style;
	}
</style>
