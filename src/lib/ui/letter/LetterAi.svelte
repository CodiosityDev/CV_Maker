<script lang="ts">
	import { onDestroy, onMount, untrack } from 'svelte';
	import type { CvStore } from '#lib/core/store/cv-store.svelte.ts';
	import {
		aiCanWriteLetter,
		aiLetterInput,
		applyAiLetter,
		findLetter,
		letterBlockSource,
		LETTER_TEXT_KEYS,
		richToPlain,
		updateLetter,
		type LetterTextKey
	} from '#lib/core/letter/index.ts';
	import type { LetterResult } from '#lib/core/ai/types.ts';
	import { incognito } from '#lib/core/storage/index.ts';
	import { t, type MessageKey } from '#lib/i18n/index.svelte.ts';
	import Button from '#lib/ui/Button.svelte';
	import Dialog from '#lib/ui/Dialog.svelte';
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
	import { toast } from '#lib/ui/toast.svelte.ts';

	let {
		store,
		letterId,
		jobPost,
		onbusy,
		onapply
	}: {
		store: CvStore;
		letterId: string;
		jobPost: string;
		onbusy?: (busy: boolean) => void;
		onapply?: (keys: LetterTextKey[]) => void;
	} = $props();
	const uid = $props.id();
	const letter = $derived(findLetter(store.cv, letterId));
	const signature = $derived(JSON.stringify([store.cv, letterId, jobPost, store.externalChange]));
	const input = $derived.by(() => {
		if (!letter) return;
		const raw = aiLetterInput(store.cv, letter, jobPost);
		// The client collapses whitespace in these two titles before sending them.
		return {
			...raw,
			position: raw.position.replace(/\s+/g, ' ').trim(),
			company: raw.company.replace(/\s+/g, ' ').trim()
		};
	});
	const canWrite = $derived(letter && aiCanWriteLetter(letter));
	let module = $state.raw<AiModule>();
	let busy = $state(false);
	let preparing = $state(false);
	let rewarding = $state(false);
	let consent = $state(false);
	let errorKey = $state<MessageKey>();
	let result = $state.raw<LetterResult>();
	let used = $state<LetterTextKey[]>([]);
	let blocked = $state(false);
	const exhausted = $derived(aiSession.quota?.remaining === 0 || blocked);
	let blockedUntil: string | undefined;
	let mounted = true;
	let request = 0;
	let observed = '';
	let observedEpoch = untrack(() => aiSession.epoch);
	let consentSignature = '';
	let consentEpoch = -1;
	let consentMode = false;
	const offered = $derived(
		LETTER_TEXT_KEYS.filter((key) => result?.[key].trim() && !used.includes(key))
	);
	export function canAsk() {
		return Boolean(module && canWrite && !busy && !preparing && !exhausted);
	}

	onMount(() => {
		syncAiSession();
		void prepare();
		void refreshAiQuota();
		const visible = () => {
			if (document.visibilityState !== 'visible') return;
			const before = aiSession.quota?.remaining ?? 0;
			const epoch = aiSession.epoch,
				mode = incognito.active;
			void refreshAiQuota().then(() => {
				if (mounted && sameAiSession(epoch, mode) && (aiSession.quota?.remaining ?? 0) > before) {
					blocked = false;
					if (errorKey === 'ai.errors.quota') errorKey = undefined;
				}
			});
		};
		document.addEventListener('visibilitychange', visible);
		return () => document.removeEventListener('visibilitychange', visible);
	});
	onDestroy(() => {
		mounted = false;
		request++;
	});
	$effect(() => {
		syncAiSession();
		const current = signature;
		const epoch = aiSession.epoch;
		if (observed !== current || observedEpoch !== epoch) {
			observed = current;
			if (observedEpoch !== epoch) {
				blocked = false;
				blockedUntil = undefined;
			}
			observedEpoch = epoch;
			request++;
			busy = false;
			preparing = false;
			consent = false;
			result = undefined;
			used = [];
			errorKey = undefined;
		}
	});
	$effect(() => {
		if (
			blockedUntil &&
			aiSession.quota &&
			Date.parse(aiSession.quota.resetsAt) > Date.parse(blockedUntil)
		) {
			blocked = false;
			blockedUntil = undefined;
		}
	});
	$effect(() => {
		const value = busy;
		untrack(() => onbusy?.(value));
	});
	async function prepare() {
		try {
			const loaded = await loadAiModule();
			if (mounted) module = loaded;
		} catch {
			if (mounted) errorKey = 'ai.errors.unavailable';
		}
	}
	function fresh(token: number, epoch: number, mode: boolean, content: string) {
		return (
			mounted &&
			token === request &&
			sameAiSession(epoch, mode) &&
			content === signature &&
			store.externalChange !== 'removed' &&
			Boolean(letter)
		);
	}
	function showError(error: unknown) {
		if (module && error instanceof module.AiError) {
			if (error.quota) updateAiQuota(error.quota);
			if (error.code === 'quota') {
				blocked = true;
				blockedUntil = aiSession.quota?.resetsAt;
			}
			errorKey = module.aiErrorMessageKey(error.code);
		} else errorKey = 'ai.errors.unavailable';
	}
	export async function ask() {
		if (!canWrite || busy || preparing || exhausted) return;
		if (!module) await prepare();
		if (!module || !mounted || !canWrite || busy || preparing || exhausted) return;
		const token = ++request,
			epoch = aiSession.epoch,
			mode = incognito.active,
			content = signature;
		errorKey = undefined;
		if (!aiSession.quota) {
			preparing = true;
			await refreshAiQuota();
			if (!fresh(token, epoch, mode, content)) return;
			preparing = false;
		}
		if (!fresh(token, epoch, mode, content) || exhausted) return;
		consentSignature = content;
		consentEpoch = epoch;
		consentMode = mode;
		consent = true;
	}
	function cancel() {
		request++;
		busy = false;
		preparing = false;
		consent = false;
	}
	async function run() {
		if (
			!module ||
			!input ||
			!consent ||
			consentSignature !== signature ||
			!sameAiSession(consentEpoch, consentMode) ||
			exhausted
		)
			return;
		aiSession.consented = true;
		consent = false;
		const token = ++request,
			epoch = aiSession.epoch,
			mode = incognito.active,
			content = signature;
		const sent = input;
		busy = true;
		errorKey = undefined;
		result = undefined;
		used = [];
		try {
			const answer = await module.aiClient.letter(sent);
			// A cancelled response still consumed a use; only its text is ignored.
			if (sameAiSession(epoch, mode)) updateAiQuota(answer.quota);
			if (!fresh(token, epoch, mode, content)) return;
			result = answer.result;
			if (!offered.length) errorKey = 'letterEditor.aiEmpty';
		} catch (error) {
			if (sameAiSession(epoch, mode) && error instanceof module.AiError) {
				if (error.quota) updateAiQuota(error.quota);
				if (error.code === 'quota' && mounted) {
					blocked = true;
					blockedUntil = aiSession.quota?.resetsAt;
				}
			}
			if (fresh(token, epoch, mode, content)) showError(error);
		} finally {
			if (mounted && token === request) busy = false;
		}
	}
	function apply(keys: LetterTextKey[]) {
		if (
			!result ||
			!letter ||
			observed !== signature ||
			!sameAiSession(observedEpoch, incognito.active)
		)
			return;
		const selected = keys.filter((key) => offered.includes(key));
		if (!selected.length) return;
		const patch = applyAiLetter(result, selected);
		store.update((draft) => updateLetter(draft, letterId, patch));
		// Keep the remaining suggestions valid after this deliberate, atomic application.
		observed = signature;
		used = [...used, ...selected];
		onapply?.(selected);
		toast.info(t('letterEditor.aiApplied'), { labelKey: 'ui.undo', run: () => store.undo() });
	}
	function reward() {
		if (!module || rewarding || !exhausted) return;
		const epoch = aiSession.epoch,
			mode = incognito.active;
		rewarding = true;
		const operation = module.aiClient.openRewardAd(letter?.locale ?? store.cv.locale);
		void operation
			.catch((error) => {
				if (mounted && sameAiSession(epoch, mode)) showError(error);
			})
			.finally(() => {
				if (mounted && sameAiSession(epoch, mode)) rewarding = false;
			});
	}
</script>

<section class="letter-ai" aria-label={t('letterEditor.ai')}>
	<div class="actions">
		<Button
			id="letter-ai-request"
			variant="secondary"
			disabled={!module || !canWrite || busy || preparing || exhausted}
			loading={busy || preparing}
			onclick={() => void ask()}>{t(busy ? 'letterEditor.aiBusy' : 'letterEditor.ai')}</Button
		>
		{#if busy || preparing}<Button variant="ghost" onclick={cancel}
				>{t('letterEditor.aiCancel')}</Button
			>{/if}
	</div>
	<AiQuota
		quotaText={aiSession.quota
			? t('letterEditor.aiQuota', { remaining: aiSession.quota.remaining })
			: undefined}
		onreward={reward}
		{rewarding}
		disabled={busy || preparing}
	>
		{#if !aiSession.quota}<p class="hint">{t('letterEditor.aiUnknownQuota')}</p>{/if}
	</AiQuota>
	{#if !canWrite}<p class="hint">{t('letterEditor.aiNeedFields')}</p>{/if}
	{#if errorKey}<p role="alert" class="error">{t(errorKey)}</p>{:else if exhausted}<p class="hint">
			{t('ai.errors.quota')}
		</p>{/if}
	{#if !module && errorKey}<Button variant="ghost" onclick={prepare}>{t('atsPanel.retry')}</Button
		>{/if}
	{#if result && offered.length && letter}
		<div class="results" data-testid="letter-ai-results" aria-live="polite">
			<h3>{t('letterEditor.aiResult')}</h3>
			<p class="hint">{t('letterEditor.aiResultHint')}</p>
			<Button variant="secondary" onclick={() => apply([...offered])}
				>{t('letterEditor.applyAll')}</Button
			>
			{#each offered as key (key)}
				<article data-testid={`letter-ai-result-${key}`}>
					<h4>{t(`letter.blocks.${key}`)}</h4>
					<details>
						<summary>{t('letterEditor.currentParagraph')}</summary>
						<p>{richToPlain(letterBlockSource(store.cv, letter, key))}</p>
					</details>
					<p>{result[key]}</p>
					<div class="actions">
						<Button variant="secondary" onclick={() => apply([key])}
							>{t('letterEditor.apply')}</Button
						><Button variant="ghost" onclick={() => (used = [...used, key])}
							>{t('letterEditor.ignore')}</Button
						>
					</div>
				</article>
			{/each}
		</div>
	{/if}
</section>
{#if consent && input}
	<Dialog bind:open={consent} title={t('letterEditor.aiConsent')}>
		<div data-testid="letter-ai-consent">
			<p>{t('letterEditor.aiPrivacy')}</p>
			<p>
				{aiSession.quota
					? t('letterEditor.aiQuota', { remaining: aiSession.quota.remaining })
					: t('letterEditor.aiUnknownQuota')}
			</p>
			<label for={`${uid}-input`}>{t('letterEditor.aiPayload')}</label>
			<textarea
				id={`${uid}-input`}
				data-testid="letter-ai-input"
				readonly
				rows="12"
				value={JSON.stringify(input, null, 2)}></textarea>
		</div>
		{#snippet footer()}<Button variant="secondary" onclick={() => (consent = false)}
				>{t('common.cancel')}</Button
			><Button onclick={() => void run()}>{t('letterEditor.aiSend')}</Button>{/snippet}
	</Dialog>
{/if}

<style>
	.letter-ai {
		min-width: 0;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
	}
	.hint {
		color: var(--color-text-muted);
		font-size: 0.8125rem;
		line-height: 1.6;
		margin: 0.5rem 0;
	}
	.error {
		color: var(--color-danger);
		font-size: 0.875rem;
		line-height: 1.6;
	}
	.results {
		display: grid;
		gap: 0.75rem;
		margin-top: 1.25rem;
	}
	h3,
	h4 {
		margin: 0;
		font-size: 1rem;
		font-weight: 650;
	}
	article {
		display: grid;
		gap: 0.75rem;
		padding: 1rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-mint-50);
		overflow-wrap: anywhere;
	}
	article p {
		margin: 0;
		white-space: pre-wrap;
		font-size: 0.875rem;
		line-height: 1.65;
	}
	summary {
		min-height: 44px;
		align-content: center;
		cursor: pointer;
		font-size: 0.8125rem;
		color: var(--color-text-muted);
	}
	label {
		display: block;
		font-size: 0.875rem;
		font-weight: 600;
		margin: 1rem 0 0.5rem;
	}
	textarea {
		width: 100%;
		max-height: 50dvh;
		resize: vertical;
		padding: 0.75rem;
		border: 1px solid var(--color-control-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		color: var(--color-text);
		font-size: 0.8125rem;
		line-height: 1.5;
	}
</style>
