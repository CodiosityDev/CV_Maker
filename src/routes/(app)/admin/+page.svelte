<script lang="ts">
	import { onMount } from 'svelte';
	import { adminClient, type AccountErrorCode, type AdminReport } from '#lib/core/account/index.ts';
	import { toRenderModel, type RenderModel } from '#lib/core/render/index.ts';
	import { i18n, t, type MessageKey } from '#lib/i18n/index.svelte.ts';
	import Button from '#lib/ui/Button.svelte';
	import CvPreview from '#lib/ui/CvPreview.svelte';
	import Input from '#lib/ui/Input.svelte';
	import { toast } from '#lib/ui/toast.svelte.ts';

	/** Site admin for reports on shared CVs (owner request). Reached by URL only: /admin. */
	let status = $state<'loading' | 'off' | 'login' | 'ready'>('loading');
	let username = $state('');
	let password = $state('');
	let loginError = $state<AccountErrorCode>();
	let busy = $state(false);
	let reports = $state.raw<AdminReport[]>([]);
	let working = $state<string>();
	let confirmRemove = $state<string>();
	let previewId = $state<string>();
	let preview = $state.raw<RenderModel>();

	const dateTime = $derived(
		new Intl.DateTimeFormat(i18n.locale === 'id' ? 'id-ID' : 'en-GB', {
			dateStyle: 'medium',
			timeStyle: 'short'
		})
	);

	async function load() {
		const me = await adminClient.me();
		if (!me.ok) {
			status = me.error === 'notFound' ? 'off' : 'login';
			return;
		}
		if (!me.data.admin) {
			status = 'login';
			return;
		}
		const list = await adminClient.reports();
		if (list.ok) reports = list.data;
		else if (list.error === 'unauthenticated') {
			status = 'login';
			return;
		}
		status = 'ready';
	}

	onMount(() => void load());

	async function login(event: SubmitEvent) {
		event.preventDefault();
		busy = true;
		loginError = undefined;
		const result = await adminClient.login(username.trim(), password);
		busy = false;
		password = '';
		if (!result.ok) {
			loginError = result.error;
			return;
		}
		await load();
	}

	async function logout() {
		await adminClient.logout();
		reports = [];
		preview = undefined;
		status = 'login';
	}

	async function act(
		name: string,
		run: () => ReturnType<typeof adminClient.dismiss>,
		done: string
	) {
		if (working) return;
		working = name;
		const result = await run();
		working = undefined;
		if (!result.ok) {
			if (result.error === 'unauthenticated') status = 'login';
			toast.error(t('adminPanel.failed'));
			return;
		}
		toast.success(t(done as MessageKey));
		confirmRemove = undefined;
		await load();
	}

	async function togglePreview(report: AdminReport) {
		if (previewId === report.shareId) {
			previewId = undefined;
			preview = undefined;
			return;
		}
		const result = await adminClient.preview(report.shareId);
		if (!result.ok) return toast.error(t('adminPanel.failed'));
		previewId = report.shareId;
		preview = toRenderModel(result.data.snapshot, { photoUrl: result.data.photo ?? undefined });
	}
</script>

<svelte:head>
	<title>{t('adminPanel.pageTitle')}</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="site-container admin-page">
	<h1>{t('adminPanel.title')}</h1>

	{#if status === 'loading'}
		<p role="status">{t('common.loading')}</p>
	{:else if status === 'off'}
		<p class="notice">{t('adminPanel.unavailable')}</p>
	{:else if status === 'login'}
		<form class="login" novalidate onsubmit={login}>
			<h2>{t('adminPanel.loginTitle')}</h2>
			<Input
				label={t('adminPanel.username')}
				bind:value={username}
				autocomplete="username"
				required
				disabled={busy}
			/>
			<Input
				type="password"
				label={t('adminPanel.password')}
				bind:value={password}
				autocomplete="current-password"
				required
				disabled={busy}
			/>
			{#if loginError}<p class="error" role="alert">
					{t(loginError === 'busy' ? 'adminPanel.busy' : 'adminPanel.wrong')}
				</p>{/if}
			<Button type="submit" loading={busy}>{t('adminPanel.login')}</Button>
		</form>
	{:else}
		<div class="toolbar">
			<h2>{t('adminPanel.reportsTitle')}</h2>
			<div class="row">
				<Button variant="secondary" size="sm" onclick={() => void load()}
					>{t('adminPanel.refresh')}</Button
				>
				<Button variant="ghost" size="sm" onclick={logout}>{t('adminPanel.logout')}</Button>
			</div>
		</div>
		{#if !reports.length}
			<p class="muted">{t('adminPanel.empty')}</p>
		{:else}
			<ul class="reports">
				{#each reports as report (report.shareId)}
					<li class="report" class:blocked={report.blocked}>
						<div class="head">
							<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- absolute link to the shared page -->
							<a href={`/u/${report.slug}`} target="_blank" rel="noopener noreferrer"
								>/u/{report.slug}</a
							>
							<span class="badge"
								>{t(report.blocked ? 'adminPanel.statusBlocked' : 'adminPanel.statusActive')}</span
							>
						</div>
						<p class="muted">
							{t('adminPanel.total', { count: report.total })} ·
							{t('adminPanel.last', {
								date: report.lastAt ? dateTime.format(new Date(report.lastAt)) : ''
							})}
						</p>
						<ul class="reasons">
							{#each Object.entries(report.reasons) as [reason, count] (reason)}
								<li>{t(`adminPanel.reasons.${reason}` as MessageKey)}: {count}</li>
							{/each}
						</ul>
						{#if report.ownerEmail}<p class="muted">
								{t('adminPanel.owner', { email: report.ownerEmail })}
							</p>{/if}
						<div class="row">
							<Button variant="secondary" size="sm" onclick={() => togglePreview(report)}
								>{t(previewId === report.shareId ? 'adminPanel.hide' : 'adminPanel.view')}</Button
							>
							<Button
								size="sm"
								variant={report.blocked ? 'secondary' : 'danger'}
								loading={working === `block-${report.shareId}`}
								disabled={Boolean(working)}
								onclick={() =>
									act(
										`block-${report.shareId}`,
										() => adminClient.block(report.shareId, !report.blocked),
										report.blocked ? 'adminPanel.unblocked' : 'adminPanel.blocked'
									)}>{t(report.blocked ? 'adminPanel.unblock' : 'adminPanel.block')}</Button
							>
							<Button
								variant="ghost"
								size="sm"
								disabled={Boolean(working)}
								onclick={() =>
									act(
										`dismiss-${report.shareId}`,
										() => adminClient.dismiss(report.shareId),
										'adminPanel.dismissed'
									)}>{t('adminPanel.dismiss')}</Button
							>
							<Button
								variant="ghost"
								size="sm"
								disabled={Boolean(working)}
								onclick={() => (confirmRemove = report.shareId)}>{t('adminPanel.remove')}</Button
							>
						</div>
						{#if confirmRemove === report.shareId}
							<div class="confirm" role="alert">
								<p>{t('adminPanel.removeConfirm')}</p>
								<div class="row">
									<Button
										variant="danger"
										size="sm"
										loading={working === `remove-${report.shareId}`}
										onclick={() =>
											act(
												`remove-${report.shareId}`,
												() => adminClient.remove(report.shareId),
												'adminPanel.removed'
											)}>{t('adminPanel.remove')}</Button
									>
									<Button variant="ghost" size="sm" onclick={() => (confirmRemove = undefined)}
										>{t('common.cancel')}</Button
									>
								</div>
							</div>
						{/if}
						{#if previewId === report.shareId && preview}
							<div class="preview"><CvPreview model={preview} /></div>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	{/if}
</div>

<style>
	.admin-page {
		display: grid;
		gap: 20px;
		max-width: 880px;
		padding-block: 40px 64px;
	}
	h1 {
		font-size: clamp(1.75rem, 5vw, 2.25rem);
		font-weight: 650;
	}
	h2 {
		font-size: 1.125rem;
		font-weight: 650;
	}
	.login {
		display: grid;
		gap: 16px;
		max-width: 420px;
	}
	.toolbar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
	}
	.reports {
		display: grid;
		gap: 12px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.report {
		display: grid;
		gap: 8px;
		padding: 16px;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
	}
	.report.blocked {
		border-color: var(--color-coral);
	}
	.head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px 12px;
	}
	.head a {
		display: inline-flex;
		align-items: center;
		min-height: 44px;
		font-weight: 650;
		overflow-wrap: anywhere;
	}
	.badge {
		padding: 2px 10px;
		border-radius: var(--radius-pill);
		background: var(--color-brand-50);
		color: var(--color-text);
		font-size: 0.75rem;
		font-weight: 650;
	}
	.report.blocked .badge {
		background: var(--color-coral-50);
	}
	.reasons {
		margin: 0;
		padding-left: 1.25rem;
		color: var(--color-text);
		font-size: 0.875rem;
	}
	.muted {
		color: var(--color-text-muted);
		font-size: 0.875rem;
		overflow-wrap: anywhere;
	}
	.confirm {
		display: grid;
		gap: 8px;
		padding: 12px;
		border-radius: var(--radius-md);
		background: var(--color-coral-50);
		font-size: 0.875rem;
	}
	.preview {
		max-width: 520px;
	}
	.notice {
		padding: 12px 16px;
		border-radius: var(--radius-md);
		background: var(--color-brand-50);
	}
	.error {
		color: var(--color-danger);
		font-size: 0.875rem;
	}
</style>
