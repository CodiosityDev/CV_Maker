<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { ACCOUNT_HINT_STORAGE_KEY } from '#lib/core/account/hint.ts';
	import { t } from '#lib/i18n/index.svelte.ts';
	import { toast } from '#lib/ui/toast.svelte.ts';

	/**
	 * Header button next to "Buat CV": "Masuk" for guests, "Keluar" after a login on this browser.
	 * Reads the local login hint only (no request); the account code loads when "Keluar" is clicked.
	 */
	let { onnavigate }: { onnavigate?: () => void } = $props();
	let signedIn = $state(false);
	let busy = $state(false);

	function readHint(): boolean {
		try {
			return localStorage.getItem(ACCOUNT_HINT_STORAGE_KEY) === '1';
		} catch {
			return false;
		}
	}
	$effect(() => {
		void page.url;
		signedIn = readHint();
	});

	async function signOut() {
		if (busy) return;
		busy = true;
		onnavigate?.();
		try {
			const [{ account }, { shareSync }, { autoBackup }] = await Promise.all([
				import('#lib/core/account/session.svelte.ts'),
				import('#lib/core/share/publish.ts'),
				import('#lib/core/backup/cloud.ts')
			]);
			if (!(await account.logout())) {
				toast.error(t('nav.signOutError'));
				return;
			}
			shareSync.reset();
			autoBackup.cancel();
			signedIn = false;
			toast.success(t('nav.signedOut'));
			await goto(resolve('/(app)/cv'));
		} catch {
			toast.error(t('nav.signOutError'));
		} finally {
			busy = false;
		}
	}
</script>

<svelte:window
	onstorage={(event) => {
		if (event.key === null || event.key === ACCOUNT_HINT_STORAGE_KEY) signedIn = readHint();
	}}
/>

{#if signedIn}
	<button
		type="button"
		class="account-action"
		disabled={busy}
		aria-busy={busy || undefined}
		data-testid="header-sign-out"
		onclick={signOut}>{t('nav.signOut')}</button
	>
{:else}
	<a
		class="account-action"
		href={resolve('/(app)/masuk')}
		aria-current={page.url.pathname.startsWith('/masuk') ? 'page' : undefined}
		data-testid="header-sign-in"
		onclick={onnavigate}>{t('nav.signIn')}</a
	>
{/if}

<style>
	.account-action {
		display: inline-flex;
		flex-shrink: 0;
		min-width: 44px;
		min-height: 44px;
		align-items: center;
		justify-content: center;
		padding: 0 14px;
		border: 1px solid var(--color-control-border);
		border-radius: var(--radius-md);
		background: transparent;
		color: var(--color-brand-ink);
		font: inherit;
		font-size: 0.875rem;
		font-weight: 650;
		line-height: 1;
		text-decoration: none;
		white-space: nowrap;
		cursor: pointer;
		transition: background-color var(--motion-duration) ease-out;
	}
	.account-action:hover:not(:disabled) {
		background: var(--color-brand-50);
	}
	.account-action:disabled {
		cursor: progress;
		opacity: 0.7;
	}
	.account-action[aria-current='page'] {
		background: var(--color-brand-100);
	}
	/* Phones: the button would crowd the header; "Masuk"/"Akun"/"Keluar" stay in the menu. */
	@media (max-width: 419px) {
		.account-action {
			display: none;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.account-action {
			transition: none;
		}
	}
</style>
