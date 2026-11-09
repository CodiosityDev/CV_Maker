<script lang="ts">
	import { onDestroy, onMount, tick, untrack } from 'svelte';
	import { goto, replaceState } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import {
		analyzeCv,
		createAtsAnalyzer,
		type AtsAnalyzer,
		type AtsReport,
		type KeywordReport,
		type CheckTarget
	} from '#lib/core/ats/index.ts';
	import { LIMITS, newId, type CVDocument } from '#lib/core/schema/index.ts';
	import { createCvStore } from '#lib/core/store/cv-store.svelte.ts';
	import { assetRepo, incognito, storage } from '#lib/core/storage/index.ts';
	import { getIncognitoUiContext } from '#lib/ui/incognito-context.ts';
	import { toRenderModel } from '#lib/core/render/index.ts';
	import { loadGuidance, type Guidance } from '#lib/core/content/index.ts';
	import {
		loadSuggestions,
		suggest,
		categoryOf,
		normalize,
		type SuggestionData
	} from '#lib/core/suggest/index.ts';
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
	import Autocomplete from '../Autocomplete.svelte';
	import Textarea from '../Textarea.svelte';
	import Select from '../Select.svelte';
	import Stepper from '../Stepper.svelte';
	import Dialog from '../Dialog.svelte';
	import BottomSheet from '../BottomSheet.svelte';
	import CvPreview from '../CvPreview.svelte';
	import TemplatePicker from '../TemplatePicker.svelte';
	import ExportPanel from '../ExportPanel.svelte';
	import AtsPanel from '../AtsPanel.svelte';
	import { toast } from '../toast.svelte.ts';
	import PersonalStep from './PersonalStep.svelte';
	import CollectionSteps from './CollectionSteps.svelte';

	let { initial }: { initial: CVDocument } = $props();
	const store = untrack(() => createCvStore(initial));
	const incognitoUi = getIncognitoUiContext();
	const requestedAtsReview = untrack(() => page.url.searchParams.get('step') === 'review');
	if (requestedAtsReview || store.cv.status.wizardCompleted || store.cv.status.wizardStep === 0) {
		store.update(
			(draft) => {
				draft.status.wizardStep = requestedAtsReview ? 9 : draft.status.wizardCompleted ? 10 : 1;
			},
			{ skipHistory: true }
		);
	}
	let mounted = true;
	onDestroy(() => {
		mounted = false;
		atsAnalyzer?.dispose();
		clearAtsUndo();
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
	let suggestionsData = $state.raw<SuggestionData>();
	const summaryExamples = $derived.by(() => {
		const available = examples?.summaryExamples ?? [];
		if (!suggestionsData) return available;
		const category = categoryOf(suggestionsData, store.cv.targetRole);
		const field =
			category === 'finance' ? 'accounting' : category === 'customer' ? 'sales' : category;
		const preferred = available.some((example) => example.field === field)
			? field
			: category === 'data'
				? 'it'
				: 'general';
		return [
			...available.filter((example) => example.field === preferred),
			...available.filter((example) => example.field !== preferred)
		];
	});
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
	const sessionExpired = $derived(incognito.active && Boolean(incognito.expiredAt));
	let atsAnalyzer: AtsAnalyzer | undefined;
	let atsReady = $state(false);
	let atsReport = $state.raw<AtsReport>();
	let atsKeywords = $state.raw<KeywordReport>();
	let atsLoading = $state(false);
	let atsFailed = $state(false);
	let atsRetry = $state(0);
	let jobPost = $state('');
	let analysisRequest = 0;
	let atsUndo = $state.raw<{ id: number; revision: string; signature: string }>();
	const doneAtsScore = $derived(
		step === 'done' && !sessionExpired ? analyzeCv($state.snapshot(store.cv)).score : undefined
	);
	const removed = $derived(store.externalChange === 'removed');
	let removalNotice = $state<HTMLDivElement>();
	const collectionSteps: WizardStepId[] = [
		'education',
		'experience',
		'organizations',
		'projects',
		'skills'
	];
	$effect(() => {
		if (!removed) return;
		previewOpen = false;
		replaceOpen = false;
		pendingSummary = '';
		jobPost = '';
		atsReport = undefined;
		atsKeywords = undefined;
		void tick().then(() => {
			if (mounted && removed) removalNotice?.focus({ preventScroll: true });
		});
	});

	onMount(() => {
		atsAnalyzer = createAtsAnalyzer();
		atsReady = true;
		if (requestedAtsReview) {
			void focusAtsPanel();
		}
		const unregisterBeforeStart = incognitoUi?.registerBeforeStart(async () => {
			await store.flush();
			return store.saveState !== 'error';
		});
		const unregisterBeforeEnd = incognitoUi?.registerBeforeEnd(() => {
			store.applyExternalChange({ type: 'wiped' });
		});
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
		return () => {
			unregisterBeforeStart?.();
			unregisterBeforeEnd?.();
			media.removeEventListener('change', update);
		};
	});
	$effect(() => {
		const request = ++analysisRequest;
		const ready = atsReady;
		const currentStep = step;
		const removed = store.externalChange === 'removed';
		const text = jobPost;
		void atsRetry;
		if (!ready || currentStep !== 'review' || removed) {
			atsLoading = false;
			return;
		}
		const cv = $state.snapshot(store.cv);
		atsLoading = true;
		atsFailed = false;
		atsKeywords = undefined;
		const timer = setTimeout(() => {
			void atsAnalyzer?.analyze(cv, text.trim() ? text : undefined).then(
				(result) => {
					if (!mounted || request !== analysisRequest) return;
					atsReport = result.report;
					atsKeywords = result.keywords;
					atsLoading = false;
				},
				() => {
					if (!mounted || request !== analysisRequest) return;
					atsReport = undefined;
					atsKeywords = undefined;
					atsLoading = false;
					atsFailed = true;
				}
			);
		}, 400);
		return () => {
			clearTimeout(timer);
			if (analysisRequest === request) analysisRequest += 1;
		};
	});
	$effect(() => {
		const notice = atsUndo;
		const revision = store.cv.updatedAt;
		const removed = store.externalChange === 'removed';
		if (
			notice &&
			(removed ||
				(revision !== notice.revision && untrack(atsContentSignature) !== notice.signature))
		)
			clearAtsUndo();
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
		const locale = store.cv.locale;
		let current = true;
		suggestionsData = undefined;
		void loadSuggestions(locale).then(
			(loaded) => {
				if (current) suggestionsData = loaded;
			},
			() => {
				if (current) suggestionsData = undefined;
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
		if (id && !removed && !sessionExpired)
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
		if (step !== 'done' || removed) return;
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
		if (next !== 9 && page.url.searchParams.get('step') === 'review') {
			replaceState(resolve('/(app)/buat/[id]', { id: store.cv.id }), page.state);
		}
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
	async function focusIssue(issue: { field?: string }) {
		await tick();
		if (!issue.field) {
			await focusHeading();
			return;
		}
		const control =
			document.getElementById(issue.field) ??
			document.getElementById(`${issue.field}-month`) ??
			document.getElementById(`${issue.field}.0`) ??
			document.getElementById(`${issue.field}-add`);
		if (!control) {
			await focusHeading();
			return;
		}
		let disclosure = control?.closest('details');
		while (disclosure) {
			disclosure.open = true;
			disclosure = disclosure.parentElement?.closest('details') ?? null;
		}
		await tick();
		control.focus();
		control.scrollIntoView({ block: 'center' });
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
	async function flushBeforeLeave(): Promise<boolean> {
		if (store.externalChange === 'removed') return false;
		await store.flush();
		if (store.saveState === 'error') {
			toast.error(t('wizard.saveError'));
			return false;
		}
		return true;
	}
	async function openDashboard(event: MouseEvent) {
		if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0)
			return;
		event.preventDefault();
		if ((await flushBeforeLeave()) && mounted && step === 'done') await goto(resolve('/(app)/cv'));
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
	function atsField(target: CheckTarget): string | undefined {
		if (target.step === 'personal' && target.field)
			return target.field === 'links' && target.itemId
				? `personal.links.${target.itemId}.url`
				: `personal.${target.field}`;
		if (target.section && target.itemId && target.field)
			return `${target.section}.${target.itemId}.${target.field}`;
		if (target.section === 'summary') return 'summary';
		if (target.section === 'skills') return 'skills.hard';
		return target.field;
	}
	async function jumpToIssue(issue: StepIssue | CheckTarget) {
		const targetStep = 'step' in issue ? issue.step : issueStep(issue);
		const field = 'step' in issue ? atsField(issue) : issue.field;
		await move(WIZARD_STEPS.findIndex(({ id }) => id === targetStep));
		attempted = true;
		await focusIssue({ field });
	}
	async function focusAtsPanel() {
		await tick();
		const panel = document.getElementById('ats-panel');
		panel?.focus({ preventScroll: true });
		panel?.scrollIntoView({ block: 'start' });
	}
	async function checkAtsAgain(event: MouseEvent) {
		event.preventDefault();
		await move(9);
		await focusAtsPanel();
	}
	function atsContentSignature() {
		const content = $state.snapshot(store.cv);
		return JSON.stringify({ ...content, status: undefined, updatedAt: undefined });
	}
	function clearAtsUndo() {
		if (atsUndo) toast.dismiss(atsUndo.id);
		atsUndo = undefined;
	}
	function canAddAtsKeyword(term: string) {
		return (
			store.externalChange !== 'removed' &&
			store.cv.skills.hard.length < LIMITS.skillsPerGroup &&
			![store.cv.skills.hard, store.cv.skills.soft, store.cv.skills.tools].some((group) =>
				group.some((skill) => normalize(skill) === normalize(term))
			)
		);
	}
	async function focusAtsJob() {
		await tick();
		const input = document.querySelector<HTMLTextAreaElement>('#ats-panel textarea');
		if (input) input.focus({ preventScroll: true });
		else heading?.focus({ preventScroll: true });
	}
	async function addAtsKeyword(term: string) {
		if (
			!canAddAtsKeyword(term) ||
			!atsKeywords?.keywords.some(
				(keyword) => keyword.term === term && keyword.known && !keyword.inCv
			)
		)
			return;
		clearAtsUndo();
		store.update(
			(draft) => {
				draft.skills.hard.push(term);
			},
			{ coalesceKey: `ats.skill.${newId()}` }
		);
		const signature = atsContentSignature();
		const id = toast.info(t('atsPanel.added', { term }), {
			labelKey: 'wizard.undo',
			run: () => {
				if (store.externalChange !== 'removed' && atsContentSignature() === signature) store.undo();
				clearAtsUndo();
				void focusAtsJob();
			}
		});
		atsUndo = { id, revision: store.cv.updatedAt, signature };
		await focusAtsJob();
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
			{ coalesceKey: `summary.example.${newId()}` }
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
	{#if removed}
		<Card>
			<div
				class="removed-notice"
				role="alert"
				tabindex="-1"
				bind:this={removalNotice}
				data-testid="removed-cv"
			>
				<p>{t(sessionExpired ? 'incognito.expiredMessage' : 'wizard.externalRemoved')}</p>
				<div class="button-row">
					<Button href="/buat">{t('wizard.startNew')}</Button>
					<Button href="/cv" variant="secondary">{t('nav.myCvs')}</Button>
				</div>
			</div>
		</Card>
	{:else}
		<div class="progress-panel">
			<Stepper steps={labels} shortSteps={shortLabels} current={index - 1} />
		</div>
		{#if memory}<p class="banner warning" role="status">{t('wizard.memoryWarning')}</p>{/if}
		{#if store.externalChange !== 'none'}
			<div class="banner warning" role="alert">
				<p>
					{t(
						store.externalChange === 'removed'
							? incognito.active && incognito.expiredAt
								? 'incognito.expiredMessage'
								: 'wizard.externalRemoved'
							: 'wizard.externalUpdated'
					)}
				</p>
				<div class="button-row">
					{#if store.externalChange === 'removed'}<Button href="/buat"
							>{t('wizard.startNew')}</Button
						>
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
				{#if store.externalChange === 'removed' && incognito.active && incognito.expiredAt}
					{t('incognito.expiredStatus')}
				{:else if store.saveState === 'error'}<span class="error">{t('wizard.saveError')}</span
					><Button variant="ghost" onclick={() => store.flush()}>{t('wizard.retry')}</Button>
				{:else if store.saveState === 'saving' || pendingSave}{t('wizard.saving')}
				{:else}{t(
						incognito.active ? 'incognito.saved' : memory ? 'wizard.savedMemory' : 'wizard.saved'
					)}{/if}
			</div>
			<div class="history">
				<Button
					variant="secondary"
					size="sm"
					class="history-action"
					title={t('wizard.undo')}
					aria-label={t('wizard.undo')}
					disabled={!store.canUndo || store.externalChange === 'removed'}
					onclick={() => store.undo()}><span aria-hidden="true">↶</span></Button
				>
				<Button
					variant="secondary"
					size="sm"
					class="history-action"
					title={t('wizard.redo')}
					aria-label={t('wizard.redo')}
					disabled={!store.canRedo || store.externalChange === 'removed'}
					onclick={() => store.redo()}><span aria-hidden="true">↷</span></Button
				>
			</div>
		</div>
		<div class="workspace" class:full={step === 'review' || step === 'done'}>
			<form novalidate autocomplete={incognito.active ? 'off' : undefined} onsubmit={next}>
				<Card>
					<header class="step-heading">
						{#if isStepOptional(index)}<span class="optional-chip">{t('wizard.optional')}</span
							>{/if}
						<h1 bind:this={heading} tabindex="-1">{t(`wizard.steps.${step}.title`)}</h1>
						<p>{t(`wizard.steps.${step}.description`)}</p>
					</header>
					{#if guidanceError || exampleError}<p class="banner warning">
							{t('wizard.loadError')}
							<Button variant="ghost" onclick={() => guidanceAttempt++}>{t('wizard.retry')}</Button>
						</p>{/if}
					{#if step !== 'done' && guidance?.stepTips[step].length}
						<details class="tips">
							<summary>{t('wizard.tips')}</summary>
							<ul>
								{#each guidance.stepTips[step].slice(0, 3) as tip (tip)}<li>{tip}</li>{/each}
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
							<Autocomplete
								id="targetRole"
								label={t('wizard.fields.targetRole')}
								popularWhenEmpty
								suggestions={(query) =>
									suggestionsData
										? suggest(suggestionsData, 'jobTitle', query, { popularWhenEmpty: true })
										: []}
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
							<PersonalStep {store} {issues} {photoUrl} {suggestionsData} />
						{:else if collectionSteps.includes(step)}
							<CollectionSteps
								{store}
								{step}
								{issues}
								{examples}
								{suggestionsData}
								onTarget={() => move(1)}
							/>
						{:else if step === 'summary'}
							<Textarea
								id="summary"
								label={t('wizard.fields.summary')}
								hideLabel
								maxlength={LIMITS.summary}
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
								<details class="tips summary-examples">
									<summary>{t('wizard.examples')}</summary>
									<div class="examples">
										{#each summaryExamples.slice(0, 1) as example (example.field)}<article>
												<h2>{example.label}</h2>
												<p>{example.text}</p>
												<Button variant="secondary" onclick={() => useSummary(example.text)}
													>{t('wizard.useSummary')}</Button
												>
											</article>{/each}
									</div>
									{#if summaryExamples.length > 1}
										<details class="other-examples">
											<summary>{t('wizard.otherExamples')}</summary>
											<div class="examples">
												{#each summaryExamples.slice(1) as example (example.field)}<article>
														<h2>{example.label}</h2>
														<p>{example.text}</p>
														<Button variant="secondary" onclick={() => useSummary(example.text)}
															>{t('wizard.useSummary')}</Button
														>
													</article>{/each}
											</div>
										</details>
									{/if}
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
							{#if !sessionExpired}
								<AtsPanel
									report={atsReport}
									keywords={atsKeywords}
									loading={atsLoading}
									failed={atsFailed}
									bind:jobPost
									onjump={jumpToIssue}
									onadd={addAtsKeyword}
									canAdd={canAddAtsKeyword}
									onretry={() => (atsRetry += 1)}
								/>
								<TemplatePicker {store} {model} />
								<p class="hint">{t('wizard.previewNotice')}</p>
								<CvPreview {model} />
							{/if}
						{:else if step === 'done'}
							{#if doneAtsScore !== undefined}<p
									class="ats-done-summary"
									data-testid="ats-done-summary"
								>
									{t('atsPanel.doneScore', { score: doneAtsScore })} ·
									<a href="#ats-panel" onclick={checkAtsAgain}>{t('atsPanel.checkAgain')}</a>
								</p>{/if}
							{#if !sessionExpired}<ExportPanel cv={store.cv} beforeLeave={flushBeforeLeave} />{/if}
							<div class="done-actions">
								<Button href="/cv" variant="secondary" onclick={openDashboard}
									>{t('wizard.goDashboard')}</Button
								>
								<Button variant="ghost" onclick={() => move(9)}>{t('wizard.editAgain')}</Button>
							</div>
							{#if !sessionExpired}
								<p class="hint">{t('wizard.previewNotice')}</p>
								<CvPreview {model} />
							{/if}
						{/if}
					</fieldset>
				</Card>
				{#if step !== 'done'}
					<div class="bottom-actions">
						<Button variant="secondary" onclick={back}>{t('wizard.back')}</Button>
						{#if !desktop}<Button
								variant="ghost"
								class="preview-action"
								disabled={store.externalChange === 'removed'}
								aria-label={t('preview.open')}
								title={t('preview.open')}
								onclick={() => (previewOpen = true)}
								><svg
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="1.75"
									aria-hidden="true"
									><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle
										cx="12"
										cy="12"
										r="3"
									/></svg
								></Button
							>{/if}
						{#if isStepOptional(index)}<Button
								variant="ghost"
								disabled={store.externalChange === 'removed'}
								onclick={() => move(nextStepIndex(index))}>{t('wizard.skip')}</Button
							>{/if}
						<Button type="submit" disabled={store.externalChange === 'removed'}
							>{t(step === 'review' ? 'wizard.finish' : 'wizard.next')}</Button
						>
					</div>
				{/if}
			</form>
			{#if desktop && step !== 'review' && step !== 'done' && !sessionExpired}
				<aside class="preview-panel" aria-label={t('preview.label')}>
					<div class="preview-heading">
						<h2>{t('preview.label')}</h2>
					</div>
					<CvPreview {model} />
				</aside>
			{/if}
		</div>
	{/if}
</div>

{#if !removed}
	<BottomSheet
		bind:open={previewOpen}
		title={t('preview.label')}
		description={t('wizard.previewNotice')}
	>
		{#if previewOpen && !sessionExpired}<CvPreview {model} />{/if}
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
{/if}

<style>
	.ats-done-summary {
		margin-bottom: 16px;
		font-size: 0.875rem;
	}
	.ats-done-summary a {
		display: inline-flex;
		align-items: center;
		min-height: 44px;
		color: var(--color-brand-ink);
	}
	.removed-notice p {
		margin-bottom: 16px;
	}
	.done-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-block: 24px;
	}
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
		flex-wrap: nowrap;
		align-items: center;
		gap: 0.5rem;
	}
	.toolbar {
		justify-content: flex-start;
		margin-bottom: 1rem;
	}
	.history :global(.history-action) {
		width: 44px;
		padding: 0;
		font-size: 1.5rem;
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
	.optional-chip {
		display: inline-block;
		padding: 2px 8px;
		border-radius: var(--radius-pill);
		background: var(--color-brand-50);
		color: var(--color-brand-ink);
		font-size: 0.75rem;
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
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 8px 0 calc(8px + env(safe-area-inset-bottom));
		margin-top: 1rem;
		background: var(--color-canvas);
		border-top: 1px solid var(--color-border);
	}
	.bottom-actions :global(.button) {
		min-width: 44px;
		min-height: 44px;
		padding: 8px 10px;
		font-size: 0.8125rem;
		line-height: 1.5;
		white-space: nowrap;
	}
	.bottom-actions :global(.preview-action) {
		width: 44px;
		padding: 8px;
	}
	.bottom-actions :global(.preview-action svg) {
		width: 20px;
		height: 20px;
	}
	.bottom-actions :global(button[type='submit']) {
		margin-left: auto;
		flex: 1;
		max-width: 160px;
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
		height: calc(100dvh - 2rem);
		overflow-y: auto;
	}
	.preview-heading {
		margin-bottom: 1rem;
	}
	@media (max-width: 480px) {
		.workspace form :global(.card-body) {
			padding: 16px;
		}
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
