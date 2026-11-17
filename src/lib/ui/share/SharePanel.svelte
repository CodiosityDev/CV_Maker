<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import {
		accountClient,
		accountErrorKey,
		shareClient,
		type AccountErrorCode
	} from '#lib/core/account/index.ts';
	import { account } from '#lib/core/account/session.svelte.ts';
	import type { CVDocument } from '#lib/core/schema/types.ts';
	import {
		DEFAULT_SHARE_SETTINGS,
		isValidCustomSlug,
		SHARE_LIMITS,
		shareUrl,
		type ShareAccess,
		type ShareInfo,
		type ShareSettings
	} from '#lib/core/share/index.ts';
	import { publishShare, shareSync } from '#lib/core/share/publish.ts';
	import { incognito } from '#lib/core/storage/index.ts';
	import { i18n, t, type MessageKey } from '#lib/i18n/index.svelte.ts';
	import Button from '#lib/ui/Button.svelte';
	import Checkbox from '#lib/ui/Checkbox.svelte';
	import Input from '#lib/ui/Input.svelte';
	import Select from '#lib/ui/Select.svelte';
	import Toggle from '#lib/ui/Toggle.svelte';
	import { toast } from '#lib/ui/toast.svelte.ts';

	/**
	 * "Bagikan" dialog content (like Google Drive sharing). The user decides who can see the CV and
	 * what is shown; nothing is uploaded until "Simpan & bagikan".
	 */
	let {
		cv,
		beforeSave
	}: {
		cv: CVDocument;
		/** E.g. flush the editor's pending autosave first. false = stop. */
		beforeSave?: () => Promise<boolean>;
	} = $props();

	type Expiry = 'keep' | 'never' | '7' | '30' | '90';

	let info = $state<ShareInfo>();
	let loadingInfo = $state(true);
	let access = $state<ShareAccess>('link');
	let discoverable = $state(false);
	let settings = $state<ShareSettings>({ ...DEFAULT_SHARE_SETTINGS });
	let slug = $state('');
	let password = $state('');
	let changingPassword = $state(false);
	let removePassword = $state(false);
	let expiry = $state<Expiry>('never');
	let busy = $state(false);
	let error = $state<AccountErrorCode>();
	let slugError = $state(false);
	let confirming = $state<'rotate' | 'remove'>();
	let resent = $state(false);

	// Button resolves internal paths itself.
	const signInHref = $derived(`/masuk?next=${encodeURIComponent(page.url.pathname)}`);
	const link = $derived(
		info && typeof location !== 'undefined' ? shareUrl(location.origin, info.slug) : ''
	);
	const noContact = $derived(!settings.showPhone && !settings.showEmail);
	const dateFormat = $derived(
		new Intl.DateTimeFormat(i18n.locale === 'id' ? 'id-ID' : 'en-GB', { dateStyle: 'medium' })
	);
	const expiryOptions = $derived([
		...(info?.expiresAt
			? [
					{
						value: 'keep',
						label: t('share.expiryKeep', { date: dateFormat.format(new Date(info.expiresAt)) })
					}
				]
			: []),
		{ value: 'never', label: t('share.expiryNever') },
		{ value: '7', label: t('share.expiry7') },
		{ value: '30', label: t('share.expiry30') },
		{ value: '90', label: t('share.expiry90') }
	]);
	const accessOptions: { value: ShareAccess; label: MessageKey; hint: MessageKey }[] = [
		{ value: 'private', label: 'share.accessPrivate', hint: 'share.accessPrivateHint' },
		{ value: 'link', label: 'share.accessLink', hint: 'share.accessLinkHint' },
		{ value: 'public', label: 'share.accessPublic', hint: 'share.accessPublicHint' }
	];

	function apply(next: ShareInfo) {
		info = next;
		access = next.access;
		discoverable = next.discoverable;
		settings = { ...next.settings };
		slug = next.slug;
		expiry = next.expiresAt ? 'keep' : 'never';
		password = '';
		changingPassword = false;
		removePassword = false;
	}

	onMount(() => {
		void (async () => {
			await account.load();
			if (account.user?.verified && !incognito.active) {
				await shareSync.load(true);
				const existing = shareSync.info(cv.id);
				if (existing) apply(existing);
			}
			loadingInfo = false;
		})();
	});

	function fail(code: AccountErrorCode) {
		error = code;
		if (code === 'unauthenticated' || code === 'unverified') void account.load(true);
	}

	function expiresAt(): string | null | undefined {
		if (expiry === 'keep') return undefined;
		if (expiry === 'never') return null;
		return new Date(Date.now() + Number(expiry) * 86_400_000).toISOString();
	}

	function passwordChange(): string | null | undefined {
		if (removePassword) return null;
		if ((!info?.hasPassword || changingPassword) && password) return password;
		return undefined;
	}

	async function save(nextAccess: ShareAccess = access) {
		error = undefined;
		slugError = false;
		const customSlug = slug.trim();
		if (customSlug && customSlug !== info?.slug && !isValidCustomSlug(customSlug)) {
			slugError = true;
			return;
		}
		if (password && password.length < SHARE_LIMITS.passwordMin) {
			error = 'invalid';
			return;
		}
		busy = true;
		try {
			if (beforeSave && !(await beforeSave())) return;
			const change = passwordChange();
			const until = expiresAt();
			const result = await publishShare($state.snapshot(cv) as CVDocument, {
				access: nextAccess,
				discoverable: nextAccess === 'public' && discoverable,
				settings: $state.snapshot(settings),
				...(customSlug && customSlug !== info?.slug ? { slug: customSlug } : {}),
				...(change !== undefined ? { password: change } : {}),
				...(until !== undefined ? { expiresAt: until } : {})
			});
			if (!result.ok) return fail(result.error);
			apply(result.data);
			toast.success(t(nextAccess === 'private' ? 'share.stopped' : 'share.saved'));
		} finally {
			busy = false;
		}
	}

	async function copy() {
		try {
			await navigator.clipboard.writeText(link);
			toast.success(t('share.copied'));
		} catch {
			toast.error(t('share.copyFailed'));
		}
	}

	async function confirmAction() {
		const action = confirming;
		confirming = undefined;
		if (!action || !info) return;
		busy = true;
		error = undefined;
		try {
			if (action === 'rotate') {
				const result = await shareClient.rotate(cv.id);
				if (!result.ok) return fail(result.error);
				shareSync.remember(result.data);
				apply(result.data);
				toast.success(t('share.rotated'));
			} else {
				const result = await shareClient.remove(cv.id);
				if (!result.ok) return fail(result.error);
				shareSync.forget(cv.id);
				info = undefined;
				access = 'link';
				slug = '';
				expiry = 'never';
				toast.success(t('share.removed'));
			}
		} finally {
			busy = false;
		}
	}

	async function resend() {
		busy = true;
		const result = await accountClient.resendVerification(i18n.locale);
		busy = false;
		if (result.ok) resent = true;
		else fail(result.error);
	}
</script>

<div class="share-panel" data-testid="share-panel">
	{#if incognito.active}
		<p class="notice">{t('share.incognito')}</p>
	{:else if !account.loaded || loadingInfo}
		<p role="status">{t('common.loading')}</p>
	{:else if !account.available}
		<p class="notice" role="alert">{t('account.errors.unavailable')}</p>
	{:else if !account.user}
		{#if account.providers.google || account.providers.password}
			<p>{t('share.signInPrompt')}</p>
			<div class="actions"><Button href={signInHref}>{t('share.signIn')}</Button></div>
		{:else}
			<p class="notice">{t('share.unavailable')}</p>
		{/if}
	{:else if !account.user.verified}
		<p class="notice">{t('account.unverifiedNotice')}</p>
		<div class="actions">
			{#if resent}<p role="status">{t('account.resent')}</p>
			{:else}<Button variant="secondary" loading={busy} onclick={resend}
					>{t('account.resend')}</Button
				>{/if}
		</div>
	{:else}
		<form
			novalidate
			onsubmit={(event) => {
				event.preventDefault();
				void save();
			}}
		>
			<fieldset class="access">
				<legend>{t('share.accessLabel')}</legend>
				{#each accessOptions as option (option.value)}
					<label class="radio">
						<input
							type="radio"
							name="share-access"
							value={option.value}
							bind:group={access}
							disabled={busy}
						/>
						<span>
							<span class="radio-label">{t(option.label)}</span>
							<span class="radio-hint">{t(option.hint)}</span>
						</span>
					</label>
				{/each}
				{#if access === 'public'}
					<Checkbox label={t('share.discoverable')} bind:checked={discoverable} disabled={busy} />
				{/if}
			</fieldset>

			<fieldset>
				<legend>{t('share.showTitle')}</legend>
				<div class="toggles">
					<Toggle label={t('share.showPhone')} bind:checked={settings.showPhone} disabled={busy} />
					<Toggle label={t('share.showEmail')} bind:checked={settings.showEmail} disabled={busy} />
					<Toggle
						label={t('share.showAddress')}
						bind:checked={settings.showAddress}
						disabled={busy}
					/>
					{#if cv.kind === 'creative'}<Toggle
							label={t('share.showPhoto')}
							bind:checked={settings.showPhoto}
							disabled={busy}
						/>{/if}
				</div>
				{#if noContact}<p class="hint warn">{t('share.noContact')}</p>{/if}
				<div class="toggles">
					<Toggle
						label={t('share.allowDownload')}
						bind:checked={settings.allowDownload}
						disabled={busy}
					/>
					<Toggle
						label={t('share.autoUpdate')}
						hint={t('share.autoUpdateHint')}
						bind:checked={settings.autoUpdate}
						disabled={busy}
					/>
				</div>
			</fieldset>

			<Input
				label={t('share.slug')}
				hint={t('share.slugHint')}
				bind:value={slug}
				maxlength={SHARE_LIMITS.slugMax}
				autocomplete="off"
				autocapitalize="none"
				spellcheck={false}
				disabled={busy}
				error={slugError ? t('share.slugInvalid') : undefined}
				oninput={() => (slugError = false)}
			/>

			{#if info?.hasPassword && !changingPassword && !removePassword}
				<div class="password-set">
					<p>{t('share.passwordSet')}</p>
					<div class="actions">
						<Button variant="secondary" size="sm" onclick={() => (changingPassword = true)}
							>{t('share.passwordChange')}</Button
						>
						<Button variant="ghost" size="sm" onclick={() => (removePassword = true)}
							>{t('share.passwordRemove')}</Button
						>
					</div>
				</div>
			{:else if !removePassword}
				<Input
					type="password"
					label={t('share.password')}
					hint={t('share.passwordHint')}
					bind:value={password}
					maxlength={SHARE_LIMITS.passwordMax}
					autocomplete="new-password"
					disabled={busy}
				/>
			{/if}

			<Select
				label={t('share.expiry')}
				bind:value={expiry as string}
				options={expiryOptions}
				disabled={busy}
			/>

			{#if error}<p class="error" role="alert">{t(accountErrorKey(error))}</p>{/if}

			<div class="actions">
				<Button type="submit" loading={busy}>{t(info ? 'share.update' : 'share.save')}</Button>
			</div>
		</form>

		{#if info && info.access !== 'private'}
			<div class="link-box">
				<Input label={t('share.linkLabel')} value={link} readonly />
				<div class="actions">
					<Button variant="secondary" onclick={copy}>{t('share.copy')}</Button>
					<Button variant="ghost" href={link} target="_blank" rel="noopener noreferrer"
						>{t('share.openLink')}</Button
					>
				</div>
				<p class="hint">{t('share.views', { count: info.viewCount })}</p>
			</div>
		{/if}

		{#if info}
			<div class="manage">
				{#if confirming}
					<p role="alert">
						{t(confirming === 'rotate' ? 'share.rotateConfirm' : 'share.removeConfirm')}
					</p>
					<div class="actions">
						<Button variant={confirming === 'remove' ? 'danger' : 'primary'} onclick={confirmAction}
							>{t(confirming === 'rotate' ? 'share.rotate' : 'share.remove')}</Button
						>
						<Button variant="ghost" onclick={() => (confirming = undefined)}
							>{t('common.cancel')}</Button
						>
					</div>
				{:else}
					<div class="actions">
						{#if info.access !== 'private'}
							<Button variant="ghost" disabled={busy} onclick={() => void save('private')}
								>{t('share.stop')}</Button
							>
						{/if}
						<Button variant="ghost" disabled={busy} onclick={() => (confirming = 'rotate')}
							>{t('share.rotate')}</Button
						>
						<Button variant="ghost" disabled={busy} onclick={() => (confirming = 'remove')}
							>{t('share.remove')}</Button
						>
					</div>
				{/if}
			</div>
		{/if}

		<p class="hint privacy">{t('share.privacyNote')}</p>
	{/if}
</div>

<style>
	.share-panel {
		display: grid;
		gap: 16px;
		min-width: 0;
	}
	form {
		display: grid;
		gap: 20px;
	}
	fieldset {
		display: grid;
		gap: 10px;
		min-width: 0;
		margin: 0;
		padding: 0;
		border: 0;
	}
	legend {
		margin-bottom: 6px;
		color: var(--color-text);
		font-size: 0.9375rem;
		font-weight: 650;
	}
	.radio {
		display: flex;
		align-items: flex-start;
		gap: 10px;
		min-height: 44px;
		padding: 10px 12px;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		cursor: pointer;
	}
	.radio:has(input:checked) {
		border-color: var(--color-brand);
		background: var(--color-brand-50);
	}
	.radio input {
		width: 18px;
		height: 18px;
		margin-top: 2px;
		accent-color: var(--color-brand-ink);
	}
	.radio-label {
		display: block;
		color: var(--color-text);
		font-weight: 600;
	}
	.radio-hint,
	.hint {
		display: block;
		color: var(--color-text-muted);
		font-size: 0.8125rem;
		line-height: 1.5;
	}
	.warn {
		color: var(--color-coral-ink, var(--color-text));
	}
	.toggles {
		display: grid;
		gap: 4px;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
	}
	.password-set p,
	.manage p {
		margin-bottom: 8px;
		font-size: 0.875rem;
	}
	.link-box {
		display: grid;
		gap: 10px;
		padding: 16px;
		border-radius: var(--radius-md);
		background: var(--color-mint-50);
	}
	.manage {
		padding-top: 12px;
		border-top: 1px solid var(--color-border);
	}
	.notice {
		padding: 12px 16px;
		border-radius: var(--radius-md);
		background: var(--color-brand-50);
		font-size: 0.875rem;
		line-height: 1.6;
	}
	.error {
		color: var(--color-danger);
		font-size: 0.875rem;
	}
	.privacy {
		margin-top: 4px;
	}
</style>
