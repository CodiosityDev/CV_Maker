<script lang="ts">
	import { onDestroy, onMount, untrack } from 'svelte';
	import type { ConcisePoint, ConciseReport } from '#lib/core/ats/concise.ts';
	import type { CVDocument } from '#lib/core/schema/types.ts';
	import { createCvStore, type CvStore } from '#lib/core/store/cv-store.svelte.ts';
	import { incognito } from '#lib/core/storage/index.ts';
	import { t } from '#lib/i18n/index.svelte.ts';
	import { getIncognitoUiContext } from '#lib/ui/incognito-context.ts';
	import Button from '#lib/ui/Button.svelte';
	import { toast } from '#lib/ui/toast.svelte.ts';
	import ConcisePanel from './ConcisePanel.svelte';
	import { applyConcisePoint } from './concise-target.ts';

	let {
		cv,
		report,
		resetKey,
		onfix,
		onchange,
		registerStore
	}: {
		cv: CVDocument;
		report?: ConciseReport;
		resetKey?: string;
		onfix?: (target: NonNullable<ConcisePoint['target']>) => void;
		onchange: (document: CVDocument) => void;
		registerStore?: (store: CvStore) => () => void;
	} = $props();
	const store = untrack(() => createCvStore($state.snapshot(cv)));
	const openedId = untrack(() => cv.id);
	const openedMode = untrack(() => incognito.active);
	const openedExpiry = untrack(() => incognito.expiredAt);
	const incognitoUi = getIncognitoUiContext();
	let mounted = true;
	const invalidated = $derived(
		store.externalChange !== 'none' ||
			incognito.active !== openedMode ||
			incognito.expiredAt !== openedExpiry ||
			(openedMode && Boolean(incognito.expiredAt))
	);
	const active = $derived(cv?.id === openedId && store.cv.id === openedId && !invalidated);

	function content(document: CVDocument): string {
		return JSON.stringify({ ...document, updatedAt: undefined });
	}
	function usable(): boolean {
		return mounted && active && content($state.snapshot(cv)) === content($state.snapshot(store.cv));
	}
	$effect(() => {
		const next = $state.snapshot(cv);
		if (invalidated) {
			untrack(() => store.applyExternalChange({ type: 'wiped' }));
			return;
		}
		if (!next || next.id !== openedId) return;
		// Parent echoes our own changes synchronously; retain their undo history during reanalysis.
		if (content(next) !== untrack(() => content($state.snapshot(store.cv))))
			untrack(() => store.replace(next));
	});

	onMount(() => {
		const unregisterStore = registerStore?.(store);
		const beforeStart = incognitoUi?.registerBeforeStart(async () => {
			if (!usable()) return true;
			await store.flush();
			return store.saveState !== 'error';
		});
		const beforeEnd = incognitoUi?.registerBeforeEnd(() =>
			store.applyExternalChange({ type: 'wiped' })
		);
		return () => {
			unregisterStore?.();
			beforeStart?.();
			beforeEnd?.();
		};
	});
	onDestroy(() => {
		mounted = false;
		if (
			store.externalChange !== 'none' ||
			incognito.active !== openedMode ||
			incognito.expiredAt !== openedExpiry
		)
			store.applyExternalChange({ type: 'wiped' });
		void store.destroy();
	});

	function persist(): void {
		void store.flush().then(() => {
			if (usable() && store.saveState === 'error') toast.error(t('wizard.saveError'));
		});
	}
	function apply(point: ConcisePoint, text: string): boolean {
		if (
			!usable() ||
			!report?.points.some(
				(candidate) => candidate.key === point.key && candidate.text === point.text
			)
		)
			return false;
		if (!applyConcisePoint(store, point, text)) return false;
		onchange($state.snapshot(store.cv));
		persist();
		return true;
	}
	function undo(): void {
		if (!usable() || !store.canUndo) return;
		store.undo();
		onchange($state.snapshot(store.cv));
		persist();
	}
</script>

<div data-testid="saved-concise-state" data-save-state={store.saveState}>
	{#if active}
		{#if report?.score !== undefined}
			<ConcisePanel {report} locale={store.cv.locale} {resetKey} {onfix} onapply={apply} />
		{/if}
		{#if store.canUndo}
			<div class="undo-action">
				<Button id="saved-concise-undo" variant="secondary" size="sm" onclick={undo}
					>{t('ui.undo')}</Button
				>
			</div>
		{/if}
	{/if}
</div>

<style>
	.undo-action {
		display: flex;
		justify-content: flex-start;
		margin-top: 12px;
	}
</style>
