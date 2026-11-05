<script lang="ts">
	import { onDestroy, onMount, tick, untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { LIMITS, type CVDocument } from '#lib/core/schema/index.ts';
	import { createCvStore } from '#lib/core/store/cv-store.svelte.ts';
	import { assetRepo, storage } from '#lib/core/storage/index.ts';
	import { toRenderModel } from '#lib/core/render/index.ts';
	import { loadGuidance, type Guidance } from '#lib/core/content/index.ts';
	import {
		WIZARD_STEPS,
		validateStep,
		validateAll,
		nextStepIndex,
		previousStepIndex,
		isStepOptional,
		type StepIssue,
		type WizardStepId
	} from '#lib/core/wizard/index.ts';
	import { i18n, t, type MessageKey } from '#lib/i18n/index.svelte.ts';
	import Button from '../Button.svelte';
	import Card from '../Card.svelte';
	import Input from '../Input.svelte';
	import Textarea from '../Textarea.svelte';
	import Select from '../Select.svelte';
	import Stepper from '../Stepper.svelte';
	import Dialog from '../Dialog.svelte';
	import BottomSheet from '../BottomSheet.svelte';
	import CvPreview from '../CvPreview.svelte';
	import PersonalStep from './PersonalStep.svelte';
	import CollectionSteps from './CollectionSteps.svelte';

	let { initial }: { initial: CVDocument } = $props();
	const store = untrack(() => createCvStore(initial));
	if (store.cv.status.wizardCompleted || store.cv.status.wizardStep === 0) {
		store.update(
			(draft) => {
				draft.status.wizardStep = draft.status.wizardCompleted ? 10 : 1;
			},
			{ skipHistory: true }
		);
	}
	onDestroy(() => {
		void store.destroy();
	});
	const index = $derived(store.cv.status.wizardStep);
	const step = $derived(WIZARD_STEPS[index]?.id ?? 'target');
	const labels = $derived(WIZARD_STEPS.slice(1).map(({ id }) => t(`wizard.steps.${id}.title`)));
	const shortLabels = $derived(
		WIZARD_STEPS.slice(1).map(({ id }) => t(`wizard.steps.${id}.short`))
	);
	let attempted = $state(false);
	const issues = $derived(attempted ? validateStep(step, store.cv) : []);
	const reviewIssues = $derived(validateAll(store.cv));
	let guidance = $state.raw<Guidance>();
	let examples = $state.raw<Guidance>();
	let guidanceError = $state(false);
	let exampleError = $state(false);
	let guidanceAttempt = $state(0);
	let previewOpen = $state(false);
	let desktop = $state(false);
	let memory = $state(false);
	let loadedAt = $state(untrack(() => initial.updatedAt));
	const savedAt = $derived(
		store.lastSavedAt && store.lastSavedAt > loadedAt ? store.lastSavedAt : loadedAt
	);
	const pendingSave = $derived(store.cv.updatedAt !== savedAt);
	let photoUrl = $state<string>();
	let photoLoadError = $state(false);
	let photoMissing = $state(false);
	let replaceOpen = $state(false);
	let pendingSummary = $state('');
	let requestedPersistence = untrack(() => initial.status.wizardCompleted);
	let heading: HTMLHeadingElement | undefined = $state();
	const model = $derived(toRenderModel(store.cv, { photoUrl }));
	const collectionSteps: WizardStepId[] = [
		'education',
		'experience',
		'organizations',
		'projects',
		'skills'
	];

	onMount(() => {
		const media = matchMedia('(min-width: 1024px)');
		const update = () => {
			desktop = media.matches;
			if (desktop) previewOpen = false;
		};
		update();
		media.addEventListener('change', update);
		void storage.getMode().then((mode) => {
			memory = mode === 'memory';
		});
		return () => media.removeEventListener('change', update);
	});
	$effect(() => {
		const locale = i18n.locale;
		void guidanceAttempt;
		let current = true;
		guidanceError = false;
		guidance = undefined;
		void loadGuidance(locale).then(
			(loaded) => {
				if (current) guidance = loaded;
			},
			() => {
				if (current) guidanceError = true;
			}
		);
		return () => {
			current = false;
		};
	});
	$effect(() => {
		const locale = store.cv.locale;
		void guidanceAttempt;
		let current = true;
		exampleError = false;
		examples = undefined;
		void loadGuidance(locale).then(
			(loaded) => {
				if (current) examples = loaded;
			},
			() => {
				if (current) exampleError = true;
			}
		);
		return () => {
			current = false;
		};
	});
	$effect(() => {
		const id = store.cv.personal.photoAssetId;
		let current = true;
		let url: string | null = null;
		photoUrl = undefined;
		photoLoadError = false;
		photoMissing = false;
		if (id)
			void assetRepo.getPhotoUrl(id).then(
				(loaded) => {
					if (!current) {
						if (loaded) URL.revokeObjectURL(loaded);
						return;
					}
					url = loaded;
					photoUrl = loaded ?? undefined;
					photoMissing = loaded === null;
				},
				() => {
					if (current) photoLoadError = true;
				}
			);
		return () => {
			current = false;
			if (url) URL.revokeObjectURL(url);
		};
	});
	$effect(() => {
		if (step !== 'done') return;
		if (!store.cv.status.wizardCompleted)
			store.update(
				(draft) => {
					draft.status.wizardCompleted = true;
				},
				{ skipHistory: true }
			);
		if (!requestedPersistence) {
			requestedPersistence = true;
			void storage.requestPersistence();
		}
	});

	async function focusHeading() {
		await tick();
		heading?.focus({ preventScroll: true });
		window.scrollTo({ top: 0, behavior: 'instant' });
	}
	async function move(next: number) {
		if (store.externalChange === 'removed') return;
		attempted = false;
		store.update(
			(draft) => {
				draft.status.wizardStep = next;
				if (next < 10) draft.status.wizardCompleted = false;
			},
			{ skipHistory: true }
		);
		await focusHeading();
	}
	async function focusIssue(issue: StepIssue) {
		await tick();
		const control =
			document.getElementById(issue.field) ?? document.getElementById(`${issue.field}-month`);
		control?.focus();
		control?.scrollIntoView({ block: 'center' });
	}
	async function back() {
		if (store.externalChange === 'removed') {
			await goto(resolve('/(app)/buat'));
			return;
		}
		if (index === 1) {
			await store.flush();
			await goto(resolve('/(app)/buat'));
		} else await move(previousStepIndex(index));
	}
	async function next(event: SubmitEvent) {
		event.preventDefault();
		if (store.externalChange === 'removed') return;
		attempted = true;
		const found = step === 'review' ? validateAll(store.cv) : validateStep(step, store.cv);
		if (found[0]) {
			if (step === 'review') await jumpToIssue(found[0]);
			else await focusIssue(found[0]);
			return;
		}
		await move(nextStepIndex(index));
	}
	function issueStep(issue: StepIssue): WizardStepId {
		const section = issue.field.split('.')[0];
		if (section === 'personal') return 'personal';
		if (section === 'languages' || section === 'certifications' || section === 'awards')
			return 'skills';
		return WIZARD_STEPS.find(({ id }) => id === section)?.id ?? 'target';
	}
	async function jumpToIssue(issue: StepIssue) {
		await move(WIZARD_STEPS.findIndex(({ id }) => id === issueStep(issue)));
		attempted = true;
		await focusIssue(issue);
	}
	function issueText(issue: StepIssue) {
		const field = issue.field.split('.').at(-1) ?? '';
		const fieldLabels: Record<string, MessageKey> = {
			fullName: 'wizard.fields.fullName',
			email: 'wizard.fields.email',
			phone: 'wizard.fields.phone',
			institution: 'wizard.fields.institution',
			dates: 'wizard.fields.end',
			role: 'wizard.fields.role',
			name: 'wizard.fields.name'
		};
		return t('wizard.issueContext', {
			section: t(`wizard.steps.${issueStep(issue)}.title`),
			field: fieldLabels[field]
				? t(fieldLabels[field])
				: t(`wizard.steps.${issueStep(issue)}.title`),
			message: t(issue.messageKey)
		});
	}
	function shortcut(event: KeyboardEvent) {
		const target = event.target;
		if (
			target instanceof Element &&
			target.closest('input, textarea, select, [contenteditable="true"]')
		)
			return;
		if (store.externalChange === 'removed' || document.querySelector('dialog[open]')) return;
		if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'z') {
			event.preventDefault();
			if (event.shiftKey) store.redo();
			else store.undo();
		}
	}
	function useSummary(text: string) {
		pendingSummary = text;
		if (store.cv.summary.trim()) replaceOpen = true;
		else applySummary();
	}
	function applySummary() {
		store.update(
			(draft) => {
				draft.summary = pendingSummary;
			},
			{ coalesceKey: 'summary' }
		);
		replaceOpen = false;
	}
	async function reload() {
		if (await store.reloadFromRepo()) {
			loadedAt = store.cv.updatedAt;
			attempted = false;
			await focusHeading();
		}
	}
</script>

<svelte:window onkeydown={shortcut} />

<div class="wizard">
	<div class="progress-panel">
		<Stepper steps={labels} shortSteps={shortLabels} current={index - 1} />
	</div>
	{#if memory}<p class="banner warning" role="status">{t('wizard.memoryWarning')}</p>{/if}
	{#if store.externalChange !== 'none'}
		<div class="banner warning" role="alert">
			<p>
				{t(
					store.externalChange === 'removed' ? 'wizard.externalRemoved' : 'wizard.externalUpdated'
				)}
			</p>
			<div class="button-row">
				{#if store.externalChange === 'removed'}<Button href="/buat">{t('wizard.startNew')}</Button>
				{:else}<Button variant="secondary" onclick={reload}>{t('wizard.reload')}</Button><Button
						variant="ghost"
						onclick={() => store.keepLocalVersion()}>{t('wizard.keepLocal')}</Button
					>{/if}
			</div>
		</div>
	{/if}
	<div class="toolbar">
		<div
			class="save-status"
			role="status"
			aria-live="polite"
			data-testid="save-status"
			data-save-state={store.saveState === 'error'
				? 'error'
				: store.saveState === 'saving' || pendingSave
					? 'saving'
					: 'saved'}
		>
			{#if store.saveState === 'error'}<span class="error">{t('wizard.saveError')}</span><Button
					variant="ghost"
					onclick={() => store.flush()}>{t('wizard.retry')}</Button
				>
			{:else if store.saveState === 'saving' || pendingSave}{t('wizard.saving')}
			{:else}{t(memory ? 'wizard.savedMemory' : 'wizard.saved')}{/if}
		</div>
		<div class="history">
			<Button
				variant="secondary"
				size="sm"
				disabled={!store.canUndo || store.externalChange === 'removed'}
				onclick={() => store.undo()}>{t('wizard.undo')}</Button
			>
			<Button
				variant="secondary"
				size="sm"
				disabled={!store.canRedo || store.externalChange === 'removed'}
				onclick={() => store.redo()}>{t('wizard.redo')}</Button
			>
		</div>
	</div>
	<div class="workspace" class:full={step === 'review' || step === 'done'}>
		<form novalidate onsubmit={next}>
			<Card>
				<header class="step-heading">
					<p class="step-count">
						{t('ui.stepProgress', { current: index, total: 10 })}{#if isStepOptional(index)}
							· {t('wizard.optional')}{/if}
					</p>
					<h1 bind:this={heading} tabindex="-1">{t(`wizard.steps.${step}.title`)}</h1>
					<p>{t(`wizard.steps.${step}.description`)}</p>
				</header>
				{#if guidanceError || exampleError}<p class="banner warning">
						{t('wizard.loadError')}
						<Button variant="ghost" onclick={() => guidanceAttempt++}>{t('wizard.retry')}</Button>
					</p>{/if}
				{#if guidance?.stepTips[step].length}
					<details class="tips" open={step === 'done'}>
						<summary>{t('wizard.tips')}</summary>
						<ul>
							{#each guidance.stepTips[step] as tip (tip)}<li>{tip}</li>{/each}
						</ul>
					</details>
				{/if}
				<fieldset class="step-fields" disabled={store.externalChange === 'removed'}>
					{#if step === 'target'}
						<Select
							id="locale"
							label={t('wizard.fields.locale')}
							options={[
								{ value: 'id', label: t('locale.id') },
								{ value: 'en', label: t('locale.en') }
							]}
							bind:value={
								() => store.cv.locale,
								(value) =>
									store.update(
										(draft) => {
											draft.locale = value === 'en' ? 'en' : 'id';
										},
										{ coalesceKey: 'locale' }
									)
							}
						/>
						<Input
							id="targetRole"
							label={t('wizard.fields.targetRole')}
							maxlength={LIMITS.title}
							showCounter
							bind:value={
								() => store.cv.targetRole ?? '',
								(value) =>
									store.update(
										(draft) => {
											draft.targetRole = value;
										},
										{ coalesceKey: 'targetRole' }
									)
							}
						/>
						<Input
							id="title"
							label={t('wizard.fields.title')}
							maxlength={LIMITS.cvTitle}
							showCounter
							bind:value={
								() => store.cv.title,
								(value) =>
									store.update(
										(draft) => {
											draft.title = value;
										},
										{ coalesceKey: 'title' }
									)
							}
						/>
					{:else if step === 'personal'}
						{#if photoMissing}<p role="alert" class="error">{t('wizard.photoMissing')}</p>{/if}
						{#if photoLoadError}<p role="alert" class="error">{t('wizard.photoFailed')}</p>{/if}
						<PersonalStep {store} {issues} {guidance} {photoUrl} />
					{:else if collectionSteps.includes(step)}
						<CollectionSteps {store} {step} {issues} {guidance} {examples} />
					{:else if step === 'summary'}
						<Textarea
							id="summary"
							label={t('wizard.fields.summary')}
							maxlength={LIMITS.summary}
							hint={guidance?.fieldTips.summary}
							bind:value={
								() => store.cv.summary,
								(value) =>
									store.update(
										(draft) => {
											draft.summary = value;
										},
										{ coalesceKey: 'summary' }
									)
							}
						/>
						{#if examples}
							<details class="tips">
								<summary>{t('wizard.actionVerbs')}</summary>
								<p>{examples.actionVerbs.join(', ')}</p>
							</details>
							<details class="tips">
								<summary>{t('wizard.examples')}</summary>
								<div class="examples">
									{#each examples.summaryExamples as example (example.field)}<article>
											<h2>{example.label}</h2>
											<p>{example.text}</p>
											<Button variant="secondary" onclick={() => useSummary(example.text)}
												>{t('wizard.useSummary')}</Button
											>
										</article>{/each}
								</div>
							</details>
						{/if}
					{:else if step === 'review'}
						{#if reviewIssues.length}
							<div class="review-issues" role="status">
								<h2>{t('wizard.reviewIssues')}</h2>
								<p>{t('wizard.reviewInstruction')}</p>
								<ul>
									{#each reviewIssues as issue (`${issue.field}-${issue.messageKey}`)}<li>
											<button type="button" onclick={() => jumpToIssue(issue)}
												>{issueText(issue)}</button
											>
										</li>{/each}
								</ul>
							</div>
						{:else}<p class="ready" role="status">{t('wizard.reviewReady')}</p>{/if}
						<p class="hint">{t('wizard.previewNotice')}</p>
						<CvPreview {model} />
					{:else if step === 'done'}
						<p class="ready">{t('wizard.doneAvailability')}</p>
						<Button variant="secondary" onclick={() => move(9)}>{t('wizard.editAgain')}</Button>
						<p class="hint">{t('wizard.previewNotice')}</p>
						<CvPreview {model} />
					{/if}
				</fieldset>
			</Card>
			{#if step !== 'done'}
				<div class="bottom-actions">
					<Button variant="secondary" onclick={back}>{t('wizard.back')}</Button>
					{#if isStepOptional(index)}<Button
							variant="ghost"
							disabled={store.externalChange === 'removed'}
							onclick={() => move(nextStepIndex(index))}>{t('wizard.skip')}</Button
						>{/if}
					<Button type="submit" disabled={store.externalChange === 'removed'}
						>{t(step === 'review' ? 'wizard.finish' : 'wizard.next')}</Button
					>
					{#if !desktop}<Button
							variant="ghost"
							class="preview-action"
							onclick={() => (previewOpen = true)}>{t('preview.open')}</Button
						>{/if}
				</div>
			{/if}
		</form>
		{#if desktop && step !== 'review' && step !== 'done'}
			<aside class="preview-panel" aria-label={t('preview.label')}>
				<div class="preview-heading">
					<h2>{t('preview.label')}</h2>
					<p>{t('wizard.previewNotice')}</p>
				</div>
				<CvPreview {model} />
			</aside>
		{/if}
	</div>
</div>

<BottomSheet
	bind:open={previewOpen}
	title={t('preview.label')}
	description={t('wizard.previewNotice')}
>
	{#if previewOpen}<CvPreview {model} />{/if}
</BottomSheet>
<Dialog
	bind:open={replaceOpen}
	title={t('wizard.replaceTitle')}
	description={t('wizard.replaceDescription')}
>
	{#snippet footer()}<Button variant="secondary" onclick={() => (replaceOpen = false)}
			>{t('common.cancel')}</Button
		><Button onclick={applySummary}>{t('wizard.replace')}</Button>{/snippet}
</Dialog>

<style>
	.wizard {
		width: min(1200px, calc(100% - 32px));
		margin: 0 auto;
		padding: 1.5rem 0 2rem;
	}
	.progress-panel {
		padding: 1rem;
		margin-bottom: 1rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
		box-shadow: var(--shadow-card);
	}
	.toolbar,
	.history {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
	}
	.toolbar {
		justify-content: space-between;
		margin-bottom: 1rem;
	}
	.save-status {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
		color: var(--color-text-muted);
		font-size: 0.75rem;
		min-height: 36px;
		padding: 6px 12px;
		border-radius: var(--radius-pill);
		background: var(--color-surface);
	}
	.save-status[data-save-state='saved'] {
		background: var(--color-mint-50);
		color: var(--color-success);
	}
	.save-status[data-save-state='error'] {
		background: var(--color-coral-50);
	}
	.workspace,
	form,
	.step-fields {
		min-width: 0;
	}
	.step-heading {
		margin-bottom: 1.5rem;
	}
	.step-count {
		color: var(--color-text-muted);
		font-size: 0.875rem;
	}
	h1 {
		margin: 0.75rem 0;
		font-size: clamp(1.6rem, 3vw, 2rem);
		font-weight: 650;
	}
	.step-heading > p:last-child,
	.hint {
		color: var(--color-text-muted);
		font-size: 0.875rem;
	}
	.step-fields {
		display: grid;
		gap: 1.5rem;
		margin: 1.5rem 0 0;
		padding: 0;
		border: 0;
	}
	.step-fields :global(input),
	.step-fields :global(textarea),
	.step-fields :global(select),
	.step-fields :global(button) {
		scroll-margin-block: 9rem;
	}
	.tips {
		min-width: 0;
		margin-top: 1rem;
		padding: 0.75rem 1rem;
		border-radius: var(--radius-md);
		background: var(--color-mint-50);
		border: 1px solid var(--color-mint);
		color: var(--color-ink);
		font-size: 0.875rem;
	}
	summary {
		min-height: 44px;
		display: list-item;
		align-content: center;
		font-weight: 650;
	}
	.tips ul {
		padding-left: 1.25rem;
	}
	.tips p {
		margin: 0.75rem 0;
	}
	.examples {
		display: grid;
		gap: 1.5rem;
		padding-top: 1rem;
	}
	.examples h2,
	.review-issues h2,
	.preview-heading h2 {
		font-size: 1rem;
	}
	.examples article {
		padding-bottom: 1rem;
		border-bottom: 1px solid var(--color-border);
	}
	.banner {
		margin: 1rem 0;
		padding: 1rem;
		border-radius: var(--radius-md);
		font-size: 0.875rem;
	}
	.banner .button-row {
		margin-top: 0.75rem;
	}
	.warning {
		background: var(--color-warning-surface);
		color: var(--color-warning);
		border: 1px solid var(--color-border);
	}
	.error {
		color: var(--color-danger);
	}
	.ready {
		border: 1px solid var(--color-mint);
		background: var(--color-success-surface);
		color: var(--color-success);
		padding: 1rem;
		border-radius: var(--radius-md);
	}
	.review-issues {
		padding: 1rem;
		border: 1px solid var(--color-border);
		background: var(--color-coral-50);
		border-radius: var(--radius-lg);
		color: var(--color-danger);
	}
	.review-issues ul {
		padding-left: 1rem;
	}
	.review-issues button {
		min-height: 44px;
		padding: 0.5rem 0;
		background: transparent;
		border: 0;
		text-align: left;
		text-decoration: underline;
		color: inherit;
	}
	.bottom-actions {
		position: sticky;
		z-index: 5;
		bottom: 0;
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.5rem;
		padding: 0.75rem 0 max(0.75rem, env(safe-area-inset-bottom));
		margin-top: 1rem;
		background: var(--color-canvas);
		border-top: 1px solid var(--color-border);
	}
	.bottom-actions :global(.button) {
		padding-inline: 0.5rem;
	}
	.bottom-actions :global(.preview-action) {
		grid-column: 1 / -1;
	}
	.bottom-actions :global(button[type='submit']) {
		grid-column: 3;
	}
	.preview-panel {
		position: sticky;
		top: 1rem;
		align-self: start;
		min-width: 0;
		padding: 1rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
		box-shadow: var(--shadow-card);
		max-height: calc(100dvh - 2rem);
		overflow-y: auto;
	}
	.preview-heading {
		margin-bottom: 1rem;
	}
	.preview-heading p {
		margin-top: 0.5rem;
		color: var(--color-text-muted);
		font-size: 0.75rem;
	}
	@media (min-width: 1024px) {
		.wizard {
			width: min(1200px, calc(100% - 64px));
		}
		.workspace {
			display: grid;
			grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
			gap: 1.5rem;
			align-items: start;
		}
		.workspace.full {
			display: block;
			max-width: 900px;
			margin-inline: auto;
		}
		.bottom-actions {
			position: static;
		}
	}
</style>
