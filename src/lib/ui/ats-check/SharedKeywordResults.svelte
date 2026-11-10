<script lang="ts">
	import type { KeywordMatch, KeywordReport } from '#lib/core/ats/types.ts';
	import { t } from '#lib/i18n/index.svelte.ts';

	let {
		keywords,
		onadd,
		canAdd = () => true
	}: {
		keywords: KeywordReport;
		onadd?: (term: string) => void;
		canAdd?: (term: string) => boolean;
	} = $props();
	const uid = $props.id();
	const knownFirst = (a: KeywordMatch, b: KeywordMatch) => Number(b.known) - Number(a.known);
	const present = $derived(keywords.keywords.filter((keyword) => keyword.inCv).sort(knownFirst));
	const missing = $derived(keywords.keywords.filter((keyword) => !keyword.inCv).sort(knownFirst));
</script>

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
							<span class="keyword-chip present" data-known={keyword.known}>{keyword.term}</span>
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
				{#if onadd}<p class="keyword-help">{t('atsPanel.keywordHelp')}</p>{/if}
				<ul class="keyword-list">
					{#each missing as keyword (keyword.term)}
						<li>
							{#if keyword.known && onadd}
								<button
									type="button"
									class="keyword-chip missing add-keyword"
									data-known="true"
									aria-label={t('atsPanel.addKeyword', { term: keyword.term })}
									disabled={!canAdd(keyword.term)}
									onclick={() => onadd?.(keyword.term)}>{keyword.term}</button
								>
							{:else}<span class="keyword-chip missing" data-known={keyword.known}
									>{keyword.term}</span
								>{/if}
						</li>
					{/each}
				</ul>
			{:else}<p class="keyword-empty">{t('atsPanel.noneMissing')}</p>{/if}
		</section>
	{/if}
</div>

<style>
	.keyword-results,
	.keyword-group {
		display: grid;
		gap: 12px;
		min-width: 0;
	}
	.keyword-results {
		gap: 20px;
	}
	h3 {
		margin: 0;
		font-size: 0.875rem;
		font-weight: 650;
	}
	.keyword-summary {
		font-size: 0.875rem;
		font-weight: 600;
	}
	.keyword-empty,
	.keyword-help {
		color: var(--color-text-muted);
		font-size: 0.8125rem;
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
		color: var(--color-text);
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
</style>
