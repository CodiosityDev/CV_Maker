<script lang="ts">
	import { resolve } from '$app/paths';
	import { t } from '#lib/i18n/index.svelte.ts';
	import LanguageSwitcher from '#lib/ui/LanguageSwitcher.svelte';
	import Logo from '#lib/ui/Logo.svelte';
	import ThemeToggle from '#lib/ui/ThemeToggle.svelte';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<header class="share-header">
	<div class="site-container header-inner">
		<a class="brand" href={resolve('/(site)')} aria-label={t('nav.home')}>
			<Logo size={26} /><span>{t('app.name')}</span>
		</a>
		<LanguageSwitcher />
		<ThemeToggle />
	</div>
</header>
<main id="main" tabindex="-1">{@render children()}</main>

<style>
	.share-header {
		border-bottom: 1px solid var(--color-border);
		background: var(--color-surface);
	}
	.header-inner {
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: 60px;
	}
	.brand {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		min-height: 44px;
		margin-right: auto;
		color: var(--color-text);
		font-size: 18px;
		font-weight: 800;
		letter-spacing: -0.06em;
		text-decoration: none;
	}
	@media print {
		.share-header {
			display: none;
		}
	}
</style>
