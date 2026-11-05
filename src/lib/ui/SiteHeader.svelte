<script lang="ts">
	import { resolve } from '$app/paths';
	import type { PathnameWithSearchOrHash } from '$app/types';
	import { t } from '#lib/i18n/index.svelte.ts';
	import Button from '#lib/ui/Button.svelte';
	import Icon from '#lib/ui/Icon.svelte';
	import LanguageSwitcher from '#lib/ui/LanguageSwitcher.svelte';
</script>

<header class="site-header">
	<div class="site-container header-inner">
		<div class="brand-row">
			<a class="brand" href={resolve('/(site)')} aria-label={t('nav.home')}
				><span class="brand-mark"><Icon name="file" size={23} /></span><span>{t('app.name')}</span
				></a
			>
			<LanguageSwitcher />
		</div>
		<nav aria-label={t('nav.label')}>
			<a class="desktop-link" href={resolve('/cv' as PathnameWithSearchOrHash)}>{t('nav.myCvs')}</a>
			<Button href="/buat" size="sm" class="header-cta">{t('nav.create')}<Icon size={16} /></Button>
		</nav>
	</div>
</header>

<style>
	.site-header {
		background: var(--color-surface);
		border-bottom: 1px solid var(--color-neutral-200);
	}
	.header-inner {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding-block: 12px;
	}
	.brand-row {
		display: flex;
		width: 100%;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}
	.brand {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		min-height: 44px;
		text-decoration: none;
		font-size: 20px;
		letter-spacing: -0.06em;
		font-weight: 800;
		color: var(--color-text);
		white-space: nowrap;
	}
	.brand-mark {
		display: grid;
		place-items: center;
		width: 36px;
		height: 40px;
		background: var(--color-primary-600);
		border-radius: 10px;
		color: white;
	}
	nav {
		display: flex;
		width: 100%;
		align-items: center;
		gap: 20px;
	}
	.desktop-link {
		display: none;
		padding: 12px 4px;
		font-weight: 600;
		font-size: 14px;
		text-decoration: none;
		color: var(--color-text-muted);
	}
	:global(.header-cta) {
		width: 100%;
	}
	@media (min-width: 640px) {
		.header-inner {
			min-height: 80px;
			flex-wrap: nowrap;
			padding-block: 0;
			gap: 20px;
		}
		.brand-row {
			display: contents;
		}
		.brand {
			margin-inline-end: auto;
		}
		nav {
			width: auto;
		}
		:global(.header-cta) {
			width: auto;
		}
	}
	@media (min-width: 900px) {
		.desktop-link {
			display: inline-flex;
			align-items: center;
			min-height: 44px;
		}
	}
</style>
