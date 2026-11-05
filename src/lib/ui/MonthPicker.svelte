<script lang="ts">
	import { untrack } from 'svelte';
	import { i18n, monthNames, t } from '#lib/i18n/index.svelte.ts';

	interface Props {
		value?: string;
		current?: boolean;
		allowCurrent?: boolean;
		label: string;
		id?: string;
		hint?: string;
		error?: string;
		required?: boolean;
		disabled?: boolean;
		class?: string;
	}

	const uid = $props.id();
	let {
		value = $bindable(undefined),
		current = $bindable(false),
		allowCurrent = false,
		label,
		id = uid,
		hint,
		error,
		required = false,
		disabled = false,
		class: className = ''
	}: Props = $props();

	const currentYear = new Date().getFullYear();
	const years = Array.from({ length: 47 }, (_, index) => String(currentYear + 6 - index));
	const months = $derived(monthNames(i18n.locale));
	const describedBy = $derived(
		[hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined
	);
	const inactive = $derived(disabled || (allowCurrent && current));
	const initialDate = untrack(() => /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value ?? ''));
	let month = $state(initialDate?.[2] ?? '');
	let year = $state(initialDate?.[1] ?? '');
	let previousValue: string | undefined;
	let initialized = false;

	$effect(() => {
		if (initialized && value === previousValue) return;
		const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value ?? '');
		year = match?.[1] ?? '';
		month = match?.[2] ?? '';
		previousValue = value;
		initialized = true;
	});

	function select(part: 'month' | 'year', next: string) {
		if (part === 'month') month = next;
		else year = next;
		const result = month && year ? `${year}-${month}` : undefined;
		previousValue = result;
		value = result;
	}
</script>

<fieldset class="month-picker {className}" {disabled} aria-describedby={describedBy}>
	<legend
		>{label}{#if required}<span aria-hidden="true"> *</span>{/if}</legend
	>
	<div class="date-fields">
		<div>
			<label for="{id}-month">{t('ui.month')}</label>
			<select
				id="{id}-month"
				value={month}
				disabled={inactive}
				required={required && !inactive}
				aria-invalid={error ? true : undefined}
				aria-describedby={describedBy}
				onchange={(event) => select('month', event.currentTarget.value)}
			>
				<option value="">{t('ui.chooseMonth')}</option>
				{#each months as name, index (index)}<option value={String(index + 1).padStart(2, '0')}
						>{name}</option
					>{/each}
			</select>
		</div>
		<div>
			<label for="{id}-year">{t('ui.year')}</label>
			<select
				id="{id}-year"
				value={year}
				disabled={inactive}
				required={required && !inactive}
				aria-invalid={error ? true : undefined}
				aria-describedby={describedBy}
				onchange={(event) => select('year', event.currentTarget.value)}
			>
				<option value="">{t('ui.chooseYear')}</option>
				{#each years as option (option)}<option value={option}>{option}</option>{/each}
			</select>
		</div>
	</div>
	{#if allowCurrent}
		<label class="current-label" for="{id}-current">
			<input id="{id}-current" type="checkbox" bind:checked={current} {disabled} />
			<span>{t('ui.untilPresent')}</span>
		</label>
	{/if}
	{#if hint}<p id="{id}-hint" class="hint">{hint}</p>{/if}
	{#if error}<p id="{id}-error" class="error">{error}</p>{/if}
</fieldset>

<style>
	.month-picker {
		min-width: 0;
		margin: 0;
		padding: 0;
		border: 0;
	}
	legend {
		margin-bottom: 0.75rem;
		padding: 0;
		font-size: 0.875rem;
		font-weight: 600;
	}
	legend span {
		color: var(--color-danger);
	}
	.date-fields {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: 0.75rem;
	}
	.date-fields > div {
		min-width: 0;
	}
	.date-fields label {
		display: block;
		margin-bottom: 0.375rem;
		color: var(--color-text-muted);
		font-size: 0.875rem;
	}
	select {
		width: 100%;
		min-width: 0;
		min-height: 44px;
		padding: 0.625rem 0.5rem;
		border: 1px solid var(--color-control-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		color: var(--color-text);
		font: inherit;
		font-size: 1rem;
	}
	select[aria-invalid='true'] {
		border-color: var(--color-danger);
	}
	select:disabled {
		background: var(--color-surface-muted);
		color: var(--color-text-muted);
		cursor: not-allowed;
	}
	.current-label {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		min-height: 44px;
		margin-top: 0.5rem;
		font-size: 0.875rem;
		cursor: pointer;
	}
	.current-label input {
		width: 20px;
		height: 20px;
		margin: 0;
		accent-color: var(--color-brand-ink);
	}
	.current-label:has(input:disabled) {
		color: var(--color-text-muted);
		cursor: not-allowed;
	}
	.hint,
	.error {
		margin: 0.5rem 0 0;
		font-size: 0.875rem;
		line-height: 1.6;
	}
	.hint {
		color: var(--color-text-muted);
	}
	.error {
		color: var(--color-danger);
	}
</style>
