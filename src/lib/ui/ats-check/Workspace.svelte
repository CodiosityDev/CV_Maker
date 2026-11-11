<script lang="ts">
	import { onDestroy, onMount, tick, untrack, type Component } from 'svelte';
	import { resolve } from '$app/paths';
	import { goto as navigate } from '$app/navigation';
	import type { CVDocument, CVMeta } from '#lib/core/schema/types.ts';
	import { LIMITS } from '#lib/core/schema/limits.ts';
	import type { ExtractedCv, ScanReport } from '#lib/core/scan/types.ts';
	import { SCAN_ACCEPT } from '#lib/core/scan/types.ts';
	import type { AtsAnalyzer, AtsReport, KeywordReport, CheckTarget } from '#lib/core/ats/index.ts';
	import { MAX_JOB_POST_CHARS } from '#lib/core/ats/keywords.ts';
	import { incognito } from '#lib/core/storage/incognito.svelte.ts';
	import type { SuggestionData } from '#lib/core/suggest/types.ts';
	import {
		t,
		i18n,
		ensureMessages,
		registerNamespace,
		type MessageKey
	} from '#lib/i18n/index.svelte.ts';
	import Button from '#lib/ui/Button.svelte';
	import Autocomplete from '#lib/ui/Autocomplete.svelte';
	import Textarea from '#lib/ui/Textarea.svelte';
	import type { AiReviewSource as ReviewSource } from '#lib/ui/ai/AiReviewPanel.svelte';
	import { resetAiSession, syncAiSession } from '#lib/ui/ai/session.svelte.ts';
	import { atsEditQuery } from './navigation.ts';

	type StorageModule = typeof import('#lib/core/storage/index.ts');
	type SuggestModule = typeof import('#lib/core/suggest/index.ts');
	let tab = $state<'file' | 'cv'>('file');
	let cvs = $state<CVMeta[]>([]);
	let listFailed = $state(false);
	let selectedId = $state('');
	let cv = $state.raw<CVDocument>();
	let extracted = $state.raw<ExtractedCv>();
	let scanReport = $state.raw<ScanReport>();
	let cvReport = $state.raw<AtsReport>();
	let keywords = $state.raw<KeywordReport>();
	let fileName = $state('');
	let jobPost = $state('');
	let targetRole = $state('');
	let extracting = $state(false);
	let extractionPending = $state(false);
	let loadingCv = $state(false);
	let analyzing = $state(false);
	let error = $state<MessageKey>();
	let analysisFailed = $state(false);
	let fileInput = $state<HTMLInputElement>();
	let uploadTab = $state<HTMLButtonElement>();
	let cvTab = $state<HTMLButtonElement>();
	let dragOver = $state(false);
	let retry = $state(0);
	let revision = $state(0);
	let ScanResults =
		$state<Component<{ report: ScanReport; keywords?: KeywordReport; jobPost?: string }>>();
	let CvResults = $state<typeof import('#lib/ui/AtsPanel.svelte').default>();
	let Review = $state<Component<{ source: ReviewSource }>>();
	let ConvertPanel = $state<typeof import('./ConvertPanel.svelte').default>();
	let conversionEngaged = $state(false);
	let suggestModule = $state.raw<SuggestModule>();
	let suggestions = $state.raw<SuggestionData>();
	let storage: StorageModule | undefined;
	let atsModule: typeof import('#lib/core/ats/index.ts') | undefined;
	let analyzer: AtsAnalyzer | undefined;
	let namespaceRequest: Promise<void> | undefined;
	let generation = 0;
	let listGeneration = 0;
	let mounted = true;
	const uid = $props.id();
	const scope = () => `${incognito.active}:${incognito.expiredAt ?? ''}`;
	let previousScope = untrack(scope);
	const reviewSource = $derived<ReviewSource | undefined>(
		tab === 'file' && extracted
			? { kind: 'file', extracted, targetRole, jobPost }
			: tab === 'cv' && cv
				? { kind: 'cv', cv, jobPost }
				: undefined
	);
	const busy = $derived(extracting || loadingCv || analyzing);
	const suggestionLocale = $derived(cv?.locale ?? scanReport?.locale ?? i18n.locale);

	function current(token: number, startedScope: string) {
		return mounted && token === generation && startedScope === scope();
	}
	function clearResults() {
		generation += 1;
		revision = generation;
		analyzer?.dispose();
		analyzer = undefined;
		extracted = undefined;
		cv = undefined;
		scanReport = undefined;
		cvReport = undefined;
		keywords = undefined;
		selectedId = '';
		fileName = '';
		loadingCv = false;
		extracting = false;
		analyzing = false;
		error = undefined;
		analysisFailed = false;
		conversionEngaged = false;
		if (fileInput) fileInput.value = '';
	}
	function reset() {
		clearResults();
		jobPost = '';
		targetRole = '';
		void tick().then(() => fileInput?.focus());
	}
	function selectTab(next: 'file' | 'cv') {
		if (next === tab) return;
		clearResults();
		tab = next;
	}
	function tabKey(event: KeyboardEvent) {
		if (!cvs.length || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
		event.preventDefault();
		const next =
			event.key === 'Home' ? 'file' : event.key === 'End' ? 'cv' : tab === 'file' ? 'cv' : 'file';
		selectTab(next);
		(next === 'file' ? uploadTab : cvTab)?.focus();
	}
	async function prepareMessages() {
		if (!namespaceRequest)
			namespaceRequest = Promise.all([
				import('#lib/i18n/messages/app.id.ts'),
				import('#lib/i18n/messages/ats.id.ts')
			])
				.then(async ([app, ats]) => {
					registerNamespace('app', app.appId);
					registerNamespace('ats', ats.atsId);
					await ensureMessages();
				})
				.catch((error: unknown) => {
					namespaceRequest = undefined;
					throw error;
				});
		return namespaceRequest;
	}
	async function refreshList() {
		const request = ++listGeneration;
		const startedScope = scope();
		listFailed = false;
		try {
			storage ??= await import('#lib/core/storage/index.ts');
			const list = await storage.cvRepo.list();
			if (!mounted || request !== listGeneration || startedScope !== scope()) return;
			cvs = list;
			if (tab === 'cv' && !cvs.length) {
				clearResults();
				tab = 'file';
			}
		} catch {
			if (mounted && request === listGeneration && startedScope === scope()) listFailed = true;
		}
	}
	onMount(() => {
		void refreshList();
		let stopExternal: (() => void) | undefined;
		let stopped = false;
		void import('#lib/core/storage/index.ts').then((module) => {
			if (stopped) return;
			stopExternal = module.onExternalChange((event) => {
				if (event.type === 'wiped') {
					clearResults();
					cvs = [];
					jobPost = '';
					targetRole = '';
					resetAiSession();
				}
				if (event.type === 'cv-removed') cvs = cvs.filter((item) => item.id !== event.id);
				if ('id' in event && event.id === selectedId) {
					if (event.type === 'cv-removed') clearResults();
					else void chooseCv(event.id);
				}
				void refreshList();
			});
		});
		return () => {
			stopped = true;
			stopExternal?.();
		};
	});
	onDestroy(() => {
		mounted = false;
		generation += 1;
		listGeneration += 1;
		analyzer?.dispose();
		extracted = undefined;
		cv = undefined;
		jobPost = '';
		targetRole = '';
		fileName = '';
	});
	$effect(() => {
		const nextScope = scope();
		if (nextScope !== previousScope) {
			previousScope = nextScope;
			clearResults();
			cvs = [];
			jobPost = '';
			targetRole = '';
			syncAiSession();
			void refreshList();
		}
	});
	$effect(() => {
		const locale = suggestionLocale;
		let live = true;
		void import('#lib/core/suggest/index.ts')
			.then(async (module) => {
				const data = await module.loadSuggestions(locale);
				if (live && mounted) {
					suggestModule = module;
					suggestions = data;
				}
			})
			.catch(() => {});
		return () => {
			live = false;
		};
	});
	$effect(() => {
		const file = extracted;
		const document = cv;
		const post = jobPost;
		const attempt = retry;
		void attempt;
		if (!file && !document) return;
		const token = ++generation;
		revision = token;
		conversionEngaged = false;
		const startedScope = scope();
		analyzing = true;
		analysisFailed = false;
		keywords = undefined;
		const timer = setTimeout(() => {
			void (async () => {
				try {
					await prepareMessages();
					atsModule ??= await import('#lib/core/ats/index.ts');
					if (!current(token, startedScope)) return;
					analyzer ??= atsModule.createAtsAnalyzer();
					if (file) {
						const [analysis, component] = await Promise.all([
							analyzer.analyzeScan($state.snapshot(file), post),
							import('./ScanResults.svelte')
						]);
						if (!current(token, startedScope)) return;
						scanReport = analysis.report;
						keywords = analysis.keywords;
						ScanResults = component.default;
						if (!file.layout.imageOnly) {
							const convert = await import('./ConvertPanel.svelte');
							if (!current(token, startedScope)) return;
							ConvertPanel = convert.default;
						}
					} else if (document) {
						const [analysis, component] = await Promise.all([
							analyzer.analyze($state.snapshot(document), post),
							import('#lib/ui/AtsPanel.svelte')
						]);
						if (!current(token, startedScope)) return;
						cvReport = analysis.report;
						keywords = analysis.keywords;
						CvResults = component.default;
					}
					const review = await import('#lib/ui/ai/AiReviewPanel.svelte');
					if (!current(token, startedScope)) return;
					Review = review.default;
				} catch {
					if (current(token, startedScope)) analysisFailed = true;
				} finally {
					if (current(token, startedScope)) analyzing = false;
				}
			})();
		}, 160);
		return () => clearTimeout(timer);
	});
	async function readFile(file: File | undefined) {
		if (!file || extractionPending) return;
		clearResults();
		const token = generation;
		const startedScope = scope();
		fileName = file.name;
		extracting = true;
		extractionPending = true;
		try {
			await prepareMessages();
			const module = await import('#lib/core/scan/index.ts');
			try {
				const text = await module.extractCvText(file);
				if (current(token, startedScope)) extracted = text;
			} catch (failure) {
				if (current(token, startedScope))
					error =
						failure instanceof module.ScanError
							? module.scanErrorMessageKey(failure.code)
							: 'atsCheck.readFailed';
			}
		} catch {
			if (current(token, startedScope)) error = 'atsCheck.readFailed';
		} finally {
			extractionPending = false;
			if (current(token, startedScope)) {
				extracting = false;
				if (fileInput) fileInput.value = '';
			}
		}
	}
	async function chooseCv(id: string) {
		clearResults();
		tab = 'cv';
		selectedId = id;
		loadingCv = true;
		const token = generation;
		const startedScope = scope();
		try {
			storage ??= await import('#lib/core/storage/index.ts');
			const document = await storage.cvRepo.get(id);
			if (!current(token, startedScope)) return;
			if (!document) {
				error = 'atsCheck.cvMissing';
				void refreshList();
			} else cv = document;
		} catch {
			if (current(token, startedScope)) error = 'atsCheck.cvLoadFailed';
		} finally {
			if (current(token, startedScope)) loadingCv = false;
		}
	}
	function suggestionsFor(query: string) {
		return suggestions && suggestModule
			? suggestModule.suggest(suggestions, 'jobTitle', query)
			: [];
	}
	function drop(event: DragEvent) {
		event.preventDefault();
		dragOver = false;
		if (!extractionPending) void readFile(event.dataTransfer?.files[0]);
	}
	function editedAt(value: string) {
		return new Intl.DateTimeFormat(i18n.locale === 'id' ? 'id-ID' : 'en-GB', {
			dateStyle: 'medium'
		}).format(new Date(value));
	}
	async function jump(target: CheckTarget) {
		if (!cv || !storage) return;
		const token = generation;
		const startedScope = scope();
		try {
			const latest = await storage.cvRepo.get(cv.id);
			if (!current(token, startedScope)) return;
			if (!latest) {
				clearResults();
				void refreshList();
				return;
			}
			await navigate(resolve(`/(app)/cv/[id]/edit?${atsEditQuery(target)}`, { id: latest.id }));
		} catch {
			if (current(token, startedScope)) error = 'atsCheck.cvLoadFailed';
		}
	}
</script>

<div class="source-tabs" role="tablist" aria-label={t('atsCheck.source')}>
	<button
		type="button"
		role="tab"
		id={`${uid}-file-tab`}
		aria-controls={`${uid}-file-panel`}
		aria-selected={tab === 'file'}
		tabindex={tab === 'file' ? 0 : -1}
		bind:this={uploadTab}
		onkeydown={tabKey}
		onclick={() => selectTab('file')}>{t('atsCheck.uploadTab')}</button
	>
	{#if cvs.length}<button
			type="button"
			role="tab"
			id={`${uid}-cv-tab`}
			aria-controls={`${uid}-cv-panel`}
			aria-selected={tab === 'cv'}
			tabindex={tab === 'cv' ? 0 : -1}
			bind:this={cvTab}
			onkeydown={tabKey}
			onclick={() => selectTab('cv')}>{t('atsCheck.savedTab')}</button
		>{/if}
</div>

{#if tab === 'file'}
	<div role="tabpanel" id={`${uid}-file-panel`} aria-labelledby={`${uid}-file-tab`}>
		<div
			class:drag-over={dragOver}
			class="dropzone"
			data-testid="scan-dropzone"
			role="group"
			aria-labelledby={`${uid}-upload-label`}
			ondragover={(event) => {
				event.preventDefault();
				dragOver = true;
			}}
			ondragleave={() => (dragOver = false)}
			ondrop={drop}
		>
			<label id={`${uid}-upload-label`} for="ats-file">{t('atsCheck.fileLabel')}</label>
			<p id={`${uid}-file-help`}>{t('atsCheck.fileHint')}</p>
			<input
				id="ats-file"
				type="file"
				accept={SCAN_ACCEPT}
				disabled={extractionPending}
				aria-describedby={`${uid}-file-help ${uid}-file-privacy${error ? ` ${uid}-error` : ''}`}
				aria-invalid={Boolean(error)}
				bind:this={fileInput}
				onchange={() => void readFile(fileInput?.files?.[0])}
			/>
			<p class="privacy" id={`${uid}-file-privacy`}>{t('atsCheck.filePrivacy')}</p>
		</div>
		{#if fileName}<div class="file-row">
				<p class="file-name">{fileName}</p>
				<Button variant="ghost" onclick={reset}>{t('atsCheck.anotherFile')}</Button>
			</div>{/if}
	</div>
{:else}
	<div role="tabpanel" id={`${uid}-cv-panel`} aria-labelledby={`${uid}-cv-tab`}>
		<h2 class="small-heading">{t('atsCheck.chooseCv')}</h2>
		<ul class="cv-list">
			{#each cvs as item (item.id)}<li>
					<button
						type="button"
						aria-pressed={selectedId === item.id}
						onclick={() => void chooseCv(item.id)}
						><strong>{item.title || t('atsCheck.untitled')}</strong><span
							>{t('atsCheck.modified', { date: editedAt(item.updatedAt) })}</span
						></button
					>
				</li>{/each}
		</ul>
	</div>
{/if}
{#if !cvs.length}<p class="create-link">
		{t('atsCheck.noSaved')} <a href={resolve('/(app)/buat')}>{t('nav.create')}</a>
	</p>{/if}
{#if listFailed}<p class="load-error">
		{t('atsCheck.listFailed')}
		<button type="button" onclick={() => void refreshList()}>{t('atsCheck.retry')}</button>
	</p>{/if}

<div class="context-fields">
	{#if tab === 'file'}<Autocomplete
			id="ats-target-role"
			label={t('atsCheck.targetRole')}
			bind:value={targetRole}
			suggestions={suggestionsFor}
			popularWhenEmpty
			maxlength={LIMITS.title}
			autocomplete="off"
		/>{/if}
	<Textarea
		id="ats-job-post"
		label={t('atsCheck.jobLabel')}
		maxlength={MAX_JOB_POST_CHARS}
		rows={4}
		showCounter={false}
		autocomplete="off"
		spellcheck={false}
		aria-describedby={`${uid}-job-count ${uid}-job-privacy`}
		bind:value={jobPost}
	/>
	<p class="character-count" id={`${uid}-job-count`}>
		{t('atsCheck.characterCount', { count: jobPost.length, max: MAX_JOB_POST_CHARS })}
	</p>
	<p class="privacy" id={`${uid}-job-privacy`}>{t('atsCheck.jobPrivacy')}</p>
</div>

{#if busy}<p class="status" role="status" aria-live="polite">
		{t(extracting ? 'atsCheck.reading' : loadingCv ? 'atsCheck.loadingCv' : 'atsCheck.analyzing')}
	</p>{/if}
{#if error}<p id={`${uid}-error`} class="error" role="alert">{t(error)}</p>{/if}
{#if analysisFailed}<div class="error" role="alert">
		<p>{t('atsCheck.analysisFailed')}</p>
		<Button variant="secondary" onclick={() => retry++}>{t('atsCheck.retry')}</Button>
	</div>{/if}

<div class="results" aria-busy={analyzing || undefined}>
	{#if tab === 'file' && scanReport && ScanResults && !conversionEngaged}<ScanResults
			report={scanReport}
			{keywords}
			{jobPost}
		/>
	{:else if tab === 'cv' && cvReport && CvResults}<CvResults
			report={cvReport}
			{keywords}
			{jobPost}
			loading={analyzing}
			showJobField={false}
			fixLabel={t('atsCheck.fix')}
			onjump={jump}
			onretry={() => retry++}
		/>{/if}
	{#if tab === 'file' && extracted && scanReport && !extracted.layout.imageOnly && ConvertPanel && !busy && !analysisFailed}
		{#key revision}
			{@const panelRevision = untrack(() => revision)}
			<ConvertPanel
				{extracted}
				{jobPost}
				{targetRole}
				onstagechange={(engaged) => {
					if (mounted && panelRevision === revision) conversionEngaged = engaged;
				}}
			/>
		{/key}
	{/if}
	{#if Review && reviewSource && !busy && !analysisFailed && !conversionEngaged && (scanReport || cvReport)}{#key revision}<Review
				source={reviewSource}
			/>{/key}{/if}
</div>

<style>
	.source-tabs {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
		margin-bottom: 1.5rem;
		padding: 0.25rem;
		background: var(--color-brand-50);
		border-radius: var(--radius-md);
		width: fit-content;
		max-width: 100%;
	}
	.source-tabs button {
		min-height: 44px;
		padding: 0.65rem 0.85rem;
		border: 0;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--color-brand-ink);
		font: inherit;
		font-size: 0.875rem;
		font-weight: 600;
	}
	.source-tabs button[aria-selected='true'] {
		background: var(--color-mint);
		color: var(--color-text);
	}
	.dropzone {
		display: grid;
		gap: 0.75rem;
		min-width: 0;
		padding: 1.25rem;
		border: 1px dashed var(--color-control-border);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
	}
	.dropzone.drag-over {
		background: var(--color-mint-50);
	}
	label,
	.small-heading {
		font-size: 1rem;
		font-weight: 650;
	}
	.dropzone p,
	.create-link,
	.privacy,
	.load-error {
		color: var(--color-text-muted);
		font-size: 0.875rem;
	}
	input[type='file'] {
		min-height: 44px;
		max-width: 100%;
		width: 100%;
		color: var(--color-text);
		font-size: 0.875rem;
	}
	input::file-selector-button {
		min-height: 44px;
		padding: 0.6rem 0.8rem;
		margin-right: 0.75rem;
		background: var(--color-brand-50);
		color: var(--color-brand-ink);
		border: 0;
		border-radius: var(--radius-sm);
		font: inherit;
		cursor: pointer;
	}
	.file-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
		margin-top: 0.5rem;
	}
	.file-name {
		flex: 1;
		min-width: 0;
		overflow-wrap: anywhere;
		font-size: 0.875rem;
	}
	.create-link {
		margin-top: 1rem;
	}
	a,
	.load-error button {
		display: inline-flex;
		align-items: center;
		min-height: 44px;
	}
	.load-error button {
		border: 0;
		background: transparent;
		color: var(--color-brand-ink);
		text-decoration: underline;
	}
	.context-fields {
		display: grid;
		gap: 1rem;
		margin-top: 1.5rem;
	}
	.character-count {
		margin-top: -0.75rem;
		color: var(--color-text-muted);
		font-size: 0.8125rem;
		text-align: right;
	}
	.context-fields .privacy {
		margin-top: -0.5rem;
	}
	.status {
		margin-top: 1.5rem;
		color: var(--color-text-muted);
	}
	.error {
		margin-top: 1rem;
		color: var(--color-danger);
	}
	.results {
		min-width: 0;
	}
	.cv-list {
		list-style: none;
		padding: 0;
		display: grid;
		gap: 0.5rem;
		margin: 1rem 0 0;
	}
	.cv-list button {
		display: grid;
		gap: 0.25rem;
		min-height: 44px;
		width: 100%;
		text-align: left;
		padding: 1rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		color: var(--color-text);
		overflow-wrap: anywhere;
	}
	.cv-list button[aria-pressed='true'] {
		background: var(--color-mint-50);
		border-color: var(--color-control-border);
	}
	.cv-list span {
		color: var(--color-text-muted);
		font-size: 0.8125rem;
	}
</style>
