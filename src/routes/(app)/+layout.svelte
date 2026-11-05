<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { assetRepo } from '#lib/core/storage/index.ts';
	import { t } from '#lib/i18n/index.svelte.ts';
	import LanguageSwitcher from '#lib/ui/LanguageSwitcher.svelte';
	import Icon from '#lib/ui/Icon.svelte';
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
			<span class="brand-mark"><Icon name="file" size={22} /></span>
			<span>{t('app.name')}</span>
		</a>
		<LanguageSwitcher />
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
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		min-height: 76px;
	}
	.brand {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		min-height: 44px;
		color: var(--color-text);
		font-size: 20px;
		font-weight: 800;
		letter-spacing: -0.06em;
		text-decoration: none;
		white-space: nowrap;
	}
	.brand-mark {
		display: grid;
		place-items: center;
		width: 34px;
		height: 38px;
		border-radius: var(--radius-md);
		background: var(--color-primary-600);
		color: white;
	}
</style>
