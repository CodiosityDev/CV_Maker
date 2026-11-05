<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		title: string;
		children: Snippet;
		open?: boolean;
		disabled?: boolean;
		class?: string;
		id?: string;
	};
	const generatedId = $props.id();
	let {
		title,
		children,
		open = $bindable(false),
		disabled = false,
		class: className = '',
		id = generatedId
	}: Props = $props();
</script>

<div class={`accordion ${className}`}>
	<h3>
		<button
			type="button"
			id={`${id}-trigger`}
			aria-expanded={open}
			aria-controls={`${id}-panel`}
			{disabled}
			onclick={() => (open = !open)}
		>
			<span>{title}</span>
			<svg
				class:expanded={open}
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="1.75"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg
			>
		</button>
	</h3>
	<div id={`${id}-panel`} role="region" aria-labelledby={`${id}-trigger`} hidden={!open}>
		<div class="content">{@render children()}</div>
	</div>
</div>

<style>
	.accordion {
		min-width: 0;
		border-bottom: 1px solid var(--color-border);
	}
	h3 {
		margin: 0;
	}
	button {
		display: flex;
		width: 100%;
		min-height: 60px;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		border: 0;
		border-radius: var(--radius-sm);
		background: transparent;
		padding: 16px 0;
		color: var(--color-text);
		font-size: 1rem;
		font-weight: 600;
		line-height: 1.6;
		text-align: left;
		cursor: pointer;
	}
	button:disabled {
		opacity: 0.65;
		cursor: not-allowed;
	}
	svg {
		width: 20px;
		height: 20px;
		flex-shrink: 0;
		color: var(--color-text-muted);
	}
	svg.expanded {
		transform: scaleY(-1);
	}
	.content {
		padding: 0 28px 20px 0;
		color: var(--color-text-muted);
		font-size: 0.875rem;
		line-height: 1.8;
	}
</style>
