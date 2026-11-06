<script lang="ts">
	import { onDestroy, tick } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { incognito } from '#lib/core/storage/index.ts';
	import { i18n, t } from '#lib/i18n/index.svelte.ts';
	import { getIncognitoUiContext } from '#lib/ui/incognito-context.ts';
	import { toast } from '#lib/ui/toast.svelte.ts';
	import Button from '#lib/ui/Button.svelte';
	import Dialog from '#lib/ui/Dialog.svelte';
	import IncognitoEndDialog from '#lib/ui/IncognitoEndDialog.svelte';

	const session = getIncognitoUiContext();
	let toggle = $state<HTMLButtonElement>();
	let startOpen = $state(false);
	let infoOpen = $state(false);
	let endOpen = $state(false);
	let starting = $state(false);
	let failed = $state(false);
	let mounted = true;
	const expiry = $derived(incognito.expiresAt);
	const expiryTime = $derived(
		expiry
			? new Intl.DateTimeFormat(i18n.locale === 'id' ? 'id-ID' : 'en-GB', {
					hour: '2-digit',
					minute: '2-digit',
					hourCycle: 'h23'
				}).format(Date.parse(expiry))
			: ''
	);

	onDestroy(() => {
		mounted = false;
	});

	function open() {
		toggle?.focus();
		failed = false;
		if (incognito.active) infoOpen = true;
		else startOpen = true;
	}

	async function start() {
		if (starting || incognito.active) return;
		starting = true;
		failed = false;
		const origin = page.url.pathname;
		try {
			if (!(await session?.prepareToStart())) {
				failed = true;
				toast.error(t('incognito.startFailed'));
				return;
			}
			if (!mounted || !startOpen || origin !== page.url.pathname) return;
			if (page.route.id !== '/(app)/buat' && page.route.id !== '/(app)/cv') {
				// Leave the saved editor/print view before switching the repository.
				await goto(resolve('/(app)/buat'));
				await tick();
			}
			if (!mounted || !startOpen || incognito.active) return;
			incognito.start();
			startOpen = false;
			toast.success(t('incognito.started'));
		} catch {
			failed = true;
			toast.error(t('incognito.startFailed'));
		} finally {
			starting = false;
		}
	}

	async function confirmEnd() {
		infoOpen = false;
		await tick();
		toggle?.focus();
		endOpen = true;
	}
</script>

<button
	bind:this={toggle}
	type="button"
	class="incognito-toggle"
	class:active={incognito.active}
	aria-label={t('incognito.label')}
	aria-pressed={incognito.active}
	disabled={starting}
	onclick={open}
>
	<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
		<circle cx="7" cy="15" r="4" /><circle cx="17" cy="15" r="4" />
		<path d="M11 15h2M3 14V9h2m16 5V9h-2" />
	</svg>
	<span class="header-label"
		>{t(incognito.active ? 'incognito.headerActive' : 'incognito.headerLabel')}</span
	>
</button>

<Dialog
	bind:open={startOpen}
	title={t('incognito.startTitle')}
	description={t('incognito.startDescription')}
	disabled={starting}
>
	<p>{t('incognito.browserTip')}</p>
	{#if failed}<p class="start-error" role="alert">{t('incognito.startFailed')}</p>{/if}
	{#snippet footer()}
		<Button variant="secondary" disabled={starting} onclick={() => (startOpen = false)}
			>{t('common.cancel')}</Button
		>
		<Button loading={starting} onclick={start}>{t('incognito.startConfirm')}</Button>
	{/snippet}
</Dialog>

<Dialog
	bind:open={infoOpen}
	title={t('incognito.activeTitle')}
	description={t('incognito.startDescription')}
>
	<p>{t('incognito.idleDescription')}</p>
	{#if expiry}<p class="info-expiry" role="status">
			{t('incognito.expires', { time: expiryTime })}
		</p>{/if}
	<p class="browser-tip">{t('incognito.browserTip')}</p>
	{#snippet footer()}
		<Button variant="secondary" onclick={() => (infoOpen = false)}>{t('ui.close')}</Button>
		<Button onclick={confirmEnd}>{t('incognito.endAction')}</Button>
	{/snippet}
</Dialog>
<IncognitoEndDialog bind:open={endOpen} />

<style>
	.incognito-toggle {
		display: inline-flex;
		flex-shrink: 0;
		align-items: center;
		justify-content: center;
		gap: 8px;
		width: 44px;
		min-height: 44px;
		padding: 8px;
		border: 0;
		border-radius: var(--radius-md);
		background: var(--color-brand-50);
		color: var(--color-brand-ink);
		font-size: 0.875rem;
		font-weight: 650;
		white-space: nowrap;
	}
	.incognito-toggle:hover {
		background: var(--color-brand-100);
	}
	.incognito-toggle.active {
		background: var(--color-mint);
		color: var(--color-ink);
	}
	.incognito-toggle:disabled {
		opacity: 0.6;
	}
	svg {
		width: 20px;
		height: 20px;
		flex-shrink: 0;
	}
	.header-label {
		display: none;
	}
	.browser-tip,
	.info-expiry {
		margin-top: 16px;
	}
	.start-error {
		margin-top: 16px;
		color: var(--color-danger);
	}
	@media (min-width: 480px) {
		.incognito-toggle {
			width: auto;
			padding-inline: 12px;
		}
		.header-label {
			display: inline;
		}
	}
</style>
