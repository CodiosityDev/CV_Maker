<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		header?: Snippet;
		children?: Snippet;
		footer?: Snippet;
		disabled?: boolean;
		class?: string;
	};
	let { header, children, footer, disabled = false, class: className = '' }: Props = $props();
</script>

<div class={`card ${className}`} aria-disabled={disabled || undefined}>
	{#if header}<div class="card-header">{@render header()}</div>{/if}
	{#if children}<div class="card-body">{@render children()}</div>{/if}
	{#if footer}<div class="card-footer">{@render footer()}</div>{/if}
</div>

<style>
	.card {
		min-width: 0;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
		box-shadow: var(--shadow-sm);
	}
	.card-header,
	.card-body,
	.card-footer {
		padding: 20px;
	}
	.card-header {
		border-bottom: 1px solid var(--color-border);
	}
	.card-footer {
		border-top: 1px solid var(--color-border);
		background: var(--color-surface-muted);
		border-radius: 0 0 var(--radius-lg) var(--radius-lg);
	}
</style>
