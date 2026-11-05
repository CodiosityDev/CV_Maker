<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';

	type Props = Omit<HTMLInputAttributes, 'checked' | 'type' | 'class' | 'children'> & {
		label: string;
		checked?: boolean;
		hint?: string;
		class?: string;
	};
	const generatedId = $props.id();
	let {
		label,
		checked = $bindable(false),
		id = generatedId,
		hint,
		disabled = false,
		class: className = '',
		'aria-describedby': describedBy,
		...rest
	}: Props = $props();
	let description = $derived(
		[describedBy, hint && `${id}-hint`].filter(Boolean).join(' ') || undefined
	);
</script>

<div class={`checkbox ${className}`}>
	<label for={id} class:disabled>
		<input {...rest} {id} type="checkbox" {disabled} bind:checked aria-describedby={description} />
		<span>{label}</span>
	</label>
	{#if hint}<p id={`${id}-hint`}>{hint}</p>{/if}
</div>

<style>
	.checkbox {
		min-width: 0;
	}
	label {
		display: flex;
		min-height: 44px;
		align-items: center;
		gap: 12px;
		color: var(--color-text);
		font-size: 0.875rem;
		line-height: 1.5;
		cursor: pointer;
	}
	input {
		appearance: none;
		display: grid;
		width: 20px;
		height: 20px;
		flex-shrink: 0;
		place-items: center;
		border: 1px solid var(--color-control-border);
		border-radius: 5px;
		background: var(--color-surface);
		color: var(--color-surface);
		cursor: inherit;
		transition:
			background-color var(--motion-duration) ease-out,
			border-color var(--motion-duration) ease-out;
	}
	input::after {
		width: 12px;
		height: 10px;
		background: currentColor;
		clip-path: polygon(0 42%, 14% 27%, 40% 58%, 86% 0, 100% 15%, 41% 100%);
		content: '';
		opacity: 0;
	}
	input:checked {
		border-color: var(--color-brand-ink);
		background: var(--color-brand-ink);
	}
	input:checked::after {
		opacity: 1;
	}
	.disabled {
		opacity: 0.65;
		cursor: not-allowed;
	}
	p {
		margin: 0 0 0 32px;
		color: var(--color-text-muted);
		font-size: 0.75rem;
		line-height: 1.5;
	}
	@media (forced-colors: active) {
		input {
			appearance: auto;
		}
		input::after {
			display: none;
		}
	}
</style>
