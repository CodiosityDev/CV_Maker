<script lang="ts">
	import { incognito } from '#lib/core/storage/index.ts';
	import { t } from '#lib/i18n/index.svelte.ts';
	import Button from '#lib/ui/Button.svelte';

	let {
		disabled = false,
		onstart
	}: {
		disabled?: boolean;
		onstart?: () => void | Promise<void>;
	} = $props();
	let starting = $state(false);
	let failed = $state(false);

	async function start() {
		if (disabled || starting || incognito.active) return;
		starting = true;
		failed = false;
		try {
			incognito.start();
			await onstart?.();
		} catch {
			failed = true;
		} finally {
			starting = false;
		}
	}
</script>

{#if !incognito.active}
	<section class="incognito-option" aria-label={t('incognito.optionTitle')}>
		<h2>{t('incognito.optionTitle')}</h2>
		<p>{t('incognito.startDescription')}</p>
		<Button variant="secondary" size="sm" {disabled} loading={starting} onclick={start}>
			{t('incognito.startAction')}
		</Button>
		<p class="browser-tip">{t('incognito.browserTip')}</p>
		{#if failed}<p role="alert">{t('incognito.actionError')}</p>{/if}
	</section>
{/if}

<style>
	.incognito-option {
		display: grid;
		justify-items: start;
		gap: 12px;
		margin-top: 28px;
		padding: 20px;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-brand-50);
		color: var(--color-ink);
		overflow-wrap: anywhere;
	}
	h2 {
		font-size: 1rem;
		font-weight: 650;
	}
	p {
		max-width: 65ch;
		font-size: 0.875rem;
	}
	.browser-tip {
		color: var(--color-text-muted);
		font-size: 0.8125rem;
	}
</style>
