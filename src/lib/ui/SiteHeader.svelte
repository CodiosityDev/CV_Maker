<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { t } from '#lib/i18n/index.svelte.ts';
	import Button from '#lib/ui/Button.svelte';
	import LanguageSwitcher from '#lib/ui/LanguageSwitcher.svelte';
	import Logo from '#lib/ui/Logo.svelte';

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
		<a class="brand" href={resolve('/(site)')} aria-label={t('nav.home')} onclick={closeMenu}
			><Logo size={28} /><span>{t('app.name')}</span></a
		>
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
		<div class="language-control"><LanguageSwitcher /></div>
		<div class="create-action">
			<Button href="/buat" size="sm" class="header-cta" onclick={closeMenu}
				>{t('nav.create')}</Button
			>
		</div>
	</div>
</header>

<style>
	.site-header {
		background: var(--color-surface);
		border-bottom: 1px solid var(--color-border);
	}
	.header-inner {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		grid-template-areas: 'brand language' 'menu create';
		align-items: center;
		gap: 0.75rem 1.5rem;
		padding-block: 0.75rem;
	}
	.brand {
		grid-area: brand;
		display: inline-flex;
		align-items: center;
		gap: 8px;
		min-height: 44px;
		width: fit-content;
		color: var(--color-ink);
		font-size: 1.25rem;
		font-weight: 700;
		letter-spacing: -0.04em;
		text-decoration: none;
		white-space: nowrap;
	}
	.language-control {
		grid-area: language;
		justify-self: end;
	}
	.create-action {
		grid-area: create;
		justify-self: end;
	}
	.menu-toggle {
		grid-area: menu;
		justify-self: start;
		min-width: 44px;
		min-height: 44px;
		width: fit-content;
		padding: 0.5rem 1rem;
		border: 1px solid transparent;
		border-radius: var(--radius-md);
		background: var(--color-brand-50);
		color: var(--color-brand-ink);
		font: inherit;
		font-size: 0.875rem;
		font-weight: 650;
		cursor: pointer;
		transition:
			background-color var(--motion-duration) var(--motion-ease),
			transform var(--motion-duration) var(--motion-ease);
	}
	.menu-toggle:hover {
		background: var(--color-brand-100);
	}
	.menu-toggle:active {
		transform: translateY(1px);
	}
	nav {
		grid-column: 1 / -1;
		display: none;
		min-width: 0;
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
		border-radius: var(--radius-md);
		color: var(--color-text-muted);
		font-size: 0.875rem;
		font-weight: 600;
		text-decoration: none;
		white-space: nowrap;
		transition:
			background-color var(--motion-duration) var(--motion-ease),
			color var(--motion-duration) var(--motion-ease);
	}
	nav a:hover {
		background: var(--color-mint-50);
		color: var(--color-brand-ink);
	}
	nav a[aria-current='page'] {
		background: var(--color-brand-50);
		color: var(--color-brand-ink);
	}
	@media (min-width: 480px) {
		.header-inner {
			grid-template-columns: minmax(0, 1fr) auto auto auto;
			grid-template-areas: 'brand language menu create';
			column-gap: 1rem;
		}
	}
	@media (min-width: 768px) {
		.menu-toggle {
			display: none;
		}
		nav {
			grid-area: nav;
			display: block;
		}
		ul {
			display: flex;
			flex-wrap: wrap;
			gap: 0.25rem 0.75rem;
			padding-top: 0.5rem;
		}
		.header-inner {
			grid-template-columns: minmax(0, 1fr) auto auto;
			grid-template-areas: 'brand language create' 'nav nav nav';
			gap: 0.5rem 1.5rem;
		}
	}
	@media (min-width: 1024px) {
		.header-inner {
			grid-template-columns: auto minmax(0, 1fr) auto auto;
			grid-template-areas: 'brand nav language create';
			gap: 1.25rem;
		}
		ul {
			flex-wrap: nowrap;
			justify-content: end;
			gap: 0.25rem;
			padding: 0;
			border: 0;
		}
		nav a {
			padding-inline: 0.625rem;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.menu-toggle,
		nav a {
			transition: none;
		}
	}
</style>
