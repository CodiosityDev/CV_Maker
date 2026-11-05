<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';

	type Props = { steps: string[]; current: number; disabled?: boolean; class?: string };
	let { steps, current, disabled = false, class: className = '' }: Props = $props();
	let active = $derived(Math.min(Math.max(0, current), Math.max(0, steps.length - 1)));
</script>

<nav
	class={`stepper ${className}`}
	aria-label={t('ui.steps')}
	data-disabled={disabled || undefined}
>
	<div class="mobile-progress">
		<p>{t('ui.stepProgress', { current: steps.length ? active + 1 : 0, total: steps.length })}</p>
		<progress
			max={Math.max(1, steps.length)}
			value={steps.length ? active + 1 : 0}
			aria-label={t('ui.steps')}
		></progress>
		{#if steps[active]}<span>{steps[active]}</span>{/if}
	</div>
	<ol>
		{#each steps as step, index (`${index}-${step}`)}
			<li
				class:complete={index < active}
				class:active={index === active}
				aria-current={index === active ? 'step' : undefined}
			>
				<span class="marker" aria-hidden="true">{index < active ? '✓' : index + 1}</span>
				<span
					>{step}<span class="sr-only"
						>: {index < active
							? t('ui.completed')
							: index === active
								? t('ui.currentStep')
								: t('ui.upcoming')}</span
					></span
				>
			</li>
		{/each}
	</ol>
</nav>

<style>
	.stepper {
		min-width: 0;
	}
	.stepper[data-disabled] {
		opacity: 0.65;
	}
	.mobile-progress {
		display: grid;
		gap: 8px;
	}
	p {
		margin: 0;
		color: var(--color-primary-700);
		font-size: 0.875rem;
		font-weight: 700;
	}
	.mobile-progress > span {
		color: var(--color-text-muted);
		font-size: 0.875rem;
	}
	progress {
		width: 100%;
		height: 8px;
		overflow: hidden;
		border: 0;
		border-radius: 999px;
		background: var(--color-border);
		color: var(--color-primary-600);
		accent-color: var(--color-primary-600);
	}
	progress::-webkit-progress-bar {
		border-radius: 999px;
		background: var(--color-border);
	}
	progress::-webkit-progress-value {
		border-radius: 999px;
		background: var(--color-primary-600);
	}
	progress::-moz-progress-bar {
		border-radius: 999px;
		background: var(--color-primary-600);
	}
	ol {
		display: none;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	li {
		display: flex;
		min-width: 0;
		align-items: center;
		gap: 8px;
		color: var(--color-text-muted);
		font-size: 0.75rem;
		line-height: 1.5;
	}
	.marker {
		display: inline-flex;
		width: 32px;
		height: 32px;
		flex-shrink: 0;
		align-items: center;
		justify-content: center;
		border: 1px solid var(--color-border);
		border-radius: 50%;
		background: var(--color-surface);
		font-size: 0.875rem;
		font-weight: 700;
	}
	.complete .marker {
		border-color: var(--color-primary-600);
		color: var(--color-primary-700);
	}
	.active {
		color: var(--color-primary-700);
		font-weight: 700;
	}
	.active .marker {
		border-color: var(--color-primary-600);
		background: var(--color-primary-600);
		color: white;
	}
	@media (min-width: 768px) {
		.mobile-progress {
			display: none;
		}
		ol {
			display: flex;
			flex-wrap: wrap;
			gap: 16px 24px;
		}
		li {
			flex: 1 1 112px;
		}
	}
</style>
