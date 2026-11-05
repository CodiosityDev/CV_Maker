<script lang="ts">
	import type { HTMLTextareaAttributes } from 'svelte/elements';
	import { t } from '#lib/i18n/index.svelte.ts';

	type Props = Omit<HTMLTextareaAttributes, 'value' | 'class' | 'children'> & {
		label: string;
		value?: string;
		hint?: string;
		error?: string;
		showCounter?: boolean;
		class?: string;
	};
	const generatedId = $props.id();
	let {
		label,
		value = $bindable(''),
		id = generatedId,
		hint,
		error,
		required = false,
		maxlength,
		showCounter = true,
		disabled = false,
		rows = 3,
		class: className = '',
		'aria-describedby': describedBy,
		...rest
	}: Props = $props();
	let element: HTMLTextAreaElement | undefined = $state();
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
	function resize(_value: string) {
		if (element && element.clientWidth > 0) {
			element.style.height = 'auto';
			const style = getComputedStyle(element);
			const border = parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
			element.style.height = `${element.scrollHeight + border}px`;
		}
	}
	$effect(() => resize(value));
	$effect(() => {
		const textarea = element;
		if (!textarea || typeof ResizeObserver === 'undefined') return;
		let previousWidth: number | undefined;
		let frame: number | undefined;
		const observer = new ResizeObserver(([entry]) => {
			const width = entry?.contentRect.width;
			if (width === undefined || width === previousWidth) return;
			previousWidth = width;
			if (width > 0) {
				if (frame !== undefined) cancelAnimationFrame(frame);
				// Mutating the observed box during delivery produces ResizeObserver loop errors.
				frame = requestAnimationFrame(() => {
					frame = undefined;
					resize(value);
				});
			}
		});
		observer.observe(textarea);
		return () => {
			observer.disconnect();
			if (frame !== undefined) cancelAnimationFrame(frame);
		};
	});
</script>

<div class={`field ${className}`}>
	<label for={id}
		>{label}{#if required}<span class="required" aria-hidden="true"> *</span><span class="sr-only">
				{t('ui.required')}</span
			>{/if}</label
	>
	<textarea
		{...rest}
		{id}
		{required}
		{maxlength}
		{disabled}
		{rows}
		bind:this={element}
		bind:value
		aria-describedby={description}
		aria-invalid={error ? true : undefined}></textarea>
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
	textarea {
		box-sizing: border-box;
		width: 100%;
		min-width: 0;
		min-height: 96px;
		border: 1px solid var(--color-control-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		padding: 12px;
		color: var(--color-text);
		font-size: 1rem;
		line-height: 1.6;
		resize: vertical;
	}
	textarea::placeholder {
		color: var(--color-text-muted);
	}
	textarea[aria-invalid='true'] {
		border-color: var(--color-danger);
	}
	textarea:disabled {
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
