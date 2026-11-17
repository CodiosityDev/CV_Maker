<script lang="ts">
	import { onMount } from 'svelte';
	import {
		accountClient,
		accountErrorKey,
		type AccountErrorCode
	} from '#lib/core/account/index.ts';
	import { account } from '#lib/core/account/session.svelte.ts';
	import { t } from '#lib/i18n/index.svelte.ts';
	import Button from '#lib/ui/Button.svelte';

	let status = $state<'working' | 'done' | 'failed'>('working');
	let error = $state<AccountErrorCode>();

	onMount(() => {
		// The token is in the URL fragment (never sent to a server); remove it from the address bar.
		const token = new URLSearchParams(location.hash.slice(1)).get('token') ?? '';
		history.replaceState(history.state, '', location.pathname);
		void (async () => {
			if (!token) {
				status = 'failed';
				return;
			}
			const result = await accountClient.verify(token);
			if (result.ok) {
				status = 'done';
				void account.load(true);
			} else {
				status = 'failed';
				error = result.error;
			}
		})();
	});
</script>

<svelte:head>
	<title>{t('account.verifyTitle')} — CV Maker</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="site-container auth-page">
	<h1>{t('account.verifyTitle')}</h1>
	{#if status === 'working'}
		<p role="status">{t('account.verifying')}</p>
	{:else if status === 'done'}
		<p class="notice" role="status">{t('account.verified')}</p>
		<div><Button href="/cv">{t('nav.myCvs')}</Button></div>
	{:else}
		<p class="error" role="alert">
			{t(error && error !== 'expired' ? accountErrorKey(error) : 'account.verifyFailed')}
		</p>
		<div><Button href="/akun" variant="secondary">{t('account.navAccount')}</Button></div>
	{/if}
</div>

<style>
	.auth-page {
		display: grid;
		gap: 16px;
		max-width: 480px;
		padding-block: 40px 64px;
	}
	h1 {
		font-size: clamp(1.75rem, 5vw, 2.25rem);
		font-weight: 650;
	}
	.notice {
		padding: 12px 16px;
		border-radius: var(--radius-md);
		background: var(--color-mint-50);
	}
	.error {
		color: var(--color-danger);
	}
</style>
