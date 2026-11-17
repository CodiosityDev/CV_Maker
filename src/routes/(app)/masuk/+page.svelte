<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import {
		ACCOUNT_LIMITS,
		accountClient,
		accountErrorKey,
		googleLoginUrl,
		isEmailShaped,
		safeNext,
		type AccountErrorCode
	} from '#lib/core/account/index.ts';
	import { account } from '#lib/core/account/session.svelte.ts';
	import { i18n, t } from '#lib/i18n/index.svelte.ts';
	import Button from '#lib/ui/Button.svelte';
	import Input from '#lib/ui/Input.svelte';
	import { toast } from '#lib/ui/toast.svelte.ts';

	let mode = $state<'signin' | 'register'>('signin');
	let email = $state('');
	let password = $state('');
	let name = $state('');
	let busy = $state(false);
	let error = $state<AccountErrorCode>();
	let emailError = $state(false);
	let passwordError = $state(false);

	const next = $derived(safeNext(page.url.searchParams.get('next')));
	const googleFailed = $derived(page.url.searchParams.get('error') === 'google');
	const anyProvider = $derived(account.providers.google || account.providers.password);

	onMount(() => void account.load());

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		error = undefined;
		emailError = !isEmailShaped(email.trim());
		passwordError =
			mode === 'register' ? password.length < ACCOUNT_LIMITS.passwordMin : password.length === 0;
		if (emailError || passwordError) return;
		busy = true;
		try {
			const result =
				mode === 'register'
					? await accountClient.register({
							email: email.trim(),
							password,
							name: name.trim(),
							locale: i18n.locale
						})
					: await accountClient.login(email.trim(), password);
			if (!result.ok) {
				error = result.error;
				return;
			}
			account.signedIn(result.data);
			toast.success(t(mode === 'register' ? 'account.registered' : 'account.signedIn'));
			// `next` is a validated same-site path (safeNext).
			// eslint-disable-next-line svelte/no-navigation-without-resolve
			await goto(next);
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head>
	<title>{t('account.pageTitle')}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="site-container auth-page">
	<h1>{t('account.signInTitle')}</h1>
	<p class="intro">{t('account.signInIntro')}</p>

	{#if !account.loaded}
		<p role="status">{t('common.loading')}</p>
	{:else if account.user}
		<p class="notice" role="status">{t('account.signedInAs', { email: account.user.email })}</p>
		<div class="row">
			<Button href={next}>{t('common.next')}</Button>
			<Button href="/akun" variant="secondary">{t('account.navAccount')}</Button>
		</div>
	{:else if !account.available || !anyProvider}
		<p class="notice" role="alert">{t('account.unavailable')}</p>
	{:else}
		{#if googleFailed}<p class="error" role="alert">{t('account.googleFailed')}</p>{/if}

		{#if account.providers.google}
			<!-- Full page navigation to the API (not a SvelteKit route). -->
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
			<a class="google" href={googleLoginUrl(next)} data-sveltekit-reload>
				<svg viewBox="0 0 24 24" aria-hidden="true" width="20" height="20"
					><path
						fill="#4285F4"
						d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.7Z"
					/><path
						fill="#34A853"
						d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1 .7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.7-4.9h-4v3.1A12 12 0 0 0 12 24Z"
					/><path
						fill="#FBBC05"
						d="M5.3 14.4a7.2 7.2 0 0 1 0-4.7V6.6h-4a12 12 0 0 0 0 10.9l4-3.1Z"
					/><path
						fill="#EA4335"
						d="M12 4.8c1.7 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1C6.3 6.9 8.9 4.8 12 4.8Z"
					/></svg
				>
				<span>{t('account.google')}</span>
			</a>
		{/if}

		{#if account.providers.password}
			{#if account.providers.google}<p class="or"><span>{t('account.or')}</span></p>{/if}
			<div class="tabs" role="group" aria-label={t('account.signInTitle')}>
				<button
					type="button"
					aria-pressed={mode === 'signin'}
					onclick={() => {
						mode = 'signin';
						error = undefined;
					}}>{t('account.tabSignIn')}</button
				>
				<button
					type="button"
					aria-pressed={mode === 'register'}
					onclick={() => {
						mode = 'register';
						error = undefined;
					}}>{t('account.tabRegister')}</button
				>
			</div>
			<form novalidate onsubmit={submit}>
				{#if mode === 'register'}
					<Input
						label={t('account.name')}
						bind:value={name}
						maxlength={ACCOUNT_LIMITS.nameMax}
						autocomplete="name"
						disabled={busy}
					/>
				{/if}
				<Input
					type="email"
					label={t('account.email')}
					bind:value={email}
					maxlength={ACCOUNT_LIMITS.emailMax}
					autocomplete="email"
					required
					disabled={busy}
					error={emailError ? t('account.errors.invalid') : undefined}
					oninput={() => (emailError = false)}
				/>
				<Input
					type="password"
					label={t('account.password')}
					hint={mode === 'register' ? t('account.passwordHint') : undefined}
					bind:value={password}
					maxlength={ACCOUNT_LIMITS.passwordMax}
					autocomplete={mode === 'register' ? 'new-password' : 'current-password'}
					required
					disabled={busy}
					error={passwordError ? t('account.errors.invalid') : undefined}
					oninput={() => (passwordError = false)}
				/>
				{#if error}<p class="error" role="alert">{t(accountErrorKey(error))}</p>{/if}
				<Button type="submit" loading={busy}
					>{t(mode === 'register' ? 'account.register' : 'account.signIn')}</Button
				>
			</form>
			{#if mode === 'signin'}
				<a class="text-link" href={resolve('/(app)/masuk/reset')}>{t('account.forgot')}</a>
			{/if}
		{:else}
			<p class="hint">{t('account.passwordOff')}</p>
		{/if}
		<p class="hint privacy">{t('account.privacyNote')}</p>
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
	.intro,
	.hint {
		color: var(--color-text-muted);
		font-size: 0.9375rem;
		line-height: 1.7;
	}
	.hint {
		font-size: 0.8125rem;
	}
	form {
		display: grid;
		gap: 16px;
	}
	.google {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
		min-height: 48px;
		padding: 0 18px;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		color: var(--color-text);
		font-weight: 600;
		text-decoration: none;
	}
	.google:hover {
		border-color: var(--color-brand);
	}
	.or {
		display: flex;
		align-items: center;
		gap: 12px;
		color: var(--color-text-muted);
		font-size: 0.875rem;
	}
	.or::before,
	.or::after {
		content: '';
		flex: 1;
		height: 1px;
		background: var(--color-border);
	}
	.tabs {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 4px;
		padding: 4px;
		border-radius: var(--radius-md);
		background: var(--color-brand-50);
	}
	.tabs button {
		min-height: 44px;
		border: 0;
		border-radius: calc(var(--radius-md) - 4px);
		background: transparent;
		color: var(--color-text-muted);
		font: inherit;
		font-weight: 600;
		cursor: pointer;
	}
	.tabs button[aria-pressed='true'] {
		background: var(--color-surface);
		color: var(--color-text);
		box-shadow: var(--shadow-card);
	}
	.text-link {
		display: inline-flex;
		align-items: center;
		min-height: 44px;
		width: fit-content;
		font-size: 0.875rem;
		font-weight: 600;
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.notice {
		padding: 12px 16px;
		border-radius: var(--radius-md);
		background: var(--color-brand-50);
		font-size: 0.875rem;
	}
	.error {
		color: var(--color-danger);
		font-size: 0.875rem;
	}
</style>
