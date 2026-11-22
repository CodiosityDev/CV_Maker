<script lang="ts">
	import { untrack } from 'svelte';
	import type { RenderModel } from '#lib/core/render/index.ts';
	import { t, type MessageKey } from '#lib/i18n/index.svelte.ts';
	import { preventPreviewNavigation } from './prevent-preview-navigation.ts';
	import {
		resolveTemplate,
		type TemplateComponent,
		type TemplateMeta
	} from '#lib/templates/registry.ts';

	let { model }: { model: RenderModel } = $props();
	/** A4 width (210 mm) in CSS pixels: every template is exactly this wide. */
	const PAPER_WIDTH_PX = (210 * 96) / 25.4;
	const requestedMeta = $derived(resolveTemplate(model.templateId, model.kind));
	let renderedModel = $state.raw<RenderModel>(untrack(() => model));
	let displayedMeta = $state.raw<TemplateMeta>(untrack(() => requestedMeta));
	let Template = $state<TemplateComponent>();
	let failed = $state(false);
	let retryVersion = $state(0);
	let container = $state<HTMLDivElement>();
	let paper = $state<HTMLDivElement>();
	let scale = $state(0);
	let height = $state(0);
	/**
	 * Scale the A4 sheet with CSS `zoom` where supported: the text is laid out and drawn at its final
	 * size, so it stays sharp. `transform: scale()` (fallback) can leave the sheet as a blurry
	 * bitmap after an animation or under the dark-theme filter.
	 */
	const useZoom = typeof CSS !== 'undefined' && CSS.supports('zoom', '0.5');

	$effect(() => {
		const next = model;
		if (requestedMeta !== displayedMeta || !Template) return;
		const timer = setTimeout(() => {
			renderedModel = next;
		}, 150);
		return () => clearTimeout(timer);
	});

	$effect(() => {
		const meta = requestedMeta;
		// Retrying starts a fresh request even when the selected metadata is unchanged.
		void retryVersion;
		let cancelled = false;
		failed = false;
		void (async () => {
			try {
				const module = await meta.load();
				if (cancelled) return;
				untrack(() => {
					Template = module.default;
					displayedMeta = meta;
					renderedModel = model;
				});
			} catch {
				if (!cancelled) failed = true;
			}
		})();
		return () => {
			cancelled = true;
		};
	});

	$effect(() => {
		const viewport = container;
		const page = paper;
		if (!viewport || !page) return;
		let frame: number | undefined;
		function measure() {
			frame = undefined;
			if (!viewport || !page || !viewport.clientWidth) return;
			const next = Math.min(1, viewport.clientWidth / PAPER_WIDTH_PX);
			scale = next;
			if (!useZoom) height = page.offsetHeight * next;
		}
		function schedule() {
			if (frame !== undefined) cancelAnimationFrame(frame);
			frame = requestAnimationFrame(measure);
		}
		const observer = new ResizeObserver(schedule);
		observer.observe(viewport);
		if (!useZoom) observer.observe(page);
		// First size at once (before paint), so the sheet never flashes at full size.
		measure();
		return () => {
			observer.disconnect();
			if (frame !== undefined) cancelAnimationFrame(frame);
		};
	});
</script>

<figure class="cv-preview" aria-label={t('preview.label')} data-testid="cv-preview">
	{#if !renderedModel.personal.fullName && !renderedModel.personal.headline && !renderedModel.personal.email && !renderedModel.personal.phone && !renderedModel.sections.length}
		<p class="empty">{t('preview.empty')}</p>
	{/if}
	{#if failed || !Template}
		<div class="loading" role="status">
			<p>{t(failed ? 'preview.error' : 'preview.loading')}</p>
			{#if failed}
				<button type="button" onclick={() => (retryVersion += 1)}>{t('preview.retry')}</button>
			{/if}
		</div>
	{/if}
	<div class="viewport" bind:this={container} style:height={useZoom ? undefined : `${height}px`}>
		<div
			class="paper"
			bind:this={paper}
			use:preventPreviewNavigation
			style:zoom={useZoom && scale ? scale : undefined}
			style:transform={useZoom ? undefined : `scale(${scale})`}
			style:visibility={scale ? undefined : 'hidden'}
		>
			{#if Template}<Template model={renderedModel} />{/if}
		</div>
	</div>
	<figcaption>
		{t('preview.caption', {
			template: t(`templates.${displayedMeta.id}.name` as MessageKey)
		})}
	</figcaption>
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
		background: var(--color-paper);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-paper);
		/* Dark theme only (token unset otherwise); never applies to print. */
		filter: var(--paper-dim, none);
	}
	.paper {
		--color-focus: var(--color-paper-focus);
		color: var(--color-paper-ink);
		color-scheme: light;
		width: 210mm;
		min-height: 297mm;
		transform-origin: top left;
		background: var(--color-paper);
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
			zoom: 1 !important;
			transform: none !important;
			visibility: visible !important;
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
