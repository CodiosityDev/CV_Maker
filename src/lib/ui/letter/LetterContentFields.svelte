<script lang="ts">
	import { resolve } from '$app/paths';
	import type { CVDocument } from '#lib/core/schema/types.ts';
	import {
		letterHighlightOptions,
		letterMotivationExamples,
		LETTER_HIGHLIGHT_SECTIONS,
		LETTER_LIMITS,
		type CoverLetter,
		type LetterHighlightRef,
		type LetterPatch
	} from '#lib/core/letter/index.ts';
	import { t } from '#lib/i18n/index.svelte.ts';
	import Button from '#lib/ui/Button.svelte';
	import Checkbox from '#lib/ui/Checkbox.svelte';
	import Input from '#lib/ui/Input.svelte';
	import Textarea from '#lib/ui/Textarea.svelte';
	import { getLetterNavigation } from './navigation.svelte.ts';
	const navigation = getLetterNavigation();
	let {
		cv,
		letter,
		onchange
	}: {
		cv: CVDocument;
		letter: CoverLetter;
		onchange: (patch: LetterPatch, field?: string) => void;
	} = $props();
	const options = $derived(letterHighlightOptions(cv));
	const examples = $derived(letterMotivationExamples(cv, letter));
	const identity = $derived(
		cv.status.wizardCompleted
			? resolve('/(app)/cv/[id]/edit', { id: cv.id })
			: resolve('/(app)/buat/[id]', { id: cv.id })
	);
	function selected(ref: LetterHighlightRef) {
		return letter.highlights.some((item) => item.id === ref.id && item.section === ref.section);
	}
	function highlight(ref: LetterHighlightRef, checked: boolean) {
		const others = letter.highlights.filter(
			(item) => item.id !== ref.id || item.section !== ref.section
		);
		if (checked && others.length >= LETTER_LIMITS.highlights) return;
		onchange({ highlights: checked ? [...others, ref] : others });
	}
</script>

<fieldset id="letter-highlights" tabindex="-1">
	<legend>{t('letterEditor.highlights')}</legend>
	<p class="hint">{t('letterEditor.educationAuto')}</p>
	<p class="hint" id="letter-highlight-limit">{t('letterEditor.highlightLimit')}</p>
	{#each LETTER_HIGHLIGHT_SECTIONS as section (section)}{@const group = options.filter(
			(option) => option.section === section
		)}{#if group.length}<h3>{t(`letter.highlightSections.${section}`)}</h3>
			<div class="highlights">
				{#each group as option (`${option.ref.section}:${option.ref.id}`)}<label
						class:chosen={selected(option.ref)}
						><input
							type="checkbox"
							data-testid="letter-highlight"
							checked={selected(option.ref)}
							disabled={!selected(option.ref) &&
								letter.highlights.length >= LETTER_LIMITS.highlights}
							aria-describedby="letter-highlight-limit"
							onchange={(event) => highlight(option.ref, event.currentTarget.checked)}
						/><span
							><strong
								>{section === 'skills'
									? t(
											`letter.skillGroups.${option.ref.id === 'tools' ? 'tools' : option.ref.id === 'soft' ? 'soft' : 'hard'}`
										)
									: option.label}</strong
							>{#if section === 'skills'}<small>{option.label}</small
								>{:else if option.sublabel}<small>{option.sublabel}</small>{/if}</span
						></label
					>{/each}
			</div>{/if}{/each}
	{#if !options.length}<p class="hint">{t('letterEditor.noHighlights')}</p>{/if}
</fieldset>
<Textarea
	id="letter-motivation"
	data-testid="letter-motivation"
	label={t('letterEditor.motivation')}
	value={letter.motivation}
	maxlength={LETTER_LIMITS.motivation}
	hint={t('letterEditor.motivationHint')}
	oninput={(event) => onchange({ motivation: event.currentTarget.value }, 'motivation')}
/>
<details>
	<summary>{t('letterEditor.examples')}</summary>
	<ol class="examples">
		{#each examples as example, index (index)}<li>
				<p>{example}</p>
				<Button variant="secondary" onclick={() => onchange({ motivation: example })}
					>{t('letterEditor.useExample', { number: index + 1 })}</Button
				>
			</li>{/each}
	</ol>
</details>
<Checkbox
	label={t('letterEditor.immediate')}
	checked={letter.availability.immediate}
	onchange={(event) => onchange({ availability: { immediate: event.currentTarget.checked } })}
/><Checkbox
	label={t('letterEditor.relocate')}
	checked={letter.availability.relocate}
	onchange={(event) => onchange({ availability: { relocate: event.currentTarget.checked } })}
/>
{#if letter.locale === 'id'}<Checkbox
		id="letter-include-identity"
		data-testid="letter-include-identity"
		label={t('letterEditor.includeIdentity')}
		checked={letter.includeIdentity}
		hint={t('letterEditor.identityPrivacy')}
		onchange={(event) => onchange({ includeIdentity: event.currentTarget.checked })}
	/>{#if letter.includeIdentity}<div class="identity-fields">
			<Input
				id="letter-birth-place"
				label={t('letterEditor.birthPlace')}
				value={letter.identity.birthPlace}
				maxlength={LETTER_LIMITS.birthPlace}
				oninput={(event) =>
					onchange({ identity: { birthPlace: event.currentTarget.value } }, 'birthPlace')}
			/><label class="native-field" for="letter-birth-date"
				>{t('letterEditor.birthDate')}<input
					id="letter-birth-date"
					type="date"
					value={letter.identity.birthDate ?? ''}
					oninput={(event) =>
						onchange(
							{ identity: { birthDate: event.currentTarget.value || undefined } },
							'birthDate'
						)}
				/></label
			><Textarea
				id="letter-address"
				label={t('letterEditor.address')}
				value={letter.identity.address}
				maxlength={LETTER_LIMITS.address}
				oninput={(event) =>
					onchange({ identity: { address: event.currentTarget.value } }, 'address')}
			/>
			<p class="hint">
				{t('letterEditor.cvIdentity')}
				<a href={identity} onclick={navigation.click}>{t('letterEditor.editCv')}</a>
			</p>
			<p>
				{cv.personal.fullName} · {cv.personal.email} · {cv.personal.phone}
			</p>
		</div>{/if}{/if}

<style>
	h3,
	legend {
		font-size: 0.875rem;
		font-weight: 650;
		line-height: 1.5;
	}
	h3 {
		margin: 1rem 0 0.5rem;
	}
	p {
		margin: 0.5rem 0;
		line-height: 1.65;
	}
	.hint {
		color: var(--color-text-muted);
		font-size: 0.8125rem;
	}
	a {
		color: var(--color-brand-ink);
		text-underline-offset: 3px;
		font-size: 0.875rem;
	}
	fieldset {
		padding: 0;
		border: 0;
		margin: 0;
		min-width: 0;
	}
	legend {
		margin-bottom: 0.5rem;
	}
	input[type='checkbox'] {
		accent-color: var(--color-brand-ink);
		width: 20px;
		height: 20px;
		flex-shrink: 0;
	}
	summary {
		min-height: 44px;
		cursor: pointer;
		align-content: center;
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--color-brand-ink);
	}
	.highlights {
		display: grid;
		gap: 0.5rem;
	}
	.highlights label {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		min-height: 60px;
		padding: 0.875rem;
		border: 1px solid var(--color-control-border);
		border-radius: var(--radius-md);
		font-size: 0.8125rem;
	}
	.highlights label:has(:disabled) {
		opacity: 0.6;
	}
	.highlights .chosen {
		background: var(--color-mint-50);
		border-color: var(--color-brand-ink);
	}
	.highlights span {
		display: grid;
		gap: 0.25rem;
	}
	.highlights small {
		color: var(--color-text-muted);
		font-size: 0.75rem;
		line-height: 1.5;
	}
	.examples {
		display: grid;
		gap: 1rem;
		padding-left: 1.25rem;
		font-size: 0.8125rem;
	}
	.identity-fields {
		display: grid;
		gap: 1rem;
		background: var(--color-mint-50);
		padding: 1rem;
		border-radius: var(--radius-md);
	}
	.identity-fields p {
		font-size: 0.8125rem;
	}
	.native-field {
		display: grid;
		gap: 0.5rem;
		min-width: 0;
		font-size: 0.875rem;
		font-weight: 600;
	}
	.native-field input {
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
</style>
