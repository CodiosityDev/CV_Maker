<script lang="ts">
	import type { DateRange } from '#lib/core/schema/index.ts';
	import { t } from '#lib/i18n/index.svelte.ts';
	import MonthPicker from '../MonthPicker.svelte';

	let {
		id,
		range,
		error,
		onChange
	}: {
		id: string;
		range?: DateRange;
		error?: string;
		onChange: (range: DateRange, field: 'start' | 'end' | 'current') => void;
	} = $props();
</script>

<div class="date-range">
	<MonthPicker
		id={`${id}.start`}
		label={t('wizard.fields.start')}
		bind:value={
			() => range?.start,
			(value) => onChange({ ...(range ?? { current: false }), start: value }, 'start')
		}
	/>
	<MonthPicker
		{id}
		label={t('wizard.fields.end')}
		{error}
		allowCurrent
		bind:value={
			() => range?.end, (value) => onChange({ ...(range ?? { current: false }), end: value }, 'end')
		}
		bind:current={
			() => range?.current ?? false,
			(value) => onChange({ ...(range ?? {}), current: value }, 'current')
		}
	/>
</div>

<style>
	.date-range {
		display: grid;
		gap: 0.75rem;
		min-width: 0;
	}
	@media (min-width: 640px) {
		.date-range {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
</style>
