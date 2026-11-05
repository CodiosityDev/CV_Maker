<script lang="ts">
	import type { Snippet } from 'svelte';
	import { resolve } from '$app/paths';
	import type { PathnameWithSearchOrHash } from '$app/types';
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
		rel
	}: Props = $props();
	let blocked = $derived(disabled || loading);

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

{#if href && /^(https?:)?\/\//.test(href)}
	<a
		{id}
		href={blocked ? undefined : href}
		role={blocked ? 'link' : undefined}
		{title}
		{target}
		rel={`external noopener noreferrer ${rel ?? ''}`}
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
{:else if href}
	<a
		{id}
		href={blocked ? undefined : resolve(href as PathnameWithSearchOrHash)}
		role={blocked ? 'link' : undefined}
		{title}
		{target}
		rel={target === '_blank' ? `noopener noreferrer ${rel ?? ''}` : rel}
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
			transform 150ms ease,
			opacity 150ms ease;
	}
	.button:hover:not(:disabled):not([aria-disabled='true']) {
		transform: translateY(-1px);
	}
	.button:active:not(:disabled):not([aria-disabled='true']) {
		transform: translateY(0);
	}
	.primary {
		background: var(--color-primary-600);
		color: white;
	}
	.secondary {
		border-color: var(--color-border);
		background: var(--color-surface);
		color: var(--color-text);
	}
	.ghost {
		background: transparent;
		color: var(--color-primary-700);
	}
	.danger {
		background: var(--color-danger);
		color: white;
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
		animation: spin 200ms linear infinite;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
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
