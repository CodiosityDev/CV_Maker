<script lang="ts">
	import {
		DEFAULT_LETTER_STYLE,
		letterFontFamily,
		LETTER_STYLE_OPTIONS,
		type LetterStyle
	} from '#lib/core/letter/index.ts';
	import { t } from '#lib/i18n/index.svelte.ts';
	import Button from '#lib/ui/Button.svelte';

	let {
		style,
		onchange
	}: {
		style: LetterStyle;
		onchange: (patch: Partial<LetterStyle>) => void;
	} = $props();
</script>

<fieldset>
	<legend>{t('letterEditor.font')}</legend>
	<div class="font-options">
		{#each LETTER_STYLE_OPTIONS.font as font (font)}
			<label style:font-family={letterFontFamily(font)}
				><input
					type="radio"
					name="letter-font"
					value={font}
					checked={style.font === font}
					onchange={() => onchange({ font })}
				/>{t(`letter.fonts.${font}`)}</label
			>
		{/each}
	</div>
</fieldset>
<div class="style-fields">
	<label for="letter-size"
		>{t('letterEditor.fontSize')}<select
			id="letter-size"
			value={style.size}
			onchange={(event) => onchange({ size: event.currentTarget.value === '11' ? 11 : 12 })}
			>{#each LETTER_STYLE_OPTIONS.size as size (size)}<option value={size}
					>{t('letterEditor.fontSizeOption', { size })}</option
				>{/each}</select
		></label
	>
	<label for="letter-line-height"
		>{t('letterEditor.lineHeight')}<select
			id="letter-line-height"
			value={style.lineHeight}
			onchange={(event) =>
				onchange({
					lineHeight:
						event.currentTarget.value === '1' ? 1 : event.currentTarget.value === '1.5' ? 1.5 : 1.15
				})}
			>{#each LETTER_STYLE_OPTIONS.lineHeight as height (height)}<option value={height}
					>{height}</option
				>{/each}</select
		></label
	>
	<label for="letter-align"
		>{t('letterEditor.align')}<select
			id="letter-align"
			value={style.align}
			onchange={(event) =>
				onchange({ align: event.currentTarget.value === 'justify' ? 'justify' : 'left' })}
			>{#each LETTER_STYLE_OPTIONS.align as align (align)}<option value={align}
					>{t(`letter.aligns.${align}`)}</option
				>{/each}</select
		></label
	>
</div>
<Button
	variant="ghost"
	id="letter-reset-style"
	onclick={() => onchange({ ...DEFAULT_LETTER_STYLE })}>{t('letterEditor.resetStyle')}</Button
>

<style>
	fieldset {
		padding: 0;
		border: 0;
		margin: 0;
		min-width: 0;
	}
	legend {
		margin-bottom: 0.5rem;
		font-size: 0.875rem;
		font-weight: 650;
		line-height: 1.5;
	}
	input[type='radio'] {
		accent-color: var(--color-brand-ink);
		width: 20px;
		height: 20px;
		flex-shrink: 0;
	}
	.style-fields label {
		display: grid;
		gap: 0.5rem;
		min-width: 0;
		font-size: 0.875rem;
		font-weight: 600;
	}
	select {
		box-sizing: border-box;
		width: 100%;
		min-width: 0;
		min-height: 48px;
		border: 1px solid var(--color-control-border);
		border-radius: var(--radius-md);
		padding: 0.75rem;
		background: var(--color-surface);
		color: var(--color-text);
		font-size: 1rem;
	}
	.font-options {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.5rem;
	}
	.font-options label {
		min-height: 44px;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 1rem;
		color: var(--color-text);
	}
	.style-fields {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
		margin: 1rem 0;
	}
</style>
