<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { asset } from '$app/paths';
	import {
		checkLetter,
		findLetter,
		LETTER_FONT_CSS_PATH,
		letterFileName,
		toLetterModel
	} from '#lib/core/letter/index.ts';
	import { cvRepo, incognito, onExternalChange } from '#lib/core/storage/index.ts';
	import { t } from '#lib/i18n/index.svelte.ts';
	import FormalLetter from '#lib/templates/letter/FormalLetter.svelte';
	import Button from '#lib/ui/Button.svelte';
	import type { CVDocument } from '#lib/core/schema/types.ts';
	let { data }: { data: { cv: CVDocument | null; letterId: string } } = $props();
	let removed = $state(false);
	let changed = $state(false);
	let mode = $state(false);
	let printed = false;
	let fontStylesLoaded = $state(false);
	let fontLink = $state<HTMLLinkElement>();
	let failed = $state(false);
	let checked = $state(false);
	let viewport = $state<HTMLDivElement>();
	let paper = $state<HTMLDivElement>();
	let scale = $state(1);
	let height = $state(0);
	const unavailable = $derived(
		removed ||
			changed ||
			mode !== incognito.active ||
			Boolean(incognito.active && incognito.expiredAt)
	);
	const letter = $derived(
		checked && data.cv && !unavailable ? findLetter(data.cv, data.letterId) : undefined
	);
	const model = $derived(data.cv && letter ? toLetterModel(data.cv, letter) : undefined);
	const blocked = $derived(
		data.cv && letter ? checkLetter(data.cv, letter).some((check) => check.level === 'error') : true
	);
	const title = $derived(
		data.cv && letter && !incognito.active
			? letterFileName(data.cv, letter, 'pdf')
			: t('letterEditor.printTitle')
	);

	onMount(() => {
		mode = incognito.active;
		const openedMode = incognito.active;
		const openedExpiry = incognito.expiredAt;
		const id = data.cv?.id;
		const expectedVersion = data.cv?.updatedAt;
		const letterId = data.letterId;
		let active = true;
		const link = fontLink;
		const fontsLoaded = () => {
			fontStylesLoaded = true;
		};
		const fontsFailed = () => {
			failed = true;
		};
		link?.addEventListener('load', fontsLoaded);
		link?.addEventListener('error', fontsFailed);
		if (link?.sheet) fontsLoaded();
		document.documentElement.classList.add('letter-print-route');
		const stop = onExternalChange((event) => {
			if (event.type === 'wiped' || (event.type === 'cv-removed' && event.id === data.cv?.id))
				removed = true;
			// Discard stale output when a letter is removed or changed elsewhere; reload explicitly.
			if (event.type === 'cv-saved' && event.id === data.cv?.id) changed = true;
		});
		const expire = incognito.onExpire(() => {
			removed = true;
		});
		if (id) {
			void cvRepo.get(id).then(
				(latest) => {
					if (!active) return;
					if (
						openedMode !== incognito.active ||
						openedExpiry !== incognito.expiredAt ||
						!latest ||
						!findLetter(latest, letterId)
					)
						removed = true;
					else if (latest.updatedAt !== expectedVersion) changed = true;
					else checked = true;
				},
				() => {
					if (active) {
						failed = true;
					}
				}
			);
		} else removed = true;
		return () => {
			active = false;
			link?.removeEventListener('load', fontsLoaded);
			link?.removeEventListener('error', fontsFailed);
			stop();
			expire();
			document.documentElement.classList.remove('letter-print-route');
		};
	});
	$effect(() => {
		const frame = viewport;
		const sheet = paper;
		if (!frame || !sheet) return;
		let raf: number | undefined;
		const measure = () => {
			if (raf !== undefined) cancelAnimationFrame(raf);
			raf = requestAnimationFrame(() => {
				scale = Math.min(1, frame.clientWidth / sheet.offsetWidth);
				height = sheet.offsetHeight * scale;
			});
		};
		const observer = new ResizeObserver(measure);
		observer.observe(frame);
		observer.observe(sheet);
		measure();
		return () => {
			observer.disconnect();
			if (raf !== undefined) cancelAnimationFrame(raf);
		};
	});
	$effect(() => {
		if (!model || blocked || unavailable || printed || !fontStylesLoaded) return;
		let cancelled = false;
		void (async () => {
			await tick();
			await document.fonts.ready;
			if (cancelled || unavailable || blocked || printed) return;
			printed = true;
			document.title = title;
			try {
				window.print();
			} catch {
				failed = true;
			}
		})();
		return () => {
			cancelled = true;
		};
	});
</script>

<svelte:head
	><title>{title}</title><meta name="robots" content="noindex" /><link
		rel="stylesheet"
		href={asset(LETTER_FONT_CSS_PATH.slice(1) as Parameters<typeof asset>[0])}
		bind:this={fontLink}
	/></svelte:head
>

{#if !checked && !unavailable && !failed}<p class="print-error" role="status">
		{t('common.loading')}
	</p>
{:else if model && !blocked && !unavailable}
	<div class="print-page">
		<div class="paper-viewport" bind:this={viewport} style:height="{height}px">
			<div class="paper" bind:this={paper} style:transform="scale({scale})">
				<FormalLetter {model} />
			</div>
		</div>
	</div>
	{#if failed}<p role="alert" class="print-error">{t('printPage.printError')}</p>{/if}
{:else}<div class="missing">
		<h1>
			{t(
				failed
					? 'printPage.loadError'
					: changed
						? 'wizard.externalUpdated'
						: unavailable
							? 'wizard.externalRemoved'
							: blocked && letter
								? 'letterEditor.printBlocked'
								: 'letterEditor.missingLetter'
			)}
		</h1>
		<Button href={data.cv ? `/cv/${data.cv.id}/surat/${data.letterId}` : '/surat'}
			>{t('printPage.back')}</Button
		>
	</div>{/if}

<style>
	.print-page {
		width: min(210mm, calc(100% - 24px));
		margin: 24px auto 40px;
	}
	.paper-viewport {
		width: 100%;
		overflow: hidden;
		background: #fff;
		outline: 1px solid var(--color-border);
	}
	.paper {
		width: 210mm;
		transform-origin: top left;
		background: #fff;
		color: #000;
		color-scheme: light;
	}
	.missing {
		display: grid;
		justify-items: start;
		gap: 24px;
		max-width: 36rem;
		margin: 48px auto;
		padding: 20px;
	}
	.missing h1 {
		font-size: 1.5rem;
	}
	.print-error {
		padding: 24px;
		text-align: center;
	}
	@media print {
		@page {
			size: A4;
			margin: 25mm;
		}
		:global(html.letter-print-route),
		:global(.letter-print-route body) {
			margin: 0;
			padding: 0;
			background: #fff;
			color: #000;
			color-scheme: light;
		}
		:global(.letter-print-route .skip-link),
		:global(.letter-print-route .toaster),
		.missing,
		.print-error {
			display: none !important;
		}
		:global(.letter-print-route #main),
		.print-page,
		.paper-viewport,
		.paper {
			width: auto;
			max-width: none;
			height: auto !important;
			margin: 0;
			padding: 0;
			overflow: visible;
			outline: 0;
			box-shadow: none;
			transform: none !important;
		}
	}
</style>
