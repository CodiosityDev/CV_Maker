<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import {
		accountClient,
		accountErrorKey,
		shareClient,
		type AccountErrorCode
	} from '#lib/core/account/index.ts';
	import { account } from '#lib/core/account/session.svelte.ts';
	import type { CVMeta } from '#lib/core/schema/types.ts';
	import type { ShareInfo } from '#lib/core/share/index.ts';
	import { shareSync } from '#lib/core/share/publish.ts';
	import { cvRepo, incognito, type ImportResult } from '#lib/core/storage/index.ts';
	import { driveClient, driveConnectUrl, type Result } from '#lib/core/account/index.ts';
	import {
		autoBackup,
		autoBackupEnabled,
		backupToDrive,
		driveStartup,
		restoreFrom,
		setAutoBackupEnabled
	} from '#lib/core/backup/cloud.ts';
	import { page } from '$app/state';
	import { i18n, t, type MessageKey } from '#lib/i18n/index.svelte.ts';
	import Button from '#lib/ui/Button.svelte';
	import Toggle from '#lib/ui/Toggle.svelte';
	import Input from '#lib/ui/Input.svelte';
	import { toast } from '#lib/ui/toast.svelte.ts';

	let autoOn = $state(autoBackupEnabled());
	let drive = $state.raw<{
		available: boolean;
		connected: boolean;
		lastBackupAt: string | null;
		fileUrl: string | null;
	}>();
	let name = $state('');
	/** Shared CV whose "Hapus dari server" is being confirmed. */
	let removingShare = $state<string>();

	async function deleteShare(cvId: string) {
		await act(
			`share-${cvId}`,
			() => shareClient.remove(cvId),
			() => {
				shares = shares.filter((share) => share.cvId !== cvId);
				shareSync.forget(cvId);
				removingShare = undefined;
				toast.success(t('share.removed'));
			}
		);
	}
	let nameSaved = $state('');
	$effect(() => {
		// Fill the field once the account is known (and after other tabs change it).
		const current = account.user?.name ?? '';
		if (current !== nameSaved) {
			name = current;
			nameSaved = current;
		}
	});

	async function saveName(event: SubmitEvent) {
		event.preventDefault();
		await act(
			'name',
			() => accountClient.updateProfile(name),
			(user) => {
				nameSaved = user.name;
				account.signedIn(user);
				toast.success(t('account.nameSaved'));
			}
		);
	}
	let working = $state<string>();
	$effect(() => setAutoBackupEnabled(autoOn));

	const dateTime = $derived(
		new Intl.DateTimeFormat(i18n.locale === 'id' ? 'id-ID' : 'en-GB', {
			dateStyle: 'medium',
			timeStyle: 'short'
		})
	);
	async function loadBackups() {
		const status = await driveClient.status();
		if (status.ok) drive = status.data;
	}

	/** Runs one backup action at a time and shows its outcome. */
	async function act<T>(name: string, run: () => Promise<Result<T>>, done: (value: T) => void) {
		if (working) return;
		working = name;
		error = undefined;
		try {
			const result = await run();
			if (result.ok) done(result.data);
			else {
				error = result.error;
				if (result.error === 'reconnect') void loadBackups();
			}
		} finally {
			working = undefined;
		}
	}

	function restored(result: ImportResult) {
		if (result.imported) toast.success(t('backup.restored', { count: result.imported }));
		else toast.info(t('backup.restoredNone'));
		void cvRepo.list().then((list) => (cvs = list));
	}

	let shares = $state.raw<ShareInfo[]>([]);
	let cvs = $state.raw<CVMeta[]>([]);
	let busy = $state(false);
	let resent = $state(false);
	let confirmDelete = $state(false);
	let error = $state<AccountErrorCode>();

	const titles = $derived(new Map(cvs.map((cv) => [cv.id, cv.title])));
	const accessKey: Record<ShareInfo['access'], MessageKey> = {
		private: 'share.accessPrivate',
		link: 'share.accessLink',
		public: 'share.accessPublic'
	};

	onMount(() => {
		void (async () => {
			await account.load(true);
			if (!account.user) return;
			const [list, local] = await Promise.all([shareClient.list(), cvRepo.list().catch(() => [])]);
			cvs = local;
			if (list.ok) shares = list.data;
			else error = list.error;
			await loadBackups();
			const driveResult = page.url.searchParams.get('drive');
			if (driveResult === 'connected') toast.success(t('backup.driveConnected'));
			else if (driveResult === 'failed') toast.error(t('backup.driveFailed'));
			if (drive?.connected) {
				// New device: the CVs from the Drive backup come in once (no duplicates).
				const startup = await driveStartup();
				if (startup.restored) {
					toast.success(t('backup.driveSyncRestored', { count: startup.restored }));
					cvs = await cvRepo.list().catch(() => cvs);
				}
			}
		})();
	});

	async function resend() {
		busy = true;
		const result = await accountClient.resendVerification(i18n.locale);
		busy = false;
		if (result.ok) {
			resent = true;
			toast.success(t('account.resent'));
		} else error = result.error;
	}

	async function signOut() {
		busy = true;
		const ok = await account.logout();
		busy = false;
		if (!ok) return toast.error(t('account.errors.unavailable'));
		shareSync.reset();
		autoBackup.cancel();
		toast.success(t('account.signedOut'));
		await goto(resolve('/(app)/cv'));
	}

	async function remove() {
		busy = true;
		const result = await accountClient.deleteAccount();
		busy = false;
		if (!result.ok) {
			error = result.error;
			return;
		}
		account.signedOut();
		shareSync.reset();
		autoBackup.cancel();
		toast.success(t('account.deleted'));
		await goto(resolve('/(app)/cv'));
	}
</script>

<svelte:head>
	<title>{t('account.accountPageTitle')}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="site-container account-page">
	<h1>{t('account.accountTitle')}</h1>

	{#if !account.loaded}
		<p role="status">{t('common.loading')}</p>
	{:else if !account.available}
		<p class="notice" role="alert">{t('account.errors.unavailable')}</p>
	{:else if !account.user}
		<p>{t('account.needSignIn')}</p>
		<div><Button href="/masuk?next=%2Fakun">{t('account.navSignIn')}</Button></div>
	{:else}
		<section class="card" aria-labelledby="who">
			<h2 id="who" class="sr-only">{t('account.accountTitle')}</h2>
			<p class="email">{t('account.signedInAs', { email: account.user.email })}</p>
			<form class="name-form" novalidate onsubmit={saveName}>
				<Input
					label={t('account.nameLabel')}
					hint={t('account.nameHint')}
					bind:value={name}
					maxlength={80}
					autocomplete="name"
					disabled={Boolean(working)}
				/>
				<Button
					type="submit"
					variant="secondary"
					loading={working === 'name'}
					disabled={Boolean(working) || name.trim() === nameSaved}>{t('common.save')}</Button
				>
			</form>
			<p class="muted">
				{[
					account.user.google ? t('account.methodGoogle') : '',
					account.user.hasPassword ? t('account.methodPassword') : ''
				]
					.filter(Boolean)
					.join(' · ')}
			</p>
			{#if !account.user.verified}
				<p class="notice">{t('account.unverifiedNotice')}</p>
				{#if !resent}<div>
						<Button variant="secondary" loading={busy} onclick={resend}
							>{t('account.resend')}</Button
						>
					</div>{/if}
			{/if}
			<div>
				<Button variant="ghost" disabled={busy} onclick={signOut}>{t('account.signOut')}</Button>
			</div>
		</section>

		{#if error}<p class="error" role="alert">{t(accountErrorKey(error))}</p>{/if}

		<section aria-labelledby="shares-title">
			<h2 id="shares-title">{t('account.sharesTitle')}</h2>
			{#if !shares.length}
				<p class="muted">{t('account.sharesEmpty')}</p>
			{:else}
				<ul class="shares">
					{#each shares as share (share.cvId)}
						<li>
							<div>
								{#if titles.has(share.cvId)}
									<a href={resolve('/(app)/cv/[id]/edit', { id: share.cvId })}
										>{titles.get(share.cvId) || t('dashboard.untitled')}</a
									>
								{:else}<span>{t('account.shareUnknownCv')}</span>{/if}
								<p class="muted">
									{t(accessKey[share.access])} · {t('share.views', { count: share.viewCount })}
								</p>
							</div>
							{#if share.access !== 'private'}
								<a
									class="open"
									href={resolve('/(share)/u/[slug]', { slug: share.slug })}
									target="_blank"
									rel="noopener noreferrer">/u/{share.slug}</a
								>
							{/if}
							{#if removingShare === share.cvId}
								<div class="row" role="group" aria-label={t('share.removeConfirm')}>
									<span class="muted">{t('share.removeConfirm')}</span>
									<Button
										variant="danger"
										size="sm"
										loading={working === `share-${share.cvId}`}
										onclick={() => deleteShare(share.cvId)}>{t('share.remove')}</Button
									>
									<Button variant="ghost" size="sm" onclick={() => (removingShare = undefined)}
										>{t('common.cancel')}</Button
									>
								</div>
							{:else}
								<Button
									variant="ghost"
									size="sm"
									disabled={Boolean(working)}
									onclick={() => (removingShare = share.cvId)}>{t('share.remove')}</Button
								>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		{#if !incognito.active}
			<section class="card" aria-labelledby="drive-title" data-testid="drive-section">
				<h2 id="drive-title">{t('backup.driveTitle')}</h2>
				<p class="muted">{t('backup.driveIntro')}</p>
				{#if !drive?.available}
					<p class="muted">{t('backup.driveUnavailable')}</p>
				{:else if !drive.connected}
					<div>
						<!-- Full page navigation to the API (Google consent), not a SvelteKit route. -->
						<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
						<a class="drive-link" href={driveConnectUrl('/akun')} data-sveltekit-reload
							><svg
								class="drive-icon"
								viewBox="0 0 87.3 78"
								width="20"
								height="18"
								aria-hidden="true"
								><path
									d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3L27.5 53H0c0 1.55.4 3.1 1.2 4.5z"
									fill="#0066da"
								/><path
									d="M43.65 25 29.9 1.2c-1.35.8-2.5 1.9-3.3 3.3L1.2 48.5A9.06 9.06 0 0 0 0 53h27.5z"
									fill="#00ac47"
								/><path
									d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5H59.8l5.85 11.5z"
									fill="#ea4335"
								/><path
									d="M43.65 25 57.4 1.2C56.05.4 54.5 0 52.9 0H34.4c-1.6 0-3.15.45-4.5 1.2z"
									fill="#00832d"
								/><path
									d="M59.8 53H27.5L13.75 76.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z"
									fill="#2684fc"
								/><path
									d="M73.4 26.5 60.7 4.5c-.8-1.4-1.95-2.5-3.3-3.3L43.65 25 59.8 53h27.45c0-1.55-.4-3.1-1.2-4.5z"
									fill="#ffba00"
								/></svg
							><span>{t('backup.driveConnect')}</span></a
						>
					</div>
				{:else}
					<Toggle label={t('backup.auto')} hint={t('backup.autoHint')} bind:checked={autoOn} />
					{#if drive.fileUrl}
						<!-- External link to the user's own file in Google Drive. -->
						<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
						<a class="drive-link" href={drive.fileUrl} target="_blank" rel="noopener noreferrer"
							><svg
								class="drive-icon"
								viewBox="0 0 87.3 78"
								width="20"
								height="18"
								aria-hidden="true"
								><path
									d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3L27.5 53H0c0 1.55.4 3.1 1.2 4.5z"
									fill="#0066da"
								/><path
									d="M43.65 25 29.9 1.2c-1.35.8-2.5 1.9-3.3 3.3L1.2 48.5A9.06 9.06 0 0 0 0 53h27.5z"
									fill="#00ac47"
								/><path
									d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5H59.8l5.85 11.5z"
									fill="#ea4335"
								/><path
									d="M43.65 25 57.4 1.2C56.05.4 54.5 0 52.9 0H34.4c-1.6 0-3.15.45-4.5 1.2z"
									fill="#00832d"
								/><path
									d="M59.8 53H27.5L13.75 76.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z"
									fill="#2684fc"
								/><path
									d="M73.4 26.5 60.7 4.5c-.8-1.4-1.95-2.5-3.3-3.3L43.65 25 59.8 53h27.45c0-1.55-.4-3.1-1.2-4.5z"
									fill="#ffba00"
								/></svg
							><span>{t('backup.driveOpen')}</span><span aria-hidden="true">↗</span><span
								class="sr-only">{t('a11y.opensNewTab')}</span
							></a
						>
					{/if}
					{#if drive.lastBackupAt}<p class="muted">
							{t('backup.driveLast', { date: dateTime.format(new Date(drive.lastBackupAt)) })}
						</p>{/if}
					<div class="row">
						<Button
							loading={working === 'drive-save'}
							disabled={Boolean(working)}
							onclick={() =>
								act('drive-save', backupToDrive, (data) => {
									drive = drive && { ...drive, lastBackupAt: data.lastBackupAt };
									void loadBackups();
									toast.success(t('backup.driveSaved'));
								})}>{t('backup.driveSave')}</Button
						>
						<Button
							variant="secondary"
							loading={working === 'drive-restore'}
							disabled={Boolean(working)}
							onclick={() =>
								act(
									'drive-restore',
									async () => restoreFrom(await driveClient.restore()),
									restored
								)}>{t('backup.driveRestore')}</Button
						>
						<Button
							variant="ghost"
							disabled={Boolean(working)}
							onclick={() =>
								act('drive-off', driveClient.disconnect, () => {
									drive = drive && {
										...drive,
										connected: false,
										lastBackupAt: null,
										fileUrl: null
									};
									toast.success(t('backup.driveDisconnected'));
								})}>{t('backup.driveDisconnect')}</Button
						>
					</div>
				{/if}
			</section>
		{/if}

		<section class="danger" aria-labelledby="delete-title">
			<h2 id="delete-title">{t('account.deleteTitle')}</h2>
			<p>{t('account.deleteDescription')}</p>
			{#if confirmDelete}
				<p role="alert"><strong>{t('account.deleteConfirm')}</strong></p>
				<div class="row">
					<Button variant="danger" loading={busy} onclick={remove}
						>{t('account.deleteAction')}</Button
					>
					<Button variant="ghost" disabled={busy} onclick={() => (confirmDelete = false)}
						>{t('common.cancel')}</Button
					>
				</div>
			{:else}
				<div>
					<Button variant="ghost" onclick={() => (confirmDelete = true)}
						>{t('account.deleteAction')}</Button
					>
				</div>
			{/if}
		</section>
	{/if}
</div>

<style>
	.account-page {
		display: grid;
		gap: 24px;
		max-width: 720px;
		padding-block: 40px 64px;
	}
	h1 {
		font-size: clamp(1.75rem, 5vw, 2.25rem);
		font-weight: 650;
	}
	h2 {
		margin-bottom: 12px;
		font-size: 1.125rem;
		font-weight: 650;
	}
	.card {
		display: grid;
		gap: 10px;
		padding: 20px;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
	}
	.email {
		font-weight: 600;
		overflow-wrap: anywhere;
	}
	.muted {
		color: var(--color-text-muted);
		font-size: 0.875rem;
	}
	.notice {
		padding: 12px 16px;
		border-radius: var(--radius-md);
		background: var(--color-brand-50);
		font-size: 0.875rem;
	}
	.shares {
		display: grid;
		gap: 8px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.shares li {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 8px 16px;
		padding: 12px 16px;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
	}
	.shares a {
		display: inline-flex;
		align-items: center;
		min-height: 44px;
		font-weight: 600;
		overflow-wrap: anywhere;
	}
	.name-form {
		display: grid;
		justify-items: start;
		gap: 8px;
		max-width: 480px;
	}
	.name-form :global(.field) {
		width: 100%;
	}
	.drive-link {
		gap: 8px;
		width: fit-content;
		display: inline-flex;
		align-items: center;
		min-height: 44px;
		padding: 0 16px;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		color: var(--color-text);
		font-weight: 600;
		text-decoration: none;
	}
	.drive-link:hover {
		border-color: var(--color-brand);
	}
	.danger {
		padding: 20px;
		border-radius: var(--radius-lg);
		background: var(--color-coral-50);
	}
	.danger p {
		margin-bottom: 12px;
		color: var(--color-text-muted);
		font-size: 0.875rem;
		line-height: 1.7;
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.error {
		color: var(--color-danger);
		font-size: 0.875rem;
	}
</style>
