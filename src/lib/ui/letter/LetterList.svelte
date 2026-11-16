<script lang="ts">
	import { onDestroy } from 'svelte';
	import { resolve } from '$app/paths';
	import {
		addLetter,
		createLetter,
		duplicateLetter,
		findLetter,
		LETTER_LIMITS,
		letterTitle,
		removeLetter,
		toLetterModel
	} from '#lib/core/letter/index.ts';
	import type { CvStore } from '#lib/core/store/cv-store.svelte.ts';
	import { incognito } from '#lib/core/storage/index.ts';
	import { i18n, t } from '#lib/i18n/index.svelte.ts';
	import FormalLetter from '#lib/templates/letter/FormalLetter.svelte';
	import Button from '#lib/ui/Button.svelte';
	import Dialog from '#lib/ui/Dialog.svelte';
	import { toast } from '#lib/ui/toast.svelte.ts';
	import { getLetterNavigation } from './navigation.svelte.ts';
	const navigation = getLetterNavigation();
	let { store }: { store: CvStore } = $props();
	let busy = $state(false);
	let deleting = $state<string>();
	let deleteOpen = $state(false);
	let mounted = true;
	let undoToast: number | undefined;
	let deleteVersion = '';
	const letters = $derived(store.cv.letters ?? []);
	const full = $derived(letters.length >= LETTER_LIMITS.perCv);
	const example = $derived(toLetterModel(store.cv, createLetter(store.cv)));
	onDestroy(() => {
		mounted = false;
		if (undoToast !== undefined) toast.dismiss(undoToast);
	});
	function valid(mode: boolean) {
		return (
			mounted &&
			mode === incognito.active &&
			!incognito.expiredAt &&
			store.externalChange !== 'removed'
		);
	}
	async function open(id: string) {
		const mode = incognito.active;
		busy = true;
		try {
			if (valid(mode) && findLetter(store.cv, id))
				await navigation.go(
					resolve('/(app)/cv/[id]/surat/[letterId]', { id: store.cv.id, letterId: id })
				);
		} catch {
			if (valid(mode)) toast.error(t('dashboard.actionError'));
		} finally {
			if (mounted) busy = false;
		}
	}
	function create() {
		if (busy || full) return;
		const letter = createLetter(store.cv);
		store.update((d) => {
			addLetter(d, letter);
		});
		void open(letter.id);
	}
	function duplicate(id: string) {
		if (busy || full) return;
		let copy: string | undefined;
		store.update((d) => {
			// The pure helper clones its source. Pass a plain snapshot instead of a Svelte proxy.
			const snapshot = $state.snapshot(d);
			copy = duplicateLetter(snapshot, id);
			const letter = copy ? findLetter(snapshot, copy) : undefined;
			if (letter) addLetter(d, letter);
		});
		if (copy) void open(copy);
	}
	function remove() {
		if (!deleting || busy || !findLetter(store.cv, deleting)) return;
		const id = deleting;
		store.update((d) => removeLetter(d, id));
		deleteVersion = JSON.stringify(store.cv);
		deleteOpen = false;
		deleting = undefined;
		if (undoToast !== undefined) toast.dismiss(undoToast);
		const mode = incognito.active;
		undoToast = toast.info(t('letterEditor.deleted'), {
			labelKey: 'ui.undo',
			run: () => {
				if (valid(mode) && JSON.stringify(store.cv) === deleteVersion) store.undo();
				if (undoToast !== undefined) toast.dismiss(undoToast);
				undoToast = undefined;
			}
		});
	}
</script>

<div
	class="site-container letter-list"
	inert={navigation.busy}
	aria-busy={navigation.busy || undefined}
>
	<div class="page-heading">
		<div>
			<a class="back-link" href={resolve('/(app)/surat')} onclick={navigation.click}
				>{t('letterEditor.backToLetters')}</a
			>
			<h1>{t('letterEditor.title')}</h1>
			<p>{store.cv.title || t('dashboard.untitled')}</p>
		</div>
		{#if letters.length}<Button disabled={busy || full} onclick={create}
				>{t('letterEditor.newLetter')}</Button
			>{/if}
	</div>
	{#if !store.cv.status.wizardCompleted}<p class="notice">
			{t('letterEditor.incomplete')}
			<a href={resolve('/(app)/buat/[id]', { id: store.cv.id })} onclick={navigation.click}
				>{t('letterEditor.incompleteLink')}</a
			>
		</p>{/if}
	{#if full}<p class="notice" role="status">
			{t('letterEditor.limit', { count: LETTER_LIMITS.perCv })}
		</p>{/if}
	{#if !letters.length}<section class="empty" data-testid="letter-list-empty">
			<div class="miniature" aria-hidden="true" inert>
				<div class="miniature-paper"><FormalLetter model={example} /></div>
			</div>
			<div>
				<p>{t('letterEditor.emptyLettersHint')}</p>
				<Button onclick={create} disabled={busy}>{t('letterEditor.newLetter')}</Button>
			</div>
		</section>
	{:else}<section
			class="letters"
			aria-label={t('letterEditor.listTitle', { title: store.cv.title || t('dashboard.untitled') })}
		>
			{#each letters as letter (letter.id)}<article class="letter-card" data-testid="letter-card">
					<h2>
						<a
							href={resolve('/(app)/cv/[id]/surat/[letterId]', {
								id: store.cv.id,
								letterId: letter.id
							})}
							onclick={(event) => {
								if (
									event.button !== 0 ||
									event.ctrlKey ||
									event.metaKey ||
									event.shiftKey ||
									event.altKey
								)
									return;
								event.preventDefault();
								void open(letter.id);
							}}>{letterTitle(letter) || t('letterEditor.untitled')}</a
						>
					</h2>
					<p>
						<time datetime={letter.updatedAt}
							>{t('letterEditor.updated', {
								date: new Intl.DateTimeFormat(i18n.locale === 'id' ? 'id-ID' : 'en-GB', {
									dateStyle: 'medium'
								}).format(new Date(letter.updatedAt))
							})}</time
						>
					</p>
					<div class="actions">
						<Button variant="secondary" disabled={busy} onclick={() => void open(letter.id)}
							>{t('dashboard.edit')}</Button
						><Button variant="ghost" disabled={busy || full} onclick={() => duplicate(letter.id)}
							>{t('letterEditor.duplicate')}</Button
						><Button
							variant="ghost"
							disabled={busy}
							onclick={() => {
								deleting = letter.id;
								deleteOpen = true;
							}}>{t('letterEditor.remove')}</Button
						>
					</div>
				</article>{/each}
		</section>{/if}
</div>

<Dialog
	bind:open={deleteOpen}
	title={t('letterEditor.deleteTitle')}
	description={t('letterEditor.deleteDescription', {
		title: letters.find((letter) => letter.id === deleting)
			? letterTitle(letters.find((letter) => letter.id === deleting)!)
			: ''
	})}
>
	<div class="actions">
		<Button variant="ghost" onclick={() => (deleteOpen = false)}>{t('common.cancel')}</Button
		><Button variant="danger" onclick={remove}>{t('letterEditor.remove')}</Button>
	</div>
</Dialog>

<style>
	.letter-list {
		max-width: 1080px;
		padding-block: 32px 48px;
	}
	.page-heading {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 20px;
	}
	h1 {
		font-size: clamp(1.75rem, 5vw, 2.5rem);
		font-weight: 650;
		margin-block: 16px 8px;
	}
	.page-heading p,
	.letter-card p {
		color: var(--color-text-muted);
		font-size: 0.875rem;
		overflow-wrap: anywhere;
	}
	.back-link {
		display: inline-flex;
		min-height: 44px;
		align-items: center;
		color: var(--color-brand-ink);
		font-size: 0.875rem;
	}
	.notice {
		margin-top: 24px;
		padding: 16px 20px;
		border-radius: var(--radius-md);
		background: var(--color-mint-50);
		font-size: 0.875rem;
		line-height: 1.7;
	}
	.notice a {
		color: var(--color-brand-ink);
	}
	.letters {
		display: grid;
		gap: 16px;
		margin-top: 28px;
	}
	.letter-card {
		min-width: 0;
		padding: 24px;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
	}
	h2 {
		font-size: 1.125rem;
		font-weight: 650;
		line-height: 1.6;
		overflow-wrap: anywhere;
	}
	h2 a {
		color: var(--color-text);
		text-decoration: none;
	}
	.letter-card p {
		margin-top: 12px;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-top: 20px;
	}
	.empty {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 28px;
		padding-block: 40px;
	}
	.empty p {
		max-width: 30rem;
		line-height: 1.7;
		margin-bottom: 20px;
	}
	.miniature {
		width: 150px;
		height: 212px;
		overflow: hidden;
		background: #fff;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
	}
	.miniature-paper {
		width: 210mm;
		transform: scale(0.188);
		transform-origin: top left;
	}
	.empty > div:last-child {
		flex: 1;
		min-width: 180px;
	}
	@media (min-width: 768px) {
		.letter-list {
			padding-top: 40px;
		}
		.letters {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
</style>
