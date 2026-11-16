<script lang="ts">
	import { onDestroy, onMount, untrack } from 'svelte';
	import { beforeNavigate } from '$app/navigation';
	import type { CVDocument } from '#lib/core/schema/types.ts';
	import { createCvStore } from '#lib/core/store/cv-store.svelte.ts';
	import { findLetter } from '#lib/core/letter/index.ts';
	import { incognito, onExternalChange, storage } from '#lib/core/storage/index.ts';
	import { t } from '#lib/i18n/index.svelte.ts';
	import { getIncognitoUiContext } from '#lib/ui/incognito-context.ts';
	import Button from '#lib/ui/Button.svelte';
	import { toast } from '#lib/ui/toast.svelte.ts';
	import { initLetterNavigation } from './navigation.svelte.ts';
	let { initial, letterId }: { initial: CVDocument; letterId?: string } = $props();
	const store = untrack(() => createCvStore(initial));
	const mode = untrack(() => incognito.active);
	const incognitoUi = getIncognitoUiContext();
	let memory = $state(false);
	let mounted = true;
	let invalidated = $state(false);
	let loadAttempt = $state(0);
	let List = $state.raw<typeof import('./LetterList.svelte').default>();
	let Editor = $state.raw<typeof import('./LetterEditor.svelte').default>();
	let editorImport: Promise<typeof import('./LetterEditor.svelte')> | undefined;
	let listImport: Promise<typeof import('./LetterList.svelte')> | undefined;
	let loading = $state(true);
	let loadFailed = $state(false);
	let lastLoaded = $state(untrack(() => initial.updatedAt));
	const removed = $derived(
		invalidated ||
			store.externalChange === 'removed' ||
			mode !== incognito.active ||
			(mode && Boolean(incognito.expiredAt))
	);
	const saved = $derived(
		store.lastSavedAt && store.lastSavedAt > lastLoaded ? store.lastSavedAt : lastLoaded
	);
	const hasLetter = $derived(!letterId || Boolean(findLetter(store.cv, letterId)));
	const navigation = initLetterNavigation(store, () => mounted && !removed);

	onMount(() => {
		const headerLink = (event: MouseEvent) => {
			const anchor =
				event.target instanceof Element
					? event.target.closest<HTMLAnchorElement>('.app-header a[href]')
					: null;
			if (anchor) navigation.click(event, anchor);
		};
		document.addEventListener('click', headerLink, true);
		const beforeStart = incognitoUi?.registerBeforeStart(async () => {
			await store.flush();
			return store.saveState !== 'error';
		});
		const beforeEnd = incognitoUi?.registerBeforeEnd(() => invalidate());
		const stopExternal = onExternalChange((event) => {
			if (event.type === 'wiped' || (event.type === 'cv-removed' && event.id === store.cv.id))
				invalidate();
		});
		const stopExpire = incognito.onExpire(invalidate);
		void storage.getMode().then((value) => {
			if (mounted) memory = value === 'memory';
		});
		return () => {
			document.removeEventListener('click', headerLink, true);
			beforeStart?.();
			beforeEnd?.();
			stopExternal();
			stopExpire();
		};
	});
	beforeNavigate(() => {
		void store.flush();
	});
	onDestroy(() => {
		mounted = false;
		void store.destroy();
	});
	$effect(() => {
		if (mode !== incognito.active) untrack(invalidate);
	});
	$effect(() => {
		const id = letterId;
		const missing = !hasLetter;
		const gone = removed;
		void loadAttempt;
		let cancelled = false;
		List = undefined;
		Editor = undefined;
		loadFailed = false;
		loading = !gone && !missing;
		if (gone || missing) return;
		const failed = () => {
			if (!cancelled && mounted && !removed) {
				loadFailed = true;
				loading = false;
			}
		};
		if (id) {
			editorImport ??= import('./LetterEditor.svelte');
			void editorImport.then(
				(module) => {
					if (cancelled || !mounted || removed) return;
					Editor = module.default;
					loading = false;
				},
				() => {
					editorImport = undefined;
					failed();
				}
			);
		} else {
			listImport ??= import('./LetterList.svelte');
			void listImport.then(
				(module) => {
					if (cancelled || !mounted || removed) return;
					List = module.default;
					loading = false;
				},
				() => {
					listImport = undefined;
					failed();
				}
			);
		}
		return () => {
			cancelled = true;
		};
	});
	function invalidate() {
		invalidated = true;
		store.applyExternalChange({ type: 'wiped' });
	}
	async function reload() {
		const session = incognito.active;
		const expiry = incognito.expiredAt;
		try {
			const exists = await store.reloadFromRepo();
			if (!mounted || invalidated || session !== incognito.active || expiry !== incognito.expiredAt)
				invalidate();
			else if (exists) lastLoaded = store.cv.updatedAt;
			else invalidate();
		} catch {
			if (mounted && !invalidated) toast.error(t('dashboard.actionError'));
		}
	}
</script>

{#if removed}
	<div class="site-container workspace-notice" role="alert">
		<p>{t(incognito.expiredAt ? 'incognito.expiredMessage' : 'wizard.externalRemoved')}</p>
		<Button href="/surat">{t('letterEditor.backToLetters')}</Button>
	</div>
{:else}
	{#if memory}<p class="site-container notice" role="status">{t('wizard.memoryWarning')}</p>{/if}
	{#if store.externalChange === 'updated'}<div class="site-container notice" role="alert">
			<p>{t('wizard.externalUpdated')}</p>
			<div class="actions">
				<Button variant="secondary" onclick={reload}>{t('wizard.reload')}</Button><Button
					variant="ghost"
					onclick={() => store.keepLocalVersion()}>{t('wizard.keepLocal')}</Button
				>
			</div>
		</div>{/if}
	{#if !hasLetter}<div class="site-container workspace-notice">
			<h1>{t('letterEditor.missingLetter')}</h1>
			<Button href={`/cv/${store.cv.id}/surat`} onclick={navigation.click}
				>{t('letterEditor.backToLetters')}</Button
			>
		</div>
	{:else if loading}<p class="site-container notice" role="status">{t('common.loading')}</p>
	{:else if loadFailed}<div class="site-container notice" role="alert">
			<p>{t('dashboard.actionError')}</p>
			<Button variant="secondary" onclick={() => (loadAttempt += 1)}>{t('wizard.retry')}</Button>
		</div>
	{:else if !letterId && List}<List {store} />
	{:else if letterId && Editor}<Editor {store} {letterId} />{/if}
	<div
		class="site-container save-state"
		role="status"
		aria-live="polite"
		data-testid="letter-save-state"
		data-save-state={store.saveState === 'error'
			? 'error'
			: store.saveState === 'saving' || store.cv.updatedAt !== saved
				? 'saving'
				: 'saved'}
	>
		{#if store.saveState === 'error'}<p>{t('wizard.saveError')}</p>
			<Button variant="ghost" onclick={() => store.flush()}>{t('wizard.retry')}</Button>
		{:else if store.saveState === 'saving' || store.cv.updatedAt !== saved}{t('wizard.saving')}
		{:else}{t(
				incognito.active ? 'incognito.saved' : memory ? 'wizard.savedMemory' : 'wizard.saved'
			)}{/if}
	</div>
{/if}

<style>
	.workspace-notice {
		display: grid;
		justify-items: start;
		gap: 20px;
		max-width: 48rem;
		padding-block: 40px;
	}
	.workspace-notice h1 {
		font-size: 1.75rem;
	}
	.notice {
		max-width: 72rem;
		padding: 20px;
		margin-block: 20px;
		border-radius: var(--radius-md);
		background: var(--color-mint-50);
		line-height: 1.7;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-top: 12px;
	}
	.save-state {
		display: flex;
		align-items: center;
		gap: 8px;
		max-width: 1400px;
		padding-block: 16px 32px;
		color: var(--color-text-muted);
		font-size: 0.8125rem;
	}
</style>
