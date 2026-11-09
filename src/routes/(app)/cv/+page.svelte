<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { CVDocument, CVMeta } from '#lib/core/schema/types.ts';
	import { LIMITS } from '#lib/core/schema/limits.ts';
	import { cvRepo, incognito, storage, onExternalChange } from '#lib/core/storage/index.ts';
	import { i18n, t, type MessageKey } from '#lib/i18n/index.svelte.ts';
	import Button from '#lib/ui/Button.svelte';
	import Dialog from '#lib/ui/Dialog.svelte';
	import Input from '#lib/ui/Input.svelte';
	import ExportPanel from '#lib/ui/ExportPanel.svelte';
	import IncognitoEndDialog from '#lib/ui/IncognitoEndDialog.svelte';
	import { resolveTemplate } from '#lib/templates/registry.ts';
	import { toast } from '#lib/ui/toast.svelte.ts';

	let cvs = $state<CVMeta[]>([]);
	let loading = $state(true);
	let listError = $state(false);
	let memory = $state(false);
	let busy = $state(false);
	let endOpen = $state(false);
	let menuOpen = $state(false);
	let menuCv = $state<CVMeta>();
	let exportOpen = $state(false);
	let exportCv = $state.raw<CVDocument>();
	let renameOpen = $state(false);
	let renameCv = $state<CVMeta>();
	let renameTitle = $state('');
	let renameError = $state(false);
	let deleteOpen = $state(false);
	let deleteCv = $state<CVMeta>();
	let wipeOpen = $state(false);
	let wipeText = $state('');
	const wipeInstruction = $derived(t('dashboard.wipeInput').split('{word}'));
	let active = $state(false);
	let listRequest = 0;

	async function refresh() {
		const request = ++listRequest;
		const session = incognito.active;
		const expiredAt = incognito.expiredAt;
		try {
			const [list, mode] = await Promise.all([cvRepo.list(), storage.getMode()]);
			if (
				!active ||
				request !== listRequest ||
				session !== incognito.active ||
				expiredAt !== incognito.expiredAt
			)
				return;
			cvs = list;
			memory = mode === 'memory';
			listError = false;
			const ids = new Set(list.map((cv) => cv.id));
			for (const cv of [menuCv, renameCv, deleteCv, exportCv]) {
				if (cv && !ids.has(cv.id)) clearDialogs(cv.id);
			}
			if (exportOpen && exportCv) {
				const id = exportCv.id;
				const doc = await cvRepo.get(id);
				if (
					active &&
					request === listRequest &&
					session === incognito.active &&
					expiredAt === incognito.expiredAt &&
					exportOpen &&
					exportCv?.id === id
				) {
					exportCv = doc ?? undefined;
					if (!doc) exportOpen = false;
				}
			}
		} catch {
			if (active && request === listRequest) listError = true;
		} finally {
			if (active && request === listRequest) loading = false;
		}
	}

	onMount(() => {
		active = true;
		const unsubscribe = onExternalChange((event) => {
			if (event.type === 'cv-removed') forgetCv(event.id);
			else if (event.type === 'wiped') forgetCv();
			void refresh();
		});
		const visible = () => {
			if (document.visibilityState === 'visible') void refresh();
		};
		document.addEventListener('visibilitychange', visible);
		return () => {
			active = false;
			listRequest += 1;
			unsubscribe();
			document.removeEventListener('visibilitychange', visible);
		};
	});

	function clearDialogs(id?: string) {
		if (id === undefined || menuCv?.id === id) {
			menuOpen = false;
			menuCv = undefined;
		}
		if (id === undefined || renameCv?.id === id) {
			renameOpen = false;
			renameCv = undefined;
			renameTitle = '';
			renameError = false;
		}
		if (id === undefined || deleteCv?.id === id) {
			deleteOpen = false;
			deleteCv = undefined;
		}
		if (id === undefined || exportCv?.id === id) {
			exportOpen = false;
			exportCv = undefined;
		}
		if (id === undefined) {
			wipeOpen = false;
			wipeText = '';
		}
	}

	function forgetCv(id?: string) {
		cvs = id === undefined ? [] : cvs.filter((cv) => cv.id !== id);
		clearDialogs(id);
	}

	$effect(() => {
		void incognito.active;
		void incognito.expiredAt;
		if (!active) return;
		cvs = [];
		clearDialogs();
		memory = false;
		listError = false;
		loading = true;
		void refresh();
	});

	function more(cv: CVMeta) {
		menuCv = cv;
		menuOpen = true;
	}

	async function checkAts(cv: CVMeta) {
		if (busy) return;
		busy = true;
		menuOpen = false;
		try {
			await goto(resolve('/(app)/buat/[id]?step=review#ats-panel', { id: cv.id }));
		} catch {
			if (active) toast.error(t('dashboard.actionError'));
		} finally {
			if (active) busy = false;
		}
	}

	async function showExport(cv: CVMeta, trigger: EventTarget | null) {
		if (busy) return;
		const session = incognito.active;
		const expiredAt = incognito.expiredAt;
		const sameSession = () =>
			active &&
			session === incognito.active &&
			expiredAt === incognito.expiredAt &&
			cvs.some((item) => item.id === cv.id);
		busy = true;
		try {
			const doc = await cvRepo.get(cv.id);
			if (!sameSession()) return;
			if (!doc) {
				toast.info(t('dashboard.missing'));
				await refresh();
				return;
			}
			exportCv = doc;
			busy = false;
			await tick();
			if (!sameSession() || exportCv?.id !== cv.id) return;
			// Touch activation need not focus buttons; give the dialog a reliable return target.
			if (trigger instanceof HTMLElement && trigger.isConnected)
				trigger.focus({ preventScroll: true });
			exportOpen = true;
		} catch {
			if (active) toast.error(t('dashboard.actionError'));
		} finally {
			if (active) busy = false;
		}
	}

	async function duplicate(cv: CVMeta) {
		if (busy) return;
		busy = true;
		menuOpen = false;
		try {
			const copy = await cvRepo.duplicate(cv.id);
			if (!active) return;
			toast[copy ? 'success' : 'info'](t(copy ? 'dashboard.duplicated' : 'dashboard.missing'));
			await refresh();
		} catch {
			if (active) toast.error(t('dashboard.actionError'));
		} finally {
			if (active) busy = false;
		}
	}

	function openRename(cv: CVMeta) {
		menuOpen = false;
		renameCv = cv;
		renameTitle = cv.title;
		renameError = false;
		renameOpen = true;
	}

	async function rename(event: SubmitEvent) {
		event.preventDefault();
		if (busy || !renameCv) return;
		renameError = !renameTitle.trim();
		if (renameError) return;
		const id = renameCv.id;
		const title = renameTitle.trim();
		busy = true;
		try {
			const existing = await cvRepo.get(id);
			if (!existing) {
				if (active) toast.info(t('dashboard.missing'));
			} else {
				await cvRepo.rename(id, title);
				if (active) toast.success(t('dashboard.renamed'));
			}
			if (!active) return;
			if (renameCv?.id === id) renameOpen = false;
			await refresh();
		} catch {
			if (active) toast.error(t('dashboard.actionError'));
		} finally {
			if (active) busy = false;
		}
	}

	function openDelete(cv: CVMeta) {
		menuOpen = false;
		deleteCv = cv;
		deleteOpen = true;
	}

	async function remove() {
		if (busy || !deleteCv) return;
		const id = deleteCv.id;
		busy = true;
		try {
			await cvRepo.remove(id);
			if (!active) return;
			forgetCv(id);
			toast.success(t('dashboard.deleted'));
			await refresh();
		} catch {
			if (active) toast.error(t('dashboard.actionError'));
		} finally {
			if (active) busy = false;
		}
	}

	async function wipe(event: SubmitEvent) {
		event.preventDefault();
		if (busy || wipeText.trim().toUpperCase() !== t('dashboard.wipeWord')) return;
		busy = true;
		try {
			await storage.wipeAll();
			if (!active) return;
			forgetCv();
			toast.success(t('dashboard.wipeDone'));
			await refresh();
		} catch {
			if (active) toast.error(t('dashboard.actionError'));
		} finally {
			if (active) busy = false;
		}
	}
</script>

<svelte:head>
	<title>{t('dashboard.pageTitle')}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

{#snippet actions(cv: CVMeta)}
	<button type="button" disabled={busy} onclick={() => checkAts(cv)}
		>{t('dashboard.checkAts')}</button
	>
	<button type="button" disabled={busy} onclick={() => duplicate(cv)}
		>{t('dashboard.duplicate')}</button
	>
	<button type="button" disabled={busy} onclick={() => openRename(cv)}
		>{t('dashboard.rename')}</button
	>
	<button type="button" class="delete-action" disabled={busy} onclick={() => openDelete(cv)}
		>{t('dashboard.delete')}</button
	>
{/snippet}

<div class="site-container dashboard">
	<div class="page-heading">
		<div>
			<h1>{t('dashboard.title')}</h1>
			{#if incognito.active}<p class="session-label">{t('incognito.sessionLabel')}</p>{/if}
		</div>
		<Button href="/buat">{t('dashboard.create')}</Button>
	</div>
	{#if !incognito.active}<p class="local-note">{t('dashboard.localNote')}</p>{/if}
	{#if memory}<p class="memory-warning" role="status">{t('dashboard.memoryWarning')}</p>{/if}
	{#if incognito.active && incognito.expiredAt}
		<p class="session-notice" role="status">{t('incognito.expiredMessage')}</p>
	{/if}

	{#if listError}
		<div class="list-error" role="alert">
			<p>{t('dashboard.loadError')}</p>
			<Button variant="secondary" onclick={() => void refresh()}>{t('dashboard.retry')}</Button>
		</div>
	{/if}
	{#if loading}
		<p class="loading" role="status">{t('dashboard.loading')}</p>
	{:else if !cvs.length && !listError}
		<div class="empty" data-testid="dashboard-empty">
			<p>{t('dashboard.empty')}</p>
			<Button href="/buat">{t('dashboard.create')}</Button>
		</div>
	{:else if cvs.length}
		<div class="cv-list">
			{#each cvs as cv (cv.id)}
				<article class="cv-card" data-testid="cv-card" aria-labelledby="cv-title-{cv.id}">
					<div class="card-heading">
						<h2 id="cv-title-{cv.id}">{cv.title || t('dashboard.untitled')}</h2>
						<button
							class="more"
							type="button"
							disabled={busy}
							onclick={() => more(cv)}
							aria-label={t('dashboard.more', { title: cv.title || t('dashboard.untitled') })}
						>
							<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"
								><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle
									cx="19"
									cy="12"
									r="1.8"
								/></svg
							>
						</button>
					</div>
					<p class="full-name">{cv.fullName || t('dashboard.nameMissing')}</p>
					<p class="target-role">{cv.targetRole || t('dashboard.roleMissing')}</p>
					<div class="cv-meta">
						<span>{t(cv.kind === 'ats' ? 'dashboard.kindAts' : 'dashboard.kindCreative')}</span>
						<span
							>{t(
								`templates.${resolveTemplate(cv.templateId, cv.kind).id}.name` as MessageKey
							)}</span
						>
						{#if !cv.wizardCompleted}<span class="unfinished">{t('dashboard.unfinished')}</span
							>{/if}
					</div>
					<p class="updated">
						{t('dashboard.updatedAt')}
						<time datetime={cv.updatedAt}
							>{new Intl.DateTimeFormat(i18n.locale === 'id' ? 'id-ID' : 'en-GB', {
								dateStyle: 'medium',
								timeStyle: 'short'
							}).format(new Date(cv.updatedAt))}</time
						>
					</p>
					<div class="primary-actions">
						<Button href={`/buat/${cv.id}`} variant="secondary"
							>{t(cv.wizardCompleted ? 'dashboard.edit' : 'dashboard.continue')}</Button
						>
						<Button disabled={busy} onclick={(event) => showExport(cv, event.currentTarget)}
							>{t('dashboard.download')}</Button
						>
					</div>
					<div class="secondary-actions">{@render actions(cv)}</div>
				</article>
			{/each}
		</div>
	{/if}

	{#if incognito.active}
		<section class="session-end" aria-labelledby="session-end-heading">
			<div>
				<h2 id="session-end-heading">{t('incognito.endTitle')}</h2>
				<p>{t('incognito.endDescription')}</p>
			</div>
			<Button variant="secondary" disabled={busy || loading} onclick={() => (endOpen = true)}
				>{t('incognito.endAction')}</Button
			>
		</section>
	{:else}
		<section class="danger-zone" aria-labelledby="wipe-heading">
			<div>
				<h2 id="wipe-heading">{t('dashboard.wipeTitle')}</h2>
				<p>{t('dashboard.wipeDescription')}</p>
			</div>
			<Button
				variant="ghost"
				disabled={busy || loading}
				onclick={() => {
					wipeText = '';
					wipeOpen = true;
				}}>{t('dashboard.wipeAction')}</Button
			>
		</section>
	{/if}
</div>

<IncognitoEndDialog bind:open={endOpen} />

<Dialog
	bind:open={menuOpen}
	title={menuCv?.title || t('dashboard.untitled')}
	presentation="sheet"
	closeOnBackdrop
>
	{#if menuCv}<div class="menu-actions">{@render actions(menuCv)}</div>{/if}
</Dialog>

<Dialog bind:open={exportOpen} title={t('dashboard.download')} presentation="sheet" closeOnBackdrop>
	{#if exportOpen && exportCv}
		{#if !exportCv.status.wizardCompleted}
			<p class="incomplete-note">{t('dashboard.unfinishedDownload')}</p>
		{/if}
		<ExportPanel cv={exportCv} />
	{/if}
</Dialog>

<Dialog bind:open={renameOpen} title={t('dashboard.renameTitle')}>
	<form onsubmit={rename}>
		<Input
			label={t('dashboard.titleLabel')}
			bind:value={renameTitle}
			maxlength={LIMITS.cvTitle}
			showCounter
			autocomplete={incognito.active ? 'off' : undefined}
			required
			disabled={busy}
			error={renameError ? t('dashboard.titleRequired') : undefined}
			oninput={() => (renameError = false)}
		/>
		<div class="dialog-actions">
			<Button variant="ghost" disabled={busy} onclick={() => (renameOpen = false)}
				>{t('common.cancel')}</Button
			>
			<Button type="submit" loading={busy}>{t('common.save')}</Button>
		</div>
	</form>
</Dialog>

<Dialog
	bind:open={deleteOpen}
	title={t('dashboard.deleteTitle')}
	description={t('dashboard.deleteDescription', {
		title: deleteCv?.title || t('dashboard.untitled')
	})}
>
	<div class="dialog-actions">
		<Button variant="ghost" disabled={busy} onclick={() => (deleteOpen = false)}
			>{t('common.cancel')}</Button
		>
		<Button variant="danger" loading={busy} onclick={remove}>{t('dashboard.delete')}</Button>
	</div>
</Dialog>

<Dialog
	bind:open={wipeOpen}
	title={t('dashboard.wipeConfirmTitle')}
	description={t('dashboard.wipeConfirmDescription')}
>
	<form onsubmit={wipe}>
		<p id="wipe-instruction" class="wipe-instruction">
			{wipeInstruction[0]}<strong class="confirm-word">{t('dashboard.wipeWord')}</strong
			>{wipeInstruction[1]}
		</p>
		<Input
			label={t('dashboard.wipeInputLabel')}
			bind:value={wipeText}
			disabled={busy}
			aria-describedby="wipe-instruction"
			autocomplete="off"
			autocapitalize="characters"
			spellcheck={false}
		/>
		<div class="dialog-actions">
			<Button variant="ghost" disabled={busy} onclick={() => (wipeOpen = false)}
				>{t('common.cancel')}</Button
			>
			<Button
				type="submit"
				variant="danger"
				loading={busy}
				disabled={wipeText.trim().toUpperCase() !== t('dashboard.wipeWord')}
				>{t('dashboard.wipeAction')}</Button
			>
		</div>
	</form>
</Dialog>

<style>
	.wipe-instruction {
		margin-bottom: 16px;
		font-size: 0.875rem;
		line-height: 1.8;
	}
	.confirm-word {
		padding: 2px 6px;
		border-radius: 4px;
		background: var(--color-coral-50);
		color: var(--color-ink);
		font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
		font-weight: 700;
		white-space: nowrap;
	}
	.dashboard {
		max-width: 1120px;
		padding-block: 32px 64px;
	}
	.page-heading {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		margin-bottom: 24px;
	}
	h1 {
		font-size: clamp(1.875rem, 5vw, 2.75rem);
		font-weight: 650;
	}
	h2 {
		font-size: 1.25rem;
		font-weight: 650;
	}
	.local-note {
		max-width: 800px;
		padding: 20px;
		border-radius: var(--radius-lg);
		background: var(--color-mint-50);
		color: var(--color-text-muted);
		font-size: 0.875rem;
		line-height: 1.7;
	}
	.session-label {
		margin-top: 4px;
		color: var(--color-brand-ink);
		font-size: 0.875rem;
	}
	.session-notice {
		margin-block: 20px;
		padding: 16px 20px;
		border-radius: var(--radius-lg);
		background: var(--color-brand-50);
		color: var(--color-ink);
		font-size: 0.875rem;
		line-height: 1.7;
	}
	.memory-warning,
	.list-error {
		margin-top: 16px;
		padding: 16px;
		border-radius: var(--radius-md);
		background: var(--color-coral-50);
		color: var(--color-danger);
		font-size: 0.875rem;
	}
	.list-error {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 12px;
	}
	.loading {
		margin-block: 32px;
		color: var(--color-text-muted);
	}
	.empty {
		display: grid;
		justify-items: start;
		gap: 20px;
		padding-block: 40px;
	}
	.empty p {
		color: var(--color-text-muted);
	}
	.cv-list {
		display: grid;
		gap: 20px;
		margin-top: 28px;
	}
	.cv-card {
		min-width: 0;
		padding: 20px;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
		box-shadow: var(--shadow-card);
	}
	.card-heading {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 8px;
	}
	.card-heading h2 {
		min-width: 0;
		padding-top: 8px;
		overflow-wrap: anywhere;
		line-height: 1.5;
	}
	.more {
		display: grid;
		width: 44px;
		min-width: 44px;
		height: 44px;
		place-items: center;
		padding: 0;
		border: 0;
		border-radius: var(--radius-md);
		background: var(--color-brand-50);
		color: var(--color-brand-ink);
		cursor: pointer;
	}
	.more svg {
		width: 24px;
		height: 24px;
	}
	.full-name {
		margin-top: 12px;
		font-weight: 600;
		overflow-wrap: anywhere;
	}
	.target-role {
		margin-top: 4px;
		color: var(--color-text-muted);
		font-size: 0.875rem;
		overflow-wrap: anywhere;
	}
	.cv-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 8px 16px;
		margin-top: 20px;
		font-size: 0.75rem;
		color: var(--color-text-muted);
	}
	.unfinished {
		color: var(--color-brand-ink);
		font-weight: 600;
	}
	.updated {
		margin-top: 8px;
		color: var(--color-text-muted);
		font-size: 0.75rem;
		overflow-wrap: anywhere;
	}
	.primary-actions {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 12px;
		margin-top: 24px;
	}
	.primary-actions :global(.button) {
		padding-inline: 12px;
	}
	.secondary-actions {
		display: none;
	}
	.secondary-actions button,
	.menu-actions button {
		min-height: 44px;
		padding: 8px 12px;
		border: 0;
		border-radius: var(--radius-md);
		background: transparent;
		color: var(--color-brand-ink);
		font: inherit;
		font-size: 0.875rem;
		font-weight: 600;
		text-align: left;
		cursor: pointer;
	}
	.secondary-actions button:hover:not(:disabled),
	.menu-actions button:hover:not(:disabled) {
		background: var(--color-brand-50);
	}
	.secondary-actions button.delete-action,
	.menu-actions button.delete-action {
		color: var(--color-danger);
	}
	button:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}
	.menu-actions {
		display: grid;
		gap: 8px;
	}
	.incomplete-note {
		margin-bottom: 20px;
		padding: 12px 16px;
		border-radius: var(--radius-md);
		background: var(--color-mint-50);
		color: var(--color-text-muted);
		font-size: 0.875rem;
		line-height: 1.7;
	}
	.danger-zone p,
	.session-end p {
		margin-top: 8px;
		color: var(--color-text-muted);
		font-size: 0.875rem;
		line-height: 1.7;
	}
	.danger-zone,
	.session-end {
		display: grid;
		justify-items: start;
		gap: 16px;
		margin-top: 32px;
		padding: 20px;
		border-radius: var(--radius-lg);
		background: var(--color-coral-50);
	}
	.session-end {
		background: var(--color-brand-50);
	}
	.danger-zone h2,
	.session-end h2 {
		font-size: 1rem;
	}
	.danger-zone :global(.button) {
		color: var(--color-danger);
		padding-inline: 0;
		text-align: left;
	}
	.dialog-actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: 12px;
		margin-top: 24px;
	}
	@media (min-width: 768px) {
		.dashboard {
			padding-top: 48px;
		}
		.cv-list {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.more {
			display: none;
		}
		.card-heading h2 {
			padding-top: 0;
		}
		.secondary-actions {
			display: flex;
			flex-wrap: wrap;
			gap: 4px;
			margin: 12px -12px -8px;
		}
	}
</style>
