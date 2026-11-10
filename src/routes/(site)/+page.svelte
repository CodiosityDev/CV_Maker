<script lang="ts">
	import { resolve } from '$app/paths';
	import { t } from '#lib/i18n/index.svelte.ts';
	import Button from '#lib/ui/Button.svelte';
	import CvMockup from '#lib/ui/CvMockup.svelte';
	import VisitorCounter from '#lib/ui/VisitorCounter.svelte';
</script>

<svelte:head>
	<title>{t('landing.title')}</title>
	<meta name="description" content={t('landing.description')} />
</svelte:head>

<main id="main" tabindex="-1">
	<section class="hero site-container" aria-labelledby="hero-title">
		<div class="hero-copy">
			<h1 id="hero-title">{t('landing.headline')}</h1>
			<p class="hero-intro">{t('landing.intro')}</p>
			<Button href="/buat" size="lg">{t('nav.create')}</Button>
			<a class="ats-link" href={resolve('/(site)/cek-ats')}>{t('landing.atsCheck')}</a>
			<VisitorCounter />
		</div>
		<CvMockup />
	</section>
	<section class="how-section" aria-labelledby="how-title">
		<div class="site-container">
			<h2 id="how-title">{t('landing.howTitle')}</h2>
			<ol>
				<li>
					<h3>{t('landing.chooseTitle')}</h3>
					<p>{t('landing.chooseCopy')}</p>
				</li>
				<li>
					<h3>{t('landing.fillTitle')}</h3>
					<p>{t('landing.fillCopy')}</p>
				</li>
				<li>
					<h3>{t('landing.reviewTitle')}</h3>
					<p>{t('landing.reviewCopy')}</p>
				</li>
			</ol>
		</div>
	</section>
	<section class="types-section site-container" aria-labelledby="types-title">
		<h2 id="types-title">{t('landing.typeTitle')}</h2>
		<div class="type-columns">
			<article>
				<h3>{t('landing.atsTitle')}</h3>
				<p>{t('landing.atsCopy')}</p>
				<p class="detail">{t('landing.atsDetail')}</p>
			</article>
			<article>
				<h3>{t('landing.creativeTitle')}</h3>
				<p>{t('landing.creativeCopy')}</p>
				<p class="warning-label">{t('landing.creativeWarning')}</p>
				<p class="detail">{t('landing.creativeDetail')}</p>
			</article>
		</div>
	</section>
	<div class="site-container closing-links">
		<p class="privacy-line">
			{t('landing.privacyCopy')}
			<a href={resolve('/(site)/privasi')}>{t('landing.privacyLink')}</a>
		</p>
		<p class="faq-line">
			{t('landing.faqCopy')}
			<a href={resolve('/(site)/faq')}>{t('landing.faqLink')}</a>
		</p>
	</div>
</main>

<style>
	.hero {
		display: grid;
		gap: 40px;
		padding-block: 48px;
		align-items: center;
	}
	.hero-copy {
		min-width: 0;
	}
	.ats-link {
		display: flex;
		align-items: center;
		min-height: 44px;
		width: fit-content;
		margin-top: 0.5rem;
		font-size: 0.9375rem;
	}
	h1 {
		max-width: 620px;
		color: var(--color-text);
		font-size: clamp(34px, 4.6vw, 52px);
		font-weight: 650;
		line-height: 1.14;
	}
	.hero-intro {
		max-width: 500px;
		margin-block: 24px;
		color: var(--color-text-muted);
		font-size: 17px;
		line-height: 1.8;
	}
	h2 {
		font-size: clamp(25px, 3vw, 32px);
		font-weight: 600;
	}
	h3 {
		font-size: 19px;
		font-weight: 650;
	}
	.how-section {
		padding-block: 40px;
		border-block: 1px solid var(--color-border);
		background: var(--color-cream-50);
	}
	ol {
		display: grid;
		list-style: decimal;
		gap: 24px;
		max-width: 760px;
		margin: 28px 0 0;
		padding-left: 1.5rem;
	}
	li {
		padding-left: 8px;
	}
	li::marker {
		color: var(--color-text);
		font-weight: 650;
	}
	li p,
	.type-columns p {
		margin-top: 10px;
		color: var(--color-text-muted);
	}
	.types-section {
		padding-block: 40px;
	}
	.type-columns {
		display: grid;
		gap: 28px;
		margin-top: 28px;
	}
	.type-columns article {
		min-width: 0;
	}
	.type-columns h3 {
		font-size: 23px;
	}
	.type-columns .detail {
		font-size: 14px;
	}
	.type-columns .warning-label {
		display: inline-block;
		padding: 4px 8px;
		border-radius: var(--radius-pill);
		background: var(--color-coral-50);
		color: var(--color-coral-ink);
		font-size: 13px;
		font-weight: 600;
	}
	.closing-links {
		padding-bottom: 40px;
	}
	.privacy-line {
		padding-top: 24px;
		border-top: 1px solid var(--color-border);
	}
	.faq-line {
		margin-top: 12px;
	}
	.closing-links p {
		color: var(--color-text-muted);
		font-size: 14px;
	}
	.closing-links a {
		display: inline-flex;
		align-items: center;
		min-height: 44px;
		margin-left: 4px;
		font-weight: 600;
	}
	@media (min-width: 768px) {
		.hero {
			grid-template-columns: 1.2fr 0.8fr;
			gap: 48px;
			padding-block: 64px;
		}
		.how-section,
		.types-section {
			padding-block: 48px;
		}
		.type-columns {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 40px;
		}
		.type-columns article + article {
			padding-left: 40px;
			border-left: 1px solid var(--color-border);
		}
		.closing-links {
			padding-bottom: 48px;
		}
	}
</style>
