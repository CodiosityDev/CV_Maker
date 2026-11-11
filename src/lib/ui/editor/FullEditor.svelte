<script lang="ts">
	import { onDestroy, onMount, tick, untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { atsEditTarget, atsField, type AtsEditTarget } from '#lib/ui/ats-check/navigation.ts';
	import { applyConcisePoint } from '#lib/ui/ats-check/concise-target.ts';
	import type { CVDocument } from '#lib/core/schema/types.ts';
	import { LIMITS } from '#lib/core/schema/limits.ts';
	import { newId } from '#lib/core/schema/ids.ts';
	import type {
		AtsAnalyzer,
		AtsReport,
		KeywordReport,
		ConcisePoint,
		ConciseReport
	} from '#lib/core/ats/index.ts';
	import { createCvStore } from '#lib/core/store/cv-store.svelte.ts';
	import { assetRepo, incognito, storage } from '#lib/core/storage/index.ts';
	import { toRenderModel } from '#lib/core/render/index.ts';
	import { loadGuidance, type Guidance } from '#lib/core/content/index.ts';
	import { loadSuggestions, normalize, type SuggestionData } from '#lib/core/suggest/index.ts';
	import type { CustomSectionKey } from '#lib/core/schema/types.ts';
	import { t } from '#lib/i18n/index.svelte.ts';
	import { getIncognitoUiContext } from '#lib/ui/incognito-context.ts';
	import { toast } from '#lib/ui/toast.svelte.ts';
	import Button from '#lib/ui/Button.svelte';
	import Card from '#lib/ui/Card.svelte';
	import Dialog from '#lib/ui/Dialog.svelte';
	import CvPreview from '#lib/ui/CvPreview.svelte';
	import TemplatePicker from '#lib/ui/TemplatePicker.svelte';
	import ExportPanel from '#lib/ui/ExportPanel.svelte';
	import AtsPanel from '#lib/ui/AtsPanel.svelte';
	import JobLinks from '#lib/ui/JobLinks.svelte';
	import PersonalStep from '#lib/ui/wizard/PersonalStep.svelte';
	import CareerFields from '#lib/ui/wizard/CareerFields.svelte';
	import SummaryFields from '#lib/ui/wizard/SummaryFields.svelte';
	import CollectionSteps from '#lib/ui/wizard/CollectionSteps.svelte';
	import SectionList from './SectionList.svelte';
	import CustomSectionFields from './CustomSectionFields.svelte';

	let { initial }: { initial: CVDocument } = $props();
	const store = untrack(() => createCvStore(initial));
	const incognitoUi = getIncognitoUiContext();
	const openedAt = untrack(() => initial.updatedAt);
	let loadedAt = $state(openedAt);
	const savedAt = $derived(
		store.lastSavedAt && store.lastSavedAt > loadedAt ? store.lastSavedAt : loadedAt
	);
	const pendingSave = $derived(store.cv.updatedAt !== savedAt);
	const removed = $derived(store.externalChange === 'removed');
	const expired = $derived(incognito.active && Boolean(incognito.expiredAt));
	let mounted = true;
	let memory = $state(false);
	let view = $state<'edit' | 'preview'>('edit');
	let tool = $state<'download' | 'ats' | 'jobs'>();
	let toolOpen = $state(false);
	let appearanceOpen = $state(false);
	let container = $state<HTMLDivElement>();
	let removalNotice = $state<HTMLDivElement>();
	let photoUrl = $state<string>();
	let photoError = $state(false);
	let photoMissing = $state(false);
	let suggestionsData = $state.raw<SuggestionData>();
	let examples = $state.raw<Guidance>();
	let guidanceFailed = $state(false);
	let guidanceRetry = $state(0);
	const model = $derived(toRenderModel(store.cv, { photoUrl }));
	let analyzer: AtsAnalyzer | undefined;
	let analyzerLoad: Promise<AtsAnalyzer> | undefined;
	let atsReport = $state.raw<AtsReport>();
	let atsKeywords = $state.raw<KeywordReport>();
	let atsConcise = $state.raw<ConciseReport>();
	let conciseSignature: string | undefined;
	const conciseSource = $derived(contentSignature());
	let atsLoading = $state(false);
	let atsFailed = $state(false);
	let atsRetry = $state(0);
	let jobPost = $state('');
	let analysisRequest = 0;
	let keywordUndo: number | undefined;
	let keywordSignature: string | undefined;

	onMount(() => {
		const target = atsEditTarget(page.url.searchParams);
		if (target) void jump(target);
		const beforeStart = incognitoUi?.registerBeforeStart(async () => {
			await store.flush();
			return store.saveState !== 'error';
		});
		const beforeEnd = incognitoUi?.registerBeforeEnd(() =>
			store.applyExternalChange({ type: 'wiped' })
		);
		void storage.getMode().then((mode) => {
			if (mounted) memory = mode === 'memory';
		});
		return () => {
			beforeStart?.();
			beforeEnd?.();
		};
	});
	onDestroy(() => {
		mounted = false;
		analysisRequest += 1;
		analyzer?.dispose();
		clearKeywordUndo();
		void store.destroy();
	});
	$effect(() => {
		if (!removed) return;
		toolOpen = false;
		tool = undefined;
		jobPost = '';
		atsReport = undefined;
		atsKeywords = undefined;
		atsConcise = undefined;
		clearKeywordUndo();
		void tick().then(() => {
			if (mounted && removed) removalNotice?.focus({ preventScroll: true });
		});
	});
	$effect(() => {
		const locale = store.cv.locale;
		void guidanceRetry;
		let current = true;
		suggestionsData = undefined;
		examples = undefined;
		guidanceFailed = false;
		void Promise.all([loadSuggestions(locale), loadGuidance(locale)]).then(
			([suggestions, guidance]) => {
				if (current) {
					suggestionsData = suggestions;
					examples = guidance;
				}
			},
			() => {
				if (current) guidanceFailed = true;
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
		photoError = false;
		photoMissing = false;
		if (id && !removed && !expired)
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
					if (current) photoError = true;
				}
			);
		return () => {
			current = false;
			if (url) URL.revokeObjectURL(url);
		};
	});
	$effect(() => {
		void conciseSource;
		void incognito.active;
		void removed;
		void expired;
		atsConcise = undefined;
		conciseSignature = undefined;
	});
	$effect(() => {
		const request = ++analysisRequest;
		const source = conciseSource;
		const mode = incognito.active;
		void atsRetry;
		if (!toolOpen || tool !== 'ats' || removed || expired) {
			atsLoading = false;
			return;
		}
		const cv = $state.snapshot(store.cv);
		const text = jobPost;
		atsLoading = true;
		atsFailed = false;
		atsKeywords = undefined;
		const timer = setTimeout(() => {
			analyzerLoad ??= import('#lib/core/ats/index.ts').then(({ createAtsAnalyzer }) => {
				const created = createAtsAnalyzer();
				if (!mounted) created.dispose();
				else analyzer = created;
				return created;
			});
			void analyzerLoad
				.then((engine) => {
					if (!mounted || request !== analysisRequest) return undefined;
					return engine.analyze(cv, text.trim() ? text : undefined);
				})
				.then((result) => {
					if (
						!result ||
						!mounted ||
						request !== analysisRequest ||
						removed ||
						expired ||
						mode !== incognito.active ||
						source !== contentSignature()
					)
						return;
					atsReport = result.report;
					atsKeywords = result.keywords;
					atsConcise = result.concise;
					conciseSignature = source;
					atsLoading = false;
				})
				.catch(() => {
					if (!mounted || request !== analysisRequest) return;
					analyzerLoad = undefined;
					atsReport = undefined;
					atsKeywords = undefined;
					atsConcise = undefined;
					atsLoading = false;
					atsFailed = true;
				});
		}, 400);
		return () => {
			clearTimeout(timer);
			if (analysisRequest === request) analysisRequest += 1;
		};
	});
	$effect(() => {
		void store.cv.updatedAt;
		if (keywordSignature && untrack(contentSignature) !== keywordSignature) clearKeywordUndo();
	});
	function clearKeywordUndo() {
		if (keywordUndo !== undefined) toast.dismiss(keywordUndo);
		keywordUndo = undefined;
		keywordSignature = undefined;
	}
	function contentSignature() {
		const cv = $state.snapshot(store.cv);
		return JSON.stringify({ ...cv, status: undefined, updatedAt: undefined });
	}
	function openTool(next: 'download' | 'ats' | 'jobs') {
		tool = next;
		toolOpen = true;
	}
	async function flushBeforeLeave() {
		if (removed) return false;
		await store.flush();
		if (store.saveState === 'error') {
			toast.error(t('wizard.saveError'));
			return false;
		}
		return mounted && !removed;
	}
	async function dashboard(event: MouseEvent) {
		if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)
			return;
		event.preventDefault();
		if (await flushBeforeLeave()) await goto(resolve('/(app)/cv'));
	}
	async function reload() {
		if (await store.reloadFromRepo()) loadedAt = store.cv.updatedAt;
		else store.applyExternalChange({ type: 'wiped' });
	}
	function shortcut(event: KeyboardEvent) {
		if (
			removed ||
			event.defaultPrevented ||
			event.altKey ||
			!(event.ctrlKey || event.metaKey) ||
			document.querySelector('dialog[open]')
		)
			return;
		if (
			event.target instanceof Element &&
			event.target.closest('input, textarea, select, [contenteditable]')
		)
			return;
		const key = event.key.toLowerCase();
		if (key !== 'z' && key !== 'y') return;
		event.preventDefault();
		if (key === 'y' || event.shiftKey) store.redo();
		else store.undo();
	}
	async function focusField(field: string, section?: string) {
		toolOpen = false;
		view = 'edit';
		await tick();
		if (!mounted || removed || !container?.isConnected) return;
		const control =
			document.getElementById(field) ??
			document.getElementById(`${field}-month`) ??
			document.getElementById(`${field}.0`) ??
			document.getElementById(`${field}-add`);
		const row = section
			? [...(container?.querySelectorAll<HTMLElement>('[data-section-key]') ?? [])].find(
					(node) => node.dataset.sectionKey === section
				)
			: undefined;
		const toggle = row?.querySelector<HTMLButtonElement>('[data-section-toggle]');
		if (toggle?.getAttribute('aria-expanded') === 'false') toggle.click();
		let disclosure = control?.closest('details') ?? row?.querySelector('details');
		while (disclosure) {
			disclosure.open = true;
			disclosure = disclosure.parentElement?.closest('details') ?? null;
		}
		await tick();
		if (!mounted || removed || !container?.isConnected) return;
		const target = control ?? toggle ?? row?.querySelector<HTMLElement>('summary');
		target?.focus({ preventScroll: true });
		target?.scrollIntoView({ block: 'center', behavior: 'instant' });
	}
	async function jump(target: AtsEditTarget) {
		await focusField(atsField(target) ?? '', target.section ?? target.step);
	}
	function applyShorter(point: ConcisePoint, text: string): boolean {
		if (
			!mounted ||
			removed ||
			expired ||
			!atsConcise ||
			conciseSignature !== contentSignature() ||
			!atsConcise.points.some((item) => item.key === point.key && item.text === point.text)
		)
			return false;
		return applyConcisePoint(store, point, text);
	}
	function canAddKeyword(term: string) {
		return (
			!removed &&
			store.cv.skills.hard.length < LIMITS.skillsPerGroup &&
			![...store.cv.skills.hard, ...store.cv.skills.soft, ...store.cv.skills.tools].some(
				(skill) => normalize(skill) === normalize(term)
			)
		);
	}
	function addKeyword(term: string) {
		if (
			!canAddKeyword(term) ||
			!atsKeywords?.keywords.some((item) => item.term === term && !item.inCv)
		)
			return;
		clearKeywordUndo();
		store.update(
			(draft) => {
				draft.skills.hard.push(term);
			},
			{ coalesceKey: `ats.skill.${newId()}` }
		);
		keywordSignature = contentSignature();
		keywordUndo = toast.info(t('atsPanel.added', { term }), {
			labelKey: 'wizard.undo',
			run: () => {
				if (!removed && keywordSignature === contentSignature()) store.undo();
				clearKeywordUndo();
			}
		});
	}
</script>

<svelte:window onkeydown={shortcut} />

<div class="full-editor" bind:this={container} data-testid="full-editor">
	{#if removed}
		<Card
			><div
				class="removed-notice"
				role="alert"
				tabindex="-1"
				bind:this={removalNotice}
				data-testid="removed-cv"
			>
				<p>{t(expired ? 'incognito.expiredMessage' : 'wizard.externalRemoved')}</p>
				<div class="button-row">
					<Button href="/buat">{t('wizard.startNew')}</Button><Button href="/cv" variant="secondary"
						>{t('nav.myCvs')}</Button
					>
				</div>
			</div></Card
		>
	{:else}
		<header class="editor-heading">
			<div>
				<h1>{t('editor.title')}</h1>
				<p>{t('editor.description')}</p>
			</div>
			<Button href="/cv" variant="ghost" onclick={dashboard}>{t('nav.myCvs')}</Button>
		</header>
		{#if memory}<p class="notice" role="status">{t('wizard.memoryWarning')}</p>{/if}
		{#if store.externalChange === 'updated'}<div class="notice" role="alert">
				<p>{t('wizard.externalUpdated')}</p>
				<div class="button-row">
					<Button variant="secondary" onclick={reload}>{t('wizard.reload')}</Button><Button
						variant="ghost"
						onclick={() => store.keepLocalVersion()}>{t('wizard.keepLocal')}</Button
					>
				</div>
			</div>{/if}
		<div class="editor-toolbar">
			<div
				role="status"
				aria-live="polite"
				class="save-status"
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
				{:else}{t(
						incognito.active ? 'incognito.saved' : memory ? 'wizard.savedMemory' : 'wizard.saved'
					)}{/if}
			</div>
			<div class="history">
				<Button
					variant="secondary"
					aria-label={t('wizard.undo')}
					title={t('wizard.undo')}
					disabled={!store.canUndo}
					onclick={() => store.undo()}>↶</Button
				><Button
					variant="secondary"
					aria-label={t('wizard.redo')}
					title={t('wizard.redo')}
					disabled={!store.canRedo}
					onclick={() => store.redo()}>↷</Button
				>
			</div>
			<div class="tools">
				<Button onclick={() => openTool('download')}>{t('editor.download')}</Button><Button
					variant="secondary"
					onclick={() => openTool('ats')}>{t('dashboard.checkAts')}</Button
				><Button variant="ghost" onclick={() => openTool('jobs')}
					>{t('jobLinks.dialogTitle')}</Button
				>
			</div>
		</div>
		<div class="view-switch" role="group" aria-label={t('editor.view')}>
			<button type="button" aria-pressed={view === 'edit'} onclick={() => (view = 'edit')}
				>{t('editor.edit')}</button
			><button type="button" aria-pressed={view === 'preview'} onclick={() => (view = 'preview')}
				>{t('editor.preview')}</button
			>
		</div>
		<div class="workspace" class:show-preview={view === 'preview'}>
			<div class="editor-form">
				{#if guidanceFailed}<p class="notice">
						{t('wizard.loadError')}
						<Button variant="ghost" onclick={() => guidanceRetry++}>{t('wizard.retry')}</Button>
					</p>{/if}
				<form
					novalidate
					autocomplete={incognito.active ? 'off' : undefined}
					onsubmit={(event) => event.preventDefault()}
				>
					<details class="fixed-section" open data-section-key="personal">
						<summary>{t('wizard.steps.personal.title')}</summary>
						<div class="section-body">
							<PersonalStep
								{store}
								issues={[]}
								{suggestionsData}
								{photoUrl}
							/>{#if photoError || photoMissing}<p class="error">
									{t(photoMissing ? 'wizard.photoMissing' : 'wizard.photoFailed')}
								</p>{/if}
						</div>
					</details>
					<details class="fixed-section" data-section-key="target">
						<summary>{t('wizard.steps.target.title')}</summary>
						<div class="section-body"><CareerFields {store} {suggestionsData} /></div>
					</details>
				</form>
				<SectionList {store}>
					{#snippet renderSection(section)}
						<form
							novalidate
							autocomplete={incognito.active ? 'off' : undefined}
							onsubmit={(event) => event.preventDefault()}
						>
							{#if section.key === 'summary'}<SummaryFields {store} {examples} {suggestionsData} />
							{:else if section.key === 'education' || section.key === 'experience' || section.key === 'organizations' || section.key === 'projects'}<CollectionSteps
									{store}
									step={section.key}
									issues={[]}
									{examples}
									{suggestionsData}
								/>
							{:else if section.key === 'skills' || section.key === 'languages' || section.key === 'certifications' || section.key === 'awards'}<CollectionSteps
									{store}
									step="skills"
									skillSection={section.key}
									issues={[]}
									{examples}
									{suggestionsData}
								/>
							{:else}<CustomSectionFields
									{store}
									sectionKey={section.key as CustomSectionKey}
								/>{/if}
						</form>
					{/snippet}
				</SectionList>
				<details class="fixed-section" bind:open={appearanceOpen}>
					<summary>{t('editor.appearance')}</summary>
					<div class="section-body">
						{#if appearanceOpen}<TemplatePicker {store} {model} />{/if}
					</div>
				</details>
			</div>
			<aside class="preview-panel" aria-label={t('preview.label')}>
				<div class="preview-sticky"><CvPreview {model} /></div>
			</aside>
		</div>
		<Dialog
			bind:open={toolOpen}
			title={tool === 'download'
				? t('editor.download')
				: tool === 'ats'
					? t('atsPanel.title')
					: t('jobLinks.dialogTitle')}
		>
			{#if toolOpen}
				{#if tool === 'download'}<ExportPanel
						cv={store.cv}
						beforeLeave={flushBeforeLeave}
						returnToEditor
					/>
				{:else if tool === 'ats'}<AtsPanel
						report={atsReport}
						keywords={atsKeywords}
						concise={atsConcise}
						locale={store.cv.locale}
						conciseResetKey={`${store.cv.id}:${conciseSource}:${incognito.active}`}
						onapply={applyShorter}
						loading={atsLoading}
						failed={atsFailed}
						bind:jobPost
						onjump={jump}
						onadd={addKeyword}
						onretry={() => atsRetry++}
						canAdd={canAddKeyword}
					/>
				{:else if tool === 'jobs'}<JobLinks
						cv={store.cv}
						suggestionData={suggestionsData}
						onfillTarget={(event) => {
							event.preventDefault();
							void focusField('targetRole', 'target');
						}}
					/>{/if}
			{/if}
		</Dialog>
	{/if}
</div>

<style>
	.full-editor {
		max-width: 90rem;
		margin: 0 auto;
		padding: 1.25rem 1rem 3rem;
		min-width: 0;
	}
	.editor-heading,
	.editor-toolbar,
	.button-row,
	.history,
	.tools {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}
	.editor-heading {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		margin-bottom: 1.25rem;
		gap: 0.375rem 0.75rem;
	}
	.editor-heading > div {
		display: contents;
	}
	.editor-heading > :global(.button) {
		grid-column: 2;
		grid-row: 1;
	}
	h1 {
		font-size: clamp(1.65rem, 3vw, 2rem);
		font-weight: 650;
	}
	.editor-heading p {
		grid-column: 1 / -1;
		grid-row: 2;
		color: var(--color-text-muted);
		margin-top: 0.375rem;
		line-height: 1.6;
	}
	.editor-toolbar {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 0.75rem;
		margin-bottom: 1rem;
		padding: 0.875rem;
		background: var(--color-brand-50);
		border-radius: var(--radius-lg);
	}
	.save-status {
		flex: 1 1 12rem;
		min-width: 0;
		font-size: 0.875rem;
	}
	.history {
		flex-wrap: nowrap;
	}
	.tools {
		grid-column: 1 / -1;
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.4fr);
		align-items: stretch;
	}
	.tools :global(.button) {
		min-width: 0;
		padding-inline: 0.625rem;
		text-align: center;
	}
	.notice {
		padding: 1rem;
		margin-block: 1rem;
		border-radius: var(--radius-md);
		background: var(--color-cream);
		line-height: 1.6;
	}
	.error {
		color: var(--color-danger);
	}
	.view-switch {
		display: flex;
		margin-bottom: 1rem;
		padding: 0.25rem;
		border-radius: var(--radius-md);
		background: var(--color-mint);
	}
	.view-switch button {
		flex: 1;
		min-height: 44px;
		border: 0;
		border-radius: var(--radius-sm);
		background: transparent;
		font: inherit;
		color: var(--color-text);
		cursor: pointer;
	}
	.view-switch button[aria-pressed='true'] {
		background: var(--color-surface);
	}
	.view-switch button:focus-visible {
		outline: 2px solid var(--color-brand-ink);
		outline-offset: 2px;
	}
	.workspace,
	.editor-form,
	.preview-panel {
		min-width: 0;
	}
	.preview-panel {
		display: none;
	}
	.show-preview .editor-form {
		display: none;
	}
	.show-preview .preview-panel {
		display: block;
	}
	.fixed-section {
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
		margin-bottom: 1rem;
		overflow-wrap: anywhere;
	}
	.fixed-section > summary {
		padding: 1rem;
		scroll-margin-top: 6rem;
		min-height: 52px;
		cursor: pointer;
		font-weight: 600;
	}
	.section-body {
		padding: 0 1rem 1.25rem;
	}
	.fixed-section[open] > .section-body {
		animation: ui-content-reveal 160ms ease-out;
	}
	.removed-notice {
		padding: 0.5rem;
		line-height: 1.7;
	}
	.removed-notice .button-row {
		margin-top: 1rem;
	}
	@media (min-width: 640px) {
		.full-editor {
			padding: 1.75rem 1.5rem 3rem;
		}
		.tools {
			grid-column: auto;
			display: flex;
		}
		.editor-toolbar {
			grid-template-columns: minmax(0, 1fr) auto auto;
		}
	}
	@media (min-width: 1024px) {
		.workspace {
			display: grid;
			grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
			gap: 1.5rem;
			align-items: start;
		}
		.preview-panel {
			display: block;
			position: sticky;
			top: 5.5rem;
			max-height: calc(100svh - 6.5rem);
			overflow: auto;
		}
		.show-preview .editor-form {
			display: block;
		}
		.view-switch {
			display: none;
		}
	}
</style>
