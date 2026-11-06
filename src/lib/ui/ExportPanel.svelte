<script lang="ts">
	import { onDestroy, tick } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { CVDocument } from '#lib/core/schema/types.ts';
	import { toRenderModel } from '#lib/core/render/index.ts';
	import { incognito } from '#lib/core/storage/index.ts';
	import {
		downloadBlob,
		exportDocx,
		exportFileName,
		exportTxt,
		toPlainText
	} from '#lib/core/export/index.ts';
	import { t } from '#lib/i18n/index.svelte.ts';
	import Button from '#lib/ui/Button.svelte';
	import { toast } from '#lib/ui/toast.svelte.ts';

	let { cv, beforeLeave }: { cv: CVDocument; beforeLeave?: () => Promise<boolean> } = $props();
	const uid = $props.id();
	let busy = $state<'docx' | 'txt' | 'copy' | 'leave'>();
	let manualText = $state<string>();
	let textarea = $state<HTMLTextAreaElement>();
	let active = true;

	onDestroy(() => {
		active = false;
	});
	function sameSession(startedInIncognito: boolean) {
		return (
			active &&
			incognito.active === startedInIncognito &&
			(!startedInIncognito || !incognito.expiredAt)
		);
	}

	async function leave(event: MouseEvent) {
		if (
			!beforeLeave ||
			event.defaultPrevented ||
			event.button !== 0 ||
			event.ctrlKey ||
			event.metaKey ||
			event.altKey ||
			event.shiftKey
		)
			return;
		event.preventDefault();
		if (busy) return;
		busy = 'leave';
		const id = cv.id;
		try {
			if ((await beforeLeave()) && active && id === cv.id) {
				await goto(resolve('/(app)/cv/[id]/print', { id }));
			}
		} catch {
			if (active) toast.error(t('exportPanel.navigationError'));
		} finally {
			busy = undefined;
		}
	}

	async function download(format: 'docx' | 'txt') {
		if (busy) return;
		const session = incognito.active;
		if (!sameSession(session)) return;
		busy = format;
		const current = $state.snapshot(cv);
		try {
			const model = toRenderModel(current);
			const blob = await (format === 'docx' ? exportDocx(model) : exportTxt(model));
			if (!sameSession(session) || current.id !== cv.id) return;
			downloadBlob(
				blob,
				exportFileName(
					{
						fullName: current.personal.fullName,
						targetRole: current.targetRole,
						title: current.title
					},
					format
				)
			);
		} catch {
			if (active) toast.error(t('exportPanel.downloadError'));
		} finally {
			busy = undefined;
		}
	}

	function selectText() {
		textarea?.focus();
		textarea?.select();
	}

	async function copy() {
		if (busy) return;
		const session = incognito.active;
		if (!sameSession(session)) return;
		busy = 'copy';
		const current = $state.snapshot(cv);
		const text = toPlainText(toRenderModel(current));
		try {
			if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
			await navigator.clipboard.writeText(text);
			if (!sameSession(session) || current.id !== cv.id) return;
			manualText = undefined;
			toast.success(t('exportPanel.copied'));
		} catch {
			if (!sameSession(session) || current.id !== cv.id) return;
			manualText = text;
			await tick();
			if (sameSession(session)) selectText();
		} finally {
			busy = undefined;
		}
	}
</script>

<section
	class="export-panel"
	aria-labelledby="{uid}-title"
	aria-busy={busy === 'leave' || undefined}
	data-testid="export-panel"
>
	<h2 id="{uid}-title">{t('exportPanel.title')}</h2>
	{#if cv.kind === 'creative'}<p>{t('exportPanel.simpleLayout')}</p>{/if}
	<div class="pdf-option">
		<a class="pdf-link" href={resolve('/(app)/cv/[id]/print', { id: cv.id })} onclick={leave}>
			{t('exportPanel.pdf')}
			<svg
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="1.75"
				aria-hidden="true"
			>
				<path d="M7 17 17 7M7 7h10v10" />
			</svg>
		</a>
		<p>{t('exportPanel.pdfHint')}</p>
		{#if cv.kind === 'ats'}<p>{t('exportPanel.pdfAtsHint')}</p>{/if}
	</div>
	<div class="other-options">
		<div class="format-row">
			<Button
				variant="secondary"
				disabled={!!busy}
				loading={busy === 'docx'}
				onclick={() => download('docx')}
			>
				{t(busy === 'docx' ? 'exportPanel.preparing' : 'exportPanel.docx')}
			</Button>
			<p>{t('exportPanel.docxHint')}</p>
		</div>
		<div class="format-row">
			<Button
				variant="secondary"
				disabled={!!busy}
				loading={busy === 'txt'}
				onclick={() => download('txt')}
			>
				{t(busy === 'txt' ? 'exportPanel.preparing' : 'exportPanel.txt')}
			</Button>
			<p>{t('exportPanel.txtHint')}</p>
		</div>
		<div class="format-row">
			<Button variant="secondary" disabled={!!busy} loading={busy === 'copy'} onclick={copy}>
				{t(busy === 'copy' ? 'exportPanel.copying' : 'exportPanel.copy')}
			</Button>
			<p>{t('exportPanel.copyHint')}</p>
		</div>
	</div>
	{#if manualText !== undefined}
		<div class="manual-copy">
			<label for="{uid}-text">{t('exportPanel.manualLabel')}</label>
			<p id="{uid}-manual-hint">{t('exportPanel.manualHint')}</p>
			<textarea
				id="{uid}-text"
				bind:this={textarea}
				value={manualText}
				readonly
				rows="7"
				aria-describedby="{uid}-manual-hint"></textarea>
			<Button variant="ghost" onclick={selectText}>{t('exportPanel.selectText')}</Button>
		</div>
	{/if}
	{#if incognito.active}<p class="privacy-note">{t('incognito.downloadSafety')}</p>{/if}
</section>

<style>
	.export-panel {
		display: grid;
		min-width: 0;
		gap: 1.25rem;
	}
	h2 {
		margin: 0;
		font-size: 1.125rem;
		font-weight: 650;
		line-height: 1.5;
	}
	p {
		margin: 0;
		color: var(--color-text-muted);
		font-size: 0.875rem;
		line-height: 1.6;
	}
	.pdf-option {
		display: grid;
		gap: 0.5rem;
	}
	.pdf-link {
		display: inline-flex;
		min-height: 48px;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		padding: 0.75rem 1rem;
		border: 1px solid transparent;
		border-radius: var(--radius-md);
		background: var(--color-brand);
		color: var(--color-ink);
		font-size: 0.875rem;
		font-weight: 700;
		line-height: 1.5;
		text-align: center;
		text-decoration: none;
		transition: transform var(--motion-duration) ease-out;
	}
	.pdf-link:hover {
		background: var(--color-brand-hover);
	}
	.pdf-link:active {
		transform: translateY(1px);
	}
	svg {
		width: 20px;
		height: 20px;
		flex-shrink: 0;
	}
	.other-options {
		display: grid;
		gap: 1rem;
	}
	.format-row {
		display: grid;
		min-width: 0;
		gap: 0.375rem;
	}
	.manual-copy {
		display: grid;
		min-width: 0;
		gap: 0.75rem;
		padding: 1rem;
		border-radius: var(--radius-md);
		background: var(--color-mint-50);
	}
	label {
		font-size: 0.875rem;
		font-weight: 600;
	}
	textarea {
		box-sizing: border-box;
		width: 100%;
		min-width: 0;
		min-height: 10rem;
		padding: 0.75rem;
		border: 1px solid var(--color-control-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		color: var(--color-text);
		font-size: 1rem;
		line-height: 1.6;
		resize: vertical;
	}
	.privacy-note {
		padding-top: 1rem;
		border-top: 1px solid var(--color-border);
		font-size: 0.75rem;
	}
	@media (min-width: 480px) {
		.format-row {
			grid-template-columns: minmax(10rem, 0.8fr) minmax(0, 1fr);
			align-items: center;
			gap: 1rem;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.pdf-link {
			transition: none;
		}
	}
</style>
