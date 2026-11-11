<script lang="ts">
	import { onDestroy, onMount, tick, untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { AiConverted, Converted } from '#lib/core/convert/index.ts';
	import type { AiReviewInput } from '#lib/core/ai/types.ts';
	import type { ExtractedCv } from '#lib/core/scan/types.ts';
	import type { CVDocument } from '#lib/core/schema/types.ts';
	import { LIMITS } from '#lib/core/schema/limits.ts';
	import { normalize } from '#lib/core/suggest/index.ts';
	import { incognito } from '#lib/core/storage/incognito.svelte.ts';
	import { t, type MessageKey } from '#lib/i18n/index.svelte.ts';
	import Button from '#lib/ui/Button.svelte';
	import Dialog from '#lib/ui/Dialog.svelte';
	import { toast } from '#lib/ui/toast.svelte.ts';
	import AiQuota from '#lib/ui/ai/AiQuota.svelte';
	import {
		aiSession,
		loadAiModule,
		refreshAiQuota,
		sameAiSession,
		syncAiSession,
		updateAiQuota,
		type AiModule
	} from '#lib/ui/ai/session.svelte.ts';
	import ConversionReview from './ConversionReview.svelte';

	type ConvertModule = typeof import('#lib/core/convert/index.ts');
	type StorageModule = typeof import('#lib/core/storage/index.ts');
	type Stage =
		| 'idle'
		| 'preparing'
		| 'consent'
		| 'sending'
		| 'working'
		| 'local'
		| 'review'
		| 'saving'
		| 'saved';
	type Guard = {
		request: number;
		epoch: number;
		active: boolean;
		expiredAt: string | undefined;
		source: string;
		wipe: number;
	};
	type AiOperation = {
		guard: Guard;
		module: ConvertModule;
		extracted: Pick<ExtractedCv, 'text'>;
		targetRole: string;
		jobPost: string;
	};
	let {
		extracted,
		jobPost,
		targetRole,
		onstagechange
	}: {
		extracted: ExtractedCv;
		jobPost: string;
		targetRole: string;
		onstagechange?: (engaged: boolean) => void;
	} = $props();
	const uid = $props.id();
	let panel = $state<HTMLElement>();
	let progress = $state<HTMLDivElement>();
	let aiModule = $state.raw<AiModule>();
	let aiLoadFailed = $state(false);
	let stage = $state<Stage>('idle');
	let result = $state.raw<Converted | AiConverted>();
	let selectedSkills = $state<string[]>([]);
	let consentOpen = $state(false);
	let consentInput = $state.raw<AiReviewInput>();
	let errorKey = $state<MessageKey>();
	let rewarding = $state(false);
	let cancelled = $state(false);
	let savedId = $state('');
	let mounted = true;
	let request = 0;
	let wipe = 0;
	let notified = false;
	let interacted = $state(false);
	let writing = $state(false);
	let writingId = '';
	let pending: AiOperation | undefined;
	let storage: StorageModule | undefined;
	let convertRequest: Promise<ConvertModule> | undefined;
	let stopExternal: (() => void) | undefined;
	let stopExpire: (() => void) | undefined;
	const signature = $derived(JSON.stringify({ text: extracted.text, jobPost, targetRole }));
	let seenSignature = untrack(() => signature);
	let seenEpoch = untrack(() => aiSession.epoch);
	const exhausted = $derived(aiSession.quota?.remaining === 0);
	const expired = $derived(incognito.active && Boolean(incognito.expiredAt));
	const processing = $derived(['preparing', 'sending', 'working', 'local'].includes(stage));
	const input = $derived(aiModule?.aiReviewInputFromScan(extracted, jobPost, targetRole));
	const canUseAi = $derived(Boolean(input?.cvText.trim()));
	const reviewResult = $derived.by(() => {
		if (!result || !('suggestedSkills' in result)) return result;
		const existing = Object.values(result.cv.skills).flat().map(normalize);
		const seen: string[] = [];
		const suggestedSkills = result.suggestedSkills.filter((skill) => {
			const key = normalize(skill.trim().slice(0, LIMITS.title));
			if (!key || existing.includes(key) || seen.includes(key)) return false;
			seen.push(key);
			return true;
		});
		return { ...result, suggestedSkills };
	});

	onMount(() => {
		syncAiSession();
		void prepareAi();
		void import('#lib/core/storage/index.ts')
			.then((module) => {
				if (!mounted) return;
				storage = module;
				stopExternal = module.onExternalChange((event) => {
					if (
						event.type !== 'wiped' &&
						!(event.type === 'cv-removed' && event.id === (writingId || savedId))
					)
						return;
					wipe += 1;
					if (mounted) invalidate();
				});
			})
			.catch(() => {});
		stopExpire = incognito.onExpire(() => {
			wipe += 1;
			if (mounted) invalidate();
		});
		function visible() {
			if (!interacted || document.visibilityState !== 'visible') return;
			const guard = capture();
			const before = aiSession.quota?.remaining ?? 0;
			void refreshAiQuota().then(() => {
				if (fresh(guard) && (aiSession.quota?.remaining ?? 0) > before)
					toast.success(t('aiAssist.quotaAdded'));
			});
		}
		document.addEventListener('visibilitychange', visible);
		return () => document.removeEventListener('visibilitychange', visible);
	});
	onDestroy(() => {
		mounted = false;
		invalidate();
		if (!writing) stopListeners();
	});
	$effect(() => {
		syncAiSession();
		const expired = incognito.expiredAt;
		void expired;
		if (seenSignature !== signature || seenEpoch !== aiSession.epoch) {
			seenSignature = signature;
			seenEpoch = aiSession.epoch;
			invalidate();
		}
	});
	$effect(() => {
		if (stage === 'consent' && !consentOpen) cancel();
	});
	function stopListeners() {
		stopExternal?.();
		stopExternal = undefined;
		stopExpire?.();
		stopExpire = undefined;
	}
	function changeStage(next: Stage) {
		stage = next;
		const engaged = next !== 'idle';
		if (notified !== engaged) {
			notified = engaged;
			if (mounted) onstagechange?.(engaged);
		}
	}
	function invalidate() {
		request += 1;
		pending = undefined;
		result = undefined;
		selectedSkills = [];
		consentInput = undefined;
		consentOpen = false;
		errorKey = undefined;
		rewarding = false;
		cancelled = false;
		savedId = '';
		interacted = false;
		changeStage('idle');
	}
	function capture(): Guard {
		return {
			request,
			epoch: aiSession.epoch,
			active: incognito.active,
			expiredAt: incognito.expiredAt,
			source: signature,
			wipe
		};
	}
	function fresh(guard: Guard) {
		return (
			mounted &&
			request === guard.request &&
			signature === guard.source &&
			wipe === guard.wipe &&
			incognito.expiredAt === guard.expiredAt &&
			sameAiSession(guard.epoch, guard.active)
		);
	}
	function loadConvert() {
		return (convertRequest ??= import('#lib/core/convert/index.ts').catch((error: unknown) => {
			convertRequest = undefined;
			throw error;
		}));
	}
	async function prepareAi() {
		aiLoadFailed = false;
		try {
			const module = await loadAiModule();
			if (mounted) aiModule = module;
		} catch {
			if (mounted) aiLoadFailed = true;
		}
	}
	async function focusProgress(guard: Guard) {
		await tick();
		if (fresh(guard)) progress?.focus({ preventScroll: true });
	}
	async function showResult(converted: Converted | AiConverted, guard: Guard) {
		if (!fresh(guard)) return;
		result = converted;
		selectedSkills = [];
		consentInput = undefined;
		pending = undefined;
		changeStage('review');
		await tick();
		if (fresh(guard))
			panel
				?.querySelector<HTMLElement>('[data-testid="conversion-review"]')
				?.focus({ preventScroll: true });
	}
	function showAiError(error: unknown) {
		if (aiModule && error instanceof aiModule.AiError) {
			errorKey = aiModule.aiErrorMessageKey(error.code);
			if (error.quota) updateAiQuota(error.quota);
		} else errorKey = 'ai.errors.unavailable';
	}
	async function startLocal() {
		if (stage !== 'idle' || expired || writing) return;
		request += 1;
		const guard = capture();
		const file = { text: extracted.text };
		const role = targetRole;
		errorKey = undefined;
		cancelled = false;
		changeStage('local');
		void focusProgress(guard);
		try {
			const module = await loadConvert();
			if (fresh(guard)) await showResult(module.convertLocally(file, { targetRole: role }), guard);
		} catch {
			if (fresh(guard)) {
				errorKey = 'convertAts.localFailed';
				changeStage('idle');
			}
		}
	}
	async function askAi() {
		if (stage !== 'idle' || !canUseAi || exhausted || expired || writing) return;
		request += 1;
		const guard = capture();
		const file = { text: extracted.text };
		const role = targetRole;
		const post = jobPost;
		interacted = true;
		errorKey = undefined;
		cancelled = false;
		changeStage('preparing');
		void focusProgress(guard);
		try {
			const module = await loadConvert();
			if (!fresh(guard) || !aiModule) return;
			if (!aiSession.quota) await refreshAiQuota();
			if (!fresh(guard)) return;
			if (!aiSession.quota) {
				errorKey = 'ai.errors.unavailable';
				changeStage('idle');
				return;
			}
			if (exhausted) {
				changeStage('idle');
				return;
			}
			pending = { guard, module, extracted: file, targetRole: role, jobPost: post };
			consentInput = aiModule.aiReviewInputFromScan(file, post, role);
			if (aiSession.consented) void runAi(pending);
			else {
				consentOpen = true;
				changeStage('consent');
			}
		} catch (error) {
			if (fresh(guard)) {
				showAiError(error);
				changeStage('idle');
			}
		}
	}
	function accept() {
		if (!pending || !consentOpen || !fresh(pending.guard)) return;
		aiSession.consented = true;
		consentOpen = false;
		void runAi(pending);
	}
	async function runAi(operation: AiOperation) {
		if (!fresh(operation.guard) || !aiSession.consented || exhausted) return;
		changeStage('sending');
		void focusProgress(operation.guard);
		try {
			const converted = await operation.module.convertWithAi(operation.extracted, {
				targetRole: operation.targetRole,
				jobPost: operation.jobPost,
				onStarted: (quota) => {
					if (!fresh(operation.guard)) return;
					updateAiQuota(quota);
					changeStage('working');
				}
			});
			if (!fresh(operation.guard)) return;
			updateAiQuota(converted.quota);
			await showResult(converted, operation.guard);
		} catch (error) {
			if (fresh(operation.guard)) {
				pending = undefined;
				consentInput = undefined;
				showAiError(error);
				changeStage('idle');
			}
		}
	}
	function cancel() {
		if (stage === 'saving') return;
		const wasAi = interacted;
		invalidate();
		interacted = wasAi;
		cancelled = true;
		void tick().then(() => {
			if (mounted) panel?.querySelector<HTMLButtonElement>('.ai-action')?.focus();
		});
	}
	function toggleSkill(skill: string) {
		if (
			stage !== 'review' ||
			!reviewResult ||
			!('suggestedSkills' in reviewResult) ||
			!reviewResult.suggestedSkills.includes(skill)
		)
			return;
		if (selectedSkills.includes(skill))
			selectedSkills = selectedSkills.filter((value) => value !== skill);
		else if (result && result.cv.skills.hard.length + selectedSkills.length < LIMITS.skillsPerGroup)
			selectedSkills = [...selectedSkills, skill];
		else toast.info(t('wizard.skillsLimit', { max: LIMITS.skillsPerGroup }));
	}
	function documentToSave(cv: CVDocument) {
		const document = structuredClone(cv);
		const existing = Object.values(document.skills).flat().map(normalize);
		for (const skill of selectedSkills) {
			const value = skill.trim().slice(0, LIMITS.title);
			const key = normalize(value);
			if (value && !existing.includes(key) && document.skills.hard.length < LIMITS.skillsPerGroup) {
				document.skills.hard.push(value);
				existing.push(key);
			}
		}
		return document;
	}
	async function discardStaleSave(module: StorageModule, document: CVDocument, guard: Guard) {
		// The repository chooses its backend at call time: never send private cleanup to normal storage.
		if (incognito.active === guard.active) await module.cvRepo.remove(document.id).catch(() => {});
	}
	async function save() {
		if (stage !== 'review' || !result || writing) return;
		request += 1;
		const guard = capture();
		const document = documentToSave(result.cv);
		errorKey = undefined;
		changeStage('saving');
		try {
			const module = storage ?? (await import('#lib/core/storage/index.ts'));
			if (!fresh(guard)) return;
			storage = module;
			writing = true;
			writingId = document.id;
			await module.cvRepo.save(document);
			if (!fresh(guard)) {
				await discardStaleSave(module, document, guard);
				return;
			}
			savedId = document.id;
			try {
				await goto(resolve('/(app)/cv/[id]/edit', { id: document.id }));
			} catch {
				if (fresh(guard)) {
					result = undefined;
					errorKey = 'convertAts.openFailed';
					changeStage('saved');
				}
			}
		} catch {
			if (fresh(guard)) {
				errorKey = 'convertAts.saveFailed';
				changeStage('review');
			}
		} finally {
			writing = false;
			writingId = '';
			if (!mounted) stopListeners();
		}
	}
	async function openEditor() {
		if (stage !== 'saved' || !savedId) return;
		const guard = capture();
		const id = savedId;
		try {
			await goto(resolve('/(app)/cv/[id]/edit', { id }));
		} catch {
			if (fresh(guard)) errorKey = 'convertAts.openFailed';
		}
	}
	function reward() {
		if (
			!aiModule ||
			!input ||
			expired ||
			writing ||
			stage !== 'idle' ||
			rewarding ||
			!exhausted ||
			!aiSession.quota?.rewards?.remaining
		)
			return;
		interacted = true;
		const guard = capture();
		rewarding = true;
		errorKey = undefined;
		const operation = aiModule.aiClient.openRewardAd(input.locale);
		void operation
			.catch((error: unknown) => {
				if (fresh(guard)) showAiError(error);
			})
			.finally(() => {
				if (fresh(guard)) rewarding = false;
			});
	}
</script>

<section
	class="convert-panel"
	data-testid="convert-panel"
	data-convert-stage={stage}
	aria-labelledby={`${uid}-title`}
	bind:this={panel}
>
	<h2 id={`${uid}-title`}>{t('convertAts.title')}</h2>
	<AiQuota
		id={`${uid}-quota`}
		{rewarding}
		disabled={stage !== 'idle' || !aiModule || expired || writing}
		onreward={reward}
	/>
	{#if writing && stage !== 'saving'}<p class="hint" role="status">{t('convertAts.saving')}</p>{/if}
	{#if stage === 'saved' && savedId}
		<p class="error" role="alert">{t('convertAts.openFailed')}</p>
		<Button onclick={() => void openEditor()}>{t('convertAts.openEditor')}</Button>
	{:else if reviewResult}
		{#key reviewResult.cv.id}<ConversionReview
				result={reviewResult}
				{selectedSkills}
				ontoggle={toggleSkill}
				onsave={() => void save()}
				oncancel={cancel}
				saving={stage === 'saving' || writing}
				error={errorKey ? t(errorKey) : undefined}
				incognitoActive={incognito.active}
			/>{/key}
	{:else}
		<p class="description">{t('convertAts.description')}</p>
		{#if expired}<p class="hint" role="status">{t('incognito.expiredMessage')}</p>
			<Button href="/buat" variant="secondary">{t('convertAts.createNew')}</Button>{/if}
		{#if !aiSession.quota}<p class="hint" id={`${uid}-quota`}>
				{t('convertAts.quotaUnknown')}
			</p>{/if}
		{#if aiModule && !canUseAi}<p class="hint" id={`${uid}-no-text`}>
				{t('atsCheck.ai.noText')}
			</p>{/if}
		<div class="actions">
			<button
				type="button"
				class="ai-action"
				aria-disabled={stage !== 'idle' || !canUseAi || exhausted || expired || writing}
				aria-describedby={`${uid}-quota${aiModule && !canUseAi ? ` ${uid}-no-text` : ''}`}
				onclick={() => void askAi()}>{t('convertAts.ai')}</button
			>
			<Button
				variant="secondary"
				disabled={stage !== 'idle' || expired || writing}
				onclick={() => void startLocal()}>{t('convertAts.local')}</Button
			>
		</div>
		<p class="hint">{t('convertAts.localHint')}</p>
		{#if aiLoadFailed}<p class="error" role="alert">
				{t('ai.errors.unavailable')}
				<Button variant="ghost" onclick={prepareAi}>{t('convertAts.retry')}</Button>
			</p>{/if}
		{#if errorKey}<p class="error" role="alert">{t(errorKey)}</p>{/if}
		{#if processing}<div
				class="progress"
				data-testid="convert-status"
				data-stage={stage}
				role="status"
				aria-live="polite"
				tabindex="-1"
				bind:this={progress}
			>
				<p>
					{t(
						stage === 'working'
							? 'convertAts.working'
							: stage === 'sending'
								? 'convertAts.sending'
								: stage === 'local'
									? 'convertAts.localWorking'
									: 'convertAts.preparing'
					)}
				</p>
				{#if stage === 'sending' || stage === 'working'}<p class="hint">
						{t('convertAts.processingHint')}
					</p>
					<p class="hint">{t('convertAts.cancelHint')}</p>{/if}
				<Button variant="ghost" onclick={cancel}>{t('common.cancel')}</Button>
			</div>
		{:else if cancelled}<p class="hint" role="status">
				{t('convertAts.cancelled')}{#if interacted}
					{t('convertAts.cancelHint')}{/if}
			</p>{/if}
	{/if}
</section>

{#if consentOpen && consentInput}
	<Dialog bind:open={consentOpen} title={t('convertAts.consentTitle')}>
		<p>{t('convertAts.consentIntro')}</p>
		<p>{t('convertAts.contactsNotSent')}</p>
		<p>{t('atsCheck.ai.contextSent')}</p>
		<h3 id={`${uid}-input-label`}>{t('atsCheck.ai.sentText')}</h3>
		<div
			class="input-preview"
			role="textbox"
			aria-readonly="true"
			aria-multiline="true"
			tabindex="0"
			aria-labelledby={`${uid}-input-label`}
		>
			<pre data-testid="convert-consent-input">{consentInput.cvText}</pre>
		</div>
		{#snippet footer()}<Button variant="secondary" onclick={cancel}>{t('common.cancel')}</Button
			><Button onclick={accept}>{t('atsCheck.ai.send')}</Button>{/snippet}
	</Dialog>
{/if}

<style>
	.convert-panel {
		min-width: 0;
		margin-block: 1.5rem;
		padding: 1.25rem;
		background: var(--color-mint-50);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		overflow-wrap: anywhere;
	}
	h2 {
		font-size: 1.25rem;
		font-weight: 600;
	}
	h3 {
		margin-top: 1rem;
		font-size: 1rem;
		font-weight: 600;
	}
	p {
		line-height: 1.6;
	}
	.description {
		margin-top: 0.75rem;
	}
	.hint {
		margin-top: 0.5rem;
		color: var(--color-text-muted);
		font-size: 0.8125rem;
	}
	.error {
		margin-block: 1rem;
		color: var(--color-danger);
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-top: 1rem;
	}
	.ai-action {
		min-height: 44px;
		max-width: 100%;
		padding: 0.625rem 1rem;
		border: 0;
		border-radius: var(--radius-md);
		background: var(--color-brand);
		color: var(--color-on-brand);
		font: inherit;
		font-size: 0.875rem;
		font-weight: 600;
		cursor: pointer;
	}
	.ai-action[aria-disabled='true'] {
		opacity: 0.55;
		cursor: default;
	}
	.ai-action:focus-visible {
		outline: 2px solid var(--color-focus);
		outline-offset: 2px;
	}
	.progress {
		margin-top: 1rem;
	}
	.input-preview {
		max-height: 18rem;
		overflow: auto;
		margin-block: 0.75rem 1rem;
		padding: 0.75rem;
		border-radius: var(--radius-md);
		background: var(--color-mint-50);
		color: var(--color-text);
		font-size: 0.8125rem;
		line-height: 1.6;
		overflow-wrap: anywhere;
	}
	.input-preview pre {
		margin: 0;
		font: inherit;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
</style>
