<script lang="ts">
	import type { Snippet } from 'svelte';
	import { resolve } from '$app/paths';

	let {
		children,
		href,
		size = 'md',
		onclick,
		class: className = ''
	}: {
		children: Snippet;
		href: string;
		size?: 'sm' | 'md' | 'lg';
		onclick?: (event: MouseEvent) => void;
		class?: string;
	} = $props();
</script>

<a
	href={resolve(...([href.replace(/^\//, '')] as Parameters<typeof resolve>))}
	class={`button primary ${size} ${className}`}
	data-sveltekit-preload-code="viewport"
	{onclick}
>
	{@render children()}
</a>

<style>
	.button {
		display: inline-flex;
		min-width: 44px;
		min-height: 48px;
		align-items: center;
		justify-content: center;
		gap: 8px;
		border: 1px solid transparent;
		border-radius: var(--radius-md);
		padding: 12px 20px;
		font-size: 0.875rem;
		font-weight: 700;
		line-height: 1.5;
		text-align: center;
		text-decoration: none;
		cursor: pointer;
		transition:
			background-color var(--motion-duration) ease-out,
			border-color var(--motion-duration) ease-out,
			color var(--motion-duration) ease-out,
			transform var(--motion-duration) ease-out,
			opacity var(--motion-duration) ease-out;
	}
	.button:active:not(:disabled):not([aria-disabled='true']) {
		transform: translateY(1px);
	}
	.primary {
		background: var(--color-brand);
		color: var(--color-on-brand);
	}
	.primary:hover:not(:disabled):not([aria-disabled='true']) {
		background: var(--color-brand-hover);
	}
	.sm {
		min-height: 44px;
		padding: 8px 16px;
	}
	.lg {
		min-height: 52px;
		padding: 12px 24px;
		font-size: 1rem;
	}
	@media (prefers-reduced-motion: reduce) {
		.button {
			transition: none;
		}
	}
</style>
