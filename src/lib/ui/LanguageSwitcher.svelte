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
		border: 1px solid transparent;
		border-radius: var(--radius-pill);
		background: var(--color-brand-50);
		padding: 3px;
	}
	button {
		min-width: 44px;
		min-height: 44px;
		border: 1px solid transparent;
		border-radius: var(--radius-pill);
		background: transparent;
		padding: 8px;
		color: var(--color-brand-ink);
		font-size: 0.75rem;
		font-weight: 700;
		cursor: pointer;
		transition:
			background-color var(--motion-duration) ease-out,
			color var(--motion-duration) ease-out,
			transform var(--motion-duration) ease-out;
	}
	button:hover:not(:disabled):not(.active) {
		background: var(--color-brand-100);
	}
	button:active:not(:disabled) {
		transform: translateY(1px);
	}
	button.active {
		background: var(--color-mint);
		color: var(--color-text);
	}
	button:disabled {
		opacity: 0.65;
		cursor: not-allowed;
	}
</style>
