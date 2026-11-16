<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { CVDocument } from '#lib/core/schema/types.ts';
	import {
		LETTER_ATTACHMENTS,
		LETTER_LIMITS,
		type CoverLetter,
		type LetterPatch
	} from '#lib/core/letter/index.ts';
	import { t } from '#lib/i18n/index.svelte.ts';
	import Button from '#lib/ui/Button.svelte';
	import Checkbox from '#lib/ui/Checkbox.svelte';
	import Input from '#lib/ui/Input.svelte';
	let {
		cv,
		letter,
		onchange,
		finish
	}: {
		cv: CVDocument;
		letter: CoverLetter;
		onchange: (patch: LetterPatch, field?: string) => void;
		finish?: Snippet;
	} = $props();
</script>

<fieldset data-cv-id={cv.id}>
	<legend>{t('letterEditor.attachments')}</legend
	>{#each LETTER_ATTACHMENTS as attachment (attachment)}<Checkbox
			label={t(`letter.attachments.${attachment}`)}
			checked={letter.attachments.includes(attachment)}
			onchange={(event) =>
				onchange({
					attachments: event.currentTarget.checked
						? [...letter.attachments, attachment]
						: letter.attachments.filter((item) => item !== attachment)
				})}
		/>{/each}
</fieldset>
{#each letter.otherAttachments as attachment, index (index)}<div class="extra-attachment">
		<Input
			label={t('letterEditor.attachmentLabel', { number: index + 1 })}
			value={attachment}
			maxlength={LETTER_LIMITS.otherAttachment}
			oninput={(event) =>
				onchange(
					{
						otherAttachments: letter.otherAttachments.map((item, i) =>
							i === index ? event.currentTarget.value : item
						)
					},
					`attachment.${index}`
				)}
		/><Button
			variant="ghost"
			aria-label={t('letterEditor.removeAttachment', { number: index + 1 })}
			onclick={() =>
				onchange({
					otherAttachments: letter.otherAttachments.filter((_, i) => i !== index)
				})}>×</Button
		>
	</div>{/each}
<Button
	variant="secondary"
	disabled={letter.otherAttachments.length >= LETTER_LIMITS.otherAttachments}
	onclick={() => onchange({ otherAttachments: [...letter.otherAttachments, ''] })}
	>{t('letterEditor.addAttachment')}</Button
>
<Input
	id="letter-place"
	label={t('letterEditor.place')}
	value={letter.place}
	maxlength={LETTER_LIMITS.place}
	oninput={(event) => onchange({ place: event.currentTarget.value }, 'place')}
/>
<label class="native-field" for="letter-date"
	>{t('letterEditor.date')}<input
		id="letter-date"
		data-testid="letter-date"
		type="date"
		value={letter.date}
		oninput={(event) => onchange({ date: event.currentTarget.value }, 'date')}
	/></label
>
<label class="native-field" for="letter-locale"
	>{t('letterEditor.locale')}<select
		id="letter-locale"
		data-testid="letter-locale"
		value={letter.locale}
		onchange={(event) => onchange({ locale: event.currentTarget.value === 'en' ? 'en' : 'id' })}
		><option value="id">{t('locale.id')}</option><option value="en">{t('locale.en')}</option
		></select
	></label
>
<p class="hint">{t('letterEditor.englishHint')}</p>

{@render finish?.()}

<style>
	fieldset {
		padding: 0;
		border: 0;
		margin: 0;
		min-width: 0;
	}
	legend {
		font-size: 0.875rem;
		font-weight: 650;
		line-height: 1.5;
		margin-bottom: 0.5rem;
	}
	p {
		margin: 0.5rem 0;
		line-height: 1.65;
	}
	.hint {
		color: var(--color-text-muted);
		font-size: 0.8125rem;
	}
	.native-field {
		display: grid;
		gap: 0.5rem;
		min-width: 0;
		font-size: 0.875rem;
		font-weight: 600;
	}
	.native-field input,
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
	.extra-attachment {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: end;
		gap: 0.25rem;
	}
</style>
