<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { cvRepo, incognito, storage } from '#lib/core/storage/index.ts';
	import type { CVKind, CVMeta } from '#lib/core/schema/index.ts';
	import { loadGuidance, type Guidance } from '#lib/core/content/index.ts';
	import { i18n, t } from '#lib/i18n/index.svelte.ts';
	import Button from '#lib/ui/Button.svelte';
	import Card from '#lib/ui/Card.svelte';
	import Select from '#lib/ui/Select.svelte';
	import Icon from '#lib/ui/Icon.svelte';

	let guidance = $state.raw<Guidance | null>(null);
	let unfinished = $state<CVMeta[]>([]);
	let memory = $state(false);
	let guidanceError = $state(false);
	let listError = $state(false);
	let createError = $state(false);
	let creating = $state<CVKind | null>(null);
	let guidanceAttempt = $state(0);
	let application = $state('');
	let creativeField = $state('');
	const kinds: CVKind[] = ['ats', 'creative'];
	const recommendation = $derived<CVKind | null>(
		application === 'online'
			? 'ats'
			: creativeField === 'yes'
				? 'creative'
				: application || creativeField
					? 'ats'
					: null
	);

	$effect(() => {
		const locale = i18n.locale;
		void guidanceAttempt;
		let active = true;
		guidance = null;
		guidanceError = false;
		void loadGuidance(locale).then(
			(value) => {
				if (active) guidance = value;
			},
			() => {
				if (active) guidanceError = true;
			}
		);
		return () => {
			active = false;
		};
	});

	$effect(() => {
		void incognito.active;
		void incognito.expiredAt;
		unfinished = [];
		listError = false;
		let active = true;
		void Promise.all([cvRepo.list(), storage.getMode()]).then(
			([cvs, mode]) => {
				if (!active) return;
				unfinished = cvs.filter((cv) => !cv.wizardCompleted);
				memory = mode === 'memory';
			},
			() => {
				if (active) listError = true;
			}
		);
		return () => {
			active = false;
		};
	});

	async function choose(kind: CVKind) {
		if (creating) return;
		creating = kind;
		createError = false;
		try {
			const cv = await cvRepo.create({ kind, locale: i18n.locale });
			await goto(resolve('/(app)/buat/[id]', { id: cv.id }));
		} catch {
			createError = true;
		} finally {
			creating = null;
		}
	}
</script>

<svelte:head>
	<title>{t('wizard.pageTitle')}</title>
	<meta name="description" content={t('wizard.steps.type.description')} />
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="site-container type-page">
	<div class="intro">
		<h1>{t('wizard.steps.type.title')}</h1>
		<p>{t('wizard.steps.type.description')}</p>
		<p class="local-note">{t('wizard.localNote')}</p>
		<a class="all-cvs" href={resolve('/(app)/cv')}>{t('wizard.allCvs')}</a>
	</div>

	{#if memory}<p class="notice warning" role="status">{t('wizard.memoryWarning')}</p>{/if}
	{#if listError}<p class="notice warning" role="status">{t('wizard.loadError')}</p>{/if}
	{#if createError}<p class="notice error" role="alert">{t('wizard.createError')}</p>{/if}
	{#if incognito.active && incognito.expiredAt}<p class="notice" role="status">
			{t('incognito.expiredMessage')}
		</p>{/if}

	{#if unfinished.length}
		<section class="resume" aria-labelledby="resume-title">
			<h2 id="resume-title">{t('wizard.resumeTitle')}</h2>
			<div class="resume-list">
				{#each unfinished as cv (cv.id)}
					<a class="resume-card" href={resolve('/(app)/buat/[id]', { id: cv.id })}>
						<div>
							<h3>{cv.title || t('wizard.untitled')}</h3>
							<p>
								{t('wizard.updatedAt')}
								<time datetime={cv.updatedAt}
									>{new Intl.DateTimeFormat(i18n.locale === 'id' ? 'id-ID' : 'en-GB', {
										dateStyle: 'medium',
										timeStyle: 'short'
									}).format(Date.parse(cv.updatedAt))}</time
								>
							</p>
						</div>
						<span class="resume-action">{t('wizard.resume')}<Icon size={18} /></span>
					</a>
				{/each}
			</div>
		</section>
	{/if}

	<section class="quiz" aria-labelledby="quiz-title">
		<div>
			<h2 id="quiz-title">{t('wizard.quizTitle')}</h2>
			<p>{t('wizard.quizDescription')}</p>
		</div>
		<div class="quiz-fields">
			<Select
				label={t('wizard.quizApplication')}
				bind:value={application}
				options={[
					{ value: '', label: t('wizard.quizUnanswered') },
					{ value: 'online', label: t('wizard.quizOnline') },
					{ value: 'direct', label: t('wizard.quizDirect') }
				]}
			/>
			<Select
				label={t('wizard.quizCreative')}
				bind:value={creativeField}
				options={[
					{ value: '', label: t('wizard.quizUnanswered') },
					{ value: 'yes', label: t('wizard.quizYes') },
					{ value: 'no', label: t('wizard.quizNo') }
				]}
			/>
		</div>
		<p class="recommendation" role="status">
			{#if recommendation && guidance}{t('wizard.quizResult', {
					type: guidance.cvTypes[recommendation].title
				})}{:else}{t('wizard.quizOptional')}{/if}
		</p>
	</section>

	{#if guidance}
		<div class="type-cards">
			{#each kinds as kind (kind)}
				<Card class={recommendation === kind ? 'recommended-card' : ''}>
					{#if recommendation === kind}<p class="badge">{t('wizard.recommended')}</p>{/if}
					<h2>{guidance.cvTypes[kind].title}</h2>
					<ul>
						{#each guidance.cvTypes[kind].points as point (point)}<li>{point}</li>{/each}
					</ul>
					<Button
						class="choose-button"
						variant={kind === 'ats' ? 'primary' : 'secondary'}
						loading={creating === kind}
						disabled={creating !== null}
						onclick={() => choose(kind)}
					>
						{t(kind === 'ats' ? 'wizard.chooseAts' : 'wizard.chooseCreative')}<Icon size={18} />
					</Button>
				</Card>
			{/each}
		</div>
		<p class="change-note">{guidance.cvTypes.changeLater}</p>
	{:else if guidanceError}
		<div class="notice error" role="alert">
			<p>{t('wizard.loadError')}</p>
			<Button variant="secondary" onclick={() => (guidanceAttempt += 1)}>{t('wizard.retry')}</Button
			>
		</div>
	{:else}
		<p class="notice" role="status">{t('wizard.loading')}</p>
	{/if}
</div>

<style>
	.all-cvs {
		display: inline-flex;
		align-items: center;
		min-height: 44px;
		margin-top: 8px;
		color: var(--color-brand-ink);
		font-size: 0.875rem;
		font-weight: 600;
	}
	.type-page {
		max-width: 960px;
		padding-block: 40px 64px;
	}
	.intro {
		max-width: 650px;
		margin-bottom: 28px;
	}
	h1 {
		margin-block: 12px 16px;
		font-size: clamp(1.875rem, 5vw, 2.75rem);
		font-weight: 650;
	}
	.intro > p {
		color: var(--color-text-muted);
	}
	.local-note {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-top: 16px;
		font-size: 0.875rem;
	}
	h2 {
		font-size: 1.25rem;
	}
	.notice {
		display: grid;
		gap: 12px;
		margin-block: 20px;
		padding: 16px;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
	}
	.warning {
		background: var(--color-warning-surface);
		color: var(--color-warning);
	}
	.error {
		background: var(--color-danger-surface);
		color: var(--color-danger);
	}
	.resume {
		margin-bottom: 28px;
	}
	.resume h2 {
		margin-bottom: 12px;
	}
	.resume-list {
		display: grid;
		gap: 12px;
	}
	.resume-card {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		min-width: 0;
		padding: 16px;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
		color: var(--color-text);
		text-decoration: none;
		box-shadow: var(--shadow-card);
		transition:
			background-color var(--motion-duration) var(--motion-ease),
			transform var(--motion-duration) var(--motion-ease);
	}
	.resume-card:hover {
		background: var(--color-mint-50);
	}
	.resume-card > div {
		min-width: 0;
		overflow-wrap: anywhere;
	}
	.resume-card h3 {
		font-size: 1rem;
	}
	.resume-card p {
		margin-top: 6px;
		color: var(--color-text-muted);
		font-size: 0.75rem;
	}
	.resume-action {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		min-height: 44px;
		color: var(--color-brand-ink);
		font-size: 0.875rem;
		font-weight: 700;
	}
	.quiz {
		display: grid;
		gap: 20px;
		margin-bottom: 28px;
		padding: 20px;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
		box-shadow: var(--shadow-card);
	}
	.quiz > div > p {
		margin-top: 8px;
		color: var(--color-text-muted);
		font-size: 0.875rem;
	}
	.quiz-fields {
		display: grid;
		gap: 20px;
	}
	.recommendation {
		color: var(--color-brand-ink);
		font-size: 0.875rem;
		font-weight: 600;
	}
	.type-cards {
		display: grid;
		gap: 20px;
	}
	.type-cards :global(.card-body) {
		display: flex;
		flex-direction: column;
		height: 100%;
	}
	.type-cards :global(.recommended-card) {
		border-color: var(--color-mint);
		background: var(--color-mint-50);
	}
	.type-cards :global(.card:first-child) {
		background: var(--color-mint-50);
	}
	.badge {
		margin-bottom: 12px;
		color: var(--color-text);
		font-size: 0.875rem;
		font-weight: 600;
		width: fit-content;
		padding: 4px 12px;
		border-radius: var(--radius-pill);
		background: var(--color-mint);
	}
	.type-cards h2 {
		font-size: 1.5rem;
	}
	ul {
		display: grid;
		gap: 10px;
		margin-block: 20px 24px;
		padding-left: 20px;
		list-style: disc;
		color: var(--color-text-muted);
		font-size: 0.875rem;
	}
	li::marker {
		color: var(--color-brand-ink);
	}
	.type-cards :global(.choose-button) {
		width: 100%;
		margin-top: auto;
	}
	.change-note {
		margin-top: 20px;
		color: var(--color-text-muted);
		font-size: 0.875rem;
		text-align: center;
	}
	@media (min-width: 640px) {
		.quiz-fields,
		.type-cards {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.type-page {
			padding-top: 56px;
		}
	}
</style>
