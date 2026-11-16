<script lang="ts">
	import { onDestroy, onMount, tick, untrack } from 'svelte';
	import { asset, resolve } from '$app/paths';
	import type { CvStore } from '#lib/core/store/cv-store.svelte.ts';
	import {
		applyShorter,
		checkLetter,
		conciseFromLetter,
		findLetter,
		letterCoalesceKey,
		letterConciseMessageKey,
		letterEmail,
		letterFileName,
		LETTER_FONT_CSS_PATH,
		LETTER_LIMITS,
		LETTER_SOURCES,
		LETTER_TEXT_KEYS,
		toLetterModel,
		updateLetter,
		type LetterField,
		type LetterPatch,
		type LetterTextKey
	} from '#lib/core/letter/index.ts';
	import { downloadBlob } from '#lib/core/export/index.ts';
	import { incognito } from '#lib/core/storage/index.ts';
	import type { ConcisePoint, ConciseReport } from '#lib/core/ats/concise.ts';
	import { loadSuggestions, suggest, type SuggestionData } from '#lib/core/suggest/index.ts';
	import { t } from '#lib/i18n/index.svelte.ts';
	import { toast } from '#lib/ui/toast.svelte.ts';
	import { aiSession } from '#lib/ui/ai/session.svelte.ts';
	import BottomSheet from '#lib/ui/BottomSheet.svelte';
	import Button from '#lib/ui/Button.svelte';
	import Input from '#lib/ui/Input.svelte';
	import type LetterAi from './LetterAi.svelte';
	import LetterPaper from './LetterPaper.svelte';
	import { getLetterNavigation } from './navigation.svelte.ts';

	let { store, letterId }: { store: CvStore; letterId: string } = $props();
	const navigation = getLetterNavigation();
	const letter = $derived(findLetter(store.cv, letterId));
	const letterLocale = $derived(letter?.locale);
	let paperEditing = $state(false);
	let editingChecks = $state.raw<ReturnType<typeof checkLetter>>([]);
	const checks = $derived(
		paperEditing ? editingChecks : letter ? checkLetter(store.cv, letter) : []
	);
	const errors = $derived(checks.some((check) => check.level === 'error'));
	const steps = $derived([
		t('letterEditor.vacancy'),
		t('letterEditor.content'),
		t('letterEditor.attachmentsDate')
	]);
	const identity = $derived(
		store.cv.status.wizardCompleted
			? resolve('/(app)/cv/[id]/edit', { id: store.cv.id })
			: resolve('/(app)/buat/[id]', { id: store.cv.id })
	);
	const sourceSignature = $derived(JSON.stringify([store.cv, letterId, store.externalChange]));
	let step = $state(0);
	let desktop = $state(false);
	let previewOpen = $state(false);
	let styleOpen = $state(false);
	let conciseOpen = $state(false);
	let checksOpen = $state(false);
	let busy = $state<'docx' | 'txt' | 'pdf' | 'email'>();
	let aiBusy = $state(false);
	let AiPanel = $state.raw<typeof import('./LetterAi.svelte').default>();
	let ConcisePanel = $state.raw<typeof import('#lib/ui/ats-check/ConcisePanel.svelte').default>();
	let aiLoading = $state(false);
	let aiFailed = $state(false);
	let conciseLoading = $state(false);
	let conciseFailed = $state(false);
	let aiImport: Promise<typeof import('./LetterAi.svelte')> | undefined;
	let ContentFields = $state.raw<typeof import('./LetterContentFields.svelte').default>();
	let AttachmentFields = $state.raw<typeof import('./LetterAttachmentFields.svelte').default>();
	let fieldsFailed = $state(false);
	let contentImport: Promise<typeof import('./LetterContentFields.svelte')> | undefined;
	let attachmentImport: Promise<typeof import('./LetterAttachmentFields.svelte')> | undefined;
	let conciseImport: Promise<typeof import('#lib/ui/ats-check/ConcisePanel.svelte')> | undefined;
	let aiKeys = $state<LetterTextKey[]>([]);
	let jobPost = $state('');
	let manualEmail = $state<string>();
	let addressOpen = $state(untrack(() => Boolean(letter?.companyAddress)));
	let jobPostOpen = $state(false);
	let Textarea = $state.raw<typeof import('#lib/ui/Textarea.svelte').default>();
	let textareaFailed = $state(false);
	let textareaImport: Promise<typeof import('#lib/ui/Textarea.svelte')> | undefined;
	let Appearance = $state.raw<typeof import('./LetterAppearance.svelte').default>();
	let appearanceFailed = $state(false);
	let appearanceImport: Promise<typeof import('./LetterAppearance.svelte')> | undefined;
	let suggestions = $state.raw<SuggestionData>();
	let Autocomplete = $state.raw<typeof import('#lib/ui/Autocomplete.svelte').default>();
	let autocompleteImport: Promise<typeof import('#lib/ui/Autocomplete.svelte')> | undefined;
	let localReport = $state.raw<ConciseReport>();
	let displayReport = $state.raw<ConciseReport>();
	let reportSignature = $state('');
	let paper = $state<LetterPaper>();
	let ai = $state<LetterAi>();
	let root = $state<HTMLElement>();
	let mounted = true;
	const valid = () =>
		mounted &&
		Boolean(letter) &&
		store.externalChange !== 'removed' &&
		(!incognito.active || !incognito.expiredAt);
	function editingChanged(active: boolean) {
		if (active && !paperEditing) editingChecks = checks;
		paperEditing = active;
	}

	onMount(() => {
		const query = window.matchMedia('(min-width: 1024px)');
		const resize = () => {
			desktop = query.matches;
			if (desktop) previewOpen = false;
		};
		resize();
		query.addEventListener('change', resize);
		return () => query.removeEventListener('change', resize);
	});
	onDestroy(() => {
		mounted = false;
		jobPost = '';
	});
	$effect(() => {
		void letterLocale;
		suggestions = undefined;
	});
	$effect(() => {
		if (step === 1) untrack(() => void loadAiPanel());
	});
	$effect(() => {
		const index = step;
		if (index > 0) untrack(() => void loadFields(index));
	});
	async function loadFields(index: number) {
		fieldsFailed = false;
		try {
			if (index === 1 && !ContentFields) {
				const module = await (contentImport ??= import('./LetterContentFields.svelte'));
				if (valid()) ContentFields = module.default;
			}
			if (index === 2 && !AttachmentFields) {
				const module = await (attachmentImport ??= import('./LetterAttachmentFields.svelte'));
				if (valid()) AttachmentFields = module.default;
			}
		} catch {
			if (index === 1) contentImport = undefined;
			else attachmentImport = undefined;
			if (valid() && step === index) fieldsFailed = true;
		}
	}
	$effect(() => {
		if (conciseOpen) untrack(() => void loadConcise());
	});
	$effect(() => {
		if (addressOpen || jobPostOpen || manualEmail !== undefined) untrack(() => void loadTextarea());
	});
	async function loadTextarea() {
		if (Textarea) return;
		textareaFailed = false;
		try {
			const module = await (textareaImport ??= import('#lib/ui/Textarea.svelte'));
			if (valid()) Textarea = module.default;
		} catch {
			textareaImport = undefined;
			if (valid()) textareaFailed = true;
		}
	}
	$effect(() => {
		if (styleOpen) untrack(() => void loadAppearance());
	});
	async function loadAppearance() {
		if (Appearance) return;
		appearanceFailed = false;
		try {
			const module = await (appearanceImport ??= import('./LetterAppearance.svelte'));
			if (valid()) Appearance = module.default;
		} catch {
			appearanceImport = undefined;
			if (valid()) appearanceFailed = true;
		}
	}
	async function prepareSuggestions() {
		const locale = letterLocale;
		if (!locale || suggestions) return;
		try {
			const data = await loadSuggestions(locale);
			if (valid() && letter?.locale === locale) suggestions = data;
		} catch {
			/* Free text stays available offline. */
		}
	}
	async function preparePosition() {
		void prepareSuggestions();
		if (Autocomplete) return;
		const original = document.getElementById('letter-position');
		try {
			const module = await (autocompleteImport ??= import('#lib/ui/Autocomplete.svelte'));
			if (!valid()) return;
			const focused = original instanceof HTMLInputElement && document.activeElement === original;
			const start = original instanceof HTMLInputElement ? original.selectionStart : null;
			const end = original instanceof HTMLInputElement ? original.selectionEnd : null;
			Autocomplete = module.default;
			await tick();
			const replacement = document.getElementById('letter-position');
			if (
				focused &&
				valid() &&
				replacement instanceof HTMLInputElement &&
				(document.activeElement === document.body || document.activeElement === original)
			) {
				replacement.focus({ preventScroll: true });
				if (start !== null && end !== null) replacement.setSelectionRange(start, end);
			}
		} catch {
			autocompleteImport = undefined; /* Free-text input remains available. */
		}
	}
	async function loadAiPanel() {
		if (AiPanel) return;
		aiLoading = true;
		aiFailed = false;
		try {
			const module = await (aiImport ??= import('./LetterAi.svelte'));
			if (valid()) AiPanel = module.default;
		} catch {
			aiImport = undefined;
			if (mounted) aiFailed = true;
		} finally {
			if (mounted) aiLoading = false;
		}
	}
	async function loadConcise() {
		if (ConcisePanel) return;
		conciseLoading = true;
		conciseFailed = false;
		try {
			const module = await (conciseImport ??= import('#lib/ui/ats-check/ConcisePanel.svelte'));
			if (valid()) ConcisePanel = module.default;
		} catch {
			conciseImport = undefined;
			if (mounted) conciseFailed = true;
		} finally {
			if (mounted) conciseLoading = false;
		}
	}
	$effect(() => {
		const source = sourceSignature;
		// Drop old AI marks immediately; run the local analysis after typing settles.
		displayReport = undefined;
		localReport = undefined;
		reportSignature = '';
		const timer = setTimeout(() => {
			if (!valid() || source !== sourceSignature) return;
			const current = findLetter(store.cv, letterId);
			if (!current) return;
			localReport = conciseFromLetter(toLetterModel(store.cv, current));
			if (paperEditing) editingChecks = checkLetter(store.cv, current);
			reportSignature = source;
		}, 400);
		return () => clearTimeout(timer);
	});
	const currentReport = $derived(
		reportSignature === sourceSignature ? (displayReport ?? localReport) : undefined
	);
	function change(patch: LetterPatch, field?: string) {
		if (!valid()) return;
		store.update(
			(draft) => updateLetter(draft, letterId, patch),
			field ? { coalesceKey: letterCoalesceKey(letterId, field) } : undefined
		);
	}
	function selectStep(index: number) {
		step = index;
	}
	async function next(index: number) {
		step = index;
		if (index > 0) await loadFields(index);
		if (step !== index || !valid()) return;
		await tick();
		root
			?.querySelector<HTMLElement>('.step-panel input, .step-panel textarea, .step-panel button')
			?.focus();
	}
	async function showParagraph(key: LetterTextKey) {
		if (!valid()) return;
		if (!desktop) previewOpen = true;
		await tick();
		paper?.focusParagraph(key);
	}
	async function jump(field: LetterField) {
		if (field === 'cv' || field === 'cv.personal') {
			paper?.finishEditing();
			await navigation.go(identity);
			return;
		}
		const key = LETTER_TEXT_KEYS.find((key) => key === field);
		if (key && (field !== 'motivation' || letter?.overrides.motivation)) {
			await showParagraph(key);
			return;
		}
		const first = ['position', 'company'].includes(field);
		step = first ? 0 : field === 'date' || field === 'style' ? 2 : 1;
		if (field === 'style') {
			styleOpen = true;
			if (!desktop) previewOpen = true;
		}
		const index = step;
		if (index > 0) await loadFields(index);
		if (step !== index || !valid()) return;
		await tick();
		const id = field === 'identity' ? 'include-identity' : field;
		const target = root?.querySelector<HTMLElement>(`#letter-${id}`);
		target?.scrollIntoView({ block: 'center', behavior: 'instant' });
		target?.focus();
	}
	async function askAi() {
		step = 1;
		await loadAiPanel();
		if (!valid() || step !== 1) return;
		await tick();
		void ai?.ask();
	}
	function undo() {
		paper?.finishEditing();
		store.undo();
	}
	function redo() {
		paper?.finishEditing();
		store.redo();
	}
	function keydown(event: KeyboardEvent) {
		if (navigation.busy) return;
		if (
			document.querySelector('dialog[open]') &&
			!(event.target instanceof Element && event.target.closest('.sheet-paper'))
		)
			return;
		if (
			event.defaultPrevented ||
			event.isComposing ||
			!(event.ctrlKey || event.metaKey) ||
			event.altKey ||
			!valid()
		)
			return;
		if (event.key.toLowerCase() === 'z') {
			event.preventDefault();
			if (event.shiftKey) redo();
			else undo();
		} else if (event.key.toLowerCase() === 'y') {
			event.preventDefault();
			redo();
		}
	}
	async function download(format: 'docx' | 'txt' | 'pdf' | 'email') {
		if (!valid() || busy || !letter) return;
		paper?.finishEditing();
		if (errors) return;
		busy = format;
		const cv = $state.snapshot(store.cv),
			current = findLetter(cv, letterId);
		const openedLetterId = letterId;
		const mode = incognito.active;
		if (!current) {
			busy = undefined;
			return;
		}
		const snapshot = toLetterModel(cv, current);
		const stillCurrent = () =>
			valid() && incognito.active === mode && store.cv.id === cv.id && letterId === openedLetterId;
		try {
			if (format === 'pdf') {
				if (stillCurrent())
					await navigation.go(
						resolve('/(app)/cv/[id]/surat/[letterId]/print', { id: cv.id, letterId })
					);
			} else if (format === 'email') {
				const email = letterEmail(snapshot),
					text = `${t('letterEditor.emailSubject', { subject: email.subject })}\n\n${email.body}`;
				try {
					if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
					await navigator.clipboard.writeText(text);
					if (stillCurrent()) {
						manualEmail = undefined;
						toast.success(t('letterEditor.copied'));
					}
				} catch {
					if (stillCurrent()) manualEmail = text;
				}
			} else {
				const module = await import('#lib/core/letter/export.ts');
				const blob = await (format === 'docx'
					? module.exportLetterDocx(snapshot)
					: module.exportLetterTxt(snapshot));
				if (stillCurrent()) downloadBlob(blob, letterFileName(cv, current, format));
			}
		} catch {
			if (stillCurrent()) toast.error(t('letterEditor.downloadError'));
		} finally {
			if (mounted) busy = undefined;
		}
	}
	function applyConcise(point: ConcisePoint) {
		if (
			!valid() ||
			!letter ||
			!currentReport?.ai ||
			!currentReport.points.some(
				(item) =>
					item.key === point.key && item.text === point.text && item.shorter === point.shorter
			)
		)
			return false;
		change(applyShorter(point));
		return true;
	}
</script>

{#snippet textareaStatus()}
	{#if textareaFailed}<p role="alert">{t('letterEditor.loadError')}</p>
		<Button variant="secondary" onclick={() => void loadTextarea()}>{t('atsPanel.retry')}</Button
		>{:else}<p role="status">{t('common.loading')}</p>{/if}
{/snippet}

<svelte:head
	><link
		rel="stylesheet"
		href={asset(LETTER_FONT_CSS_PATH.slice(1) as Parameters<typeof asset>[0])}
	/></svelte:head
>
<svelte:window onkeydown={keydown} />

{#snippet finishControls(location: string)}
	<section
		class="finish"
		data-testid={`letter-finish-${location}`}
		aria-label={t('letterEditor.finish')}
	>
		<div class="finish-heading">
			<h2>{t('letterEditor.finish')}</h2>
			{#if checks.some((check) => check.level === 'warn')}<button
					type="button"
					class="check-toggle"
					aria-expanded={checksOpen}
					onclick={() => (checksOpen = !checksOpen)}
					>{t('letterEditor.warningCount', {
						count: checks.filter((check) => check.level === 'warn').length
					})}</button
				>{/if}
		</div>
		{#if checks.some((check) => check.level === 'error') || checksOpen}<ul class="checks">
				{#each checks.filter((check) => check.level === 'error' || checksOpen) as check (check.id)}<li
					>
						<button
							type="button"
							class:error={check.level === 'error'}
							onclick={() => void jump(check.field)}
							><span aria-hidden="true">{check.level === 'error' ? '!' : 'i'}</span><span
								><strong
									>{t(check.level === 'error' ? 'letterEditor.error' : 'letterEditor.warning')}:
								</strong>{t(check.messageKey)}</span
							></button
						>
					</li>{/each}
			</ul>{/if}
		{#if currentReport?.score !== undefined}<button
				type="button"
				class="text-link"
				onclick={() => {
					if (location === 'sheet') previewOpen = false;
					conciseOpen = true;
					void tick().then(() =>
						document
							.getElementById('letter-concise')
							?.scrollIntoView({ block: 'start', behavior: 'instant' })
					);
				}}
				>{t('letterEditor.conciseSummary', {
					score: currentReport.score,
					count: currentReport.wordy
				})} · {t('letterEditor.seeConcise')}</button
			>{/if}
		<div class="download-actions">
			<Button
				id={`letter-download-pdf${location === 'form' ? '-form' : ''}`}
				disabled={errors || !!busy}
				onclick={() => void download('pdf')}>{t('letterEditor.pdf')}</Button
			><Button
				id={`letter-download-docx${location === 'form' ? '-form' : ''}`}
				variant="secondary"
				disabled={errors || !!busy}
				loading={busy === 'docx'}
				onclick={() => void download('docx')}>{t('letterEditor.docx')}</Button
			><Button
				id={`letter-download-txt${location === 'form' ? '-form' : ''}`}
				variant="secondary"
				disabled={errors || !!busy}
				loading={busy === 'txt'}
				onclick={() => void download('txt')}>{t('letterEditor.txt')}</Button
			><Button
				id={`letter-copy-email${location === 'form' ? '-form' : ''}`}
				variant="ghost"
				disabled={errors || !!busy}
				onclick={() => void download('email')}>{t('letterEditor.email')}</Button
			>
		</div>
		{#if errors}<p class="error" role="status">{t('letterEditor.errorsHint')}</p>{/if}
	</section>
{/snippet}

{#snippet appearance()}
	{#if letter}<details
			class="appearance"
			open={styleOpen}
			ontoggle={(event) => (styleOpen = event.currentTarget.open)}
			data-testid="letter-style-panel"
		>
			<summary id="letter-style">{t('letterEditor.style')}</summary>
			{#if Appearance}<Appearance
					style={letter.style}
					onchange={(patch) => change({ style: patch })}
				/>{:else if appearanceFailed}<p role="alert">{t('letterEditor.loadError')}</p>
				<Button variant="secondary" onclick={() => void loadAppearance()}
					>{t('atsPanel.retry')}</Button
				>{:else if styleOpen}<p role="status">{t('common.loading')}</p>{/if}
		</details>{/if}
{/snippet}

{#if letter}
	<article
		class="letter-editor"
		data-testid="letter-editor"
		bind:this={root}
		inert={navigation.busy}
		aria-busy={navigation.busy || undefined}
	>
		<header class="editor-heading">
			<div>
				<a href={resolve('/(app)/cv/[id]/surat', { id: store.cv.id })} onclick={navigation.click}
					>{t('letterEditor.backToLetters')}</a
				>
				<h1>{t('letterEditor.title')}</h1>
				<p>{t('letterEditor.intro')}</p>
			</div>
			<div class="history">
				<span role="status"
					>{t(
						store.saveState === 'saving'
							? 'wizard.saving'
							: store.saveState === 'error'
								? 'wizard.saveError'
								: 'wizard.saved'
					)}</span
				><Button
					variant="ghost"
					disabled={!store.canUndo}
					onclick={undo}
					aria-label={t('letterEditor.undo')}
					title={t('letterEditor.undo')}>↶</Button
				><Button
					variant="ghost"
					disabled={!store.canRedo}
					onclick={redo}
					aria-label={t('letterEditor.redo')}
					title={t('letterEditor.redo')}>↷</Button
				>
			</div>
		</header>
		{#if !store.cv.status.wizardCompleted}<p class="cv-note">
				{t('letterEditor.incomplete')}
				<a href={identity} onclick={navigation.click}>{t('letterEditor.incompleteLink')}</a>
			</p>{/if}
		<div class="editor-grid">
			<div class="form-column">
				<nav aria-label={t('letterEditor.steps')}>
					<ol class="steps">
						{#each steps as label, index (index)}<li>
								<button
									type="button"
									data-testid={`letter-step-${index}`}
									aria-current={step === index ? 'step' : undefined}
									onclick={() => selectStep(index)}
									><span aria-hidden="true">{index + 1}</span>{label}</button
								>
							</li>{/each}
					</ol>
				</nav>
				<p class="sr-only" aria-live="polite">
					{t('letterEditor.stepAnnounce', { number: step + 1, step: steps[step] ?? '' })}
				</p>
				<section class="step-panel" aria-label={steps[step]}>
					<h2>{steps[step]}</h2>
					{#if step === 0}
						{#if Autocomplete}<Autocomplete
								id="letter-position"
								data-testid="letter-position"
								label={t('letterEditor.position')}
								value={letter.position}
								required
								maxlength={LETTER_LIMITS.position}
								suggestions={(query) =>
									suggestions ? suggest(suggestions, 'jobTitle', query) : []}
								popularWhenEmpty
								oninput={(event) => change({ position: event.currentTarget.value }, 'position')}
								onselect={(position) => change({ position }, 'position')}
								onfocus={() => void prepareSuggestions()}
								error={!letter.position.trim() ? t('letter.checks.positionMissing') : undefined}
							/>{:else}<Input
								id="letter-position"
								data-testid="letter-position"
								label={t('letterEditor.position')}
								value={letter.position}
								required
								maxlength={LETTER_LIMITS.position}
								autocomplete="off"
								onfocus={() => void preparePosition()}
								oninput={(event) => change({ position: event.currentTarget.value }, 'position')}
								error={!letter.position.trim() ? t('letter.checks.positionMissing') : undefined}
							/>{/if}
						<Input
							id="letter-company"
							data-testid="letter-company"
							label={t('letterEditor.company')}
							value={letter.company}
							required
							maxlength={LETTER_LIMITS.company}
							placeholder={t('letterEditor.companyPlaceholder')}
							oninput={(event) => change({ company: event.currentTarget.value }, 'company')}
							error={!letter.company.trim() ? t('letter.checks.companyMissing') : undefined}
						/>
						<Input
							id="letter-recipient"
							label={t('letterEditor.recipient')}
							value={letter.recipient}
							maxlength={LETTER_LIMITS.recipient}
							placeholder={t('letterEditor.recipientPlaceholder')}
							hint={t('letterEditor.recipientHint')}
							oninput={(event) => change({ recipient: event.currentTarget.value }, 'recipient')}
						/>
						<details
							open={addressOpen}
							ontoggle={(event) => (addressOpen = event.currentTarget.open)}
						>
							<summary>{t('letterEditor.addAddress')}</summary>{#if Textarea}<Textarea
									id="letter-company-address"
									label={t('letterEditor.companyAddress')}
									value={letter.companyAddress}
									maxlength={LETTER_LIMITS.companyAddress}
									rows={3}
									oninput={(event) =>
										change({ companyAddress: event.currentTarget.value }, 'companyAddress')}
								/>{:else if addressOpen}{@render textareaStatus()}{/if}
						</details>
						<fieldset>
							<legend>{t('letterEditor.source')}</legend>
							<div class="source-options">
								{#each LETTER_SOURCES as source (source)}<label
										><input
											type="radio"
											name="letter-source"
											value={source}
											checked={letter.source === source}
											onchange={() => change({ source })}
										/>{t(`letter.sources.${source}`)}</label
									>{/each}
							</div>
						</fieldset>
						{#if letter.source}<Input
								id="letter-source-detail"
								label={t(
									letter.source === 'jobPortal'
										? 'letterEditor.portal'
										: letter.source === 'referral'
											? 'letterEditor.referrer'
											: 'letterEditor.sourceDetail'
								)}
								value={letter.sourceDetail}
								maxlength={LETTER_LIMITS.sourceDetail}
								oninput={(event) =>
									change({ sourceDetail: event.currentTarget.value }, 'sourceDetail')}
							/>{#if letter.source === 'jobPortal'}<div class="portal-options">
									{#each ['JobStreet', 'LinkedIn', 'Glints', 'Kalibrr'] as portal (portal)}<button
											type="button"
											onclick={() => change({ sourceDetail: portal })}>{portal}</button
										>{/each}
								</div>{/if}{/if}
						<details ontoggle={(event) => (jobPostOpen = event.currentTarget.open)}>
							<summary>{t('letterEditor.jobPostToggle')}</summary>{#if Textarea}<Textarea
									id="letter-job-post"
									label={t('letterEditor.jobPost')}
									bind:value={jobPost}
									maxlength={LETTER_LIMITS.jobPost}
									hint={t('letterEditor.jobPostHint')}
									rows={5}
								/>{:else if jobPostOpen}{@render textareaStatus()}{/if}
						</details>
					{:else if step === 1}
						{#if ContentFields}<ContentFields
								cv={store.cv}
								{letter}
								onchange={change}
							/>{:else if fieldsFailed}<p role="alert">{t('letterEditor.loadError')}</p>
							<Button onclick={() => void loadFields(step)}>{t('atsPanel.retry')}</Button>{:else}<p
								role="status"
							>
								{t('common.loading')}
							</p>{/if}
					{:else}
						{#if AttachmentFields}<AttachmentFields cv={store.cv} {letter} onchange={change}
								>{#snippet finish()}{@render finishControls('form')}{/snippet}</AttachmentFields
							>{:else if fieldsFailed}<p role="alert">{t('letterEditor.loadError')}</p>
							<Button onclick={() => void loadFields(step)}>{t('atsPanel.retry')}</Button>{:else}<p
								role="status"
							>
								{t('common.loading')}
							</p>{/if}
					{/if}
				</section>
				<div hidden={step !== 1} class="ai-tools">
					{#if AiPanel}<AiPanel
							{store}
							{letterId}
							{jobPost}
							bind:this={ai}
							onbusy={(value) => (aiBusy = value)}
							onapply={(keys) => (aiKeys = [...new Set([...aiKeys, ...keys])])}
						/>{:else}<Button
							id="letter-ai-request"
							variant="secondary"
							disabled={aiLoading ||
								!letter.position.trim() ||
								!letter.company.trim() ||
								aiSession.quota?.remaining === 0}
							onclick={() => void askAi()}
							>{t(aiLoading ? 'common.loading' : 'letterEditor.ai')}</Button
						>
						<p class="hint">
							{t(
								aiFailed
									? 'ai.errors.unavailable'
									: !letter.position.trim() || !letter.company.trim()
										? 'letterEditor.aiNeedFields'
										: 'letterEditor.aiUnknownQuota'
							)}
						</p>{/if}
				</div>
				<div class="step-actions">
					{#if step > 0}<Button variant="secondary" onclick={() => void next(step - 1)}
							>{t('common.back')}</Button
						>{/if}{#if step < 2}<Button onclick={() => void next(step + 1)}
							>{t('common.next')}</Button
						>{/if}
				</div>
				<details
					id="letter-concise"
					open={conciseOpen}
					ontoggle={(event) => (conciseOpen = event.currentTarget.open)}
				>
					<summary>{t('concisePanel.title')}</summary>
					<div data-testid="letter-concise">
						{#if localReport && reportSignature === sourceSignature && ConcisePanel}<ConcisePanel
								report={localReport}
								locale={letter.locale}
								resetKey={`${store.cv.id}:${letterId}:${store.externalChange ?? ''}`}
								pointLabel={(point) =>
									t(
										`letter.blocks.${LETTER_TEXT_KEYS.find((key) => key === point.key) ?? 'opening'}`
									)}
								issueMessage={(point, issue) =>
									t(letterConciseMessageKey(issue), {
										fillers: point.fillers.join('", "'),
										words: point.words
									})}
								onpointfix={(point) => {
									const key = LETTER_TEXT_KEYS.find((key) => key === point.key);
									if (key) void showParagraph(key);
								}}
								onapply={applyConcise}
								onundo={() => store.undo()}
								onreport={(report) => (displayReport = report)}
								allowDismiss
							/>{:else if conciseLoading}<p role="status">
								{t('common.loading')}
							</p>{:else if conciseFailed}<p role="alert">{t('ai.errors.unavailable')}</p>
							<Button variant="secondary" onclick={() => void loadConcise()}
								>{t('atsPanel.retry')}</Button
							>{/if}
					</div>
				</details>
				{#if manualEmail}<div class="manual-email">
						<p>{t('letterEditor.copyFallback')}</p>
						{#if Textarea}<Textarea
								label={t('letterEditor.emailText')}
								value={manualEmail}
								readonly
								rows={8}
							/>{:else}{@render textareaStatus()}{/if}
					</div>{/if}
			</div>
			{#if desktop}<aside class="preview-column" aria-label={t('letterEditor.preview')}>
					{@render finishControls('preview')}
					<div class="preview-actions">
						<Button
							variant="ghost"
							onclick={() => void askAi()}
							disabled={aiLoading ||
								aiBusy ||
								!letter.position.trim() ||
								!letter.company.trim() ||
								aiSession.quota?.remaining === 0 ||
								Boolean(ai && !ai.canAsk())}>{t('letterEditor.ai')}</Button
						>
						{@render appearance()}
					</div>
					{#if !letter.position.trim() || !letter.company.trim()}<p class="hint">
							{t('letterEditor.aiNeedFields')}
						</p>{:else if aiSession.quota?.remaining === 0}<p class="hint">
							{t('ai.errors.quota')}
						</p>{/if}
					{#if aiBusy}<div class="ai-skeleton" role="status">
							<span>{t('letterEditor.aiLoadingPreview')}</span><i></i><i></i><i></i>
						</div>{/if}
					<LetterPaper
						{store}
						{letterId}
						report={currentReport}
						{aiKeys}
						onediting={editingChanged}
						bind:this={paper}
					/>
				</aside>{/if}
		</div>
		{#if !desktop}<div class="mobile-preview">
				<Button onclick={() => (previewOpen = true)}>{t('letterEditor.viewLetter')}</Button>
			</div>
			<BottomSheet bind:open={previewOpen} title={t('letterEditor.preview')}
				><div class="sheet-paper">
					{@render finishControls('sheet')}<Button
						variant="ghost"
						onclick={() => {
							previewOpen = false;
							void askAi();
						}}
						disabled={aiLoading ||
							aiBusy ||
							!letter.position.trim() ||
							!letter.company.trim() ||
							aiSession.quota?.remaining === 0 ||
							Boolean(ai && !ai.canAsk())}>{t('letterEditor.ai')}</Button
					>{@render appearance()}{#if previewOpen}<LetterPaper
							{store}
							{letterId}
							report={currentReport}
							{aiKeys}
							onediting={editingChanged}
							bind:this={paper}
						/>{/if}
				</div></BottomSheet
			>{/if}
	</article>
{/if}

<style>
	.letter-editor {
		max-width: 1440px;
		margin: 0 auto;
		padding: 1.25rem 1rem 6rem;
		overflow-wrap: anywhere;
	}
	.editor-heading {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 1.5rem;
	}
	h1 {
		font-size: clamp(1.5rem, 2.5vw, 2rem);
		line-height: 1.25;
		margin: 0.75rem 0;
	}
	h2 {
		font-size: 1.125rem;
		line-height: 1.5;
		margin: 0;
	}
	legend {
		font-size: 0.875rem;
		font-weight: 650;
		line-height: 1.5;
	}
	p {
		margin: 0.5rem 0;
		line-height: 1.65;
	}
	.editor-heading p,
	.hint {
		color: var(--color-text-muted);
		font-size: 0.8125rem;
	}
	a,
	.text-link {
		color: var(--color-brand-ink);
		text-underline-offset: 3px;
	}
	a {
		font-size: 0.875rem;
	}
	.history {
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}
	.history span {
		font-size: 0.75rem;
		color: var(--color-text-muted);
	}
	.cv-note {
		padding: 1rem;
		background: var(--color-mint-50);
		border-radius: var(--radius-md);
		font-size: 0.875rem;
	}
	.editor-grid,
	.form-column {
		display: grid;
		gap: 1.25rem;
		min-width: 0;
	}
	.steps {
		display: flex;
		list-style: none;
		padding: 0;
		margin: 0;
		gap: 0.25rem;
	}
	.steps li {
		flex: 1;
		min-width: 0;
	}
	.steps button {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
		min-height: 72px;
		border: 0;
		border-radius: var(--radius-md);
		background: transparent;
		color: var(--color-text-muted);
		font-size: 0.75rem;
		padding: 0.5rem 0.25rem;
	}
	.steps button > span {
		display: grid;
		place-items: center;
		width: 28px;
		height: 28px;
		border: 1px solid var(--color-control-border);
		border-radius: 50%;
		font-size: 0.875rem;
	}
	.steps button[aria-current] {
		color: var(--color-brand-ink);
		font-weight: 700;
		background: var(--color-brand-50);
	}
	.steps button[aria-current] > span {
		background: var(--color-brand);
		color: var(--color-ink);
		border-color: transparent;
	}
	.step-panel {
		display: grid;
		gap: 1.25rem;
		padding: 1.25rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
		min-width: 0;
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
	.source-options {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	.source-options label {
		display: flex;
		align-items: center;
		min-height: 44px;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--color-control-border);
		border-radius: var(--radius-pill);
		font-size: 0.8125rem;
	}
	.source-options label:has(:checked) {
		background: var(--color-mint-50);
		border-color: var(--color-brand-ink);
	}
	input[type='radio'] {
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
	.portal-options {
		display: flex;
		gap: 0.375rem;
		flex-wrap: wrap;
	}
	.portal-options button {
		min-height: 44px;
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-pill);
		background: var(--color-mint-50);
		color: var(--color-text);
		font-size: 0.8125rem;
	}
	.step-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
	}
	.finish {
		display: grid;
		gap: 0.75rem;
		padding: 1rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
	}
	.finish-heading {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		min-height: 44px;
	}
	.check-toggle {
		min-height: 44px;
		padding: 0.5rem;
		border: 0;
		background: transparent;
		color: var(--color-brand-ink);
		font-size: 0.8125rem;
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	.preview-actions {
		align-items: start;
	}
	.preview-actions .appearance {
		flex: 1;
		min-width: 12rem;
		padding: 0 0.75rem;
	}
	.checks {
		display: grid;
		gap: 0.25rem;
		padding: 0;
		margin: 0;
		list-style: none;
	}
	.checks button {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		min-height: 44px;
		border: 0;
		padding: 0.5rem;
		background: transparent;
		text-align: left;
		color: var(--color-text-muted);
		font-size: 0.8125rem;
		line-height: 1.5;
	}
	.checks button > span:first-child {
		display: grid;
		place-items: center;
		width: 20px;
		height: 20px;
		border: 1px solid currentColor;
		border-radius: 50%;
		flex-shrink: 0;
		font-weight: 700;
	}
	.checks .error,
	.error {
		color: var(--color-danger);
	}
	.error {
		font-size: 0.8125rem;
		margin: 0;
		line-height: 1.5;
	}
	.download-actions,
	.preview-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	.text-link {
		text-align: left;
		min-height: 44px;
		border: 0;
		padding: 0;
		background: transparent;
		font-size: 0.8125rem;
		line-height: 1.5;
	}
	.appearance {
		padding: 1rem;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
	}
	.ai-tools {
		padding: 0 1.25rem;
	}
	.ai-tools[hidden] {
		display: none;
	}
	.mobile-preview {
		position: fixed;
		z-index: 20;
		bottom: calc(1rem + env(safe-area-inset-bottom, 0px));
		right: 1rem;
	}
	.sheet-paper {
		display: grid;
		gap: 1rem;
		min-width: 0;
	}
	.ai-skeleton {
		display: grid;
		gap: 0.75rem;
		padding: 1rem;
		background: var(--color-mint-50);
		border-radius: var(--radius-md);
		font-size: 0.8125rem;
	}
	.ai-skeleton i {
		display: block;
		height: 0.75rem;
		background: var(--color-border);
		border-radius: 4px;
		width: 90%;
	}
	.ai-skeleton i:last-child {
		width: 65%;
	}
	@media (min-width: 768px) {
		.letter-editor {
			padding: 2rem 1.5rem 6rem;
		}
	}
	@media (min-width: 1024px) {
		.editor-grid {
			grid-template-columns: minmax(360px, 420px) minmax(0, 1fr);
			gap: 2rem;
			align-items: start;
		}
		.preview-column {
			display: grid;
			gap: 1rem;
			min-width: 0;
			position: sticky;
			top: 5rem;
			max-height: calc(100dvh - 6rem);
			overflow-y: auto;
			overscroll-behavior: contain;
			padding: 0.125rem 0.25rem 1rem;
		}
		.letter-editor {
			padding-bottom: 2rem;
		}
	}
</style>
