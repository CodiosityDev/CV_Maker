<script lang="ts">
	import { onDestroy, onMount, tick, untrack } from 'svelte';
	import type { CvStore } from '#lib/core/store/cv-store.svelte.ts';
	import type { AiTask, AiResult } from '#lib/core/ai/types.ts';
	import { LIMITS, newId, type SkillGroups } from '#lib/core/schema/index.ts';
	import { incognito } from '#lib/core/storage/index.ts';
	import { normalize } from '#lib/core/suggest/index.ts';
	import { t, type MessageKey } from '#lib/i18n/index.svelte.ts';
	import { toast } from '#lib/ui/toast.svelte.ts';
	import Button from '#lib/ui/Button.svelte';
	import Dialog from '#lib/ui/Dialog.svelte';
	import AiText from './AiText.svelte';
	import AiQuota from './AiQuota.svelte';
	import {
		aiSession,
		loadAiModule,
		refreshAiQuota,
		sameAiSession,
		syncAiSession,
		updateAiQuota,
		type AiModule
	} from './session.svelte.ts';

	let { store, task }: { store: CvStore; task: AiTask } = $props();
	const uid = $props.id();
	const groups = ['hard', 'tools', 'soft'] as const;
	let module = $state.raw<AiModule>();
	let busy = $state(false);
	let rewarding = $state(false);
	let consentOpen = $state(false);
	let errorKey = $state<MessageKey>();
	let result = $state.raw<AiResult>();
	let originalHeadline = '';
	let mounted = true;
	let request = 0;
	let seenEpoch = untrack(() => aiSession.epoch);
	let root = $state<HTMLElement>();
	let undo: { id: number; signature: string } | undefined;
	const removed = $derived(store.externalChange === 'removed');
	const canRun = $derived(Boolean(module?.aiCanRun(task, store.cv)));
	const exhausted = $derived(aiSession.quota?.remaining === 0);
	const profile = $derived(module?.aiProfileFromCv(store.cv));
	const label = $derived(
		task === 'headline'
			? t('aiAssist.headline')
			: task === 'skills'
				? t('aiAssist.skills')
				: t(store.cv.summary.trim() ? 'aiAssist.improve' : 'aiAssist.write')
	);
	const hasPlaceholder = $derived(
		result ? /\[(?:isi angka|add number)\]/i.test(JSON.stringify(result)) : false
	);

	onMount(() => {
		syncAiSession();
		void prepare();
		function visible() {
			if (document.visibilityState !== 'visible' || removed) return;
			const epoch = aiSession.epoch;
			const active = incognito.active;
			const before = aiSession.quota?.remaining ?? 0;
			void refreshAiQuota().then(() => {
				if (mounted && sameAiSession(epoch, active) && (aiSession.quota?.remaining ?? 0) > before)
					toast.success(t('aiAssist.quotaAdded'));
			});
		}
		document.addEventListener('visibilitychange', visible);
		return () => {
			document.removeEventListener('visibilitychange', visible);
		};
	});
	onDestroy(() => {
		mounted = false;
		request += 1;
		result = undefined;
		originalHeadline = '';
		clearUndo();
	});
	$effect(() => {
		syncAiSession();
		if (seenEpoch !== aiSession.epoch || removed) {
			seenEpoch = aiSession.epoch;
			request += 1;
			result = undefined;
			consentOpen = false;
			busy = false;
			errorKey = undefined;
			clearUndo();
		}
	});
	$effect(() => {
		if (result?.task === 'headline' && store.cv.personal.headline !== originalHeadline)
			result = undefined;
	});
	$effect(() => {
		const signature = contentSignature();
		if (undo && signature !== undo.signature) clearUndo();
	});
	async function prepare() {
		errorKey = undefined;
		try {
			const loaded = await loadAiModule();
			if (!mounted || removed) return;
			module = loaded;
			await refreshAiQuota();
		} catch {
			if (mounted && !removed) errorKey = 'ai.errors.unavailable';
		}
	}
	function contentSignature() {
		const cv = $state.snapshot(store.cv);
		return JSON.stringify({ ...cv, status: undefined, updatedAt: undefined });
	}
	function clearUndo() {
		if (undo) toast.dismiss(undo.id);
		undo = undefined;
	}
	function showError(error: unknown) {
		if (module && error instanceof module.AiError) {
			errorKey = module.aiErrorMessageKey(error.code);
			if (error.quota) updateAiQuota(error.quota);
		} else errorKey = 'ai.errors.unavailable';
	}
	function ask() {
		if (!module || !canRun || busy || exhausted || removed) return;
		if (!aiSession.consented) consentOpen = true;
		else void run();
	}
	function accept() {
		aiSession.consented = true;
		consentOpen = false;
		void run();
	}
	async function run() {
		if (!module || !aiSession.consented || !canRun || busy || exhausted || removed) return;
		const epoch = aiSession.epoch;
		const active = incognito.active;
		const token = ++request;
		const headlineAtStart = store.cv.personal.headline;
		busy = true;
		errorKey = undefined;
		result = undefined;
		clearUndo();
		try {
			const response = await module.aiClient.run(task, store.cv);
			if (!mounted || removed || token !== request || !sameAiSession(epoch, active)) return;
			updateAiQuota(response.quota);
			if (response.result.task !== task) {
				errorKey = 'ai.errors.failed';
				return;
			}
			if (task === 'headline' && store.cv.personal.headline !== headlineAtStart) return;
			originalHeadline = headlineAtStart;
			result = response.result;
		} catch (error) {
			if (mounted && !removed && token === request && sameAiSession(epoch, active))
				showError(error);
		} finally {
			if (mounted && token === request) busy = false;
		}
	}
	function record(change: Parameters<CvStore['update']>[0]) {
		if (removed) return;
		clearUndo();
		store.update(change, { coalesceKey: `ai.${task}.${newId()}` });
		const signature = contentSignature();
		const id = toast.info(t('aiAssist.applied'), {
			labelKey: 'wizard.undo',
			run: () => {
				if (!removed && contentSignature() === signature) store.undo();
				clearUndo();
			}
		});
		undo = { id, signature };
	}
	async function applyText(text: string) {
		if (removed || (task !== 'headline' && task !== 'summary')) return;
		record((draft) => {
			if (task === 'headline') draft.personal.headline = text.slice(0, LIMITS.headline);
			else draft.summary = text.slice(0, LIMITS.summary);
		});
		result = undefined;
		await tick();
		document
			.getElementById(task === 'headline' ? 'personal.headline' : 'summary')
			?.focus({ preventScroll: true });
	}
	function hasSkill(skill: string) {
		return groups.some((group) =>
			store.cv.skills[group].some((item) => normalize(item) === normalize(skill))
		);
	}
	async function addSkill(group: keyof SkillGroups, skill: string) {
		if (removed || hasSkill(skill) || store.cv.skills[group].length >= LIMITS.skillsPerGroup)
			return;
		record((draft) => {
			draft.skills[group].push(skill.slice(0, LIMITS.title));
		});
		await tick();
		(
			root?.querySelector<HTMLButtonElement>('.ai-choices button:not(:disabled)') ??
			document.getElementById(`${uid}-run`)
		)?.focus({ preventScroll: true });
	}
	function reward() {
		if (!module || removed || rewarding || !exhausted || !aiSession.quota?.rewards?.remaining)
			return;
		const epoch = aiSession.epoch;
		const active = incognito.active;
		rewarding = true;
		errorKey = undefined;
		// The client opens its new tab synchronously, before its first await.
		const operation = module.aiClient.openRewardAd(store.cv.locale);
		void operation
			.catch((error: unknown) => {
				if (mounted && !removed && sameAiSession(epoch, active)) showError(error);
			})
			.finally(() => {
				if (mounted) rewarding = false;
			});
	}
</script>

<section
	class="ai-assist"
	bind:this={root}
	data-testid="ai-assist"
	data-ai-task={task}
	aria-label={label}
>
	<button
		id={`${uid}-run`}
		class="run-button"
		type="button"
		aria-disabled={!module || !canRun || busy || exhausted || removed}
		aria-busy={busy || undefined}
		onclick={ask}>{busy ? t('aiAssist.busy') : label}</button
	>
	{#if !canRun && module}<p class="hint">
			{t(task === 'skills' ? 'aiAssist.needSkills' : 'aiAssist.needBackground')}
		</p>{/if}
	<AiQuota {rewarding} disabled={removed} onreward={reward}>
		{#if errorKey}<p class="error" role="alert">
				{t(errorKey)}{#if !module}
					<Button variant="ghost" onclick={prepare}>{t('wizard.retry')}</Button>{/if}
			</p>{/if}
	</AiQuota>
	{#if result?.task === 'headline'}
		<div class="ai-choices" role="group" aria-label={t('aiAssist.headlineChoices')}>
			{#each result.headlines.slice(0, 3) as headline, index (index)}<button
					type="button"
					onclick={() => applyText(headline)}><AiText text={headline} /></button
				>{/each}
		</div>
	{:else if result?.task === 'summary'}
		<div
			class="summary-preview"
			data-testid="ai-summary-preview"
			aria-labelledby={`${uid}-preview`}
		>
			<h3 id={`${uid}-preview`}>{t('aiAssist.preview')}</h3>
			<p><AiText text={result.summary} /></p>
			<div class="actions">
				<Button
					onclick={() => {
						if (result?.task === 'summary') void applyText(result.summary);
					}}>{t('aiAssist.use')}</Button
				><Button variant="ghost" onclick={() => (result = undefined)}
					>{t('aiAssist.discard')}</Button
				>
			</div>
		</div>
	{:else if result?.task === 'skills'}
		<div class="ai-choices">
			{#each groups as group (group)}{@const choices = result[group].filter(
					(skill, index, list) =>
						!hasSkill(skill) &&
						list.findIndex((candidate) => normalize(candidate) === normalize(skill)) === index
				)}{#if choices.length}<div data-ai-group={group}>
						<h3>{t(`wizard.fields.${group}`)}</h3>
						<div class="skill-options">
							{#each choices as skill, index (index)}<button
									type="button"
									disabled={store.cv.skills[group].length >= LIMITS.skillsPerGroup}
									onclick={() => addSkill(group, skill)}><AiText text={skill} /></button
								>{/each}
						</div>
						{#if store.cv.skills[group].length >= LIMITS.skillsPerGroup}<p class="hint">
								{t('wizard.skillsLimit', { max: LIMITS.skillsPerGroup })}
							</p>{/if}
					</div>{/if}{/each}
		</div>
	{/if}
	{#if hasPlaceholder}<p class="hint">{t('aiAssist.placeholder')}</p>{/if}
</section>

{#if consentOpen && profile && !removed}
	<Dialog bind:open={consentOpen} title={t('aiAssist.consentTitle')}>
		<p>{t('aiAssist.consentIntro')}</p>
		<dl class="profile-summary">
			<div>
				<dt>{t('wizard.fields.targetRole')}</dt>
				<dd>{profile.targetRole || t('aiAssist.noTarget')}</dd>
			</div>
			<div>
				<dt>{t('aiAssist.background')}</dt>
				<dd>
					{t('aiAssist.backgroundCount', {
						education: profile.education.length,
						experience: profile.experience.length,
						organizations: profile.organizations.length,
						projects: profile.projects.length
					})}
				</dd>
			</div>
			<div>
				<dt>{t('aiAssist.skillsAndSummary')}</dt>
				<dd>
					{t('aiAssist.contentCount', {
						skills:
							profile.skills.hard.length + profile.skills.tools.length + profile.skills.soft.length,
						certificates: profile.certifications.length,
						characters: profile.summary.length
					})}
				</dd>
			</div>
		</dl>
		<p>{t('aiAssist.notSent')}</p>
		<p>{t('aiAssist.processing')}</p>
		<p>{t('aiAssist.freeQuota')}</p>
		{#snippet footer()}<Button variant="secondary" onclick={() => (consentOpen = false)}
				>{t('common.cancel')}</Button
			><Button onclick={accept}>{t('aiAssist.agree')}</Button>{/snippet}
	</Dialog>
{/if}

<style>
	.ai-assist {
		min-width: 0;
		margin-block: 0.25rem 1rem;
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
		font-weight: 600;
		font-size: 0.875rem;
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
	.ai-choices,
	.skill-options {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-top: 0.75rem;
		min-width: 0;
	}
	.ai-choices > div {
		width: 100%;
	}
	.ai-choices button {
		min-height: 44px;
		max-width: 100%;
		padding: 0.625rem 0.875rem;
		border: 1px solid transparent;
		border-radius: var(--radius-md);
		background: var(--color-mint-50);
		color: var(--color-text);
		font: inherit;
		font-size: 0.875rem;
		text-align: left;
		overflow-wrap: anywhere;
		cursor: pointer;
	}
	.ai-choices button:hover {
		background: var(--color-mint);
	}
	.ai-choices button:focus-visible {
		outline: 2px solid var(--color-focus);
		outline-offset: 2px;
	}
	.ai-choices button:disabled {
		opacity: 0.5;
		cursor: default;
	}
	h3 {
		font-size: 0.9375rem;
		font-weight: 600;
	}
	.summary-preview {
		margin-top: 0.75rem;
		padding: 1rem;
		border-radius: var(--radius-md);
		background: var(--color-mint-50);
		overflow-wrap: anywhere;
	}
	.summary-preview p {
		white-space: pre-wrap;
		margin-top: 0.5rem;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-top: 0.75rem;
	}
	.profile-summary {
		display: grid;
		gap: 0.75rem;
		margin-block: 1rem;
		padding: 1rem;
		background: var(--color-mint-50);
		border-radius: var(--radius-md);
	}
	dt {
		font-weight: 600;
	}
	dd {
		margin: 0.25rem 0 0;
		overflow-wrap: anywhere;
	}
</style>
