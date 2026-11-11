<script lang="ts">
	import { onMount } from 'svelte';
	import type { CvStore } from '#lib/core/store/cv-store.svelte.ts';
	import {
		hasCustomDesign,
		resetDesign,
		resolveDesign,
		setDesign,
		type DesignPatch
	} from '#lib/core/design/index.ts';
	import { DESIGN_LIMITS } from '#lib/core/schema/limits.ts';
	import { newId } from '#lib/core/schema/ids.ts';
	import type {
		DesignSpacing,
		PhotoShape,
		PhotoSize,
		SidePosition
	} from '#lib/core/schema/types.ts';
	import { incognito } from '#lib/core/storage/incognito.svelte.ts';
	import { resolveTemplate } from '#lib/templates/registry.ts';
	import { t } from '#lib/i18n/index.svelte.ts';
	import Button from '#lib/ui/Button.svelte';
	import Select from '#lib/ui/Select.svelte';

	let { store, onbeforechange }: { store: CvStore; onbeforechange?: () => void } = $props();
	const uid = $props.id();
	let open = $state(
		typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches
	);
	const design = $derived(resolveDesign(store.cv));
	const editable = $derived(
		store.cv.kind === 'creative' &&
			store.externalChange !== 'removed' &&
			!(incognito.active && incognito.expiredAt)
	);
	const sidebar = $derived(
		resolveTemplate(store.cv.templateId, store.cv.kind).id === 'creative-sidebar'
	);
	const hasPhoto = $derived(Boolean(store.cv.personal.photoAssetId));
	const changed = $derived(hasCustomDesign(store.cv));

	onMount(() => {
		const media = window.matchMedia('(min-width: 1024px)');
		const resize = () => {
			open = media.matches;
		};
		media.addEventListener('change', resize);
		return () => media.removeEventListener('change', resize);
	});
	function change(patch: DesignPatch, coalesceKey = `design:change:${newId()}`) {
		if (!editable) return;
		onbeforechange?.();
		if (editable) store.update((draft) => setDesign(draft, patch), { coalesceKey });
	}
	function reset() {
		if (!editable || !changed) return;
		onbeforechange?.();
		if (editable)
			store.update((draft) => resetDesign(draft), { coalesceKey: `design:reset:${newId()}` });
	}
</script>

<details class="design-panel" bind:open data-testid="visual-design-panel">
	<summary
		>{t('visualEditor.design')}<svg aria-hidden="true" viewBox="0 0 24 24" fill="none"
			><path
				d="m6 9 6 6 6-6"
				stroke="currentColor"
				stroke-width="1.75"
				stroke-linecap="round"
				stroke-linejoin="round"
			/></svg
		></summary
	>
	<div class="controls">
		{#if sidebar}
			<Select
				label={t('visualEditor.sidePosition')}
				disabled={!editable}
				options={[
					{ value: 'left', label: t('visualEditor.left') },
					{ value: 'right', label: t('visualEditor.right') }
				]}
				bind:value={
					() => design.sidePosition, (value) => change({ sidePosition: value as SidePosition })
				}
			/>
			<div class="range-field">
				<label for={`${uid}-width`}
					>{t('visualEditor.sideWidth')}
					<output for={`${uid}-width`}
						>{t('visualEditor.widthValue', { value: design.sideWidth })}</output
					></label
				>
				<input
					id={`${uid}-width`}
					type="range"
					min={DESIGN_LIMITS.sideWidth.min}
					max={DESIGN_LIMITS.sideWidth.max}
					step="1"
					value={design.sideWidth}
					disabled={!editable}
					aria-valuetext={t('visualEditor.widthValue', { value: design.sideWidth })}
					oninput={(event) =>
						change({ sideWidth: event.currentTarget.valueAsNumber }, 'design:sideWidth')}
				/>
			</div>
		{/if}
		<Select
			label={t('visualEditor.spacing')}
			disabled={!editable}
			options={[
				{ value: 'compact', label: t('visualEditor.compact') },
				{ value: 'normal', label: t('visualEditor.normal') },
				{ value: 'airy', label: t('visualEditor.airy') }
			]}
			bind:value={() => design.spacing, (value) => change({ spacing: value as DesignSpacing })}
		/>
		{#if hasPhoto}
			<Select
				label={t('visualEditor.photoShape')}
				disabled={!editable}
				options={[
					{ value: 'circle', label: t('visualEditor.circle') },
					{ value: 'rounded', label: t('visualEditor.rounded') },
					{ value: 'square', label: t('visualEditor.square') }
				]}
				bind:value={() => design.photoShape, (value) => change({ photoShape: value as PhotoShape })}
			/>
			<Select
				label={t('visualEditor.photoSize')}
				disabled={!editable}
				options={[
					{ value: 'sm', label: t('visualEditor.sm') },
					{ value: 'md', label: t('visualEditor.md') },
					{ value: 'lg', label: t('visualEditor.lg') }
				]}
				bind:value={() => design.photoSize, (value) => change({ photoSize: value as PhotoSize })}
			/>
		{/if}
		<Button variant="secondary" disabled={!editable || !changed} onclick={reset}
			>{t('visualEditor.reset')}</Button
		>
	</div>
</details>

<style>
	.design-panel {
		min-width: 0;
		align-self: start;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
	}
	summary {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		min-height: 44px;
		padding: 0.75rem 1rem;
		color: var(--color-text);
		font-weight: 600;
		cursor: pointer;
		list-style: none;
	}
	summary::-webkit-details-marker {
		display: none;
	}
	summary svg {
		width: 18px;
		height: 18px;
		flex-shrink: 0;
		transition: transform 160ms ease-out;
	}
	details[open] summary svg {
		transform: rotate(180deg);
	}
	.controls {
		display: grid;
		gap: 1rem;
		padding: 0.25rem 1rem 1rem;
	}
	.range-field {
		display: grid;
		gap: 0.5rem;
		min-width: 0;
	}
	label {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.5rem;
		color: var(--color-text);
		font-size: 0.875rem;
		font-weight: 600;
	}
	output {
		font-variant-numeric: tabular-nums;
	}
	input[type='range'] {
		width: 100%;
		min-width: 0;
		min-height: 44px;
		accent-color: var(--color-brand-ink);
		cursor: pointer;
	}
	input:disabled {
		cursor: default;
		opacity: 0.6;
	}
</style>
