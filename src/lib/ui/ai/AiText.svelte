<script lang="ts">
	let { text }: { text: string } = $props();
</script>

{#each text.split(/(\[isi angka\]|\[add number\])/gi) as part, index (index)}{#if /^\[(?:isi angka|add number)\]$/i.test(part)}<mark
			>{part}</mark
		>{:else}{part}{/if}{/each}

<style>
	mark {
		background: var(--color-cream);
		color: var(--color-text);
		padding: 0.0625rem 0.125rem;
		border-radius: 3px;
	}
</style>
