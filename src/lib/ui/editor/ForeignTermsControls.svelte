<script lang="ts">
	import { onDestroy, tick, untrack } from 'svelte';
	import {
		addForeignTerm,
		detectForeignTerms,
		foreignSettings,
		ignoreForeignTerm,
		normalizeTerm,
		restoreForeignTerm,
		setForeignEnabled
	} from '#lib/core/foreign/index.ts';
	import { FOREIGN_LIMITS } from '#lib/core/schema/limits.ts';
	import type { CVDocument } from '#lib/core/schema/types.ts';
	import type { CvStore } from '#lib/core/store/cv-store.svelte.ts';
	import { incognito } from '#lib/core/storage/incognito.svelte.ts';
	import { t } from '#lib/i18n/index.svelte.ts';
	import Button from '#lib/ui/Button.svelte';
	import Dialog from '#lib/ui/Dialog.svelte';
	import Input from '#lib/ui/Input.svelte';
	import Toggle from '#lib/ui/Toggle.svelte';

	let { store, onbeforechange }: { store: CvStore; onbeforechange?: () => void } = $props();
	const uid = $props.id();
	const openedId = untrack(() => store.cv.id);
	const openedMode = untrack(() => incognito.active);
	let mounted = true;
	let open = $state(false);
	let term = $state('');
	let inputError = $state('');
	let notice = $state('');
	let body = $state<HTMLDivElement>();
	const available = $derived(
		store.cv.id === openedId &&
			store.cv.locale === 'id' &&
			incognito.active === openedMode &&
			!(incognito.active && incognito.expiredAt) &&
			store.externalChange !== 'removed'
	);
	const editable = $derived(available && store.externalChange === 'none');
	const settings = $derived(foreignSettings(store.cv));
	// Keep the detector out of the ordinary editor typing path.
	const detected = $derived(open && available ? detectForeignTerms(store.cv) : []);
	const ignoreFull = $derived(settings.ignore.length >= FOREIGN_LIMITS.terms);
	const extraFull = $derived(settings.extra.length >= FOREIGN_LIMITS.terms);
	onDestroy(() => {
		mounted = false;
	});
	$effect(() => {
		if (!available) {
			open = false;
			term = '';
			inputError = '';
			notice = '';
		}
	});
	$effect(() => {
		if (!open) {
			term = '';
			inputError = '';
			notice = '';
		}
	});
	function write(change: (draft: CVDocument) => void): boolean {
		if (!mounted || !editable) return false;
		onbeforechange?.();
		if (!mounted || !editable) return false;
		store.update(change);
		inputError = '';
		return true;
	}
	function toggle(enabled: boolean) {
		if (settings.enabled === enabled) return;
		write((draft) => setForeignEnabled(draft, enabled));
	}
	function manage() {
		if (!mounted || !available) return;
		onbeforechange?.();
		if (mounted && available) open = true;
	}
	async function focusList(kind: 'ignore' | 'restore', index: number, trigger?: HTMLElement) {
		await tick();
		if (!mounted || !open || !available || !body) return;
		const active = document.activeElement;
		if (active && active !== document.body && active !== trigger && active.isConnected) return;
		const buttons = body.querySelectorAll<HTMLButtonElement>(
			`[data-testid="foreign-term-${kind}"]:not(:disabled)`
		);
		const input = body.querySelector<HTMLInputElement>(
			'[data-testid="foreign-term-input"]:not(:disabled)'
		);
		const fallback = body.querySelector<HTMLButtonElement>('button:not(:disabled)');
		(buttons[Math.min(index, buttons.length - 1)] ?? input ?? fallback)?.focus();
	}
	function ignore(value: string, index: number, trigger: HTMLButtonElement) {
		if (ignoreFull || settings.ignore.includes(value)) return;
		if (write((draft) => ignoreForeignTerm(draft, value))) {
			notice = t('foreignTerms.ignored', { term: value });
			void focusList('ignore', index, trigger);
		}
	}
	function restore(value: string, index: number, trigger: HTMLButtonElement) {
		if (!settings.ignore.includes(value)) return;
		if (write((draft) => restoreForeignTerm(draft, value))) {
			notice = t('foreignTerms.restored', { term: value });
			void focusList('restore', index, trigger);
		}
	}
	function add(event: SubmitEvent) {
		event.preventDefault();
		if (!mounted || !editable) return;
		const normalized = normalizeTerm(term);
		if (!normalized) {
			inputError = t('foreignTerms.emptyTerm');
			return;
		}
		if (settings.extra.includes(normalized)) {
			inputError = t('foreignTerms.alreadyAdded', { term: normalized });
			return;
		}
		if (extraFull) {
			inputError = t('foreignTerms.extraLimit', { max: FOREIGN_LIMITS.terms });
			return;
		}
		if (write((draft) => addForeignTerm(draft, normalized))) {
			term = '';
			notice = t('foreignTerms.added', { term: normalized });
			void tick().then(() => {
				if (mounted && open && editable)
					body
						?.querySelector<HTMLInputElement>('[data-testid="foreign-term-input"]:not(:disabled)')
						?.focus();
			});
		}
	}
</script>

{#if available}
	<div class="foreign-controls" data-testid="foreign-terms-controls">
		<div class="controls-row">
			<div class="switch-wrap">
				<Toggle
					id={`${uid}-enabled`}
					label={t('foreignTerms.setting')}
					disabled={!editable}
					bind:checked={() => settings.enabled, toggle}
				/>
			</div>
			<Button variant="ghost" size="sm" onclick={manage}>{t('foreignTerms.manage')}</Button>
		</div>
	</div>
{/if}

<Dialog bind:open title={t('foreignTerms.title')} description={t('foreignTerms.description')}>
	{#if open && available}
		<div class="foreign-dialog" bind:this={body} data-testid="foreign-terms-dialog">
			{#if !editable}<p class="status-note" role="status">{t('foreignTerms.readOnly')}</p>{/if}
			<section aria-labelledby={`${uid}-detected`}>
				<h3 id={`${uid}-detected`}>{t('foreignTerms.detected')}</h3>
				{#if !settings.enabled}<p class="hint">{t('foreignTerms.off')}</p>
				{:else if !detected.length}<p class="hint">{t('foreignTerms.emptyDetected')}</p>
				{:else}<p class="hint">{t('foreignTerms.ignoreHint')}</p>
					<div class="chips">
						{#each detected as item, index (item.term)}
							<button
								type="button"
								class="term-chip"
								data-testid="foreign-term-ignore"
								data-term={item.term}
								disabled={!editable || ignoreFull}
								aria-label={t('foreignTerms.ignore', { term: item.term })}
								aria-describedby={ignoreFull ? `${uid}-ignore-limit` : undefined}
								title={t('foreignTerms.ignore', { term: item.term })}
								onclick={(event) => ignore(item.term, index, event.currentTarget)}
							>
								<span>{item.term}</span><small
									>{t(item.count ? 'foreignTerms.occurrences' : 'foreignTerms.unused', {
										count: item.count
									})}</small
								>
							</button>
						{/each}
					</div>
				{/if}
				{#if ignoreFull}<p class="hint" id={`${uid}-ignore-limit`}>
						{t('foreignTerms.ignoreLimit', { max: FOREIGN_LIMITS.terms })}
					</p>{/if}
			</section>
			<section aria-labelledby={`${uid}-ignored`}>
				<h3 id={`${uid}-ignored`}>{t('foreignTerms.notItalic')}</h3>
				{#if settings.ignore.length}<div class="chips">
						{#each settings.ignore as value, index (value)}
							<button
								type="button"
								class="term-chip ignored"
								data-testid="foreign-term-restore"
								data-term={value}
								disabled={!editable}
								aria-label={t('foreignTerms.restoreTerm', { term: value })}
								onclick={(event) => restore(value, index, event.currentTarget)}
								><span>{value}</span><small>{t('foreignTerms.restore')}</small></button
							>
						{/each}
					</div>{:else}<p class="hint">{t('foreignTerms.emptyIgnored')}</p>{/if}
			</section>
			<form onsubmit={add} novalidate>
				<Input
					id={`${uid}-term`}
					data-testid="foreign-term-input"
					label={t('foreignTerms.addLabel')}
					bind:value={term}
					maxlength={FOREIGN_LIMITS.term}
					showCounter
					autocomplete="off"
					disabled={!editable || extraFull}
					error={inputError || undefined}
					oninput={() => (inputError = '')}
					aria-describedby={extraFull ? `${uid}-extra-limit` : undefined}
				/>
				{#if extraFull}<p class="hint" id={`${uid}-extra-limit`}>
						{t('foreignTerms.extraLimit', { max: FOREIGN_LIMITS.terms })}
					</p>{/if}
				<button
					class="add-term"
					type="submit"
					data-testid="foreign-term-add"
					disabled={!editable || extraFull || !term.trim()}>{t('foreignTerms.add')}</button
				>
			</form>
			<p class="announcement" role="status" aria-live="polite">{notice}</p>
		</div>
	{/if}
</Dialog>

<style>
	.foreign-controls {
		padding-top: 1rem;
		border-top: 1px solid var(--color-border);
		min-width: 0;
	}
	.controls-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
		min-width: 0;
	}
	.switch-wrap {
		flex: 1 1 14rem;
		min-width: 0;
	}
	.foreign-dialog {
		display: grid;
		gap: 1.5rem;
		min-width: 0;
	}
	section,
	form {
		display: grid;
		gap: 0.75rem;
		min-width: 0;
	}
	h3 {
		margin: 0;
		font-size: 0.9375rem;
		font-weight: 650;
		line-height: 1.5;
	}
	p {
		margin: 0;
		line-height: 1.65;
	}
	.hint {
		color: var(--color-text-muted);
		font-size: 0.8125rem;
	}
	.status-note {
		padding: 0.75rem 1rem;
		border-radius: var(--radius-md);
		background: var(--color-mint-50);
		font-size: 0.875rem;
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		min-width: 0;
	}
	.term-chip {
		display: inline-flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.375rem 0.75rem;
		min-height: 44px;
		max-width: 100%;
		padding: 0.625rem 0.875rem;
		border: 1px solid var(--color-control-border);
		border-radius: var(--radius-pill);
		background: var(--color-mint-50);
		color: var(--color-text);
		font: inherit;
		font-size: 0.875rem;
		text-align: left;
		cursor: pointer;
	}
	.term-chip span {
		min-width: 0;
		overflow-wrap: anywhere;
	}
	.term-chip small {
		color: var(--color-text-muted);
		font-size: 0.75rem;
	}
	.ignored {
		background: var(--color-surface);
	}
	button:disabled {
		cursor: not-allowed;
		opacity: 0.65;
	}
	.add-term {
		justify-self: start;
		min-width: 44px;
		min-height: 44px;
		padding: 0.75rem 1rem;
		border: 1px solid transparent;
		border-radius: var(--radius-md);
		background: var(--color-brand);
		color: var(--color-on-brand);
		font: inherit;
		font-size: 0.875rem;
		font-weight: 650;
		cursor: pointer;
	}
	.announcement {
		min-height: 1.5rem;
		color: var(--color-text-muted);
		font-size: 0.8125rem;
		overflow-wrap: anywhere;
	}
</style>
