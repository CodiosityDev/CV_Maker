<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';
	import { getThemeContext } from './theme.svelte.ts';
	const theme = getThemeContext();
	const label = $derived(t(theme.current === 'dark' ? 'ui.useLightTheme' : 'ui.useDarkTheme'));
</script>

<button
	type="button"
	class="theme-toggle"
	aria-label={label}
	title={label}
	data-testid="theme-toggle"
	onclick={() => theme.toggle()}
>
	<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
		{#if theme.current === 'dark'}<circle cx="12" cy="12" r="4" /><path
				d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"
			/>
		{:else}<path d="M20.4 13.2A8.5 8.5 0 0 1 10.8 3.6 8.5 8.5 0 1 0 20.4 13.2Z" />{/if}
	</svg>
</button>

<style>
	.theme-toggle {
		display: inline-grid;
		place-items: center;
		flex-shrink: 0;
		width: 44px;
		height: 44px;
		padding: 10px;
		border: 0;
		border-radius: var(--radius-md);
		background: var(--color-brand-50);
		color: var(--color-brand-ink);
		cursor: pointer;
	}
	.theme-toggle:hover {
		background: var(--color-brand-100);
	}
	.theme-toggle:focus-visible {
		outline: 2px solid var(--color-focus);
		outline-offset: 2px;
	}
	svg {
		width: 22px;
		height: 22px;
	}
</style>
