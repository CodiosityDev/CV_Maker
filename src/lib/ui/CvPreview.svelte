<script lang="ts">
	import { onMount, untrack, type Component } from 'svelte';
	import type { RenderModel } from '#lib/core/render/index.ts';
	import { t } from '#lib/i18n/index.svelte.ts';

	let { model }: { model: RenderModel } = $props();
	let renderedModel = $state.raw<RenderModel>(untrack(() => model));
	let Template = $state<Component<{ model: RenderModel }>>();
	let failed = $state(false);
	let container = $state<HTMLDivElement>();
	let paper = $state<HTMLDivElement>();
	let scale = $state(0);
	let height = $state(0);
	let mounted = false;

	$effect(() => {
		const next = model;
		const timer = setTimeout(() => {
			renderedModel = next;
		}, 150);
		return () => clearTimeout(timer);
	});

	async function loadTemplate() {
		failed = false;
		try {
			const module = await import('#lib/templates/ats/AtsKlasik.svelte');
			if (mounted) Template = module.default;
		} catch {
			if (mounted) failed = true;
		}
	}

	onMount(() => {
		mounted = true;
		void loadTemplate();
		return () => {
			mounted = false;
		};
	});

	$effect(() => {
		const viewport = container;
		const page = paper;
		if (!viewport || !page) return;
		let frame: number | undefined;
		function measure() {
			frame = undefined;
			if (!viewport || !page || !page.offsetWidth) return;
			const next = Math.min(1, viewport.clientWidth / page.offsetWidth);
			scale = next;
			height = page.offsetHeight * next;
		}
		function schedule() {
			if (frame !== undefined) cancelAnimationFrame(frame);
			frame = requestAnimationFrame(measure);
		}
		const observer = new ResizeObserver(schedule);
		observer.observe(viewport);
		observer.observe(page);
		schedule();
		return () => {
			observer.disconnect();
			if (frame !== undefined) cancelAnimationFrame(frame);
		};
	});
</script>

<figure class="cv-preview" aria-label={t('preview.label')} data-testid="cv-preview">
	{#if !model.personal.fullName && !model.personal.headline && !model.personal.email && !model.personal.phone && !model.sections.length}
		<p class="empty">{t('preview.empty')}</p>
	{/if}
	{#if !Template}
		<div class="loading" role="status">
			<p>{t(failed ? 'preview.error' : 'preview.loading')}</p>
			{#if failed}<button type="button" onclick={loadTemplate}>{t('preview.retry')}</button>{/if}
		</div>
	{/if}
	<div class="viewport" bind:this={container} style:height="{height}px">
		<div class="paper" bind:this={paper} style:transform="scale({scale})">
			{#if Template}<Template model={renderedModel} />{/if}
		</div>
	</div>
	<figcaption>{t('preview.caption')}</figcaption>
</figure>

<style>
	.cv-preview {
		min-width: 0;
		width: 100%;
		margin: 0;
	}
	.viewport {
		width: 100%;
		overflow: hidden;
		background: #fff;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-card);
	}
	.paper {
		width: 210mm;
		min-height: 297mm;
		transform-origin: top left;
		background: #fff;
	}
	figcaption {
		margin-top: 0.75rem;
		color: var(--color-text-muted);
		font-size: 0.75rem;
		line-height: 1.6;
	}
	.loading,
	.empty {
		margin-bottom: 0.75rem;
		color: var(--color-text-muted);
		font-size: 0.875rem;
	}
	button {
		min-height: 44px;
		margin-top: 0.5rem;
		padding: 0.5rem 1rem;
		border: 1px solid transparent;
		border-radius: var(--radius-md);
		background: var(--color-brand-50);
		color: var(--color-brand-ink);
		font: inherit;
		cursor: pointer;
		transition: background-color var(--motion-duration) ease-out;
	}
	button:hover {
		background: var(--color-secondary-hover);
	}
	@media print {
		.viewport {
			height: auto !important;
			overflow: visible;
			border: 0;
			border-radius: 0;
			box-shadow: none;
		}
		.paper {
			transform: none !important;
		}
		figcaption,
		.loading {
			display: none;
		}
		.empty {
			display: none;
		}
	}
</style>
