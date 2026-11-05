<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';
	import { t } from '#lib/i18n/index.svelte.ts';

	type Props = Omit<HTMLInputAttributes, 'value' | 'type' | 'class' | 'children' | 'size'> & {
		label: string;
		value?: string;
		type?: 'text' | 'email' | 'tel' | 'url' | 'search' | 'password';
		hint?: string;
		error?: string;
		showCounter?: boolean;
		class?: string;
	};
	const generatedId = $props.id();
	let {
		label,
		value = $bindable(''),
		type = 'text',
		id = generatedId,
		hint,
		error,
		required = false,
		maxlength,
		showCounter = false,
		disabled = false,
		class: className = '',
		'aria-describedby': describedBy,
		...rest
	}: Props = $props();
	let description = $derived(
		[
			describedBy,
			hint && `${id}-hint`,
			error && `${id}-error`,
			showCounter && maxlength != null && `${id}-count`
		]
			.filter(Boolean)
			.join(' ') || undefined
	);
</script>

<div class={`field ${className}`}>
	<label for={id}
		>{label}{#if required}<span class="required" aria-hidden="true"> *</span><span class="sr-only">
				{t('ui.required')}</span
			>{/if}</label
	>
	<input
		{...rest}
		{id}
		{type}
		{required}
		{maxlength}
		{disabled}
		bind:value
		aria-describedby={description}
		aria-invalid={error ? true : undefined}
	/>
	{#if hint}<p id={`${id}-hint`} class="hint">{hint}</p>{/if}
	{#if error}<p id={`${id}-error`} class="error">{error}</p>{/if}
	{#if showCounter && maxlength != null}<p id={`${id}-count`} class="counter">
			{t('ui.characterCount', { count: value.length, max: maxlength })}
		</p>{/if}
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
	input {
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
	}
	input::placeholder {
		color: var(--color-text-muted);
	}
	input[aria-invalid='true'] {
		border-color: var(--color-danger);
	}
	input:disabled {
		background: var(--color-surface-muted);
		cursor: not-allowed;
		opacity: 0.65;
	}
	p {
		margin: 0;
		font-size: 0.75rem;
		line-height: 1.5;
	}
	.hint,
	.counter {
		color: var(--color-text-muted);
	}
	.error,
	.required {
		color: var(--color-danger);
	}
	.counter {
		text-align: right;
	}
</style>
