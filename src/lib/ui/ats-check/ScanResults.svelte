<script lang="ts">
	import type { KeywordReport } from '#lib/core/ats/types.ts';
	import type { ScanReport, ScanSection } from '#lib/core/scan/types.ts';
	import { t, type MessageKey } from '#lib/i18n/index.svelte.ts';
	import Button from '#lib/ui/Button.svelte';
	import SharedKeywordResults from './SharedKeywordResults.svelte';

	let {
		report,
		keywords,
		jobPost = ''
	}: { report: ScanReport; keywords?: KeywordReport; jobPost?: string } = $props();
	const uid = $props.id();
	const levels = ['error', 'warn', 'tip'] as const;
	const imageCheck = $derived(report.checks.find((check) => check.id === 'imageOnly'));
	const groups = $derived(
		levels
			.map((level) => ({
				level,
				checks: report.checks.filter((check) => check.level === level && check.id !== 'imageOnly')
			}))
			.filter((group) => group.checks.length > 0)
	);
	const sectionLabels: Record<ScanSection, MessageKey> = {
		summary: 'wizard.fields.summary',
		education: 'wizard.steps.education.title',
		experience: 'wizard.steps.experience.short',
		organizations: 'wizard.steps.organizations.title',
		projects: 'wizard.steps.projects.title',
		skills: 'wizard.steps.skills.short',
		languages: 'wizard.fields.languages',
		certifications: 'wizard.fields.certifications',
		awards: 'wizard.fields.awards'
	};
	const contacts = $derived([
		{ key: 'email', label: t('wizard.fields.email'), found: report.contact.email },
		{ key: 'phone', label: t('wizard.fields.phone'), found: report.contact.phone },
		{ key: 'linkedin', label: t('atsCheck.contactLinkedIn'), found: report.contact.linkedin }
	]);
</script>

<section
	id="scan-results"
	class="scan-results"
	data-testid="scan-results"
	aria-labelledby="{uid}-title"
	tabindex="-1"
>
	<h2 id="{uid}-title">{t('atsCheck.scanResultsTitle')}</h2>
	{#if imageCheck}
		<div class="image-only" data-testid="scan-image-only">
			<h3>{t('atsCheck.imageOnlyTitle')}</h3>
			<p data-check-id={imageCheck.id}>{t(imageCheck.messageKey, imageCheck.params)}</p>
			<Button href="/buat" variant="secondary">{t('atsCheck.createAts')}</Button>
		</div>
	{/if}
	<div class="score-summary" role="status" aria-atomic="true">
		<div class="score-line">
			<p class="score" data-testid="scan-score">{report.score}/100</p>
			<p class="grade">{t(`ats.grades.${report.grade}`)}</p>
		</div>
		<p class="counts" data-testid="scan-summary">{t('atsPanel.summary', report.counts)}</p>
	</div>
	<p class="disclaimer">{t('atsPanel.disclaimer')}</p>
	{#if report.checks.length === 0}
		<p>{t('atsPanel.empty')}</p>
	{:else if groups.length}
		<div class="check-groups">
			{#each groups as group (group.level)}
				<section
					class="check-group {group.level}"
					data-level={group.level}
					data-count={group.checks.length}
					aria-labelledby="{uid}-{group.level}-title"
				>
					<h3 id="{uid}-{group.level}-title">
						{t(`ats.levels.${group.level}`)} <span>{group.checks.length}</span>
					</h3>
					<ul class="check-list">
						{#each group.checks as check, index (`${check.id}:${index}`)}
							<li data-check-id={check.id}>{t(check.messageKey, check.params)}</li>
						{/each}
					</ul>
				</section>
			{/each}
		</div>
	{/if}
	<div class="file-summary">
		<section aria-labelledby="{uid}-sections-title">
			<h3 id="{uid}-sections-title">{t('atsCheck.sectionsTitle')}</h3>
			{#if report.sections.length}
				<ul class="detected-sections" data-testid="scan-sections">
					{#each report.sections as section (section)}<li>{t(sectionLabels[section])}</li>{/each}
				</ul>
			{:else}<p>{t('atsCheck.noSections')}</p>{/if}
		</section>
		<section aria-labelledby="{uid}-contacts-title">
			<h3 id="{uid}-contacts-title">{t('atsCheck.contactsTitle')}</h3>
			<ul class="contacts" data-testid="scan-contacts">
				{#each contacts as contact (contact.key)}
					<li data-found={contact.found}>
						{t(contact.found ? 'atsCheck.contactFound' : 'atsCheck.contactMissing', {
							label: contact.label
						})}
					</li>
				{/each}
			</ul>
		</section>
		<section aria-labelledby="{uid}-stats-title">
			<h3 id="{uid}-stats-title">{t('atsCheck.statsTitle')}</h3>
			<dl class="stats" data-testid="scan-stats">
				<div>
					<dt>{t('atsCheck.pagesLabel')}</dt>
					<dd>{report.stats.pages}</dd>
				</div>
				<div>
					<dt>{t('atsCheck.wordsLabel')}</dt>
					<dd>{report.stats.words}</dd>
				</div>
			</dl>
		</section>
	</div>
	{#if jobPost.trim() && keywords}
		<SharedKeywordResults {keywords} />
	{/if}
	{#if !imageCheck}
		<div class="create-cv">
			<p>{t('atsCheck.createCta')}</p>
			<Button href="/buat" variant="secondary">{t('atsCheck.createAts')}</Button>
		</div>
	{/if}
</section>

<style>
	.scan-results {
		display: grid;
		gap: 20px;
		min-width: 0;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
		padding: 16px;
		color: var(--color-text);
		overflow-wrap: anywhere;
	}
	h2 {
		margin: 0;
		font-size: 1.25rem;
		font-weight: 650;
	}
	h3 {
		margin: 0;
		font-size: 0.875rem;
		font-weight: 650;
	}
	p {
		margin: 0;
	}
	.score-summary {
		display: grid;
		gap: 8px;
	}
	.score-line {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 8px 16px;
	}
	.score {
		font-size: 2rem;
		font-weight: 650;
		line-height: 1.2;
	}
	.grade {
		font-size: 0.875rem;
		font-weight: 600;
	}
	.counts,
	.disclaimer {
		color: var(--color-text-muted);
		font-size: 0.8125rem;
	}
	.check-groups {
		display: grid;
		gap: 12px;
		min-width: 0;
	}
	.check-group,
	.image-only {
		min-width: 0;
		border-radius: var(--radius-md);
		padding: 12px;
		color: var(--color-text);
	}
	.check-group.error,
	.image-only {
		background: var(--color-coral-50);
	}
	.check-group.warn {
		background: var(--color-cream-50);
	}
	.check-group.tip {
		background: var(--color-mint-50);
	}
	h3 span {
		margin-left: 4px;
		font-weight: 500;
	}
	.check-list {
		display: grid;
		gap: 8px;
		margin: 8px 0 0;
		padding: 0;
		list-style: none;
		font-size: 0.875rem;
		line-height: 1.6;
	}
	.image-only {
		display: grid;
		justify-items: start;
		gap: 12px;
	}
	.image-only p,
	.create-cv p {
		font-size: 0.875rem;
		line-height: 1.6;
	}
	.file-summary {
		display: grid;
		gap: 20px;
		min-width: 0;
		border-block: 1px solid var(--color-border);
		padding-block: 16px;
	}
	.file-summary section {
		min-width: 0;
	}
	.file-summary p,
	.detected-sections,
	.contacts,
	.stats {
		margin: 8px 0 0;
		font-size: 0.875rem;
		line-height: 1.6;
	}
	.detected-sections,
	.contacts {
		display: grid;
		gap: 4px;
		padding-left: 1.25rem;
	}
	.stats {
		display: flex;
		flex-wrap: wrap;
		gap: 12px 32px;
	}
	.stats div {
		display: grid;
		gap: 2px;
	}
	dt {
		color: var(--color-text-muted);
	}
	dd {
		margin: 0;
		font-weight: 650;
	}
	.create-cv {
		display: grid;
		justify-items: start;
		gap: 12px;
		border-radius: var(--radius-md);
		background: var(--color-mint-50);
		padding: 16px;
	}
	@media (min-width: 768px) {
		.scan-results {
			padding: 20px;
		}
		.file-summary {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
</style>
