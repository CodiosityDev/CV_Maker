<script lang="ts">
	import { onMount } from 'svelte';
	import { i18n, t } from '#lib/i18n/index.svelte.ts';
	import Button from '#lib/ui/Button.svelte';
	// Small banner at the end of the page (owner); a cross-origin frame, loaded lazily.
	let adSlot = $state<HTMLDivElement>();
	onMount(() => {
		let stop = () => {};
		let active = true;
		void import('#lib/ui/ad-banner.ts').then((m) => {
			if (active && adSlot) stop = m.mountBanner(adSlot, i18n.locale);
		});
		return () => {
			active = false;
			stop();
		};
	});
</script>

<svelte:head>
	<title>{t('about.title')}</title>
	<meta name="description" content={t('about.description')} />
</svelte:head>

<main id="main" tabindex="-1" class="site-container prose-page">
	<h1>{t('about.heading')}</h1>
	<p class="intro">{t('about.intro')}</p>
	<p class="attribution">
		{t('about.attribution')}
		<a href="https://codiosity.com" target="_blank" rel="noopener noreferrer">
			{t('about.codiosityLink')} <span aria-hidden="true">↗</span><span class="sr-only">
				{t('a11y.opensNewTab')}</span
			>
		</a>
	</p>
	<div class="ad-slot" bind:this={adSlot}></div>
	<div class="back-link"><Button href="/" variant="ghost">{t('about.back')}</Button></div>
</main>

<style>
	.attribution {
		margin-top: 20px;
	}
	.attribution a {
		display: inline-flex;
		gap: 4px;
		align-items: center;
		min-height: 44px;
		font-weight: 600;
	}
	.back-link {
		margin-top: 32px;
	}
</style>
