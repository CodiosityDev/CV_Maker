<script module lang="ts">
	import type { CVDocument } from '#lib/core/schema/index.ts';
	import type { ExtractedCv } from '#lib/core/scan/types.ts';

	export type AiReviewSource =
		| { kind: 'file'; extracted: ExtractedCv; targetRole: string; jobPost: string }
		| { kind: 'cv'; cv: CVDocument; jobPost: string };
</script>

<script lang="ts">
	import { onDestroy, onMount, tick, untrack } from 'svelte';
	import type { ReviewResult } from '#lib/core/ai/types.ts';
	import { incognito } from '#lib/core/storage/incognito.svelte.ts';
	import { t, type MessageKey } from '#lib/i18n/index.svelte.ts';
	import Button from '#lib/ui/Button.svelte';
	import Dialog from '#lib/ui/Dialog.svelte';
	import { toast } from '#lib/ui/toast.svelte.ts';
	import AiQuota from './AiQuota.svelte';
	import AiText from './AiText.svelte';
	import {
		aiSession,
		loadAiModule,
		refreshAiQuota,
		sameAiSession,
		syncAiSession,
		updateAiQuota,
		type AiModule
	} from './session.svelte.ts';

	let { source }: { source: AiReviewSource } = $props();
	const uid = $props.id();
	let module = $state.raw<AiModule>();
	let busy = $state(false);
	let checkingQuota = $state(false);
	let rewarding = $state(false);
	let consentOpen = $state(false);
	let errorKey = $state<MessageKey>();
	let result = $state.raw<ReviewResult>();
	let manualText = $state<string>();
	let copying = $state<number>();
	let manualField = $state<HTMLTextAreaElement>();
	let resultHeading = $state<HTMLHeadingElement>();
	let mounted = true;
	let interacted = false;
	let request = 0;
	let consentSignature = '';
	let seenSignature = '';
	let seenEpoch = untrack(() => aiSession.epoch);
	const input = $derived(
		module
			? source.kind === 'file'
				? module.aiReviewInputFromScan(source.extracted, source.jobPost, source.targetRole)
				: module.aiReviewInputFromCv(source.cv, source.jobPost)
			: undefined
	);
	const signature = $derived(input ? JSON.stringify(input) : '');
	const canRun = $derived(Boolean(input?.cvText.trim()));
	const exhausted = $derived(aiSession.quota?.remaining === 0);
	const running = $derived(busy || checkingQuota);
	const hasPlaceholder = $derived(
		result ? /\[(?:isi angka|add number)\]/i.test(JSON.stringify(result)) : false
	);

	onMount(() => {
		syncAiSession();
		void prepare();
		function visible() {
			if (!interacted || document.visibilityState !== 'visible') return;
			const token = request;
			const epoch = aiSession.epoch;
			const active = incognito.active;
			const content = signature;
			const before = aiSession.quota?.remaining ?? 0;
			void refreshAiQuota().then(() => {
				if (fresh(token, epoch, active, content) && (aiSession.quota?.remaining ?? 0) > before)
					toast.success(t('aiAssist.quotaAdded'));
			});
		}
		document.addEventListener('visibilitychange', visible);
		return () => document.removeEventListener('visibilitychange', visible);
	});
	onDestroy(() => {
		mounted = false;
		invalidate();
	});
	$effect(() => {
		syncAiSession();
		if (seenEpoch !== aiSession.epoch || seenSignature !== signature) {
			seenEpoch = aiSession.epoch;
			seenSignature = signature;
			invalidate();
		}
	});

	function invalidate() {
		request += 1;
		interacted = false;
		consentSignature = '';
		consentOpen = false;
		busy = false;
		checkingQuota = false;
		rewarding = false;
		errorKey = undefined;
		result = undefined;
		manualText = undefined;
		copying = undefined;
	}
	function fresh(token: number, epoch: number, active: boolean, content: string) {
		return mounted && token === request && sameAiSession(epoch, active) && content === signature;
	}
	async function prepare() {
		errorKey = undefined;
		try {
			const loaded = await loadAiModule();
			if (mounted) module = loaded;
		} catch {
			if (mounted) errorKey = 'ai.errors.unavailable';
		}
	}
	function showError(error: unknown) {
		if (module && error instanceof module.AiError) {
			errorKey = module.aiErrorMessageKey(error.code);
			if (error.quota) updateAiQuota(error.quota);
		} else errorKey = 'ai.errors.unavailable';
	}
	async function ask() {
		if (!module || !canRun || running || exhausted) return;
		interacted = true;
		const token = ++request;
		const epoch = aiSession.epoch;
		const active = incognito.active;
		const content = signature;
		errorKey = undefined;
		if (!aiSession.quota) {
			checkingQuota = true;
			await refreshAiQuota();
			if (!fresh(token, epoch, active, content)) return;
			checkingQuota = false;
			if (!aiSession.quota) {
				errorKey = 'ai.errors.unavailable';
				return;
			}
		}
		if (!fresh(token, epoch, active, content) || exhausted) return;
		if (aiSession.consented) void run();
		else {
			consentSignature = content;
			consentOpen = true;
		}
	}
	function accept() {
		if (!consentOpen || !canRun || consentSignature !== signature) return;
		aiSession.consented = true;
		consentOpen = false;
		void run();
	}
	async function run() {
		if (!module || !input || !canRun || running || exhausted || !aiSession.consented) return;
		const token = ++request;
		const epoch = aiSession.epoch;
		const active = incognito.active;
		const content = signature;
		const current = { ...input };
		busy = true;
		errorKey = undefined;
		result = undefined;
		manualText = undefined;
		copying = undefined;
		try {
			const response = await module.aiClient.review(current);
			if (!fresh(token, epoch, active, content)) return;
			updateAiQuota(response.quota);
			result = response.result;
			await tick();
			if (fresh(token, epoch, active, content)) resultHeading?.focus({ preventScroll: true });
		} catch (error) {
			if (fresh(token, epoch, active, content)) showError(error);
		} finally {
			if (mounted && token === request) busy = false;
		}
	}
	function reward() {
		if (
			!module ||
			!input ||
			!canRun ||
			running ||
			rewarding ||
			!exhausted ||
			!aiSession.quota?.rewards?.remaining
		)
			return;
		interacted = true;
		const token = request;
		const epoch = aiSession.epoch;
		const active = incognito.active;
		const content = signature;
		rewarding = true;
		errorKey = undefined;
		// The client must open its tab synchronously inside this click handler.
		const operation = module.aiClient.openRewardAd(input.locale);
		void operation
			.catch((error: unknown) => {
				if (fresh(token, epoch, active, content)) showError(error);
			})
			.finally(() => {
				if (fresh(token, epoch, active, content)) rewarding = false;
			});
	}
	async function copyText(text: string, index: number) {
		if (!result || copying !== undefined) return;
		const token = request;
		const epoch = aiSession.epoch;
		const active = incognito.active;
		const content = signature;
		copying = index;
		try {
			if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
			await navigator.clipboard.writeText(text);
			if (!fresh(token, epoch, active, content)) return;
			manualText = undefined;
			toast.success(t('atsCheck.ai.copied'));
		} catch {
			if (!fresh(token, epoch, active, content)) return;
			manualText = text;
			await tick();
			if (fresh(token, epoch, active, content)) {
				manualField?.focus();
				manualField?.select();
			}
		} finally {
			if (fresh(token, epoch, active, content)) copying = undefined;
		}
	}
</script>

<section class="ai-review" data-testid="ai-review" aria-label={t('atsCheck.ai.title')}>
	<button
		type="button"
		class="run-button"
		aria-disabled={!module || !canRun || running || exhausted}
		aria-busy={running || undefined}
		aria-describedby={[
			aiSession.quota ? `${uid}-quota` : undefined,
			(module && !canRun) || !aiSession.quota ? `${uid}-hint` : undefined
		]
			.filter(Boolean)
			.join(' ')}
		onclick={() => void ask()}>{t(running ? 'atsCheck.ai.busy' : 'atsCheck.ai.request')}</button
	>
	{#if module && !canRun}<p class="hint" id={`${uid}-hint`}>{t('atsCheck.ai.noText')}</p>
	{:else if !aiSession.quota}<p class="hint" id={`${uid}-hint`}>
			{t('atsCheck.ai.quotaUnknown')}
		</p>{/if}
	<AiQuota
		id={`${uid}-quota`}
		quotaText={aiSession.quota
			? t('atsCheck.ai.quota', { remaining: aiSession.quota.remaining })
			: undefined}
		{rewarding}
		disabled={!module || !canRun || running}
		onreward={reward}
	>
		{#if errorKey}<p class="error" role="alert">
				{t(errorKey)}{#if !module}<Button variant="ghost" onclick={prepare}
						>{t('atsCheck.ai.retry')}</Button
					>{/if}
			</p>{/if}
	</AiQuota>
	{#if result}<section
			class="results"
			data-testid="ai-review-results"
			aria-labelledby={`${uid}-results`}
		>
			<h2 id={`${uid}-results`} tabindex="-1" bind:this={resultHeading}>
				{t('atsCheck.ai.title')}
			</h2>
			<p class="generated"><AiText text={result.overview} /></p>
			{#if result.strengths.length}<h3>{t('atsCheck.ai.strengths')}</h3>
				<ul>
					{#each result.strengths as strength, index (index)}<li>
							<AiText text={strength} />
						</li>{/each}
				</ul>{/if}
			{#if result.improvements.length}<h3>{t('atsCheck.ai.improvements')}</h3>
				<ol>
					{#each result.improvements as improvement, index (index)}<li>
							<strong><AiText text={improvement.title} /></strong>
							<p class="generated"><AiText text={improvement.detail} /></p>
						</li>{/each}
				</ol>{/if}
			{#if result.rewrites.length}<div class="rewrites" data-testid="ai-review-rewrites">
					<h3>{t('atsCheck.ai.rewrites')}</h3>
					{#each result.rewrites as rewrite, index (index)}<div class="rewrite">
							<dl>
								<div>
									<dt>{t('atsCheck.ai.before')}</dt>
									<dd><AiText text={rewrite.before} /></dd>
								</div>
								<div>
									<dt>{t('atsCheck.ai.after')}</dt>
									<dd><AiText text={rewrite.after} /></dd>
								</div>
							</dl>
							<Button
								variant="secondary"
								disabled={copying !== undefined}
								onclick={() => void copyText(rewrite.after, index)}>{t('atsCheck.ai.copy')}</Button
							>
						</div>{/each}
				</div>{/if}
			{#if manualText !== undefined}<div class="manual-copy">
					<p class="hint" role="status">{t('atsCheck.ai.copyFailed')}</p>
					<label for={`${uid}-copy`}>{t('atsCheck.ai.copyText')}</label>
					<textarea id={`${uid}-copy`} rows="4" readonly value={manualText} bind:this={manualField}
					></textarea>
				</div>{/if}
			{#if result.missingKeywords.length}<h3>{t('atsCheck.ai.missingKeywords')}</h3>
				<ul class="keywords">
					{#each result.missingKeywords as keyword, index (index)}<li>{keyword}</li>{/each}
				</ul>{/if}
			{#if hasPlaceholder}<p class="hint">{t('aiAssist.placeholder')}</p>{/if}
		</section>{/if}
</section>

{#if consentOpen && input}
	<Dialog bind:open={consentOpen} title={t('atsCheck.ai.consentTitle')}>
		<p>{t('atsCheck.ai.consentIntro')}</p>
		<p>{t('atsCheck.ai.redacted')}</p>
		<p>{t('atsCheck.ai.contextSent')}</p>
		<h3 id={`${uid}-input-label`}>{t('atsCheck.ai.sentText')}</h3>
		<div
			class="input-preview"
			role="textbox"
			aria-readonly="true"
			aria-multiline="true"
			aria-labelledby={`${uid}-input-label`}
			tabindex="0"
		>
			<pre data-testid="ai-review-input">{input.cvText}</pre>
		</div>
		<p>{t('aiAssist.freeQuota')}</p>
		{#snippet footer()}<Button variant="secondary" onclick={() => (consentOpen = false)}
				>{t('common.cancel')}</Button
			><Button onclick={accept}>{t('atsCheck.ai.send')}</Button>{/snippet}
	</Dialog>
{/if}

<style>
	.ai-review {
		min-width: 0;
	}
	.run-button {
		min-height: 44px;
		max-width: 100%;
		padding: 0.625rem 0.875rem;
		border: 1px solid transparent;
		border-radius: var(--radius-md);
		background: var(--color-brand-50);
		color: var(--color-brand-ink);
		font: inherit;
		font-size: 0.875rem;
		font-weight: 600;
		text-align: left;
		cursor: pointer;
	}
	.run-button[aria-disabled='true'] {
		opacity: 0.55;
		cursor: default;
	}
	.run-button:focus-visible {
		outline: 2px solid var(--color-focus);
		outline-offset: 2px;
	}
	p {
		line-height: 1.6;
	}
	.hint {
		margin-top: 0.5rem;
		color: var(--color-text-muted);
		font-size: 0.8125rem;
	}
	.error {
		margin-top: 0.5rem;
		color: var(--color-danger);
		font-size: 0.875rem;
	}
	.results {
		margin-top: 1.25rem;
		overflow-wrap: anywhere;
	}
	h2 {
		font-size: 1.125rem;
		font-weight: 600;
	}
	h3 {
		margin-top: 1.25rem;
		font-size: 1rem;
		font-weight: 600;
	}
	.generated {
		margin-top: 0.5rem;
		white-space: pre-wrap;
	}
	ul,
	ol {
		margin-top: 0.5rem;
		padding-left: 1.5rem;
	}
	ul {
		list-style: disc;
	}
	ol {
		list-style: decimal;
	}
	li + li {
		margin-top: 0.75rem;
	}
	.rewrite {
		margin-top: 0.75rem;
		padding-block: 0.75rem;
		border-top: 1px solid var(--color-border);
	}
	dl {
		display: grid;
		gap: 0.75rem;
		margin-bottom: 0.75rem;
	}
	dt {
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--color-text-muted);
	}
	dd {
		margin: 0.25rem 0 0;
		white-space: pre-wrap;
	}
	.keywords {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		padding: 0;
		list-style: none;
	}
	.keywords li {
		margin: 0;
		max-width: 100%;
		padding: 0.375rem 0.625rem;
		border-radius: var(--radius-sm);
		background: var(--color-mint-50);
		font-size: 0.875rem;
	}
	.input-preview {
		max-height: 18rem;
		overflow: auto;
		margin-block: 0.75rem 1rem;
		padding: 0.75rem;
		border-radius: var(--radius-md);
		background: var(--color-mint-50);
		color: var(--color-text);
		font: inherit;
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
	.manual-copy {
		margin-top: 0.75rem;
	}
	label {
		display: block;
		margin-block: 0.75rem 0.375rem;
		font-size: 0.875rem;
		font-weight: 600;
	}
	textarea {
		width: 100%;
		min-height: 44px;
		padding: 0.75rem;
		border: 1px solid var(--color-control-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		color: var(--color-text);
		font: inherit;
		font-size: 0.875rem;
		resize: vertical;
	}
</style>
