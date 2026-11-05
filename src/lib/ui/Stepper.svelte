<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';

	type Props = {
		steps: string[];
		shortSteps?: string[];
		current: number;
		disabled?: boolean;
		class?: string;
	};
	let {
		steps,
		shortSteps = [],
		current,
		disabled = false,
		class: className = ''
	}: Props = $props();
	let active = $derived(Math.min(Math.max(0, current), Math.max(0, steps.length - 1)));
	let value = $derived(steps.length ? active + 1 : 0);
	let progressLabel = $derived(t('ui.stepProgress', { current: value, total: steps.length }));
</script>

<nav
	class={`stepper ${className}`}
	aria-label={t('ui.steps')}
	data-disabled={disabled || undefined}
>
	<div class="progress-row">
		<p class="progress-label" title={steps[active]}>
			<span class="step-count">{progressLabel}</span>
			{#if steps[active]}
				<span class="separator" aria-hidden="true">·</span>
				<span class="step-title">{steps[active]}</span>
			{/if}
		</p>
		<div
			class="progress-track"
			role="progressbar"
			aria-label={t('ui.steps')}
			aria-valuenow={value}
			aria-valuemin={0}
			aria-valuemax={Math.max(1, steps.length)}
			aria-valuetext={`${progressLabel}${steps[active] ? ` · ${steps[active]}` : ''}`}
		>
			<span
				class="progress-fill"
				style:transform={`scaleX(${steps.length ? value / steps.length : 0})`}
			></span>
		</div>
	</div>
	<ol class="step-dots">
		{#each steps as step, index (`${index}-${step}`)}
			{@const label = shortSteps[index] ?? step}
			{@const status =
				index < active
					? t('ui.completed')
					: index === active
						? t('ui.currentStep')
						: t('ui.upcoming')}
			<li
				class:complete={index < active}
				class:active={index === active}
				aria-current={index === active ? 'step' : undefined}
				aria-label={`${label}: ${status}`}
				title={`${label}: ${status}`}
			>
				<span class="dot" aria-hidden="true"></span>
				<span class="sr-only">{label}: {status}</span>
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
	.progress-row {
		display: flex;
		flex-direction: column;
		min-width: 0;
		align-items: stretch;
		gap: 8px;
	}
	.progress-label {
		display: flex;
		min-width: 0;
		align-items: center;
		gap: 5px;
		margin: 0;
		color: var(--color-brand-ink);
		font-size: 0.75rem;
		font-weight: 600;
		line-height: 1.5;
		white-space: nowrap;
	}
	.step-count,
	.separator {
		flex-shrink: 0;
	}
	.step-title {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.progress-track {
		min-width: 40px;
		height: 8px;
		flex: 0 0 8px;
		overflow: hidden;
		border-radius: var(--radius-pill);
		background: var(--color-brand-50);
	}
	.progress-fill {
		display: block;
		width: 100%;
		height: 100%;
		border-radius: inherit;
		background: var(--color-progress);
		transform-origin: left center;
		transition: transform var(--motion-duration) var(--motion-ease);
	}
	.step-dots {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	@media (min-width: 360px) {
		.progress-label {
			font-size: 0.875rem;
		}
	}
	@media (min-width: 768px) {
		.progress-row {
			flex-direction: row;
			align-items: center;
			gap: 12px;
		}
		.progress-track {
			flex: 1 0 40px;
		}
	}
	@media (min-width: 1024px) {
		.stepper {
			display: grid;
			grid-template-columns: minmax(0, 1fr) auto;
			align-items: center;
			gap: 24px;
		}
		.step-dots {
			position: static;
			display: flex;
			width: auto;
			height: auto;
			align-items: center;
			gap: 10px;
			overflow: visible;
			clip-path: none;
		}
		.step-dots li {
			display: flex;
			align-items: center;
			justify-content: center;
			width: 8px;
			height: 16px;
		}
		.dot {
			width: 8px;
			height: 8px;
			border-radius: var(--radius-pill);
			background: var(--color-brand-100);
			transition: background-color var(--motion-duration) var(--motion-ease);
		}
		.complete .dot,
		.active .dot {
			background: var(--color-progress);
		}
		.active .dot {
			outline: 3px solid var(--color-brand-100);
			outline-offset: 2px;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.progress-fill,
		.dot {
			transition: none;
		}
	}
</style>
