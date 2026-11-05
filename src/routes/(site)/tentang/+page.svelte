<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';
	import Button from '#lib/ui/Button.svelte';
	import Icon from '#lib/ui/Icon.svelte';
</script>

<svelte:head
	><title>{t('about.title')}</title><meta
		name="description"
		content={t('about.description')}
	/></svelte:head
>

<main id="main" tabindex="-1" class="site-container prose-page">
	<p class="eyebrow">{t('about.eyebrow')}</p>
	<h1>{t('about.heading')}</h1>
	<p class="intro">{t('about.intro')}</p>
	<section>
		<h2>{t('about.purposeTitle')}</h2>
		<p>{t('about.purposeCopy')}</p>
	</section>
	<section>
		<h2>{t('about.openTitle')}</h2>
		<p>{t('about.openCopy')}</p>
		<div class="github-link">
			<Button
				href="https://github.com/CodiosityDev/CV_Maker"
				target="_blank"
				rel="noopener noreferrer"
				variant="secondary"><Icon name="github" />{t('about.github')}</Button
			>
		</div>
	</section>
	<section class="notice"><p>{t('about.privacyCopy')}</p></section>
	<div class="back-link">
		<Button href="/" variant="ghost"
			><Icon name="arrow" class="back-arrow" />{t('about.back')}</Button
		>
	</div>
</main>

<style>
	.github-link {
		margin-top: 20px;
	}
	.back-link {
		margin-top: 32px;
	}
	:global(.back-arrow) {
		transform: rotate(180deg);
	}
</style>
