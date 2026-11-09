<script lang="ts">
	import { MAX_JOB_POST_CHARS } from '#lib/core/ats/keywords.ts';
	import type {
		AtsCheck,
		AtsReport,
		CheckTarget,
		KeywordMatch,
		KeywordReport
	} from '#lib/core/ats/types.ts';
	import { t } from '#lib/i18n/index.svelte.ts';
	import Button from '#lib/ui/Button.svelte';
	import Textarea from '#lib/ui/Textarea.svelte';

	interface Props {
		report?: AtsReport;
		keywords?: KeywordReport;
		loading?: boolean;
		failed?: boolean;
		jobPost?: string;
		onjump: (target: CheckTarget) => void | Promise<void>;
		onadd: (term: string) => void;
		onretry: () => void;
		canAdd?: (term: string) => boolean;
	}

	let {
		report,
		keywords,
		loading = false,
		failed = false,
		jobPost = $bindable(''),
		onjump,
		onadd,
		onretry,
		canAdd = () => true
	}: Props = $props();
	const uid = $props.id();
	const levels = ['error', 'warn'] as const;
	const groups = $derived(
		levels
			.map((level) => ({
				level,
				checks: report?.checks.filter((check) => check.level === level) ?? []
			}))
			.filter((group) => group.checks.length > 0)
	);
	const tips = $derived(report?.checks.filter((check) => check.level === 'tip') ?? []);
	const knownFirst = (a: KeywordMatch, b: KeywordMatch) => Number(b.known) - Number(a.known);
	const present = $derived(
		(keywords?.keywords.filter((keyword) => keyword.inCv) ?? []).sort(knownFirst)
	);
	const missing = $derived(
		(keywords?.keywords.filter((keyword) => !keyword.inCv) ?? []).sort(knownFirst)
	);
</script>

{#snippet checkList(checks: AtsCheck[])}
	<ul class="check-list">
		{#each checks as check, index (`${check.id}:${check.target.section ?? ''}:${check.target.itemId ?? ''}:${check.target.field ?? ''}:${index}`)}
			<li>
				<button
					type="button"
					class="check-action"
					data-check-id={check.id}
					onclick={() => onjump(check.target)}
				>
					{t(check.messageKey, check.params)}
				</button>
			</li>
		{/each}
	</ul>
{/snippet}

<section
	id="ats-panel"
	class="ats-panel"
	data-testid="ats-panel"
	aria-busy={loading || undefined}
	aria-labelledby="{uid}-title"
	tabindex="-1"
>
	<h2 id="{uid}-title">{t('atsPanel.title')}</h2>
	{#if report}
		<div class="score-summary" role="status" aria-atomic="true" aria-busy={loading || undefined}>
			<div class="score-line">
				<p class="score" data-testid="ats-score">{report.score}/100</p>
				<p class="grade">{t(`ats.grades.${report.grade}`)}</p>
			</div>
			<p class="counts" data-testid="ats-summary">
				{t('atsPanel.summary', report.counts)}
			</p>
		</div>
	{/if}
	<p class="disclaimer">{t('atsPanel.disclaimer')}</p>
	{#if loading}<p class="loading" role="status">{t('atsPanel.loading')}</p>{/if}
	{#if failed}
		<div class="analysis-error" role="alert">
			<p>{t('atsPanel.failed')}</p>
			<Button variant="secondary" size="sm" onclick={onretry}>{t('atsPanel.retry')}</Button>
		</div>
	{/if}
	{#if report}
		{#if report.checks.length === 0}
			<p class="empty">{t('atsPanel.empty')}</p>
		{:else}
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
						{@render checkList(group.checks)}
					</section>
				{/each}
				{#if tips.length}
					<details class="check-group tip" data-level="tip" data-count={tips.length}>
						<summary>{t('atsPanel.showTips', { count: tips.length })}</summary>
						<div class="tips-content">
							<h3>{t('ats.levels.tip')}</h3>
							{@render checkList(tips)}
						</div>
					</details>
				{/if}
			</div>
		{/if}
	{/if}

	<details class="job-match">
		<summary>{t('atsPanel.matchTitle')}</summary>
		<div class="job-content">
			<div class="job-field">
				<Textarea
					id="{uid}-job-post"
					label={t('atsPanel.jobLabel')}
					placeholder={t('atsPanel.jobPlaceholder')}
					hint={t('atsPanel.jobPrivacy')}
					maxlength={MAX_JOB_POST_CHARS}
					showCounter={false}
					autocomplete="off"
					spellcheck={false}
					rows={5}
					aria-describedby="{uid}-job-count"
					bind:value={jobPost}
				/>
				<p class="character-count" id="{uid}-job-count">
					{t('atsPanel.characterCount', { count: jobPost.length, max: MAX_JOB_POST_CHARS })}
				</p>
			</div>
			{#if jobPost.trim() && keywords}
				<div class="keyword-results" data-testid="ats-keywords">
					<p class="keyword-summary" role="status">
						{t('atsPanel.keywordSummary', {
							matched: present.length,
							total: keywords.keywords.length,
							percent: Math.round(keywords.coverage * 100)
						})}
					</p>
					{#if keywords.keywords.length === 0}
						<p>{t('atsPanel.noKeywords')}</p>
					{:else}
						<section
							class="keyword-group"
							data-testid="ats-keywords-present"
							aria-labelledby="{uid}-present-title"
						>
							<h3 id="{uid}-present-title">{t('atsPanel.presentTitle')}</h3>
							{#if present.length}
								<ul class="keyword-list">
									{#each present as keyword (keyword.term)}
										<li>
											<span class="keyword-chip present" data-known={keyword.known}
												>{keyword.term}</span
											>
										</li>
									{/each}
								</ul>
							{:else}<p class="keyword-empty">{t('atsPanel.nonePresent')}</p>{/if}
						</section>
						<section
							class="keyword-group"
							data-testid="ats-keywords-missing"
							aria-labelledby="{uid}-missing-title"
						>
							<h3 id="{uid}-missing-title">{t('atsPanel.missingTitle')}</h3>
							{#if missing.length}
								<p class="keyword-help">{t('atsPanel.keywordHelp')}</p>
								<ul class="keyword-list">
									{#each missing as keyword (keyword.term)}
										<li>
											{#if keyword.known}
												<button
													type="button"
													class="keyword-chip missing add-keyword"
													data-known="true"
													aria-label={t('atsPanel.addKeyword', { term: keyword.term })}
													disabled={!canAdd(keyword.term)}
													onclick={() => onadd(keyword.term)}>{keyword.term}</button
												>
											{:else}<span class="keyword-chip missing" data-known="false"
													>{keyword.term}</span
												>{/if}
										</li>
									{/each}
								</ul>
							{:else}<p class="keyword-empty">{t('atsPanel.noneMissing')}</p>{/if}
						</section>
					{/if}
				</div>
			{/if}
		</div>
	</details>
</section>

<style>
	.ats-panel {
		display: grid;
		gap: 16px;
		min-width: 0;
		margin-block: 20px 28px;
		padding: 16px;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
		color: var(--color-ink);
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
	.disclaimer,
	.loading,
	.keyword-empty,
	.keyword-help {
		color: var(--color-text-muted);
		font-size: 0.8125rem;
	}
	.analysis-error {
		display: grid;
		justify-items: start;
		gap: 8px;
		font-size: 0.875rem;
	}
	.empty {
		font-size: 0.875rem;
	}
	.check-groups {
		display: grid;
		gap: 12px;
		min-width: 0;
	}
	.check-group {
		min-width: 0;
		border-radius: var(--radius-md);
		padding: 12px;
		color: var(--color-ink);
	}
	.check-group.error {
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
		gap: 4px;
		margin: 8px 0 0;
		padding: 0;
		list-style: none;
	}
	.check-action {
		width: 100%;
		min-width: 44px;
		min-height: 44px;
		border: 0;
		border-radius: var(--radius-sm);
		padding: 10px 4px;
		background: transparent;
		color: inherit;
		font-size: 0.875rem;
		line-height: 1.6;
		text-align: left;
		overflow-wrap: anywhere;
	}
	.check-action:hover:not(:disabled) {
		text-decoration: underline;
		text-underline-offset: 0.15em;
	}
	summary {
		min-height: 44px;
		padding-block: 10px;
		font-size: 0.875rem;
		font-weight: 600;
		cursor: pointer;
	}
	.tips-content {
		padding-top: 8px;
	}
	.job-match {
		min-width: 0;
		border-top: 1px solid var(--color-border);
		padding-top: 4px;
	}
	.job-content {
		display: grid;
		gap: 20px;
		padding-top: 12px;
		min-width: 0;
	}
	.job-field {
		min-width: 0;
	}
	.job-field :global(textarea) {
		max-height: 18rem;
		overflow-y: auto;
	}
	.character-count {
		margin-top: 8px;
		text-align: right;
		color: var(--color-text-muted);
		font-size: 0.75rem;
	}
	.keyword-results,
	.keyword-group {
		display: grid;
		gap: 12px;
		min-width: 0;
	}
	.keyword-results {
		gap: 20px;
	}
	.keyword-summary {
		font-size: 0.875rem;
		font-weight: 600;
	}
	.keyword-list {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		padding: 0;
		margin: 0;
		list-style: none;
	}
	.keyword-list li {
		min-width: 0;
		max-width: 100%;
	}
	.keyword-chip {
		display: inline-flex;
		align-items: center;
		min-width: 0;
		max-width: 100%;
		padding: 8px 12px;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		color: var(--color-ink);
		font-size: 0.8125rem;
		line-height: 1.5;
		text-align: left;
		overflow-wrap: anywhere;
	}
	.keyword-chip.present {
		background: var(--color-mint-50);
	}
	.keyword-chip.missing {
		background: var(--color-cream-50);
	}
	.add-keyword {
		min-width: 44px;
		min-height: 44px;
		text-decoration: underline;
		text-underline-offset: 0.15em;
	}
	.add-keyword:hover:not(:disabled) {
		background: var(--color-cream);
	}
	.add-keyword:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
	@media (min-width: 768px) {
		.ats-panel {
			padding: 20px;
		}
	}
</style>
