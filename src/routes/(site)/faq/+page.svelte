<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';
	import Accordion from '#lib/ui/Accordion.svelte';
	import Button from '#lib/ui/Button.svelte';
	const questions = [
		'ats',
		'scanUpload',
		'scanScore',
		'aiInvented',
		'free',
		'storage',
		'deleted',
		'incognito',
		'mobile',
		'english',
		'ai',
		'aiQuota'
	] as const;
</script>

<svelte:head>
	<title>{t('faq.title')}</title>
	<meta name="description" content={t('faq.description')} />
</svelte:head>

<main id="main" tabindex="-1" class="site-container prose-page">
	<h1>{t('faq.heading')}</h1>
	<p class="intro">{t('faq.intro')}</p>
	<section class="faq-list" aria-labelledby="questions-title">
		<h2 id="questions-title" class="sr-only">{t('faq.questionsTitle')}</h2>
		{#each questions as question (question)}
			<Accordion title={t(`faq.${question}Question`)}><p>{t(`faq.${question}Answer`)}</p></Accordion
			>
		{/each}
		<Accordion title={t('faq.makerQuestion')}>
			<p>{t('faq.makerAnswer')}</p>
			<a class="maker-link" href="https://codiosity.com" target="_blank" rel="noopener noreferrer"
				>{t('faq.makerLink')} <span aria-hidden="true">↗</span><span class="sr-only">
					{t('a11y.opensNewTab')}</span
				></a
			>
		</Accordion>
	</section>
	<div class="back-link"><Button href="/" variant="ghost">{t('faq.back')}</Button></div>
</main>

<style>
	.faq-list {
		margin-top: 32px;
	}
	.maker-link {
		display: inline-flex;
		min-height: 44px;
		align-items: center;
		gap: 4px;
		margin-top: 8px;
		font-weight: 600;
	}
	.back-link {
		margin-top: 32px;
	}
</style>
