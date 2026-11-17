<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { shareClient, type AccountErrorCode } from '#lib/core/account/index.ts';
	import { exportFileName } from '#lib/core/export/index.ts';
	import { toRenderModel, type RenderModel } from '#lib/core/render/index.ts';
	import { REPORT_REASONS, type PublicShare, type ReportReason } from '#lib/core/share/index.ts';
	import { t, type MessageKey } from '#lib/i18n/index.svelte.ts';
	import { resolveTemplate, type TemplateComponent } from '#lib/templates/registry.ts';
	import Button from '#lib/ui/Button.svelte';
	import Input from '#lib/ui/Input.svelte';
	import Select from '#lib/ui/Select.svelte';
	import { preventPreviewNavigation } from '#lib/ui/prevent-preview-navigation.ts';

	type Status = 'loading' | 'password' | 'notFound' | 'error' | 'ready';

	let status = $state<Status>('loading');
	let share = $state.raw<PublicShare>();
	let Template = $state<TemplateComponent>();
	let model = $state.raw<RenderModel>();
	let password = $state('');
	let passwordError = $state<AccountErrorCode>();
	let busy = $state(false);
	let loadError = $state<AccountErrorCode>();
	let reportOpen = $state(false);
	let reportReason = $state<ReportReason>('spam');
	let reportState = $state<'idle' | 'sending' | 'sent' | 'failed'>('idle');
	let viewport = $state<HTMLDivElement>();
	let paper = $state<HTMLDivElement>();
	let scale = $state(1);
	let height = $state(0);

	const slug = $derived(page.params.slug ?? '');
	const title = $derived(
		share?.snapshot.personal.fullName
			? t('viewer.pageTitle', { name: share.snapshot.personal.fullName })
			: t('viewer.pageTitleFallback')
	);

	async function show(next: PublicShare) {
		const module = await resolveTemplate(next.snapshot.templateId, next.snapshot.kind).load();
		share = next;
		model = toRenderModel(next.snapshot, { photoUrl: next.photo ?? undefined });
		Template = module.default;
		status = 'ready';
	}

	async function open(withPassword?: string) {
		const result = await shareClient.open(slug, withPassword);
		if (result.ok) {
			try {
				await show(result.data);
			} catch {
				status = 'error';
			}
			return;
		}
		if (result.error === 'password') {
			if (withPassword !== undefined) passwordError = 'password';
			status = 'password';
		} else if (result.error === 'notFound') status = 'notFound';
		else if (withPassword !== undefined && result.error === 'busy') passwordError = 'busy';
		else {
			loadError = result.error;
			status = 'error';
		}
	}

	onMount(() => {
		document.documentElement.classList.add('cv-print-route');
		void open();
		return () => document.documentElement.classList.remove('cv-print-route');
	});

	async function unlock(event: SubmitEvent) {
		event.preventDefault();
		if (!password) return;
		busy = true;
		passwordError = undefined;
		await open(password);
		busy = false;
	}

	$effect(() => {
		const frame = viewport;
		const sheet = paper;
		if (!frame || !sheet) return;
		let request: number | undefined;
		const measure = () => {
			request = undefined;
			if (!sheet.offsetWidth) return;
			scale = Math.min(1, frame.clientWidth / sheet.offsetWidth);
			height = sheet.offsetHeight * scale;
		};
		const observer = new ResizeObserver(() => {
			if (request !== undefined) cancelAnimationFrame(request);
			request = requestAnimationFrame(measure);
		});
		observer.observe(frame);
		observer.observe(sheet);
		return () => {
			observer.disconnect();
			if (request !== undefined) cancelAnimationFrame(request);
		};
	});

	function download() {
		if (!share) return;
		const previous = document.title;
		const cv = share.snapshot;
		document.title = exportFileName(
			{ fullName: cv.personal.fullName, targetRole: cv.targetRole, title: cv.title },
			'pdf'
		).replace(/\.pdf$/, '');
		try {
			window.print();
		} finally {
			setTimeout(() => (document.title = previous), 1000);
		}
	}

	async function sendReport(event: SubmitEvent) {
		event.preventDefault();
		reportState = 'sending';
		const result = await shareClient.report(slug, reportReason);
		reportState = result.ok ? 'sent' : 'failed';
	}

	const reasonOptions = $derived(
		REPORT_REASONS.map((reason) => ({
			value: reason,
			label: t(`viewer.reasons.${reason}` as MessageKey)
		}))
	);
</script>

<svelte:head>
	<title>{title}</title>
	{#if !share?.discoverable}<meta name="robots" content="noindex, nofollow" />{/if}
	<meta name="referrer" content="no-referrer" />
</svelte:head>

<div class="viewer">
	{#if status === 'loading'}
		<p class="status" role="status">{t('viewer.loading')}</p>
	{:else if status === 'notFound'}
		<div class="status">
			<h1>{t('viewer.notFoundTitle')}</h1>
			<p>{t('viewer.notFound')}</p>
			<Button href="/buat">{t('viewer.makeYourOwn')}</Button>
		</div>
	{:else if status === 'password'}
		<form class="status" novalidate onsubmit={unlock}>
			<h1>{t('viewer.passwordTitle')}</h1>
			<p>{t('viewer.passwordIntro')}</p>
			<Input
				type="password"
				label={t('viewer.passwordLabel')}
				bind:value={password}
				autocomplete="off"
				disabled={busy}
				error={passwordError
					? t(passwordError === 'busy' ? 'viewer.busy' : 'viewer.wrongPassword')
					: undefined}
			/>
			<Button type="submit" loading={busy}>{t('viewer.open')}</Button>
		</form>
	{:else if status === 'error'}
		<div class="status" role="alert">
			<p>
				{t(
					loadError === 'offline'
						? 'viewer.offline'
						: loadError === 'busy'
							? 'viewer.busy'
							: 'viewer.error'
				)}
			</p>
			<Button
				variant="secondary"
				onclick={() => {
					status = 'loading';
					void open();
				}}>{t('viewer.retry')}</Button
			>
		</div>
	{:else if Template && model && share}
		<div class="toolbar">
			<p class="via">
				{t('viewer.sharedVia')} <a href={resolve('/(site)')}>{t('app.name')}</a>
			</p>
			<div class="actions">
				{#if share.allowDownload}<Button onclick={download}>{t('viewer.download')}</Button>{/if}
				<Button href="/buat" variant="secondary">{t('viewer.makeYourOwn')}</Button>
			</div>
		</div>
		<div class="paper-viewport" bind:this={viewport} style:height="{height}px">
			<div
				class="paper"
				bind:this={paper}
				style:transform="scale({scale})"
				use:preventPreviewNavigation
				data-testid="shared-paper"
			>
				<Template {model} />
			</div>
		</div>
		<div class="report">
			{#if reportState === 'sent'}
				<p role="status">{t('viewer.reported')}</p>
			{:else if reportOpen}
				<form novalidate onsubmit={sendReport}>
					<h2>{t('viewer.reportTitle')}</h2>
					<p>{t('viewer.reportIntro')}</p>
					<Select
						label={t('viewer.reportReason')}
						bind:value={reportReason as string}
						options={reasonOptions}
					/>
					{#if reportState === 'failed'}<p class="error" role="alert">
							{t('viewer.reportFailed')}
						</p>{/if}
					<div class="actions">
						<Button type="submit" variant="secondary" loading={reportState === 'sending'}
							>{t('viewer.reportSend')}</Button
						>
						<Button variant="ghost" onclick={() => (reportOpen = false)}
							>{t('viewer.reportCancel')}</Button
						>
					</div>
				</form>
			{:else}
				<button type="button" class="text-button" onclick={() => (reportOpen = true)}
					>{t('viewer.report')}</button
				>
			{/if}
		</div>
	{/if}
</div>

<style>
	.viewer {
		width: min(54rem, calc(100% - 32px));
		margin-inline: auto;
		padding-block: 20px 48px;
	}
	.status {
		display: grid;
		gap: 16px;
		max-width: 480px;
		margin: 24px auto;
		padding: 24px;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
	}
	.status h1 {
		font-size: clamp(1.375rem, 5vw, 1.75rem);
		font-weight: 650;
	}
	.status p {
		color: var(--color-text-muted);
		line-height: 1.7;
	}
	.toolbar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		margin-bottom: 16px;
	}
	.via {
		color: var(--color-text-muted);
		font-size: 0.875rem;
	}
	.via a {
		font-weight: 600;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.paper-viewport {
		width: 100%;
		max-width: 210mm;
		margin-inline: auto;
		overflow: hidden;
		background: var(--color-paper);
		outline: 1px solid var(--color-border);
		box-shadow: var(--shadow-paper);
	}
	.paper {
		--color-focus: var(--color-paper-focus);
		color: var(--color-paper-ink);
		color-scheme: light;
		width: 210mm;
		min-height: 297mm;
		transform-origin: top left;
		background: var(--color-paper);
		filter: var(--paper-dim, none);
	}
	.report {
		max-width: 210mm;
		margin: 16px auto 0;
		color: var(--color-text-muted);
		font-size: 0.875rem;
	}
	.report form {
		display: grid;
		gap: 12px;
		max-width: 420px;
	}
	.report h2 {
		color: var(--color-text);
		font-size: 1rem;
		font-weight: 650;
	}
	.text-button {
		min-height: 44px;
		padding: 0;
		border: 0;
		background: none;
		color: var(--color-text-muted);
		font: inherit;
		text-decoration: underline;
		cursor: pointer;
	}
	.error {
		color: var(--color-danger);
	}
	@media print {
		@page {
			size: A4;
			margin: 0;
		}
		:global(html.cv-print-route),
		:global(.cv-print-route body) {
			margin: 0;
			padding: 0;
			background: var(--color-paper);
		}
		:global(.cv-print-route .skip-link),
		:global(.cv-print-route .toaster),
		.toolbar,
		.report {
			display: none !important;
		}
		:global(.cv-print-route #main),
		.viewer {
			width: auto;
			max-width: none;
			margin: 0;
			padding: 0;
		}
		.paper-viewport {
			width: 210mm;
			max-width: none;
			height: auto !important;
			overflow: visible;
			outline: 0;
			box-shadow: none;
		}
		.paper {
			transform: none !important;
			filter: none;
		}
	}
</style>
