<script lang="ts">
	import { tick } from 'svelte';
	import { resolve } from '$app/paths';
	import type { CVDocument } from '#lib/core/schema/types.ts';
	import {
		JOB_QUERY_MAX,
		jobSearchLinks,
		jobSearchQueryFromCv,
		relatedJobTitles
	} from '#lib/core/jobs/index.ts';
	import type { SuggestionData } from '#lib/core/suggest/index.ts';
	import { incognito } from '#lib/core/storage/index.ts';
	import { t } from '#lib/i18n/index.svelte.ts';

	interface Props {
		cv: CVDocument;
		suggestionData?: SuggestionData;
		onfillTarget?: (event: MouseEvent) => void | Promise<void>;
	}

	let { cv, suggestionData, onfillTarget }: Props = $props();
	const uid = $props.id();
	const query = $derived(jobSearchQueryFromCv(cv));
	const context = $derived(JSON.stringify([cv.id, cv.locale, query?.keyword, query?.city]));
	let selection = $state<{ context: string; keyword: string }>();
	let siteList = $state<HTMLUListElement>();
	const keyword = $derived(
		selection && selection.context === context ? selection.keyword : query?.keyword
	);
	// Where to search: any city the user types (starts with the CV's city); empty = all of
	// Indonesia. Only for this search: nothing is saved to the CV.
	let typedCity = $state<{ context: string; value: string }>();
	const cityInput = $derived(
		typedCity && typedCity.context === context ? typedCity.value : (query?.city ?? '')
	);
	const city = $derived(cityInput.trim() || undefined);
	const links = $derived(query && keyword ? jobSearchLinks({ keyword, city }) : []);

	function setCity(value: string) {
		typedCity = { context, value };
	}
	const related = $derived(
		query && suggestionData ? relatedJobTitles(suggestionData, query.keyword, 3) : []
	);

	function chooseKeyword(value: string) {
		selection = { context, keyword: value };
	}

	async function resetKeyword() {
		selection = undefined;
		await tick();
		siteList?.querySelector<HTMLAnchorElement>('a[data-job-site]')?.focus();
	}
</script>

<section class="job-links" data-testid="job-links" aria-labelledby="{uid}-title">
	<h2 id="{uid}-title">
		{query && keyword ? t('jobLinks.title', { keyword }) : t('jobLinks.emptyTitle')}
	</h2>
	{#if query && keyword}
		<p class="description">{t('jobLinks.description')}</p>
		<div class="place">
			<label for="{uid}-city">{t('jobLinks.location')}</label>
			<div class="place-row">
				<input
					id="{uid}-city"
					type="text"
					value={cityInput}
					oninput={(event) => setCity(event.currentTarget.value)}
					maxlength={JOB_QUERY_MAX}
					autocomplete={incognito.active ? 'off' : 'address-level2'}
					placeholder={t('jobLinks.anywhere')}
					aria-describedby="{uid}-city-hint"
				/>
				{#if city}
					<button type="button" class="anywhere" onclick={() => setCity('')}
						>{t('jobLinks.anywhere')}</button
					>
				{/if}
			</div>
			<small id="{uid}-city-hint">{t('jobLinks.locationHint')}</small>
		</div>
		<ul class="site-list" bind:this={siteList}>
			{#each links as link (link.site)}
				<li>
					<a
						class="site-link"
						href={link.url}
						target="_blank"
						rel="external noopener noreferrer"
						data-job-site={link.site}
					>
						<span class="link-copy">
							<span class="site-name">{link.name}</span>
							<small class="location"
								>{link.usesCity
									? t('jobLinks.city', { city: city ?? '' })
									: t('jobLinks.wholeCountry')}</small
							>
						</span>
						<span class="sr-only"> {t('jobLinks.newTab')}</span>
						<svg
							viewBox="0 0 24 24"
							width="16"
							height="16"
							fill="none"
							stroke="currentColor"
							stroke-width="1.75"
							stroke-linecap="round"
							stroke-linejoin="round"
							aria-hidden="true"
						>
							<path d="M7 17 17 7M7 7h10v10" />
						</svg>
					</a>
				</li>
			{/each}
		</ul>
		{#if related.length}
			<div class="related">
				<p id="{uid}-related">{t('jobLinks.related')}</p>
				<ul class="related-list" aria-labelledby="{uid}-related">
					{#each related as title (title)}
						<li>
							<button
								type="button"
								aria-pressed={keyword === title}
								onclick={() => chooseKeyword(title)}>{title}</button
							>
						</li>
					{/each}
				</ul>
			</div>
		{/if}
		{#if keyword !== query.keyword}
			<button type="button" class="reset-keyword" onclick={resetKeyword}
				>{t('jobLinks.resetKeyword', { keyword: query.keyword })}</button
			>
		{/if}
	{:else}
		<p class="description">{t('jobLinks.empty')}</p>
		<a
			class="fill-target"
			href={resolve('/(app)/buat/[id]?step=target#targetRole', { id: cv.id })}
			onclick={onfillTarget}>{t('jobLinks.fillTarget')}</a
		>
	{/if}
	{#if incognito.active}<p class="incognito-note">{t('jobLinks.incognitoNote')}</p>{/if}
</section>

<style>
	.job-links {
		min-width: 0;
		margin-block: 24px;
		padding-top: 24px;
		border-top: 1px solid var(--color-border);
		overflow-wrap: anywhere;
	}
	h2 {
		margin-bottom: 8px;
		font-size: 1.125rem;
	}
	.description {
		max-width: 66ch;
		margin-bottom: 12px;
		color: var(--color-text-muted);
		font-size: 0.875rem;
	}
	.site-list,
	.related-list {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.site-list li + li {
		border-top: 1px solid var(--color-border);
	}
	.site-link {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		min-height: 48px;
		padding-block: 10px;
		color: var(--color-brand-ink);
		font-size: 0.875rem;
		text-decoration: none;
	}
	.link-copy {
		display: flex;
		min-width: 0;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 4px 12px;
	}
	.site-name {
		font-weight: 500;
		text-decoration: underline;
		text-underline-offset: 4px;
	}
	.location {
		color: var(--color-text-muted);
		font-size: 0.8125rem;
	}
	.related {
		margin-top: 20px;
	}
	.place {
		display: grid;
		gap: 6px;
		margin-bottom: 12px;
	}
	.place label {
		font-size: 0.875rem;
		font-weight: 600;
	}
	.place small {
		color: var(--color-text-muted);
		font-size: 0.8125rem;
	}
	.place-row {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.place-row input {
		flex: 1 1 200px;
		min-width: 0;
		max-width: 320px;
		min-height: 44px;
		padding: 8px 12px;
		border: 1px solid var(--color-control-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		color: var(--color-text);
		font: inherit;
	}
	.anywhere {
		min-height: 44px;
		padding: 8px 12px;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-pill);
		background: transparent;
		color: var(--color-brand-ink);
		font-size: 0.8125rem;
	}
	.related p {
		margin-bottom: 8px;
		font-size: 0.875rem;
		font-weight: 600;
	}
	.related-list {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.related-list button {
		min-height: 44px;
		padding: 8px 12px;
		border: 1px solid transparent;
		border-radius: var(--radius-pill);
		background: var(--color-brand-50);
		color: var(--color-brand-ink);
		font-size: 0.8125rem;
		text-align: start;
		overflow-wrap: anywhere;
	}
	.related-list button[aria-pressed='true'] {
		background: var(--color-mint);
		color: var(--color-text);
	}
	.reset-keyword,
	.fill-target {
		display: inline-flex;
		align-items: center;
		min-height: 44px;
		padding: 8px 0;
		border: 0;
		background: transparent;
		color: var(--color-brand-ink);
		font-size: 0.875rem;
		text-align: start;
		text-decoration: underline;
		text-underline-offset: 4px;
	}
	.incognito-note {
		margin-top: 12px;
		color: var(--color-text-muted);
		font-size: 0.8125rem;
	}
</style>
