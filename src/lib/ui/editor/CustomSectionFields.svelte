<script lang="ts">
	import {
		LIMITS,
		newId,
		type CustomSectionItem,
		type CustomSectionKey
	} from '#lib/core/schema/index.ts';
	import type { CvStore } from '#lib/core/store/cv-store.svelte.ts';
	import { formatDateRange } from '#lib/core/render/index.ts';
	import { t } from '#lib/i18n/index.svelte.ts';
	import Input from '../Input.svelte';
	import ListEditor from '../ListEditor.svelte';
	import BulletEditor from '../wizard/BulletEditor.svelte';
	import DateRangeFields from '../wizard/DateRangeFields.svelte';

	let { store, sectionKey }: { store: CvStore; sectionKey: CustomSectionKey } = $props();
	const section = $derived(store.cv.custom.find((candidate) => candidate.key === sectionKey));

	function replaceItems(items: CustomSectionItem[]) {
		store.update(
			(draft) => {
				const target = draft.custom.find((candidate) => candidate.key === sectionKey);
				if (target) target.items = items;
			},
			{ coalesceKey: `${sectionKey}.structure.${newId()}` }
		);
	}
	function editItem(
		id: string,
		field: string,
		change: (item: CustomSectionItem) => void,
		operation: 'edit' | 'structure' = 'edit'
	) {
		store.update(
			(draft) => {
				const item = draft.custom
					.find((candidate) => candidate.key === sectionKey)
					?.items.find((candidate) => candidate.id === id);
				if (item) change(item);
			},
			{
				coalesceKey: `${sectionKey}.${id}.${field}${operation === 'structure' ? `.${newId()}` : ''}`
			}
		);
	}
	function summary(item: CustomSectionItem) {
		return [
			item.title.trim() || t('editor.sections.newItem'),
			item.subtitle?.trim(),
			item.dates ? formatDateRange(item.dates, store.cv.locale) : undefined
		]
			.filter(Boolean)
			.join(' · ');
	}
</script>

{#if section}
	<ListEditor
		label={section.title}
		getKey={(entry) => entry.id}
		getSummary={summary}
		emptyMessage={t('editor.sections.customEmpty')}
		showHeading={false}
		maxItems={LIMITS.itemsPerSection}
		onUndo={() => store.undo()}
		undoRevision={`${store.cv.updatedAt}:${store.externalChange}`}
		bind:items={() => section?.items ?? [], replaceItems}
		onAdd={(): CustomSectionItem => ({
			id: newId(),
			title: '',
			subtitle: '',
			dates: { current: false },
			bullets: []
		})}
	>
		{#snippet item(entry)}
			<div class="item-fields">
				<Input
					id={`${sectionKey}.${entry.id}.title`}
					label={t('editor.sections.itemTitle')}
					maxlength={LIMITS.title}
					showCounter
					bind:value={
						() => entry.title,
						(value) => editItem(entry.id, 'title', (item) => (item.title = value))
					}
				/>
				<Input
					id={`${sectionKey}.${entry.id}.subtitle`}
					label={t('editor.sections.itemSubtitle')}
					maxlength={LIMITS.title}
					showCounter
					bind:value={
						() => entry.subtitle ?? '',
						(value) => editItem(entry.id, 'subtitle', (item) => (item.subtitle = value))
					}
				/>
				<DateRangeFields
					id={`${sectionKey}.${entry.id}.dates`}
					range={entry.dates}
					onChange={(dates, field) =>
						editItem(entry.id, `dates.${field}`, (item) => (item.dates = dates))}
				/>
				<BulletEditor
					id={`${sectionKey}.${entry.id}.bullets`}
					label={t('editor.sections.itemBullets')}
					items={entry.bullets}
					onChange={(bullets, operation) =>
						editItem(entry.id, 'bullets', (item) => (item.bullets = bullets), operation)}
				/>
			</div>
		{/snippet}
	</ListEditor>
{/if}

<style>
	.item-fields {
		display: grid;
		gap: 1rem;
		min-width: 0;
	}
</style>
