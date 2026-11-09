<script lang="ts">
	import { LIMITS } from '#lib/core/schema/index.ts';
	import type { CvStore } from '#lib/core/store/cv-store.svelte.ts';
	import { incognito } from '#lib/core/storage/index.ts';
	import { suggest, type SuggestionData } from '#lib/core/suggest/index.ts';
	import { t } from '#lib/i18n/index.svelte.ts';
	import Select from '../Select.svelte';
	import Autocomplete from '../Autocomplete.svelte';
	import Input from '../Input.svelte';

	let { store, suggestionsData }: { store: CvStore; suggestionsData?: SuggestionData } = $props();
</script>

<Select
	id="locale"
	label={t('wizard.fields.locale')}
	options={[
		{ value: 'id', label: t('locale.id') },
		{ value: 'en', label: t('locale.en') }
	]}
	bind:value={
		() => store.cv.locale,
		(value) =>
			store.update(
				(draft) => {
					draft.locale = value === 'en' ? 'en' : 'id';
				},
				{ coalesceKey: 'locale' }
			)
	}
/>
<Autocomplete
	id="targetRole"
	label={t('wizard.fields.targetRole')}
	popularWhenEmpty
	suggestions={(query) =>
		suggestionsData ? suggest(suggestionsData, 'jobTitle', query, { popularWhenEmpty: true }) : []}
	maxlength={LIMITS.title}
	showCounter
	bind:value={
		() => store.cv.targetRole ?? '',
		(value) =>
			store.update(
				(draft) => {
					draft.targetRole = value;
				},
				{ coalesceKey: 'targetRole' }
			)
	}
/>
<Input
	id="title"
	label={t('wizard.fields.title')}
	autocomplete={incognito.active ? 'off' : undefined}
	maxlength={LIMITS.cvTitle}
	showCounter
	bind:value={
		() => store.cv.title,
		(value) =>
			store.update(
				(draft) => {
					draft.title = value;
				},
				{ coalesceKey: 'title' }
			)
	}
/>
