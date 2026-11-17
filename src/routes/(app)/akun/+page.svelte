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
	import { cvRepo } from '#lib/core/storage/index.ts';
	import { i18n, t, type MessageKey } from '#lib/i18n/index.svelte.ts';
	import Button from '#lib/ui/Button.svelte';
	import { toast } from '#lib/ui/toast.svelte.ts';

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
						</li>
					{/each}
				</ul>
			{/if}
		</section>

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
