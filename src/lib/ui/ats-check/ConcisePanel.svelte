<script lang="ts">
	import { onDestroy, onMount, tick, untrack } from 'svelte';
	import { redactContacts } from '#lib/core/ai/redact.ts';
	import { AI_CONCISE_LIMITS } from '#lib/core/ai/types.ts';
	import {
		aiConciseInput,
		mergeConciseAi,
		type ConcisePoint,
		type ConciseReport
	} from '#lib/core/ats/concise.ts';
	import type { Locale } from '#lib/core/schema/index.ts';
	import { incognito } from '#lib/core/storage/incognito.svelte.ts';
	import { t, type MessageKey } from '#lib/i18n/index.svelte.ts';
	import Button from '#lib/ui/Button.svelte';
	import Dialog from '#lib/ui/Dialog.svelte';
	import AiText from '#lib/ui/ai/AiText.svelte';
	import {
		aiSession,
		blockAiLite,
		loadAiModule,
		refreshAiQuota,
		sameAiSession,
		syncAiSession,
		updateAiLiteQuota,
		type AiModule
	} from '#lib/ui/ai/session.svelte.ts';
	import { toast } from '#lib/ui/toast.svelte.ts';

	let {
		report,
		locale,
		resetKey = '',
		onfix,
		onapply,
		onundo
	}: {
		report: ConciseReport;
		locale: Locale;
		resetKey?: string;
		onfix?: (target: NonNullable<ConcisePoint['target']>) => void;
		onapply?: (point: ConcisePoint, text: string) => boolean;
		onundo?: () => void;
	} = $props();
	const uid = $props.id();
	let module = $state.raw<AiModule>();
	let busy = $state(false);
	let checkingQuota = $state(false);
	let consentOpen = $state(false);
	let errorKey = $state<MessageKey>();
	let merged = $state.raw<ConciseReport>();
	let mergedSignature = $state('');
	let mergedEpoch = $state(-1);
	let manualText = $state<string>();
	let manualField = $state<HTMLTextAreaElement>();
	let copying = $state<string>();
	let mounted = true;
	let interactedLite = false;
	let request = 0;
	let consentSignature = '';
	let consentEpoch = -1;
	let consentMode = false;
	let seenSignature = '';
	let seenEpoch = untrack(() => aiSession.epoch);
	const signature = $derived(JSON.stringify([resetKey, locale, report.points]));
	const input = $derived.by(() => {
		const raw = aiConciseInput(report, locale);
		// Match the client's redaction after the helper's length cap, keeping point keys aligned.
		const selected = raw.points.flatMap((point, index) => {
			const key = raw.keys[index];
			const text = redactContacts(point.text)
				.trim()
				.slice(0, point.kind === 'summary' ? AI_CONCISE_LIMITS.summary : AI_CONCISE_LIMITS.bullet);
			return key !== undefined && text ? [{ point: { ...point, text }, key }] : [];
		});
		return {
			locale: raw.locale,
			points: selected.map(({ point }) => point),
			keys: selected.map(({ key }) => key)
		};
	});
	const current = $derived(
		merged && mergedSignature === signature && mergedEpoch === aiSession.epoch ? merged : report
	);
	const issues = $derived(
		current.points
			.map((point, order) => ({ point, order }))
			.filter(({ point }) => point.level !== 'ok')
			.sort((a, b) => a.point.score - b.point.score || a.order - b.order)
			.map(({ point }) => point)
	);
	const okay = $derived(current.points.filter((point) => point.level === 'ok'));
	const running = $derived(busy || checkingQuota);
	const exhausted = $derived(aiSession.lite?.remaining === 0);
	const liteBlocked = $derived(aiSession.liteBlocked);
	const canRun = $derived(input.points.some((point) => point.text.trim()));
	const hasPlaceholder = $derived(
		current.points.some(
			(point) => point.shorter && /\[(?:isi angka|add number)\]/i.test(point.shorter)
		)
	);

	onMount(() => {
		syncAiSession();
		interactedLite ||= aiSession.liteBlocked || aiSession.lite?.remaining === 0;
		void prepare();
		function visible() {
			if (!interactedLite || document.visibilityState !== 'visible') return;
			const epoch = aiSession.epoch;
			const active = incognito.active;
			void refreshAiQuota().then(() => {
				if (
					mounted &&
					sameAiSession(epoch, active) &&
					!aiSession.liteBlocked &&
					errorKey === 'concisePanel.ai.limit'
				)
					errorKey = undefined;
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
		if (seenSignature !== signature || seenEpoch !== aiSession.epoch) {
			if (seenEpoch !== aiSession.epoch) interactedLite = false;
			seenSignature = signature;
			seenEpoch = aiSession.epoch;
			invalidate();
		}
	});

	function invalidate() {
		request += 1;
		consentSignature = '';
		consentOpen = false;
		busy = false;
		checkingQuota = false;
		errorKey = undefined;
		merged = undefined;
		mergedSignature = '';
		mergedEpoch = -1;
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
			if (error.code === 'quota') {
				blockAiLite();
				errorKey = 'concisePanel.ai.limit';
			} else errorKey = module.aiErrorMessageKey(error.code);
		} else errorKey = 'ai.errors.unavailable';
	}
	async function ask() {
		if (!module || !canRun || running || exhausted || liteBlocked) return;
		interactedLite = true;
		const token = ++request;
		const epoch = aiSession.epoch;
		const active = incognito.active;
		const content = signature;
		errorKey = undefined;
		if (!aiSession.lite) {
			checkingQuota = true;
			await refreshAiQuota();
			if (!fresh(token, epoch, active, content)) return;
			checkingQuota = false;
		}
		if (!fresh(token, epoch, active, content) || exhausted) return;
		if (aiSession.consented) void run();
		else {
			consentSignature = content;
			consentEpoch = epoch;
			consentMode = active;
			consentOpen = true;
		}
	}
	function accept() {
		if (
			!consentOpen ||
			!canRun ||
			consentSignature !== signature ||
			liteBlocked ||
			!sameAiSession(consentEpoch, consentMode)
		)
			return;
		aiSession.consented = true;
		consentOpen = false;
		void run();
	}
	async function run() {
		if (!module || !canRun || running || exhausted || liteBlocked || !aiSession.consented) return;
		const token = ++request;
		const epoch = aiSession.epoch;
		const active = incognito.active;
		const content = signature;
		const base = report;
		const sent = input;
		busy = true;
		errorKey = undefined;
		manualText = undefined;
		copying = undefined;
		try {
			const answer = await module.aiClient.concise(sent);
			if (sameAiSession(epoch, active)) updateAiLiteQuota(answer.lite);
			if (!fresh(token, epoch, active, content)) return;
			merged = mergeConciseAi(base, sent, answer.result);
			mergedSignature = content;
			mergedEpoch = epoch;
		} catch (error) {
			if (sameAiSession(epoch, active) && error instanceof module.AiError && error.code === 'quota')
				blockAiLite();
			if (fresh(token, epoch, active, content)) showError(error);
		} finally {
			if (mounted && token === request) busy = false;
		}
	}
	function apply(point: ConcisePoint) {
		if (!onapply || !point.shorter || current !== merged || mergedSignature !== signature) return;
		if (!onapply(point, point.shorter)) {
			toast.info(t('concisePanel.stale'));
			return;
		}
		if (onundo) toast.info(t('concisePanel.applied'), { labelKey: 'ui.undo', run: onundo });
		else toast.success(t('concisePanel.applied'));
	}
	async function copy(point: ConcisePoint) {
		if (!point.shorter || copying !== undefined || current !== merged) return;
		const token = request;
		const epoch = aiSession.epoch;
		const active = incognito.active;
		const content = signature;
		copying = point.key;
		try {
			if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
			await navigator.clipboard.writeText(point.shorter);
			if (!fresh(token, epoch, active, content)) return;
			manualText = undefined;
			toast.success(t('concisePanel.copied'));
		} catch {
			if (!fresh(token, epoch, active, content)) return;
			manualText = point.shorter;
			await tick();
			if (fresh(token, epoch, active, content)) {
				manualField?.focus();
				manualField?.select();
			}
		} finally {
			if (fresh(token, epoch, active, content)) copying = undefined;
		}
	}
	function highlighted(text: string, fillers: string[]): { text: string; filler: boolean }[] {
		if (!fillers.length) return [{ text, filler: false }];
		const alternatives = [...fillers]
			.sort((a, b) => b.length - a.length)
			.map((filler) =>
				filler
					.split(/\s+/)
					.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
					.join('[^\\p{L}\\p{N}-]+')
			);
		const pattern = new RegExp(alternatives.join('|'), 'giu');
		const parts: { text: string; filler: boolean }[] = [];
		let end = 0;
		for (const match of text.matchAll(pattern)) {
			const start = match.index;
			const after = start + match[0].length;
			if (/[\p{L}\p{N}-]/u.test(text[start - 1] ?? '') || /[\p{L}\p{N}-]/u.test(text[after] ?? ''))
				continue;
			if (start > end) parts.push({ text: text.slice(end, start), filler: false });
			parts.push({ text: match[0], filler: true });
			end = after;
		}
		if (end < text.length) parts.push({ text: text.slice(end), filler: false });
		return parts;
	}
</script>

{#snippet pointRow(point: ConcisePoint, index: number)}
	<li data-testid="concise-point" data-point-key={point.key} data-level={point.level}>
		<div class="point-meta">
			<strong
				>{point.kind === 'summary'
					? t('wizard.fields.summary')
					: point.item || t('concisePanel.point', { number: index + 1 })}</strong
			>
			<span
				>{t(`ats.concise.levels.${point.level}`)} · {t('concisePanel.pointScore', {
					score: point.score,
					words: point.words
				})}</span
			>
		</div>
		<p class="point-text">
			{#each highlighted(point.text, point.fillers) as part, partIndex (partIndex)}{#if part.filler}<span
						class="filler"
						data-testid="concise-filler">{part.text}</span
					>{:else}{part.text}{/if}{/each}
		</p>
		{#if point.issues.length}
			<ul class="reasons">
				{#each point.issues as issue (issue)}
					<li>
						{t(
							issue === 'filler' && !point.fillers.length
								? 'concisePanel.fillerReason'
								: `ats.concise.issues.${issue}`,
							{ fillers: point.fillers.join('", "'), words: point.words }
						)}
					</li>
				{/each}
			</ul>
		{/if}
		{#if onfix && point.target}
			<button
				type="button"
				class="text-action"
				data-testid="concise-fix"
				onclick={() => point.target && onfix?.(point.target)}>{t('concisePanel.fix')}</button
			>
		{/if}
		{#if point.shorter}
			<div class="shorter" data-testid="concise-shorter">
				<h4>{t('concisePanel.shorter')}</h4>
				<p><AiText text={point.shorter} /></p>
				<div class="actions">
					{#if onapply && point.target}<Button variant="secondary" onclick={() => apply(point)}
							>{t('concisePanel.apply')}</Button
						>{/if}
					<Button variant="ghost" disabled={copying !== undefined} onclick={() => void copy(point)}
						>{t('concisePanel.copy')}</Button
					>
				</div>
			</div>
		{/if}
	</li>
{/snippet}

<section class="concise-panel" data-testid="concise-panel" aria-labelledby={`${uid}-title`}>
	<div class="heading">
		<h3 id={`${uid}-title`}>{t('concisePanel.title')}</h3>
		{#if current.score !== undefined}<span class="score" data-testid="concise-score"
				>{current.score}/100</span
			>{/if}
	</div>
	<p class="hint">{t(current.ai ? 'concisePanel.aiChecked' : 'concisePanel.localChecked')}</p>
	{#if current.score === undefined}
		<p class="empty">{t('concisePanel.empty')}</p>
	{:else}
		<p class="summary">
			{t('concisePanel.summary', { wordy: current.wordy, total: current.points.length })}
		</p>
		{#if issues.length}
			<ul class="points" data-testid="concise-issues">
				{#each issues as point, index (point.key)}{@render pointRow(point, index)}{/each}
			</ul>
		{/if}
		{#if okay.length}
			<details class="okay">
				<summary>{t('concisePanel.okay', { count: okay.length })}</summary>
				<ul class="points">
					{#each okay as point, index (point.key)}{@render pointRow(point, index)}{/each}
				</ul>
			</details>
		{/if}
	{/if}
	<div class="ai-check">
		<button
			type="button"
			class="run-button"
			data-testid="concise-ai-request"
			disabled={!module || !canRun || running || exhausted || liteBlocked}
			aria-busy={running || undefined}
			aria-describedby={`${uid}-ai-hint`}
			onclick={() => void ask()}
			>{t(running ? 'concisePanel.ai.busy' : 'concisePanel.ai.request')}</button
		>
		<p class="hint" id={`${uid}-ai-hint`}>{t('concisePanel.ai.free')}</p>
		{#if !canRun}<p class="hint">{t('concisePanel.ai.noText')}</p>{/if}
		{#if aiSession.lite && !liteBlocked}
			<p class="hint" data-testid="concise-lite-quota" aria-live="polite">
				{t('concisePanel.ai.quota', aiSession.lite)}
			</p>
		{/if}
		{#if errorKey}<p class="error" role="alert">{t(errorKey)}</p>
		{:else if exhausted || liteBlocked}<p class="hint">{t('concisePanel.ai.limit')}</p>{/if}
		{#if !module && errorKey}<Button variant="ghost" onclick={prepare}>{t('atsPanel.retry')}</Button
			>{/if}
	</div>
	{#if hasPlaceholder}<p class="hint">{t('aiAssist.placeholder')}</p>{/if}
	{#if manualText !== undefined}
		<div class="manual-copy">
			<p class="hint" role="status">{t('concisePanel.copyFailed')}</p>
			<label for={`${uid}-copy`}>{t('concisePanel.copyText')}</label>
			<textarea id={`${uid}-copy`} rows="4" readonly value={manualText} bind:this={manualField}
			></textarea>
		</div>
	{/if}
</section>

{#if consentOpen}
	<Dialog bind:open={consentOpen} title={t('concisePanel.ai.consentTitle')}>
		<p>{t('concisePanel.ai.consentIntro')}</p>
		<p>{t('concisePanel.ai.contacts')}</p>
		<p>{t('concisePanel.ai.locale', { locale: t(locale === 'id' ? 'locale.id' : 'locale.en') })}</p>
		<div class="input-preview" role="region" aria-label={t('concisePanel.ai.sentText')}>
			<ol data-testid="concise-ai-input">
				{#each input.points as point, index (index)}
					<li>
						<label for={`${uid}-input-${index}`}
							>{t(
								point.kind === 'summary' ? 'wizard.fields.summary' : 'concisePanel.bullet'
							)}</label
						>
						<textarea
							id={`${uid}-input-${index}`}
							data-testid="concise-ai-input-point"
							data-kind={point.kind}
							rows={point.kind === 'summary' ? 5 : 3}
							readonly
							value={point.text}></textarea>
					</li>
				{/each}
			</ol>
		</div>
		<p>{t('concisePanel.ai.free')}</p>
		{#snippet footer()}
			<Button variant="secondary" onclick={() => (consentOpen = false)}>{t('common.cancel')}</Button
			>
			<Button onclick={accept}>{t('concisePanel.ai.send')}</Button>
		{/snippet}
	</Dialog>
{/if}

<style>
	.concise-panel {
		min-width: 0;
		margin-top: 1.5rem;
		padding-top: 1.25rem;
		border-top: 1px solid var(--color-border);
		overflow-wrap: anywhere;
	}
	.heading,
	.point-meta,
	.actions {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.5rem 0.75rem;
	}
	.heading {
		justify-content: space-between;
	}
	h3,
	h4 {
		margin: 0;
		font-size: 1rem;
		font-weight: 600;
	}
	.score {
		font-size: 1.125rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}
	p {
		line-height: 1.6;
	}
	.hint,
	.point-meta span {
		color: var(--color-text-muted);
		font-size: 0.8125rem;
	}
	.hint {
		margin-top: 0.375rem;
	}
	.summary,
	.empty {
		margin-top: 0.75rem;
	}
	.points {
		margin: 0.75rem 0 0;
		padding: 0;
		list-style: none;
	}
	.points > li {
		padding: 1rem 0;
		border-top: 1px solid var(--color-border);
	}
	.point-meta {
		align-items: baseline;
	}
	.point-meta strong {
		font-size: 0.875rem;
	}
	.point-text {
		margin-top: 0.5rem;
		white-space: pre-wrap;
	}
	.filler {
		border-radius: 3px;
		background: var(--color-cream);
		color: var(--color-text);
		text-decoration: underline;
		text-decoration-color: var(--color-coral-ink);
		text-underline-offset: 3px;
	}
	.reasons {
		margin: 0.5rem 0 0;
		padding-left: 1.25rem;
		list-style: disc;
		font-size: 0.875rem;
		line-height: 1.6;
	}
	.reasons li + li {
		margin-top: 0.25rem;
	}
	.text-action,
	.run-button {
		min-height: 44px;
		border: 0;
		border-radius: var(--radius-md);
		color: var(--color-brand-ink);
		font: inherit;
		font-size: 0.875rem;
		font-weight: 600;
		text-align: left;
		cursor: pointer;
	}
	.text-action {
		padding: 0.5rem 0.75rem;
		background: transparent;
	}
	.run-button {
		padding: 0.75rem 1rem;
		background: var(--color-brand-50);
	}
	.run-button:disabled {
		opacity: 0.55;
		cursor: default;
	}
	.text-action:focus-visible,
	.run-button:focus-visible,
	summary:focus-visible,
	textarea:focus-visible {
		outline: 2px solid var(--color-focus);
		outline-offset: 2px;
	}
	.shorter {
		margin-top: 0.75rem;
		padding: 0.75rem;
		border-radius: var(--radius-md);
		background: var(--color-mint-50);
	}
	.shorter p {
		margin-top: 0.5rem;
		white-space: pre-wrap;
	}
	.actions {
		margin-top: 0.75rem;
	}
	.okay {
		margin-top: 0.75rem;
	}
	summary {
		min-height: 44px;
		padding-block: 0.75rem;
		color: var(--color-brand-ink);
		font-size: 0.875rem;
		font-weight: 600;
		cursor: pointer;
	}
	.ai-check {
		margin-top: 1rem;
	}
	.error {
		margin-top: 0.5rem;
		color: var(--color-danger);
		font-size: 0.875rem;
	}
	.input-preview {
		max-height: 18rem;
		margin-block: 1rem;
		overflow: auto;
		padding: 0.75rem;
		border-radius: var(--radius-md);
		background: var(--color-mint-50);
	}
	.input-preview ol {
		margin: 0;
		padding-left: 1.5rem;
	}
	.input-preview li + li {
		margin-top: 1rem;
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
