<script lang="ts">
	import { onDestroy, tick } from 'svelte';
	import type { AiConverted, Converted } from '#lib/core/convert/index.ts';
	import { t } from '#lib/i18n/index.svelte.ts';
	import AiText from '#lib/ui/ai/AiText.svelte';
	import Button from '#lib/ui/Button.svelte';
	import Checkbox from '#lib/ui/Checkbox.svelte';

	type Props = {
		result: Converted | AiConverted;
		selectedSkills: string[];
		ontoggle: (skill: string) => void;
		onsave: () => void;
		oncancel: () => void;
		saving?: boolean;
		error?: string;
		incognitoActive?: boolean;
		saveLabel?: string;
	};
	type CopyState = {
		source: Converted;
		text: string;
		status: 'copying' | 'copied' | 'manual';
	};
	let {
		result,
		selectedSkills,
		ontoggle,
		onsave,
		oncancel,
		saving = false,
		error,
		incognitoActive = false,
		saveLabel
	}: Props = $props();
	const uid = $props.id();
	let copyState = $state.raw<CopyState>();
	let manualField = $state<HTMLTextAreaElement>();
	let mounted = true;
	let copyRequest = 0;
	const activeCopy = $derived(copyState?.source === result ? copyState : undefined);
	const aiResult = $derived('aiNotes' in result ? result : undefined);
	const contacts = $derived(
		[
			{ key: 'name', label: t('wizard.fields.fullName'), value: result.cv.personal.fullName },
			{ key: 'email', label: t('wizard.fields.email'), value: result.cv.personal.email },
			{ key: 'phone', label: t('wizard.fields.phone'), value: result.cv.personal.phone },
			{ key: 'city', label: t('wizard.fields.city'), value: result.cv.personal.city },
			...result.cv.personal.links.map((link) => ({
				key: link.id,
				label: link.label || t('wizard.fields.links'),
				value: link.url
			}))
		].filter((contact) => contact.value.trim())
	);
	const counts = $derived([
		{ key: 'summary', label: t('wizard.fields.summary'), count: result.cv.summary.trim() ? 1 : 0 },
		{
			key: 'education',
			label: t('wizard.steps.education.title'),
			count: result.cv.education.length
		},
		{
			key: 'experience',
			label: t('wizard.steps.experience.short'),
			count: result.cv.experience.length
		},
		{
			key: 'organizations',
			label: t('wizard.steps.organizations.short'),
			count: result.cv.organizations.length
		},
		{ key: 'projects', label: t('wizard.steps.projects.title'), count: result.cv.projects.length },
		{
			key: 'skills',
			label: t('wizard.steps.skills.short'),
			count:
				result.cv.skills.hard.length + result.cv.skills.soft.length + result.cv.skills.tools.length
		},
		{ key: 'languages', label: t('wizard.fields.languages'), count: result.cv.languages.length },
		{
			key: 'certifications',
			label: t('wizard.fields.certifications'),
			count: result.cv.certifications.length
		},
		{ key: 'awards', label: t('wizard.fields.awards'), count: result.cv.awards.length }
	]);
	const placeholderLines = $derived.by(() => {
		const cv = result.cv;
		const lines = [
			cv.personal.headline,
			cv.summary,
			...cv.education.flatMap((entry) => entry.highlights),
			...cv.experience.flatMap((entry) => entry.bullets),
			...cv.organizations.flatMap((entry) => entry.bullets),
			...cv.projects.flatMap((entry) => entry.bullets),
			...cv.awards.map((entry) => entry.description ?? '')
		];
		return [...new Set(lines.filter((line) => /\[(?:isi angka|add number)\]/i.test(line)))];
	});

	onDestroy(() => {
		mounted = false;
		copyRequest += 1;
		copyState = undefined;
	});
	async function copyUnplaced() {
		if (!result.unplaced.length || activeCopy?.status === 'copying' || saving) return;
		const source = result;
		const text = source.unplaced.join('\n');
		const token = ++copyRequest;
		const fresh = () => mounted && token === copyRequest && source === result;
		copyState = { source, text, status: 'copying' };
		try {
			if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
			await navigator.clipboard.writeText(text);
			if (fresh()) copyState = { source, text, status: 'copied' };
		} catch {
			if (!fresh()) return;
			copyState = { source, text, status: 'manual' };
			await tick();
			if (fresh()) {
				manualField?.focus();
				manualField?.select();
			}
		}
	}
</script>

<section
	id="conversion-review"
	class="conversion-review"
	data-testid="conversion-review"
	aria-labelledby="{uid}-title"
	aria-busy={saving || undefined}
	tabindex="-1"
>
	<header>
		<h2 id="{uid}-title">{t('convertAts.review.title')}</h2>
		<p class="hint">{t('convertAts.review.description')}</p>
	</header>
	<section aria-labelledby="{uid}-contacts">
		<h3 id="{uid}-contacts">{t('convertAts.review.contacts')}</h3>
		{#if contacts.length}
			<dl class="contact-list" data-testid="conversion-contacts">
				{#each contacts as contact (contact.key)}
					<div>
						<dt>{contact.label}</dt>
						<dd>{contact.value}</dd>
					</div>
				{/each}
			</dl>
		{:else}<p class="hint">{t('convertAts.review.noContacts')}</p>{/if}
	</section>
	<section aria-labelledby="{uid}-sections">
		<h3 id="{uid}-sections">{t('convertAts.review.sections')}</h3>
		<dl class="section-counts" data-testid="conversion-counts">
			{#each counts as section (section.key)}
				<div data-section={section.key}>
					<dt>{section.label}</dt>
					<dd>{t('editor.sections.count', { count: section.count })}</dd>
				</div>
			{/each}
		</dl>
	</section>
	{#if result.notes.length}
		<section aria-labelledby="{uid}-notes" data-testid="conversion-notes">
			<h3 id="{uid}-notes">{t('convertAts.review.notes')}</h3>
			<ul class="text-list">
				{#each result.notes as note, index (`${note.id}:${index}`)}
					<li>{t(note.messageKey, note.params)}</li>
				{/each}
			</ul>
		</section>
	{/if}
	{#if aiResult?.aiNotes.length}
		<section aria-labelledby="{uid}-ai-notes" data-testid="conversion-ai-notes">
			<h3 id="{uid}-ai-notes">{t('convertAts.review.aiNotes')}</h3>
			<ul class="ai-notes text-list">
				{#each aiResult.aiNotes as note, index (index)}
					<li>
						<strong><AiText text={note.title} /></strong>
						<p><AiText text={note.detail} /></p>
					</li>
				{/each}
			</ul>
		</section>
	{/if}
	{#if placeholderLines.length}
		<section
			class="placeholders"
			aria-labelledby="{uid}-placeholders"
			data-testid="conversion-placeholders"
		>
			<h3 id="{uid}-placeholders">{t('convertAts.review.placeholders')}</h3>
			<ul class="text-list">
				{#each placeholderLines as line (line)}<li><AiText text={line} /></li>{/each}
			</ul>
		</section>
	{/if}
	{#if aiResult?.suggestedSkills.length}
		<section aria-labelledby="{uid}-skills" data-testid="conversion-skills">
			<h3 id="{uid}-skills">{t('convertAts.review.suggestedSkills')}</h3>
			<p class="hint" id="{uid}-skills-hint">{t('convertAts.review.skillsHint')}</p>
			<ul class="skill-list">
				{#each aiResult.suggestedSkills as skill, index (`${skill}:${index}`)}
					<li class:selected={selectedSkills.includes(skill)}>
						<Checkbox
							label={skill}
							checked={selectedSkills.includes(skill)}
							disabled={saving}
							aria-describedby="{uid}-skills-hint"
							onchange={() => ontoggle(skill)}
						/>
					</li>
				{/each}
			</ul>
		</section>
	{/if}
	{#if result.unplaced.length}
		<section aria-labelledby="{uid}-unplaced" data-testid="conversion-unplaced">
			<h3 id="{uid}-unplaced">{t('convertAts.review.unplaced')}</h3>
			<ul class="text-list unplaced-list">
				{#each result.unplaced as line, index (index)}<li><AiText text={line} /></li>{/each}
			</ul>
			<Button
				variant="secondary"
				size="sm"
				loading={activeCopy?.status === 'copying'}
				disabled={saving}
				onclick={() => void copyUnplaced()}>{t('convertAts.review.copy')}</Button
			>
			<p class="hint" role="status">
				{activeCopy?.status === 'copied' ? t('convertAts.review.copied') : ''}
			</p>
			{#if activeCopy?.status === 'manual'}
				<div class="manual-copy" data-testid="conversion-copy-fallback">
					<label for="{uid}-manual-copy">{t('convertAts.review.manualCopy')}</label>
					<textarea
						id="{uid}-manual-copy"
						bind:this={manualField}
						readonly
						rows="5"
						autocomplete="off"
						value={activeCopy.text}></textarea>
				</div>
			{/if}
		</section>
	{/if}
	{#if incognitoActive}<p class="hint">{t('convertAts.review.incognito')}</p>{/if}
	{#if error}<p class="error" role="alert">{error}</p>{/if}
	<div class="actions">
		<Button onclick={onsave} loading={saving}>{saveLabel ?? t('convertAts.review.save')}</Button>
		<Button variant="secondary" onclick={oncancel} disabled={saving}
			>{t('convertAts.review.cancel')}</Button
		>
	</div>
</section>

<style>
	.conversion-review {
		display: grid;
		min-width: 0;
		gap: 24px;
		padding: 16px;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
		color: var(--color-text);
		overflow-wrap: anywhere;
	}
	header,
	section section {
		display: grid;
		min-width: 0;
		gap: 12px;
	}
	h2,
	h3,
	p,
	dl,
	dd {
		margin: 0;
	}
	h2 {
		font-size: 1.25rem;
		font-weight: 650;
	}
	h3 {
		font-size: 0.9375rem;
		font-weight: 650;
	}
	p,
	dd,
	li {
		line-height: 1.6;
	}
	.hint,
	dt {
		color: var(--color-text-muted);
		font-size: 0.8125rem;
		line-height: 1.6;
	}
	.contact-list,
	.section-counts {
		display: grid;
		min-width: 0;
		gap: 8px 24px;
	}
	.contact-list > div {
		min-width: 0;
	}
	.contact-list dd {
		font-size: 0.875rem;
	}
	.section-counts > div {
		display: flex;
		min-width: 0;
		align-items: baseline;
		justify-content: space-between;
		gap: 12px;
	}
	.section-counts dd {
		flex-shrink: 0;
		font-size: 0.8125rem;
	}
	.text-list {
		display: grid;
		gap: 8px;
		margin: 0;
		padding-left: 20px;
		font-size: 0.875rem;
	}
	.ai-notes strong {
		font-weight: 650;
	}
	.ai-notes p {
		margin-top: 4px;
	}
	.placeholders {
		padding: 12px;
		border-radius: var(--radius-md);
		background: var(--color-cream-50);
	}
	.skill-list {
		display: flex;
		min-width: 0;
		flex-wrap: wrap;
		gap: 8px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.skill-list li {
		min-width: 0;
		max-width: 100%;
		padding: 0 12px;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-cream-50);
	}
	.skill-list li.selected {
		background: var(--color-brand-50);
	}
	.skill-list :global(label) {
		gap: 8px;
	}
	.unplaced-list {
		max-height: 18rem;
		overflow-y: auto;
		white-space: pre-wrap;
	}
	.manual-copy {
		display: grid;
		gap: 8px;
		min-width: 0;
		font-size: 0.8125rem;
	}
	textarea {
		width: 100%;
		min-width: 0;
		padding: 12px;
		border: 1px solid var(--color-control-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		color: var(--color-text);
		font: inherit;
		line-height: 1.6;
		resize: vertical;
	}
	.error {
		color: var(--color-danger);
		font-size: 0.875rem;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.actions :global(.button) {
		flex: 1 1 12rem;
	}
	@media (min-width: 640px) {
		.conversion-review {
			padding: 24px;
		}
		.section-counts {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.actions :global(.button) {
			flex: 0 1 auto;
		}
	}
</style>
