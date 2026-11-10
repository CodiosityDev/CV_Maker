<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { exportFileName } from '#lib/core/export/index.ts';
	import { toRenderModel, type RenderModel } from '#lib/core/render/index.ts';
	import { assetRepo, incognito, onExternalChange } from '#lib/core/storage/index.ts';
	import { t } from '#lib/i18n/index.svelte.ts';
	import { resolveTemplate, type TemplateComponent } from '#lib/templates/registry.ts';
	import Button from '#lib/ui/Button.svelte';
	import { toast } from '#lib/ui/toast.svelte.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const backHref = $derived(
		page.url.searchParams.get('from') === 'editor' && data.cv ? `/cv/${data.cv.id}/edit` : '/cv'
	);
	let Template = $state<TemplateComponent>();
	let model = $state.raw<RenderModel>();
	let loading = $state(true);
	let failed = $state(false);
	let retry = $state(0);
	let viewport = $state<HTMLDivElement>();
	let paper = $state<HTMLDivElement>();
	let scale = $state(0);
	let height = $state(0);
	let originalTitle: string | undefined;
	let titleTimer: ReturnType<typeof setTimeout> | undefined;
	let removedId = $state<string>();
	const expired = $derived(incognito.active && Boolean(incognito.expiredAt));
	const unavailable = $derived(expired || Boolean(data.cv && removedId === data.cv.id));

	function restoreTitle() {
		clearTimeout(titleTimer);
		titleTimer = undefined;
		if (originalTitle === undefined) return;
		document.title = originalTitle;
		originalTitle = undefined;
	}

	onMount(() => {
		document.documentElement.classList.add('cv-print-route');
		window.addEventListener('beforeprint', preparePrintTitle);
		window.addEventListener('afterprint', restoreTitle);
		const unsubscribe = onExternalChange((event) => {
			const id = data.cv?.id;
			if (id && (event.type === 'wiped' || (event.type === 'cv-removed' && event.id === id))) {
				removedId = id;
				restoreTitle();
			}
		});
		return () => {
			unsubscribe();
			window.removeEventListener('beforeprint', preparePrintTitle);
			window.removeEventListener('afterprint', restoreTitle);
			restoreTitle();
			document.documentElement.classList.remove('cv-print-route');
		};
	});

	$effect(() => {
		const cv = unavailable ? undefined : data.cv;
		if (unavailable) restoreTitle();
		void retry;
		let cancelled = false;
		let photoUrl: string | undefined;
		Template = undefined;
		model = undefined;
		loading = Boolean(cv);
		failed = false;

		if (cv) {
			void (async () => {
				try {
					const meta = resolveTemplate(cv.templateId, cv.kind);
					const module = await meta.load();
					if (cancelled) return;
					if (meta.supportsPhoto && cv.personal.photoAssetId) {
						photoUrl = (await assetRepo.getPhotoUrl(cv.personal.photoAssetId)) ?? undefined;
					}
					if (cancelled) {
						if (photoUrl) URL.revokeObjectURL(photoUrl);
						photoUrl = undefined;
						return;
					}
					model = toRenderModel(cv, { photoUrl });
					Template = module.default;
				} catch {
					if (!cancelled) failed = true;
				} finally {
					if (!cancelled) loading = false;
				}
			})();
		}

		return () => {
			cancelled = true;
			if (photoUrl) URL.revokeObjectURL(photoUrl);
			photoUrl = undefined;
		};
	});

	$effect(() => {
		const frame = viewport;
		const sheet = paper;
		if (!frame || !sheet) return;
		let request: number | undefined;
		function measure() {
			request = undefined;
			if (!frame || !sheet || !sheet.offsetWidth) return;
			const nextScale = Math.min(1, frame.clientWidth / sheet.offsetWidth);
			scale = nextScale;
			height = sheet.offsetHeight * nextScale;
		}
		function schedule() {
			if (request !== undefined) cancelAnimationFrame(request);
			request = requestAnimationFrame(measure);
		}
		const observer = new ResizeObserver(schedule);
		observer.observe(frame);
		observer.observe(sheet);
		schedule();
		return () => {
			observer.disconnect();
			if (request !== undefined) cancelAnimationFrame(request);
		};
	});

	function preparePrintTitle() {
		const cv = data.cv;
		if (!cv || unavailable) return;
		originalTitle ??= document.title;
		document.title = incognito.active
			? t('printPage.incognitoTitle')
			: exportFileName(
					{ fullName: cv.personal.fullName, targetRole: cv.targetRole, title: cv.title },
					'pdf'
				).replace(/\.pdf$/, '');
		clearTimeout(titleTimer);
		titleTimer = setTimeout(restoreTitle, 1000);
	}

	function printCv() {
		if (!data.cv || unavailable || !Template || !model || loading) return;
		restoreTitle();
		preparePrintTitle();
		try {
			window.print();
		} catch {
			restoreTitle();
			toast.error(t('printPage.printError'));
		}
	}
</script>

<svelte:head><title>{t('printPage.title')} · {t('app.name')}</title></svelte:head>

<div class="print-page">
	{#if unavailable}
		<div class="print-status" role="alert" data-testid="removed-cv">
			<p>{t(expired ? 'incognito.expiredMessage' : 'wizard.externalRemoved')}</p>
			<div class="print-recovery-actions">
				<Button href="/buat">{t('wizard.startNew')}</Button>
				<Button href="/cv" variant="secondary">{t('dashboard.title')}</Button>
			</div>
		</div>
	{:else if data.cv}
		<div class="print-toolbar" data-testid="print-toolbar">
			<Button href={backHref} variant="ghost">{t('printPage.back')}</Button>
			<Button onclick={printCv} disabled={loading || !Template || !model}>
				{t('printPage.savePdf')}
			</Button>
		</div>
		<details class="print-guide">
			<summary>{t('printPage.guideTitle')}</summary>
			<dl>
				<dt>{t('printPage.android')}</dt>
				<dd>{t('printPage.androidGuide')}</dd>
				<dt>{t('printPage.iphone')}</dt>
				<dd>{t('printPage.iphoneGuide')}</dd>
				<dt>{t('printPage.desktop')}</dt>
				<dd>{t('printPage.desktopGuide')}</dd>
			</dl>
		</details>
		{#if loading}
			<p class="print-status" role="status">{t('printPage.loading')}</p>
		{:else if failed}
			<div class="print-status" role="alert">
				<p>{t('printPage.loadError')}</p>
				<Button variant="secondary" onclick={() => (retry += 1)}>{t('printPage.retry')}</Button>
			</div>
		{:else if Template && model}
			<div
				class="paper-viewport"
				bind:this={viewport}
				style:height="{height}px"
				data-testid="print-viewport"
			>
				<div
					class="paper"
					bind:this={paper}
					style:transform="scale({scale})"
					data-testid="print-paper"
				>
					<Template {model} />
				</div>
			</div>
		{/if}
	{:else}
		<div class="missing">
			<h1>{t('printPage.notFound')}</h1>
			<p>{t('printPage.notFoundDescription')}</p>
			<Button href="/cv">{t('printPage.back')}</Button>
		</div>
	{/if}
</div>

<style>
	.print-page {
		width: min(54rem, calc(100% - 32px));
		margin-inline: auto;
		padding-block: 20px 40px;
	}
	.print-toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		margin-bottom: 16px;
	}
	.print-recovery-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.print-guide {
		margin-bottom: 24px;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-mint-50);
	}
	summary {
		min-height: 48px;
		padding: 12px 16px;
		font-size: 0.875rem;
		font-weight: 650;
		cursor: pointer;
	}
	dl {
		margin: 0;
		padding: 0 16px 20px;
		font-size: 0.875rem;
		line-height: 1.75;
	}
	dt {
		font-weight: 650;
	}
	dt:not(:first-child) {
		margin-top: 16px;
	}
	dd {
		margin: 4px 0 0;
		color: var(--color-text-muted);
	}
	.paper-viewport {
		width: 100%;
		max-width: 210mm;
		margin-inline: auto;
		overflow: hidden;
		background: #fff;
		outline: 1px solid var(--color-border);
		box-shadow: var(--shadow-card);
	}
	.paper {
		width: 210mm;
		min-height: 297mm;
		transform-origin: top left;
		background: #fff;
	}
	.print-status,
	.missing {
		padding: 24px;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
	}
	.print-status p,
	.missing p {
		margin-bottom: 16px;
		color: var(--color-text-muted);
	}
	.missing h1 {
		margin-bottom: 16px;
		font-size: clamp(1.5rem, 5vw, 2rem);
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
			background: #fff;
		}
		:global(.cv-print-route .app-header),
		:global(.cv-print-route .app-notice),
		:global(.cv-print-route .skip-link),
		:global(.cv-print-route .toaster),
		.print-toolbar,
		.print-guide,
		.print-status,
		.missing {
			display: none !important;
		}
		:global(.cv-print-route #main),
		.print-page {
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
			border: 0;
			outline: 0;
			box-shadow: none;
		}
		.paper {
			transform: none !important;
			border: 0;
			box-shadow: none;
		}
	}
</style>
