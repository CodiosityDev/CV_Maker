<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { assetRepo, incognito, onExternalChange } from '#lib/core/storage/index.ts';
	import { t } from '#lib/i18n/index.svelte.ts';
	import { initIncognitoUiContext, getIncognitoUiContext } from '#lib/ui/incognito-context.ts';
	import { resetAiSession, syncAiSession } from '#lib/ui/ai/session.svelte.ts';
	import IncognitoBanner from '#lib/ui/IncognitoBanner.svelte';
	import IncognitoHeader from '#lib/ui/IncognitoHeader.svelte';
	import LanguageSwitcher from '#lib/ui/LanguageSwitcher.svelte';
	import Logo from '#lib/ui/Logo.svelte';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
	initIncognitoUiContext();
	const incognitoUi = getIncognitoUiContext();
	$effect(() => {
		syncAiSession();
	});
	let menuOpen = $state(false);
	let menu: HTMLDetailsElement | undefined = $state();
	function closeMenu(event: KeyboardEvent) {
		if (event.key === 'Escape' && menuOpen) {
			event.preventDefault();
			menuOpen = false;
			menu?.querySelector('summary')?.focus();
		}
	}

	onMount(() => {
		// Housekeeping: delete photos no CV uses anymore (older than 24 h, so undo stays safe).
		void assetRepo.removeOrphans().catch(() => {});
		const stopExpire = incognito.onExpire(resetAiSession);
		const stopEnd = incognitoUi?.registerBeforeEnd(resetAiSession);
		const stopExternal = onExternalChange((event) => {
			if (event.type === 'wiped') resetAiSession();
		});
		return () => {
			stopExpire();
			stopEnd?.();
			stopExternal();
		};
	});
</script>

<svelte:window
	onbeforeunload={(event) => {
		if (incognito.active && incognito.hasData) event.preventDefault();
	}}
	onkeydown={closeMenu}
	onclick={(event) => {
		if (event.target instanceof Node && !menu?.contains(event.target)) menuOpen = false;
	}}
/>

<header class="app-header">
	<div class="site-container header-inner">
		<a class="brand" href={resolve('/(site)')} aria-label={t('nav.home')}>
			<Logo size={28} /><span class="brand-name">{t('app.name')}</span>
		</a>
		<LanguageSwitcher />
		<IncognitoHeader />
		<details class="app-menu" bind:this={menu} bind:open={menuOpen}>
			<summary aria-label={t('nav.menu')} aria-expanded={menuOpen}>
				<svg
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="1.75"
					aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg
				>
			</summary>
			<nav aria-label={t('nav.label')}>
				<a href={resolve('/(app)/buat')} onclick={() => (menuOpen = false)}>{t('nav.create')}</a>
				<a href={resolve('/(app)/cv')} onclick={() => (menuOpen = false)}>{t('nav.myCvs')}</a>
				<a href={resolve('/(site)')} onclick={() => (menuOpen = false)}>{t('nav.home')}</a>
				<a href={resolve('/(site)/faq')} onclick={() => (menuOpen = false)}>{t('nav.faq')}</a>
			</nav>
		</details>
	</div>
</header>
<IncognitoBanner />
<main id="main" tabindex="-1">{@render children()}</main>

<style>
	@media print {
		.app-header {
			display: none;
		}
	}
	.app-header {
		border-bottom: 1px solid var(--color-border);
		background: var(--color-surface);
	}
	.header-inner {
		display: flex;
		flex-wrap: nowrap;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		padding-block: 7px;
	}
	@media (max-width: 479px) {
		.header-inner {
			gap: 4px;
		}
	}
	.brand {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		margin-right: auto;
		min-width: 44px;
		min-height: 44px;
		color: var(--color-ink);
		font-size: 20px;
		font-weight: 800;
		letter-spacing: -0.06em;
		text-decoration: none;
		white-space: nowrap;
	}
	@media (max-width: 479px) {
		.brand-name {
			position: absolute;
			width: 1px;
			height: 1px;
			padding: 0;
			margin: -1px;
			overflow: hidden;
			clip: rect(0, 0, 0, 0);
			white-space: nowrap;
			border: 0;
		}
	}
	.app-menu {
		position: relative;
		flex-shrink: 0;
	}
	summary {
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		border-radius: var(--radius-md);
		background: var(--color-brand-50);
		color: var(--color-brand-ink);
		cursor: pointer;
		list-style: none;
	}
	summary::-webkit-details-marker {
		display: none;
	}
	summary svg {
		width: 20px;
		height: 20px;
	}
	nav {
		position: absolute;
		z-index: 20;
		top: calc(100% + 8px);
		right: 0;
		display: grid;
		min-width: 160px;
		padding: 8px;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		box-shadow: var(--shadow-card);
	}
	nav a {
		display: inline-flex;
		align-items: center;
		min-width: 44px;
		min-height: 44px;
		padding-inline: 12px;
		color: var(--color-brand-ink);
		font-size: 0.875rem;
		font-weight: 600;
		text-decoration: none;
	}
	nav a:hover {
		text-decoration: underline;
	}
</style>
