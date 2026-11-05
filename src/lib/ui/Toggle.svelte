<script lang="ts">
	type Props = {
		label: string;
		checked?: boolean;
		hint?: string;
		disabled?: boolean;
		id?: string;
		class?: string;
	};
	const generatedId = $props.id();
	let {
		label,
		checked = $bindable(false),
		hint,
		disabled = false,
		id = generatedId,
		class: className = ''
	}: Props = $props();
</script>

<div class={`toggle ${className}`}>
	<button
		{id}
		type="button"
		role="switch"
		aria-checked={checked}
		aria-describedby={hint ? `${id}-hint` : undefined}
		{disabled}
		onclick={() => (checked = !checked)}
	>
		<span class="track" class:checked aria-hidden="true"><span class="thumb"></span></span>
		<span>{label}</span>
	</button>
	{#if hint}<p id={`${id}-hint`}>{hint}</p>{/if}
</div>

<style>
	.toggle {
		min-width: 0;
	}
	button {
		display: flex;
		min-width: 44px;
		min-height: 44px;
		align-items: center;
		gap: 12px;
		border: 0;
		border-radius: var(--radius-sm);
		background: transparent;
		padding: 4px 0;
		color: var(--color-text);
		font-size: 0.875rem;
		line-height: 1.5;
		text-align: left;
		cursor: pointer;
	}
	.track {
		display: inline-flex;
		width: 44px;
		height: 24px;
		flex-shrink: 0;
		align-items: center;
		border: 1px solid var(--color-text-muted);
		border-radius: 999px;
		background: var(--color-surface-muted);
		padding: 2px;
	}
	.track.checked {
		border-color: var(--color-brand-ink);
		background: var(--color-brand);
	}
	.thumb {
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: var(--color-text-muted);
		transition: transform 150ms ease;
	}
	.checked .thumb {
		background: var(--color-ink);
		transform: translateX(20px);
	}
	button:disabled {
		opacity: 0.65;
		cursor: not-allowed;
	}
	p {
		margin: 0 0 0 56px;
		color: var(--color-text-muted);
		font-size: 0.75rem;
		line-height: 1.5;
	}
	@media (prefers-reduced-motion: reduce) {
		.thumb {
			transition: none;
		}
	}
</style>
