<script lang="ts">
	import { onMount } from 'svelte';
	import type { RenderModel } from '#lib/core/render/index.ts';
	import type { TemplateComponent, TemplateMeta } from '#lib/templates/registry.ts';
	import { t } from '#lib/i18n/index.svelte.ts';

	let { meta, model }: { meta: TemplateMeta; model: RenderModel } = $props();
	let frame = $state<HTMLDivElement>();
	let visible = $state(false);
	let scale = $state(0);
	let Template = $state<TemplateComponent>();
	let failed = $state(false);
	const thumbnailModel = $derived({ ...model, templateId: meta.id });

	onMount(() => {
		if (!frame) return;
		const target = frame;
		let request: number | undefined;
		const measure = () => {
			request = undefined;
			scale = target.clientWidth / ((210 * 96) / 25.4);
		};
		const resize = new ResizeObserver(() => {
			if (request !== undefined) cancelAnimationFrame(request);
			request = requestAnimationFrame(measure);
		});
		resize.observe(target);
		const intersection = new IntersectionObserver((entries) => {
			if (entries.some((entry) => entry.isIntersecting)) {
				visible = true;
				intersection.disconnect();
			}
		});
		intersection.observe(target);
		return () => {
			resize.disconnect();
			intersection.disconnect();
			if (request !== undefined) cancelAnimationFrame(request);
		};
	});
	$effect(() => {
		if (!visible) return;
		const template = meta;
		let active = true;
		failed = false;
		void template.load().then(
			(module) => {
				if (active) Template = module.default;
			},
			() => {
				if (active) failed = true;
			}
		);
		return () => {
			active = false;
		};
	});
</script>

<div class="thumbnail" bind:this={frame} aria-hidden="true" inert data-testid="template-thumbnail">
	{#if Template}
		<div class="thumbnail-paper" style:transform="scale({scale})">
			<Template model={thumbnailModel} />
		</div>
	{:else}<span
			>{t(failed ? 'templatePicker.thumbnailError' : 'templatePicker.thumbnailLoading')}</span
		>{/if}
</div>

<style>
	.thumbnail {
		position: relative;
		width: 100%;
		aspect-ratio: 210 / 297;
		overflow: hidden;
		border: 1px solid var(--color-border);
		border-radius: 6px;
		background: white;
		pointer-events: none;
	}
	.thumbnail-paper {
		width: 210mm;
		min-height: 297mm;
		transform-origin: top left;
	}
	span {
		display: block;
		padding: 12px;
		color: var(--color-text-muted);
		font-size: 0.75rem;
		line-height: 1.5;
	}
</style>
