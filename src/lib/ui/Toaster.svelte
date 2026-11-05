<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';
	import { toast, toastState } from './toast.svelte.ts';

	let { disabled = false, class: className = '' }: { disabled?: boolean; class?: string } =
		$props();
</script>

<div
	class="toaster {className}"
	role="status"
	aria-live="polite"
	aria-atomic="false"
	aria-label={t('ui.notifications')}
>
	{#each toastState.items as item (item.id)}
		<div class="notification" data-kind={item.kind}>
			<svg
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="1.75"
				aria-hidden="true"
			>
				<circle cx="12" cy="12" r="9" />
				{#if item.kind === 'success'}
					<path d="m8 12 3 3 5-6" />
				{:else if item.kind === 'error'}
					<path d="M12 7v6m0 3v1" />
				{:else}
					<path d="M12 10v7m0-10v1" />
				{/if}
			</svg>
			<p>{item.message}</p>
			<button
				type="button"
				{disabled}
				onclick={() => toast.dismiss(item.id)}
				aria-label={t('ui.dismiss')}
			>
				<svg
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="1.75"
					aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg
				>
			</button>
		</div>
	{/each}
</div>

<style>
	.toaster {
		position: fixed;
		z-index: 50;
		right: 1rem;
		bottom: max(1rem, env(safe-area-inset-bottom));
		left: 1rem;
		display: grid;
		gap: 0.75rem;
		max-width: 28rem;
		margin-left: auto;
		pointer-events: none;
	}
	.notification {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.5rem 0.5rem 0.5rem 1rem;
		border: 1px solid var(--color-border);
		border-left: 4px solid var(--color-primary-600);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		color: var(--color-text);
		box-shadow: var(--shadow-lg);
		animation: appear 180ms ease-out;
		pointer-events: auto;
	}
	.notification[data-kind='success'] {
		border-left-color: var(--color-success);
	}
	.notification[data-kind='error'] {
		border-left-color: var(--color-danger);
	}
	.notification > svg {
		flex-shrink: 0;
		width: 24px;
		height: 24px;
		color: var(--color-primary-600);
	}
	.notification[data-kind='success'] > svg {
		color: var(--color-success);
	}
	.notification[data-kind='error'] > svg {
		color: var(--color-danger);
	}
	p {
		flex: 1;
		min-width: 0;
		margin: 0;
		font-size: 0.875rem;
		line-height: 1.6;
		overflow-wrap: anywhere;
	}
	button {
		display: grid;
		flex-shrink: 0;
		width: 44px;
		height: 44px;
		place-items: center;
		border: 0;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--color-text-muted);
		cursor: pointer;
	}
	button:hover {
		background: var(--color-surface-muted);
	}
	button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	button svg {
		width: 20px;
		height: 20px;
	}
	@keyframes appear {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.notification {
			animation: none;
		}
	}
</style>
