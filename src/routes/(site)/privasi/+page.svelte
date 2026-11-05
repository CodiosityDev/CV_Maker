<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';
	import Button from '#lib/ui/Button.svelte';
	import Icon from '#lib/ui/Icon.svelte';
</script>

<svelte:head
	><title>{t('privacy.title')}</title><meta
		name="description"
		content={t('privacy.description')}
	/></svelte:head
>

<main id="main" tabindex="-1" class="site-container prose-page">
	<p class="eyebrow">{t('privacy.eyebrow')}</p>
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
		<h2>{t('privacy.deleteTitle')}</h2>
		<p>{t('privacy.deleteCopy')}</p>
	</section>
	<section class="notice">
		<h2>{t('privacy.backupTitle')}</h2>
		<p>{t('privacy.backupCopy')}</p>
		<p>{t('privacy.sharedCopy')}</p>
	</section>
	<div class="back-link">
		<Button href="/" variant="secondary"
			><Icon name="arrow" class="back-arrow" />{t('privacy.back')}</Button
		>
	</div>
</main>

<style>
	.back-link {
		margin-top: 40px;
	}
	:global(.back-arrow) {
		transform: rotate(180deg);
	}
</style>
