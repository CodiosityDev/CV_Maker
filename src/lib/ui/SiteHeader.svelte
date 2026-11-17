<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { ACCOUNT_HINT_STORAGE_KEY } from '#lib/core/account/hint.ts';
	import { t } from '#lib/i18n/index.svelte.ts';
	import PrimaryLink from '#lib/ui/PrimaryLink.svelte';
	import LanguageSwitcher from '#lib/ui/LanguageSwitcher.svelte';
	import Logo from '#lib/ui/Logo.svelte';
	import ThemeToggle from '#lib/ui/ThemeToggle.svelte';

	/** Site header: logo, language, theme, "Buat CV" and ONE dropdown menu (same as the app header). */
	const menuId = $props.id();
	let menuOpen = $state(false);
	let menuButton = $state<HTMLButtonElement>();
	let menu = $state<HTMLDivElement>();
	// "Akun" after a login on this browser, else "Masuk" — read locally, no request, no account code.
	let signedIn = $state(false);
	$effect(() => {
		void page.url;
		try {
			signedIn = localStorage.getItem(ACCOUNT_HINT_STORAGE_KEY) === '1';
		} catch {
			signedIn = false;
		}
	});

	const links = $derived([
		{ href: resolve('/(app)/buat'), label: t('nav.create') },
		{ href: resolve('/(app)/cv'), label: t('nav.myCvs') },
		signedIn
			? { href: resolve('/(app)/akun'), label: t('nav.account') }
			: { href: resolve('/(app)/masuk'), label: t('nav.signIn') },
		{ href: resolve('/(app)/surat'), label: t('nav.letter') },
		{ href: resolve('/(site)/cek-ats'), label: t('nav.atsCheck') },
		{ href: resolve('/(site)'), label: t('nav.home') },
		{ href: resolve('/(site)/faq'), label: t('nav.faq') },
		{ href: resolve('/(site)/tentang'), label: t('nav.about') }
	]);
	const external = $derived([
		{ href: 'https://respawnsociety.web.id', label: t('nav.tools') },
		{ href: 'https://codiosity.com', label: t('nav.codiosity') }
	]);

	function current(href: string): boolean {
		const path = page.url.pathname;
		return path === href || (href !== '/' && path.startsWith(`${href}/`));
	}
	function closeMenu() {
		menuOpen = false;
	}
	function onKeydown(event: KeyboardEvent) {
		if (event.key !== 'Escape' || !menuOpen) return;
		menuOpen = false;
		menuButton?.focus();
	}
	function onWindowClick(event: MouseEvent) {
		if (menuOpen && event.target instanceof Node && !menu?.contains(event.target)) menuOpen = false;
	}
</script>

<svelte:window onkeydown={onKeydown} onclick={onWindowClick} />

<header class="site-header" data-sveltekit-preload-code="viewport">
	<div class="site-container header-inner">
		<a class="brand" href={resolve('/(site)')} aria-label={t('nav.home')} onclick={closeMenu}
			><Logo size={28} /><span class="brand-name">{t('app.name')}</span></a
		>
		<LanguageSwitcher />
		<ThemeToggle />
		<div class="menu" bind:this={menu}>
			<button
				type="button"
				class="menu-toggle"
				bind:this={menuButton}
				aria-label={t('nav.menu')}
				aria-expanded={menuOpen}
				aria-controls={menuId}
				onclick={() => (menuOpen = !menuOpen)}
			>
				<svg
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="1.75"
					aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg
				>
			</button>
			<nav id={menuId} hidden={!menuOpen} aria-label={t('nav.label')}>
				{#each links as link (link.href)}
					<a
						href={link.href}
						aria-current={current(link.href) ? 'page' : undefined}
						onclick={closeMenu}>{link.label}</a
					>
				{/each}
				{#each external as link (link.href)}
					<!-- External sites (fixed list above), not app routes. -->
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
					<a href={link.href} target="_blank" rel="noopener noreferrer" onclick={closeMenu}
						>{link.label}<span aria-hidden="true">↗</span><span class="sr-only">
							{t('a11y.opensNewTab')}</span
						></a
					>
				{/each}
			</nav>
		</div>
		<div class="create-action">
			<PrimaryLink href="/buat" size="sm" class="header-cta" onclick={closeMenu}
				>{t('nav.create')}</PrimaryLink
			>
		</div>
	</div>
</header>

<style>
	.site-header {
		view-transition-name: app-header;
		/* Own stacking context (view-transition-name): keep it above the page content. */
		position: relative;
		z-index: 30;
		background: var(--color-surface);
		border-bottom: 1px solid var(--color-border);
	}
	.header-inner {
		display: flex;
		align-items: center;
		gap: 6px;
		min-height: 66px;
		padding-block: 7px;
	}
	.brand {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		min-width: 44px;
		min-height: 44px;
		margin-right: auto;
		color: var(--color-text);
		font-size: 1.25rem;
		font-weight: 700;
		letter-spacing: -0.04em;
		text-decoration: none;
		white-space: nowrap;
	}
	.menu {
		position: relative;
		flex-shrink: 0;
	}
	.menu-toggle {
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		padding: 0;
		border: 0;
		border-radius: var(--radius-md);
		background: var(--color-brand-50);
		color: var(--color-brand-ink);
		cursor: pointer;
	}
	.menu-toggle:hover,
	.menu-toggle[aria-expanded='true'] {
		background: var(--color-brand-100);
	}
	.menu-toggle svg {
		width: 20px;
		height: 20px;
	}
	nav {
		position: absolute;
		z-index: 40;
		top: calc(100% + 8px);
		right: 0;
		display: grid;
		min-width: 190px;
		padding: 8px;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		box-shadow: var(--shadow-card);
	}
	nav[hidden] {
		display: none;
	}
	nav a {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		min-height: 44px;
		padding-inline: 12px;
		border-radius: var(--radius-md);
		color: var(--color-brand-ink);
		font-size: 0.875rem;
		font-weight: 600;
		text-decoration: none;
	}
	nav a:hover {
		text-decoration: underline;
	}
	/* Current page: not by colour alone — a brand bar plus a stronger background (as in the app). */
	nav a[aria-current='page'] {
		background: var(--color-brand-100);
		color: var(--color-text);
		box-shadow: inset 0 -3px 0 var(--color-brand);
	}
	nav a span[aria-hidden='true'] {
		font-size: 0.75rem;
	}
	.create-action {
		flex-shrink: 0;
	}
	@media (max-width: 479px) {
		.header-inner {
			gap: 2px;
		}
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
		.header-inner :global(.language-switcher) {
			gap: 0;
			padding: 0;
		}
		.header-inner :global(.header-cta) {
			padding-inline: 10px;
			white-space: nowrap;
		}
	}
	/* Narrower than common phones: "Buat CV" stays in the hero and in the menu. */
	@media (max-width: 359px) {
		.create-action {
			display: none;
		}
	}
</style>
