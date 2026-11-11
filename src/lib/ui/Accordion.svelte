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
		border-radius: var(--radius-md);
		background: transparent;
		padding: 16px 12px;
		color: var(--color-text);
		font-size: 1rem;
		font-weight: 600;
		line-height: 1.6;
		text-align: left;
		cursor: pointer;
		scroll-margin-top: 6rem;
		transition:
			background-color var(--motion-duration) ease-out,
			color var(--motion-duration) ease-out;
	}
	button:hover:not(:disabled) {
		background: var(--color-brand-50);
		color: var(--color-brand-ink);
	}
	button[aria-expanded='true'] {
		background: var(--color-mint-50);
		color: var(--color-brand-ink);
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
		transition: transform var(--motion-duration) ease-out;
	}
	svg.expanded {
		transform: scaleY(-1);
	}
	.content {
		padding: 12px 40px 20px 12px;
		color: var(--color-text-muted);
		font-size: 0.875rem;
		line-height: 1.8;
	}
	div[role='region']:not([hidden]) > .content {
		animation: ui-content-reveal 160ms ease-out;
	}
</style>
