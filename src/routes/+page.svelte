<script lang="ts">
	import { resolve } from '$app/paths';
	import { t } from '#lib/i18n/index.svelte.ts';
	import Accordion from '#lib/ui/Accordion.svelte';
	import Button from '#lib/ui/Button.svelte';
	import CvMockup from '#lib/ui/CvMockup.svelte';
	import Icon from '#lib/ui/Icon.svelte';
	const faqKeys = ['Ats', 'Free', 'Storage', 'Deleted', 'Mobile', 'English'] as const;
</script>

<svelte:head>
	<title>{t('landing.title')}</title>
	<meta name="description" content={t('landing.description')} />
</svelte:head>

<main id="main" tabindex="-1">
	<section class="hero site-container" aria-labelledby="hero-title">
		<div class="hero-copy">
			<p class="eyebrow hero-eyebrow"><span aria-hidden="true"></span>{t('landing.eyebrow')}</p>
			<h1 id="hero-title" aria-label={t('landing.headline')}>
				{t('landing.headlineStart')} <span>{t('landing.headlineEnd')}</span>
			</h1>
			<p class="hero-intro">{t('landing.intro')}</p>
			<div class="button-row hero-actions">
				<Button href="/buat" size="lg">{t('nav.create')}<Icon /></Button><Button
					href="/cv"
					variant="secondary"
					size="lg">{t('nav.myCvs')}</Button
				>
			</div>
			<div class="hero-promises">
				<span><Icon name="check" size={16} />{t('landing.free')}</span><span
					><Icon name="shield" size={16} />{t('landing.local')}</span
				>
			</div>
		</div>
		<CvMockup />
	</section>
	<section class="how-section" aria-labelledby="how-title">
		<div class="site-container">
			<p class="eyebrow">{t('landing.howEyebrow')}</p>
			<h2 class="section-title" id="how-title">{t('landing.howTitle')}</h2>
			<p class="section-copy">{t('landing.howIntro')}</p>
			<ol class="how-grid">
				<li>
					<div class="step-top">
						<span>{t('landing.stepOne')}</span><Icon name="file" size={24} />
					</div>
					<h3>{t('landing.chooseTitle')}</h3>
					<p>{t('landing.chooseCopy')}</p>
				</li>
				<li>
					<div class="step-top">
						<span>{t('landing.stepTwo')}</span><Icon name="book" size={24} />
					</div>
					<h3>{t('landing.fillTitle')}</h3>
					<p>{t('landing.fillCopy')}</p>
				</li>
				<li>
					<div class="step-top">
						<span>{t('landing.stepThree')}</span><Icon name="download" size={24} />
					</div>
					<h3>{t('landing.downloadTitle')}</h3>
					<p>{t('landing.downloadCopy')}</p>
				</li>
			</ol>
		</div>
	</section>
	<section class="types-section site-container" aria-labelledby="types-title">
		<div class="section-heading">
			<p class="eyebrow">{t('landing.typeEyebrow')}</p>
			<h2 class="section-title" id="types-title">{t('landing.typeTitle')}</h2>
			<p class="section-copy">{t('landing.typeIntro')}</p>
		</div>
		<div class="type-grid">
			<article class="type-card ats-card">
				<div class="type-top">
					<span class="type-icon"><Icon name="file" size={24} /></span><span class="type-label"
						>{t('landing.atsLabel')}</span
					>
				</div>
				<div class="mini-paper ats-mini" aria-hidden="true">
					<div class="mini-name"></div>
					<div class="mini-contact"></div>
					{#each [1, 2, 3] as item (item)}<div class="mini-section">
							<b></b><i></i><i></i><i></i>
						</div>{/each}
				</div>
				<h3>{t('landing.atsTitle')}</h3>
				<p>{t('landing.atsCopy')}</p>
				<p class="type-detail">{t('landing.atsDetail')}</p>
			</article>
			<article class="type-card creative-card">
				<div class="type-top">
					<span class="type-icon"><Icon name="spark" size={24} /></span><span class="type-label"
						>{t('landing.creativeLabel')}</span
					>
				</div>
				<div class="mini-paper creative-mini" aria-hidden="true">
					<div class="mini-sidebar">
						<div class="mini-photo"></div>
						<i></i><i></i><i></i>
					</div>
					<div class="mini-main">
						<div class="mini-name"></div>
						<div class="mini-contact"></div>
						{#each [1, 2, 3] as item (item)}<div class="mini-section">
								<b></b><i></i><i></i>
							</div>{/each}
					</div>
				</div>
				<h3>{t('landing.creativeTitle')}</h3>
				<p>{t('landing.creativeCopy')}</p>
				<span class="warning-label">{t('landing.creativeWarning')}</span>
				<p class="type-detail">{t('landing.creativeDetail')}</p>
			</article>
		</div>
	</section>
	<section class="privacy-section site-container" aria-labelledby="privacy-title">
		<div class="privacy-icon"><Icon name="shield" size={44} /></div>
		<div>
			<p class="eyebrow">{t('landing.privacyEyebrow')}</p>
			<h2 class="section-title" id="privacy-title">{t('landing.privacyTitle')}</h2>
			<p class="section-copy">{t('landing.privacyCopy')}</p>
			<p class="backup-note">{t('landing.privacyBackup')}</p>
			<a href={resolve('/privasi')} class="privacy-link"
				>{t('landing.privacyLink')}<Icon size={18} /></a
			>
		</div>
	</section>
	<section class="faq-section site-container" aria-labelledby="faq-title">
		<div>
			<p class="eyebrow">{t('landing.faqEyebrow')}</p>
			<h2 class="section-title" id="faq-title">{t('landing.faqTitle')}</h2>
			<p class="section-copy">{t('landing.faqIntro')}</p>
		</div>
		<div class="faq-list">
			{#each faqKeys as key (key)}<Accordion title={t(`landing.faq${key}Question`)}
					><p>{t(`landing.faq${key}Answer`)}</p></Accordion
				>{/each}
		</div>
	</section>
	<section class="closing-section site-container" aria-labelledby="closing-title">
		<span class="closing-spark"><Icon name="spark" size={24} /></span>
		<h2 class="section-title" id="closing-title">{t('landing.closingTitle')}</h2>
		<p>{t('landing.closingCopy')}</p>
		<Button href="/buat" size="lg">{t('landing.start')}<Icon /></Button>
	</section>
</main>

<style>
	.hero {
		display: grid;
		gap: 48px;
		padding-block: 48px 64px;
		align-items: center;
	}
	.hero-eyebrow {
		display: flex;
		gap: 8px;
		align-items: center;
		line-height: 1.6;
	}
	.hero-eyebrow span {
		width: 6px;
		height: 6px;
		background: var(--color-primary-600);
		border-radius: 50%;
		flex-shrink: 0;
	}
	h1 {
		font-size: clamp(36px, 5vw, 48px);
		font-weight: 800;
		line-height: 1.14;
		letter-spacing: -0.055em;
		margin-top: 20px;
		max-width: 580px;
	}
	h1 span {
		color: var(--color-primary-600);
	}
	.hero-intro {
		margin-top: 24px;
		font-size: 16px;
		line-height: 1.85;
		color: var(--color-text-muted);
		max-width: 480px;
	}
	.hero-actions {
		margin-top: 28px;
	}
	.hero-promises {
		display: flex;
		flex-wrap: wrap;
		gap: 12px 20px;
		margin-top: 24px;
		color: var(--color-text-muted);
		font-size: 12px;
	}
	.hero-promises span {
		display: inline-flex;
		align-items: center;
		gap: 8px;
	}
	.hero-promises :global(svg) {
		color: var(--color-primary-600);
	}
	.how-section {
		background: var(--color-surface);
		padding-block: 56px;
		border-block: 1px solid var(--color-neutral-200);
	}
	.section-title {
		margin-top: 12px;
	}
	.how-grid {
		display: grid;
		gap: 32px;
		margin: 32px 0 0;
		list-style: none;
		padding: 0;
	}
	.how-grid li {
		padding-top: 20px;
		border-top: 1px solid var(--color-neutral-200);
	}
	.step-top {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 16px;
		color: var(--color-primary-600);
	}
	.step-top span {
		font-size: 14px;
		font-weight: 750;
		letter-spacing: 0.05em;
	}
	h3 {
		font-size: 20px;
		font-weight: 750;
	}
	.how-grid p {
		color: var(--color-text-muted);
		margin-top: 12px;
		font-size: 14px;
		line-height: 1.8;
		max-width: 360px;
	}
	.types-section {
		padding-block: 64px;
	}
	.type-grid {
		display: grid;
		gap: 20px;
		margin-top: 32px;
	}
	.type-card {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		padding: 24px;
		border-radius: var(--radius-lg);
		border: 1px solid var(--color-neutral-200);
		background: white;
		overflow: hidden;
	}
	.type-top {
		width: 100%;
		display: flex;
		align-items: center;
		gap: 12px;
		color: var(--color-primary-700);
	}
	.type-icon {
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		background: var(--color-primary-50);
		border-radius: 10px;
	}
	.type-label {
		font-size: 12px;
		font-weight: 750;
		letter-spacing: 0.1em;
	}
	.creative-card .type-icon {
		background: var(--color-accent-50);
		color: var(--color-accent-700);
	}
	.creative-card .type-label {
		color: var(--color-accent-700);
	}
	.type-card h3 {
		font-size: 24px;
		margin-top: 24px;
	}
	.type-card p {
		color: var(--color-text-muted);
		margin-top: 12px;
		font-size: 14px;
		line-height: 1.8;
	}
	.type-card .type-detail {
		font-size: 12px;
		padding-top: 16px;
		border-top: 1px solid var(--color-neutral-200);
		width: 100%;
		margin-top: 20px;
	}
	.warning-label {
		display: inline-block;
		color: var(--color-warning);
		background: var(--color-warning-surface);
		border-radius: 6px;
		padding: 4px 8px;
		font-size: 12px;
		font-weight: 650;
		margin-top: 16px;
	}
	.mini-paper {
		align-self: center;
		margin-top: 24px;
		background: var(--color-neutral-50);
		height: 176px;
		width: min(100%, 236px);
		border: 1px solid var(--color-neutral-200);
		border-radius: 4px;
		padding: 20px;
	}
	.mini-name {
		width: 65%;
		height: 6px;
		background: var(--color-primary-700);
		border-radius: 2px;
	}
	.mini-contact {
		width: 45%;
		height: 3px;
		background: var(--color-neutral-300);
		margin-top: 8px;
	}
	.mini-section {
		margin-top: 12px;
	}
	.mini-section b {
		display: block;
		height: 3px;
		width: 35%;
		background: #6b9c8f;
		margin-bottom: 8px;
	}
	.mini-section i {
		display: block;
		height: 2px;
		background: var(--color-neutral-200);
		width: 100%;
		margin-top: 4px;
	}
	.mini-section i:last-child {
		width: 72%;
	}
	.creative-mini {
		display: flex;
		padding: 0;
	}
	.mini-sidebar {
		width: 32%;
		background: var(--color-primary-700);
		padding: 16px 12px;
	}
	.mini-sidebar i {
		display: block;
		height: 2px;
		width: 100%;
		background: #8bbfb4;
		margin-top: 8px;
	}
	.mini-photo {
		width: 28px;
		height: 28px;
		border-radius: 50%;
		background: #a3cdbb;
		margin-bottom: 16px;
	}
	.mini-main {
		flex: 1;
		padding: 20px 12px;
	}
	.privacy-section {
		background: #edf6f1;
		border: 1px solid #dcece3;
		border-radius: var(--radius-lg);
		display: grid;
		gap: 24px;
		padding: 28px;
	}
	.privacy-icon {
		width: 80px;
		height: 80px;
		background: #dceee3;
		color: var(--color-primary-700);
		border-radius: 24px;
		display: grid;
		place-items: center;
	}
	.backup-note {
		margin-top: 12px;
		color: var(--color-text-muted);
		font-size: 14px;
		max-width: 620px;
	}
	.privacy-link {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		min-height: 44px;
		margin-top: 12px;
		font-size: 14px;
		font-weight: 700;
	}
	.faq-section {
		display: grid;
		gap: 32px;
		padding-block: 64px;
	}
	.faq-list {
		min-width: 0;
	}
	.faq-list p {
		color: var(--color-text-muted);
		font-size: 14px;
		line-height: 1.9;
	}
	.closing-section {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		padding-block: 16px 72px;
	}
	.closing-spark {
		width: 48px;
		height: 48px;
		border-radius: 50%;
		background: var(--color-accent-50);
		color: var(--color-accent-700);
		display: grid;
		place-items: center;
		margin-bottom: 12px;
	}
	.closing-section p {
		color: var(--color-text-muted);
		margin-block: 16px 24px;
	}
	@media (min-width: 768px) {
		.hero {
			grid-template-columns: 1.12fr 1fr;
			gap: 36px;
			padding-block: 64px 80px;
		}
		h1 {
			font-size: clamp(36px, 4.4vw, 48px);
		}
		.how-grid {
			grid-template-columns: repeat(3, 1fr);
			gap: 32px;
		}
		.type-grid {
			grid-template-columns: repeat(2, 1fr);
			gap: 24px;
		}
		.type-card {
			padding: 32px;
		}
		.privacy-section {
			grid-template-columns: 88px 1fr;
			align-items: start;
			gap: 32px;
			padding: 40px;
		}
		.faq-section {
			grid-template-columns: 0.8fr 1.2fr;
			gap: 48px;
			padding-block: 88px;
		}
		.types-section {
			padding-block: 80px;
		}
		.how-section {
			padding-block: 64px;
		}
	}
</style>
