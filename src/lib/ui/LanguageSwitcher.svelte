<script lang="ts">
	import { t, setLocale, i18n } from '#lib/i18n/index.svelte.ts';

	type Props = { disabled?: boolean; class?: string };
	let { disabled = false, class: className = '' }: Props = $props();
</script>

<div class={`language-switcher ${className}`} role="group" aria-label={t('locale.label')}>
	<button
		type="button"
		class:active={i18n.locale === 'id'}
		aria-pressed={i18n.locale === 'id'}
		aria-label={t('locale.id')}
		{disabled}
		onclick={() => setLocale('id')}>{t('ui.languageId')}</button
	>
	<button
		type="button"
		class:active={i18n.locale === 'en'}
		aria-pressed={i18n.locale === 'en'}
		aria-label={t('locale.en')}
		{disabled}
		onclick={() => setLocale('en')}>{t('ui.languageEn')}</button
	>
</div>

<style>
	.language-switcher {
		display: inline-flex;
		flex-shrink: 0;
		align-items: center;
		gap: 4px;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface-muted);
		padding: 3px;
	}
	button {
		min-width: 44px;
		min-height: 44px;
		border: 1px solid transparent;
		border-radius: var(--radius-sm);
		background: transparent;
		padding: 8px;
		color: var(--color-text-muted);
		font-size: 0.75rem;
		font-weight: 700;
		cursor: pointer;
	}
	button.active {
		border-color: var(--color-brand-ink);
		background: var(--color-brand);
		color: var(--color-ink);
	}
	button:disabled {
		opacity: 0.65;
		cursor: not-allowed;
	}
</style>
