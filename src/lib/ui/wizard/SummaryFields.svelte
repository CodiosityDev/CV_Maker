<script lang="ts">
	import { onDestroy } from 'svelte';
	import { LIMITS, newId } from '#lib/core/schema/index.ts';
	import type { CvStore } from '#lib/core/store/cv-store.svelte.ts';
	import { incognito } from '#lib/core/storage/index.ts';
	import type { Guidance } from '#lib/core/content/index.ts';
	import { categoryOf, type SuggestionData } from '#lib/core/suggest/index.ts';
	import { t } from '#lib/i18n/index.svelte.ts';
	import Textarea from '../Textarea.svelte';
	import Button from '../Button.svelte';
	import Dialog from '../Dialog.svelte';
	import AiAssist from '../AiAssist.svelte';

	let {
		store,
		examples,
		suggestionsData
	}: {
		store: CvStore;
		examples?: Guidance;
		suggestionsData?: SuggestionData;
	} = $props();
	let replaceOpen = $state(false);
	let pendingSummary = $state('');
	const summaryExamples = $derived.by(() => {
		const available = examples?.summaryExamples ?? [];
		if (!suggestionsData) return available;
		const category = categoryOf(suggestionsData, store.cv.targetRole);
		const field =
			category === 'finance' ? 'accounting' : category === 'customer' ? 'sales' : category;
		const preferred = available.some((example) => example.field === field)
			? field
			: category === 'data'
				? 'it'
				: 'general';
		return [
			...available.filter((example) => example.field === preferred),
			...available.filter((example) => example.field !== preferred)
		];
	});
	$effect(() => {
		if (store.externalChange === 'removed') {
			replaceOpen = false;
			pendingSummary = '';
		} else if (!replaceOpen) pendingSummary = '';
	});
	onDestroy(() => {
		pendingSummary = '';
	});
	function useSummary(text: string) {
		if (store.externalChange === 'removed') return;
		pendingSummary = text;
		if (store.cv.summary.trim()) replaceOpen = true;
		else applySummary();
	}
	function applySummary() {
		if (store.externalChange === 'removed') return;
		store.update(
			(draft) => {
				draft.summary = pendingSummary;
			},
			{ coalesceKey: `summary.example.${newId()}` }
		);
		replaceOpen = false;
		pendingSummary = '';
	}
</script>

<Textarea
	id="summary"
	label={t('wizard.fields.summary')}
	hideLabel
	autocomplete={incognito.active ? 'off' : undefined}
	maxlength={LIMITS.summary}
	bind:value={
		() => store.cv.summary,
		(value) =>
			store.update(
				(draft) => {
					draft.summary = value;
				},
				{ coalesceKey: 'summary' }
			)
	}
/>
<AiAssist {store} task="summary" />
{#if examples}
	<details class="tips">
		<summary>{t('wizard.actionVerbs')}</summary>
		<p>{examples.actionVerbs.join(', ')}</p>
	</details>
	<details class="tips summary-examples">
		<summary>{t('wizard.examples')}</summary>
		<div class="examples">
			{#each summaryExamples.slice(0, 1) as example (example.field)}
				<article>
					<h2>{example.label}</h2>
					<p>{example.text}</p>
					<Button variant="secondary" onclick={() => useSummary(example.text)}
						>{t('wizard.useSummary')}</Button
					>
				</article>
			{/each}
		</div>
		{#if summaryExamples.length > 1}
			<details class="other-examples">
				<summary>{t('wizard.otherExamples')}</summary>
				<div class="examples">
					{#each summaryExamples.slice(1) as example (example.field)}
						<article>
							<h2>{example.label}</h2>
							<p>{example.text}</p>
							<Button variant="secondary" onclick={() => useSummary(example.text)}
								>{t('wizard.useSummary')}</Button
							>
						</article>
					{/each}
				</div>
			</details>
		{/if}
	</details>
{/if}
{#if store.externalChange !== 'removed'}
	<Dialog
		bind:open={replaceOpen}
		title={t('wizard.replaceTitle')}
		description={t('wizard.replaceDescription')}
	>
		{#snippet footer()}
			<Button variant="secondary" onclick={() => (replaceOpen = false)}>{t('common.cancel')}</Button
			>
			<Button onclick={applySummary}>{t('wizard.replace')}</Button>
		{/snippet}
	</Dialog>
{/if}

<style>
	.tips {
		min-width: 0;
		margin-top: 1rem;
		padding: 0.75rem 1rem;
		border-radius: var(--radius-md);
		background: var(--color-mint-50);
		border: 1px solid var(--color-mint);
		color: var(--color-text);
		font-size: 0.875rem;
	}
	summary {
		min-height: 44px;
		display: list-item;
		align-content: center;
		font-weight: 650;
	}
	.tips p {
		margin: 0.75rem 0;
	}
	.examples {
		display: grid;
		gap: 1.5rem;
		padding-top: 1rem;
	}
	.examples h2 {
		font-size: 1rem;
	}
	.examples article {
		padding-bottom: 1rem;
		border-bottom: 1px solid var(--color-border);
	}
</style>
