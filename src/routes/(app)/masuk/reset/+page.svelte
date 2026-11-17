<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import {
		ACCOUNT_LIMITS,
		accountClient,
		accountErrorKey,
		isEmailShaped,
		type AccountErrorCode
	} from '#lib/core/account/index.ts';
	import { account } from '#lib/core/account/session.svelte.ts';
	import { i18n, t } from '#lib/i18n/index.svelte.ts';
	import Button from '#lib/ui/Button.svelte';
	import Input from '#lib/ui/Input.svelte';
	import { toast } from '#lib/ui/toast.svelte.ts';

	let token = $state('');
	let ready = $state(false);
	let email = $state('');
	let password = $state('');
	let busy = $state(false);
	let sent = $state(false);
	let error = $state<AccountErrorCode>();
	let fieldError = $state(false);

	onMount(() => {
		// The token is in the URL fragment (never sent to a server); remove it from the address bar.
		token = new URLSearchParams(location.hash.slice(1)).get('token') ?? '';
		if (token) history.replaceState(history.state, '', location.pathname);
		ready = true;
	});

	async function request(event: SubmitEvent) {
		event.preventDefault();
		error = undefined;
		fieldError = !isEmailShaped(email.trim());
		if (fieldError) return;
		busy = true;
		const result = await accountClient.requestReset(email.trim(), i18n.locale);
		busy = false;
		if (result.ok) sent = true;
		else error = result.error;
	}

	async function confirm(event: SubmitEvent) {
		event.preventDefault();
		error = undefined;
		fieldError = password.length < ACCOUNT_LIMITS.passwordMin;
		if (fieldError) return;
		busy = true;
		const result = await accountClient.confirmReset(token, password);
		busy = false;
		if (!result.ok) {
			error = result.error;
			return;
		}
		account.signedIn(result.data);
		toast.success(t('account.resetDone'));
		await goto(resolve('/(app)/cv'));
	}
</script>

<svelte:head>
	<title>{t('account.resetTitle')} — CV Maker</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="site-container auth-page">
	<h1>{t('account.resetTitle')}</h1>
	{#if !ready}
		<p role="status">{t('common.loading')}</p>
	{:else if token}
		<form novalidate onsubmit={confirm}>
			<Input
				type="password"
				label={t('account.newPassword')}
				hint={t('account.passwordHint')}
				bind:value={password}
				maxlength={ACCOUNT_LIMITS.passwordMax}
				autocomplete="new-password"
				required
				disabled={busy}
				error={fieldError ? t('account.errors.invalid') : undefined}
				oninput={() => (fieldError = false)}
			/>
			{#if error}<p class="error" role="alert">{t(accountErrorKey(error))}</p>{/if}
			<Button type="submit" loading={busy}>{t('account.resetSave')}</Button>
		</form>
	{:else if sent}
		<p class="notice" role="status">{t('account.resetSent')}</p>
	{:else}
		<p class="intro">{t('account.resetIntro')}</p>
		<form novalidate onsubmit={request}>
			<Input
				type="email"
				label={t('account.email')}
				bind:value={email}
				maxlength={ACCOUNT_LIMITS.emailMax}
				autocomplete="email"
				required
				disabled={busy}
				error={fieldError ? t('account.errors.invalid') : undefined}
				oninput={() => (fieldError = false)}
			/>
			{#if error}<p class="error" role="alert">{t(accountErrorKey(error))}</p>{/if}
			<Button type="submit" loading={busy}>{t('account.resetSend')}</Button>
		</form>
	{/if}
	<a class="text-link" href={resolve('/(app)/masuk')}>{t('account.backToSignIn')}</a>
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
	form {
		display: grid;
		gap: 16px;
	}
	.intro {
		color: var(--color-text-muted);
		line-height: 1.7;
	}
	.notice {
		padding: 12px 16px;
		border-radius: var(--radius-md);
		background: var(--color-mint-50);
		line-height: 1.6;
	}
	.error {
		color: var(--color-danger);
		font-size: 0.875rem;
	}
	.text-link {
		display: inline-flex;
		align-items: center;
		min-height: 44px;
		width: fit-content;
		font-size: 0.875rem;
		font-weight: 600;
	}
</style>
