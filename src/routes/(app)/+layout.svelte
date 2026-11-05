<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { assetRepo } from '#lib/core/storage/index.ts';
	import { t } from '#lib/i18n/index.svelte.ts';
	import LanguageSwitcher from '#lib/ui/LanguageSwitcher.svelte';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	onMount(() => {
		// Housekeeping: delete photos no CV uses anymore (older than 24 h, so undo stays safe).
		void assetRepo.removeOrphans().catch(() => {});
	});
</script>

<header class="app-header">
	<div class="site-container header-inner">
		<a class="brand" href={resolve('/(site)')} aria-label={t('nav.home')}>
			<span>{t('app.name')}</span>
		</a>
		<LanguageSwitcher />
		<nav aria-label={t('nav.label')}>
			<a href={resolve('/(site)')}>{t('nav.home')}</a>
			<a href={resolve('/(site)/faq')}>{t('nav.faq')}</a>
		</nav>
	</div>
</header>
<main id="main" tabindex="-1">{@render children()}</main>

<style>
	.app-header {
		border-bottom: 1px solid var(--color-border);
		background: var(--color-surface);
	}
	.header-inner {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 4px 12px;
		padding-block: 12px;
	}
	.brand {
		display: inline-flex;
		align-items: center;
		margin-right: auto;
		min-height: 44px;
		color: var(--color-ink);
		font-size: 20px;
		font-weight: 800;
		letter-spacing: -0.06em;
		text-decoration: none;
		white-space: nowrap;
	}
	nav {
		display: flex;
		flex-basis: 100%;
		gap: 1rem;
	}
	nav a {
		display: inline-flex;
		align-items: center;
		min-width: 44px;
		min-height: 44px;
		color: var(--color-brand-ink);
		font-size: 0.875rem;
		font-weight: 600;
		text-decoration: none;
	}
	nav a:hover {
		text-decoration: underline;
	}
	@media (min-width: 768px) {
		nav {
			flex-basis: auto;
			margin-left: 0.75rem;
		}
	}
</style>
