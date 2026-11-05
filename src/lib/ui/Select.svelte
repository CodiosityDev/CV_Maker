<script lang="ts">
	import type { HTMLSelectAttributes } from 'svelte/elements';
	import { t } from '#lib/i18n/index.svelte.ts';

	type Props = Omit<HTMLSelectAttributes, 'value' | 'class' | 'children' | 'multiple' | 'size'> & {
		label: string;
		value?: string;
		options: { value: string; label: string }[];
		hint?: string;
		error?: string;
		class?: string;
	};
	const generatedId = $props.id();
	let {
		label,
		value = $bindable(''),
		options,
		id = generatedId,
		hint,
		error,
		required = false,
		disabled = false,
		class: className = '',
		'aria-describedby': describedBy,
		...rest
	}: Props = $props();
	let description = $derived(
		[describedBy, hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') ||
			undefined
	);
</script>

<div class={`field ${className}`}>
	<label for={id}
		>{label}{#if required}<span class="required" aria-hidden="true"> *</span><span class="sr-only">
				{t('ui.required')}</span
			>{/if}</label
	>
	<select
		{...rest}
		{id}
		{required}
		{disabled}
		bind:value
		aria-describedby={description}
		aria-invalid={error ? true : undefined}
	>
		{#each options as option (option.value)}<option value={option.value}>{option.label}</option
			>{/each}
	</select>
	{#if hint}<p id={`${id}-hint`} class="hint">{hint}</p>{/if}
	{#if error}<p id={`${id}-error`} class="error">{error}</p>{/if}
</div>

<style>
	.field {
		display: grid;
		gap: 8px;
		min-width: 0;
	}
	label {
		color: var(--color-text);
		font-size: 0.875rem;
		font-weight: 600;
	}
	select {
		width: 100%;
		min-width: 0;
		min-height: 48px;
		border: 1px solid var(--color-control-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		padding: 12px;
		color: var(--color-text);
		font-size: 1rem;
		line-height: 1.5;
		transition:
			background-color var(--motion-duration) ease-out,
			border-color var(--motion-duration) ease-out;
	}
	select:hover:not(:disabled):not([aria-invalid='true']) {
		border-color: var(--color-focus);
	}
	select[aria-invalid='true'] {
		border-color: var(--color-danger);
	}
	select:disabled {
		background: var(--color-surface-muted);
		cursor: not-allowed;
		opacity: 0.65;
	}
	p {
		margin: 0;
		font-size: 0.75rem;
		line-height: 1.5;
	}
	.hint {
		color: var(--color-text-muted);
	}
	.error,
	.required {
		color: var(--color-danger);
	}
</style>
