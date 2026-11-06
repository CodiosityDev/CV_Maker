<script lang="ts">
	import type { RenderModel } from '#lib/core/render/index.ts';
	import type { CVKind } from '#lib/core/schema/types.ts';
	import type { createCvStore } from '#lib/core/store/cv-store.svelte.ts';
	import { resolveTemplate, switchKindPatch, templatesFor } from '#lib/templates/registry.ts';
	import { t, type MessageKey } from '#lib/i18n/index.svelte.ts';
	import TemplateThumbnail from '#lib/ui/TemplateThumbnail.svelte';

	let { store, model }: { store: ReturnType<typeof createCvStore>; model: RenderModel } = $props();
	const uid = $props.id();
	const choices = $derived(templatesFor(store.cv.kind));
	const selected = $derived(resolveTemplate(store.cv.templateId, store.cv.kind).id);
	const presets = [
		{ hex: '#9C9AFF', name: 'periwinkle' },
		{ hex: '#7FB8B0', name: 'mint' },
		{ hex: '#F2A97E', name: 'peach' },
		{ hex: '#FF8E8E', name: 'coral' },
		{ hex: '#8BB8E8', name: 'sky' },
		{ hex: '#C3A6E8', name: 'lavender' }
	] as const;
	function changeKind(kind: CVKind) {
		if (kind === store.cv.kind) return;
		store.update((draft) => Object.assign(draft, switchKindPatch(kind, draft.theme)));
	}
	function choose(id: string) {
		if (id === store.cv.templateId) return;
		store.update(
			(draft) => {
				draft.templateId = id;
			},
			{ coalesceKey: 'templateId' }
		);
	}
</script>

<section class="template-picker" aria-labelledby="{uid}-title" data-testid="template-picker">
	<h2 id="{uid}-title">{t('templatePicker.title')}</h2>
	<p class="explanation">{t('templatePicker.description')}</p>
	<div class="kind-options" role="group" aria-label={t('templatePicker.kind')}>
		{#each ['ats', 'creative'] as kind (kind)}
			<button
				type="button"
				class:active={store.cv.kind === kind}
				aria-pressed={store.cv.kind === kind}
				onclick={() => changeKind(kind as CVKind)}
				>{t(kind === 'ats' ? 'templatePicker.ats' : 'templatePicker.creative')}</button
			>
		{/each}
	</div>
	{#if store.cv.kind === 'creative'}<p class="creative-note">
			{t('templatePicker.creativeNotice')}
		</p>{/if}
	<div class="template-options" role="group" aria-label={t('templatePicker.templates')}>
		{#each choices as meta (meta.id)}
			<div class="template-card" class:selected={selected === meta.id}>
				<TemplateThumbnail {meta} {model} />
				<button
					type="button"
					aria-pressed={selected === meta.id}
					data-template-id={meta.id}
					onclick={() => choose(meta.id)}
				>
					<span class="name">{t(`templates.${meta.id}.name` as MessageKey)}</span>
					<span class="description">{t(`templates.${meta.id}.description` as MessageKey)}</span>
					<span class="selection"
						>{selected === meta.id
							? t('templatePicker.selected')
							: t('templatePicker.choose')}</span
					>
				</button>
			</div>
		{/each}
	</div>
	{#if store.cv.kind === 'creative'}
		<fieldset class="accents">
			<legend>{t('templatePicker.colorsLabel')}</legend>
			<div class="accent-options">
				{#each presets as preset (preset.hex)}
					<label>
						<input
							type="radio"
							name="{uid}-accent"
							value={preset.hex}
							checked={(store.cv.theme.accentColor ?? '#9C9AFF').toUpperCase() === preset.hex}
							onchange={() =>
								store.update((draft) => {
									draft.theme.accentColor = preset.hex;
								})}
						/>
						<span class="swatch" style:background={preset.hex} aria-hidden="true"></span>
						<span>{t(`templatePicker.colors.${preset.name}`)}</span>
					</label>
				{/each}
			</div>
		</fieldset>
	{/if}
</section>

<style>
	.template-picker {
		min-width: 0;
		margin-block: 24px;
	}
	h2 {
		font-size: 1.125rem;
		font-weight: 650;
	}
	.explanation {
		margin-top: 8px;
		color: var(--color-text-muted);
		font-size: 0.875rem;
		line-height: 1.6;
	}
	.kind-options {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-block: 16px;
	}
	.kind-options button {
		min-height: 44px;
		padding: 8px 16px;
		border: 1px solid transparent;
		border-radius: var(--radius-md);
		background: var(--color-brand-50);
		color: var(--color-brand-ink);
		font: inherit;
		font-size: 0.875rem;
		font-weight: 600;
		cursor: pointer;
	}
	.kind-options button.active {
		background: var(--color-brand);
		color: var(--color-ink);
	}
	.creative-note {
		margin-bottom: 16px;
		padding: 12px;
		border-radius: var(--radius-md);
		background: var(--color-cream-50);
		color: var(--color-text);
		font-size: 0.875rem;
	}
	.template-options {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 12px;
	}
	.template-card {
		position: relative;
		display: flex;
		flex-direction: column;
		min-width: 0;
		padding: 8px;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
	}
	.template-card.selected {
		background: var(--color-mint-50);
		border-color: var(--color-mint);
	}
	.template-card:focus-within {
		outline: 2px solid var(--color-focus);
		outline-offset: 3px;
	}
	.template-card button {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: 6px;
		min-width: 0;
		min-height: 44px;
		padding: 12px 4px 4px;
		border: 0;
		background: transparent;
		color: var(--color-text);
		font: inherit;
		text-align: left;
		cursor: pointer;
	}
	.template-card button::after {
		position: absolute;
		inset: 0;
		border-radius: inherit;
		content: '';
	}
	.template-card button:focus-visible {
		outline: none;
	}
	.name {
		font-size: 0.875rem;
		font-weight: 700;
		overflow-wrap: anywhere;
	}
	.description {
		color: var(--color-text-muted);
		font-size: 0.75rem;
		line-height: 1.5;
	}
	.selection {
		margin-top: auto;
		padding-top: 6px;
		color: var(--color-brand-ink);
		font-size: 0.75rem;
		font-weight: 600;
	}
	.accents {
		min-width: 0;
		margin: 20px 0 0;
		padding: 0;
		border: 0;
	}
	legend {
		margin-bottom: 8px;
		font-size: 0.875rem;
		font-weight: 600;
	}
	.accent-options {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 8px;
	}
	.accent-options label {
		position: relative;
		display: flex;
		align-items: center;
		gap: 8px;
		min-width: 0;
		min-height: 44px;
		padding: 8px;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		font-size: 0.75rem;
		cursor: pointer;
	}
	.accent-options label:focus-within {
		outline: 2px solid var(--color-focus);
		outline-offset: 2px;
	}
	.accent-options input {
		width: 16px;
		height: 16px;
		margin: 0;
		accent-color: var(--color-brand-ink);
	}
	.swatch {
		width: 20px;
		height: 20px;
		flex-shrink: 0;
		border-radius: 5px;
	}
	@media (min-width: 480px) {
		.template-options {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
		.accent-options {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}
</style>
