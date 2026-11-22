<script lang="ts" module>
	import { ensureMessages, registerNamespace } from '#lib/i18n/index.svelte.ts';
	import { homeId } from '#lib/i18n/messages/home.id.ts';

	// Text in the lazy 'home' namespace: nothing added to the landing page's initial JS.
	registerNamespace('home', homeId);
</script>

<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { i18n, t } from '#lib/i18n/index.svelte.ts';
	import { toast } from '#lib/ui/toast.svelte.ts';

	/**
	 * "Unggah PDF untuk diedit": a PDF downloaded from CV Maker carries its CV data, so uploading it
	 * adds the CV to this browser and opens the editor. Other PDFs are refused with a hint. The PDF
	 * code loads only when a file is chosen (nothing extra on the landing page).
	 *
	 * variant 'button' = secondary button (CV Saya), 'link' = text link (home, Buat CV).
	 */
	let {
		variant = 'button',
		showHint = false
	}: { variant?: 'button' | 'link'; showHint?: boolean } = $props();
	const uid = $props.id();
	let input = $state<HTMLInputElement>();
	let busy = $state(false);
	/** English text loads on demand; Indonesian is there at once. */
	let ready = $state(i18n.locale === 'id');
	onMount(() => {
		void ensureMessages().then(() => (ready = true));
	});
	let mounted = true;
	$effect(() => () => (mounted = false));

	async function upload(event: Event) {
		const field = event.currentTarget as HTMLInputElement;
		const file = field.files?.[0];
		field.value = '';
		if (!file || busy) return;
		busy = true;
		try {
			const { importCvPdf } = await import('#lib/core/pdf/import.ts');
			const result = await importCvPdf(file);
			if (!mounted) return;
			if (!result.ok) {
				toast.error(
					t(
						result.reason === 'not-cvmaker'
							? 'pdfUpload.notOurs'
							: result.reason === 'too-large'
								? 'pdfUpload.tooLarge'
								: 'pdfUpload.failed'
					)
				);
				return;
			}
			toast.success(t('pdfUpload.done'));
			await goto(resolve('/(app)/cv/[id]/edit', { id: result.id }));
		} catch {
			if (mounted) toast.error(t('pdfUpload.failed'));
		} finally {
			busy = false;
		}
	}
</script>

<div class="pdf-upload" class:link={variant === 'link'} hidden={!ready}>
	<button
		type="button"
		class="upload-button"
		disabled={busy}
		aria-busy={busy || undefined}
		aria-describedby={showHint ? `${uid}-hint` : undefined}
		onclick={() => input?.click()}
	>
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="1.75"
			aria-hidden="true"
			><path d="M12 16V4m0 0-4.5 4.5M12 4l4.5 4.5M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" /></svg
		>
		{t(busy ? 'pdfUpload.busy' : variant === 'link' ? 'pdfUpload.cta' : 'pdfUpload.button')}
	</button>
	{#if showHint}<p id="{uid}-hint" class="hint">{t('pdfUpload.hint')}</p>{/if}
	<input
		bind:this={input}
		class="file"
		type="file"
		accept="application/pdf,.pdf"
		tabindex="-1"
		aria-hidden="true"
		data-testid="upload-pdf-input"
		onchange={upload}
	/>
</div>

<style>
	.pdf-upload[hidden] {
		display: none;
	}
	.pdf-upload {
		display: grid;
		justify-items: start;
		gap: 4px;
		min-width: 0;
	}
	.upload-button {
		display: inline-flex;
		min-height: 48px;
		align-items: center;
		gap: 8px;
		padding: 12px 20px;
		border: 1px solid transparent;
		border-radius: var(--radius-md);
		background: var(--color-brand-50);
		color: var(--color-brand-ink);
		font: inherit;
		font-size: 0.875rem;
		font-weight: 700;
		line-height: 1.4;
		text-align: left;
		cursor: pointer;
		transition: background-color var(--motion-duration) ease-out;
	}
	.upload-button:hover:not(:disabled) {
		background: var(--color-secondary-hover);
	}
	.upload-button:disabled {
		cursor: progress;
		opacity: 0.75;
	}
	.link {
		margin-top: 0.5rem;
	}
	.link .upload-button {
		min-height: 44px;
		padding: 0;
		background: none;
		color: var(--color-brand-ink);
		font-size: 0.9375rem;
		font-weight: 400;
		text-decoration: underline;
		text-underline-offset: 4px;
	}
	.link .upload-button:hover:not(:disabled) {
		background: none;
		text-decoration-thickness: 2px;
	}
	svg {
		width: 18px;
		height: 18px;
		flex-shrink: 0;
	}
	.hint {
		max-width: 24rem;
		margin: 0;
		color: var(--color-text-muted);
		font-size: 0.8125rem;
		line-height: 1.6;
	}
	.file {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		opacity: 0;
	}
	@media (prefers-reduced-motion: reduce) {
		.upload-button {
			transition: none;
		}
	}
</style>
