<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { t } from '#lib/i18n/index.svelte.ts';
	import Button from '#lib/ui/Button.svelte';
	import LanguageSwitcher from '#lib/ui/LanguageSwitcher.svelte';

	const menuId = $props.id();
	let menuOpen = $state(false);
	let menuButton = $state<HTMLButtonElement>();
	const links = $derived([
		{ href: resolve('/(site)'), label: t('nav.home') },
		{ href: resolve('/(app)/buat'), label: t('nav.create') },
		{ href: resolve('/(site)/faq'), label: t('nav.faq') },
		{ href: resolve('/(site)/tentang'), label: t('nav.about') }
	]);

	function closeMenu() {
		menuOpen = false;
	}
	function escapeMenu(event: KeyboardEvent) {
		if (event.key !== 'Escape' || !menuOpen) return;
		menuOpen = false;
		menuButton?.focus();
	}
</script>

<svelte:window onkeydown={escapeMenu} />

<header class="site-header">
	<div class="site-container header-inner">
		<div class="brand-row">
			<a class="brand" href={resolve('/(site)')} aria-label={t('nav.home')} onclick={closeMenu}
				>{t('app.name')}</a
			>
			<LanguageSwitcher />
		</div>
		<div class="header-actions">
			<button
				type="button"
				class="menu-toggle"
				bind:this={menuButton}
				aria-expanded={menuOpen}
				aria-controls={menuId}
				onclick={() => {
					menuOpen = !menuOpen;
				}}>{t('nav.menu')}</button
			>
			<Button href="/buat" size="sm" class="header-cta" onclick={closeMenu}
				>{t('nav.create')}</Button
			>
		</div>
		<nav id={menuId} class:open={menuOpen} aria-label={t('nav.label')}>
			<ul>
				{#each links as link (link.href)}
					<li>
						<a
							href={link.href}
							aria-current={page.url.pathname === link.href ? 'page' : undefined}
							onclick={closeMenu}>{link.label}</a
						>
					</li>
				{/each}
				<li>
					<a
						href="https://codiosity.com"
						target="_blank"
						rel="noopener noreferrer"
						onclick={closeMenu}
						>{t('nav.codiosity')}<span aria-hidden="true">↗</span><span class="sr-only">
							{t('a11y.opensNewTab')}</span
						></a
					>
				</li>
			</ul>
		</nav>
	</div>
</header>

<style>
	.site-header {
		background: var(--color-surface);
		border-bottom: 1px solid var(--color-border);
	}
	.header-inner {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.75rem 1.5rem;
		padding-block: 0.75rem;
	}
	.brand-row {
		display: flex;
		width: 100%;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}
	.brand {
		display: inline-flex;
		align-items: center;
		min-height: 44px;
		margin-right: auto;
		color: var(--color-ink);
		font-size: 1.25rem;
		font-weight: 750;
		letter-spacing: -0.04em;
		text-decoration: none;
	}
	.header-actions {
		display: flex;
		width: 100%;
		justify-content: space-between;
		gap: 0.75rem;
		align-items: center;
	}
	.menu-toggle {
		min-width: 44px;
		min-height: 44px;
		width: fit-content;
		padding: 0.5rem 1rem;
		border: 1px solid var(--color-control-border);
		border-radius: var(--radius-sm);
		background: var(--color-surface);
		color: var(--color-ink);
		font: inherit;
		font-size: 0.875rem;
		font-weight: 650;
	}
	nav {
		display: none;
		width: 100%;
	}
	nav.open {
		display: block;
	}
	ul {
		display: grid;
		gap: 0.25rem;
		list-style: none;
		padding: 0.75rem 0 0;
		margin: 0;
		border-top: 1px solid var(--color-border);
	}
	li {
		min-width: 0;
	}
	nav a {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		width: fit-content;
		min-width: 44px;
		min-height: 44px;
		padding: 0.5rem 0.75rem;
		border-radius: var(--radius-sm);
		color: var(--color-ink);
		font-size: 0.875rem;
		font-weight: 600;
		text-decoration: none;
	}
	nav a:hover {
		background: var(--color-mint);
	}
	nav a[aria-current='page'] {
		background: var(--color-brand);
		color: var(--color-ink);
	}
	@media (min-width: 480px) {
		.brand-row {
			flex: 1;
			width: auto;
		}
		.header-actions {
			width: auto;
			margin-left: auto;
		}
	}
	@media (min-width: 768px) {
		.menu-toggle {
			display: none;
		}
		nav {
			display: block;
		}
		ul {
			display: flex;
			flex-wrap: wrap;
			gap: 0.25rem 0.75rem;
			padding-top: 0.5rem;
		}
		.header-inner {
			gap: 0.5rem 1.5rem;
		}
	}
</style>
