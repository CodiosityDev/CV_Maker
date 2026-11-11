<script lang="ts">
	import type { Snippet } from 'svelte';
	import { resolve } from '$app/paths';
	import { t } from '#lib/i18n/index.svelte.ts';

	type Props = {
		children: Snippet;
		variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
		size?: 'sm' | 'md' | 'lg';
		type?: 'button' | 'submit' | 'reset';
		href?: string;
		disabled?: boolean;
		loading?: boolean;
		onclick?: (event: MouseEvent) => void;
		class?: string;
		id?: string;
		title?: string;
		'aria-label'?: string;
		'aria-controls'?: string;
		'aria-expanded'?: boolean;
		target?: '_blank' | '_self';
		rel?: string;
		'data-sveltekit-preload-code'?: 'viewport';
	};

	let {
		children,
		variant = 'primary',
		size = 'md',
		type = 'button',
		href,
		disabled = false,
		loading = false,
		onclick,
		class: className = '',
		id,
		title,
		'aria-label': ariaLabel,
		'aria-controls': ariaControls,
		'aria-expanded': ariaExpanded,
		target,
		rel,
		'data-sveltekit-preload-code': preloadCode
	}: Props = $props();
	let blocked = $derived(disabled || loading);
	const external = $derived(!!href && /^(https?:)?\/\//.test(href));

	function handleClick(event: MouseEvent) {
		if (blocked) {
			event.preventDefault();
			return;
		}
		onclick?.(event);
	}
</script>

{#snippet content()}
	{#if loading}
		<svg class="spinner" viewBox="0 0 24 24" fill="none" aria-hidden="true">
			<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" opacity=".25" />
			<path d="M12 3a9 9 0 0 1 9 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
		</svg>
		<span class="sr-only">{t('ui.loading')}</span>
	{/if}
	{@render children()}
{/snippet}

{#if href}
	<!-- eslint-disable svelte/no-navigation-without-resolve -- Only validated external URLs bypass resolve(); the internal branch always uses it. -->
	<a
		{id}
		href={blocked
			? undefined
			: external
				? href
				: resolve(...([href.replace(/^\//, '')] as Parameters<typeof resolve>))}
		role={blocked ? 'link' : undefined}
		{title}
		{target}
		rel={external
			? `external noopener noreferrer ${rel ?? ''}`
			: target === '_blank'
				? `noopener noreferrer ${rel ?? ''}`
				: rel}
		data-sveltekit-preload-code={preloadCode}
		class={`button ${variant} ${size} ${className}`}
		aria-label={ariaLabel}
		aria-controls={ariaControls}
		aria-expanded={ariaExpanded}
		aria-disabled={blocked || undefined}
		aria-busy={loading || undefined}
		tabindex={blocked ? -1 : undefined}
		onclick={handleClick}
	>
		{@render content()}
	</a>
	<!-- eslint-enable svelte/no-navigation-without-resolve -->
{:else}
	<button
		{id}
		{type}
		{title}
		class={`button ${variant} ${size} ${className}`}
		disabled={blocked}
		aria-label={ariaLabel}
		aria-controls={ariaControls}
		aria-expanded={ariaExpanded}
		aria-busy={loading || undefined}
		onclick={handleClick}
	>
		{@render content()}
	</button>
{/if}

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
	.secondary {
		background: var(--color-brand-50);
		color: var(--color-brand-ink);
	}
	.secondary:hover:not(:disabled):not([aria-disabled='true']) {
		background: var(--color-secondary-hover);
	}
	.ghost {
		background: transparent;
		color: var(--color-brand-ink);
	}
	.ghost:hover:not(:disabled):not([aria-disabled='true']) {
		background: var(--color-brand-50);
	}
	.danger {
		background: var(--color-coral);
		color: var(--color-on-brand);
	}
	.danger:hover:not(:disabled):not([aria-disabled='true']) {
		background: var(--color-coral-50);
		color: var(--color-danger);
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
	.button:disabled,
	.button[aria-disabled='true'] {
		cursor: not-allowed;
		opacity: 0.55;
	}
	.spinner {
		width: 20px;
		height: 20px;
		flex-shrink: 0;
		animation: pulse 180ms ease-in-out infinite alternate;
	}
	@keyframes pulse {
		from {
			opacity: 0.4;
		}
		to {
			opacity: 1;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.button {
			transition: none;
		}
		.spinner {
			animation: none;
		}
	}
</style>
