<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';
	import Button from '#lib/ui/Button.svelte';
</script>

<svelte:head
	><title>{t('privacy.title')}</title><meta
		name="description"
		content={t('privacy.description')}
	/></svelte:head
>

<main id="main" tabindex="-1" class="site-container prose-page">
	<h1>{t('privacy.heading')}</h1>
	<p class="intro">{t('privacy.intro')}</p>
	<section>
		<h2>{t('privacy.storageTitle')}</h2>
		<p>{t('privacy.storageCopy')}</p>
	</section>
	<section>
		<h2>{t('privacy.trackingTitle')}</h2>
		<p>{t('privacy.trackingCopy')}</p>
	</section>
	<section>
		<h2>{t('privacy.photoTitle')}</h2>
		<p>{t('privacy.photoCopy')}</p>
	</section>
	<section>
		<h2>{t('privacy.aiTitle')}</h2>
		<p>{t('privacy.aiCopy')}</p>
	</section>
	<section>
		<h2>{t('privacy.adsTitle')}</h2>
		<p>{t('privacy.adsCopy')}</p>
	</section>
	<section>
		<h2>{t('privacy.deleteTitle')}</h2>
		<p>{t('privacy.deleteCopy')}</p>
	</section>
	<section class="notice">
		<h2>{t('privacy.lossTitle')}</h2>
		<p>{t('privacy.lossCopy')}</p>
		<p>{t('privacy.sharedCopy')}</p>
	</section>
	<div class="back-link">
		<Button href="/" variant="secondary">{t('privacy.back')}</Button>
	</div>
</main>

<style>
	.back-link {
		margin-top: 40px;
	}
</style>
