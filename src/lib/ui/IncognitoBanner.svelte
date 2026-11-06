<script lang="ts">
	import { incognito } from '#lib/core/storage/index.ts';
	import { i18n, t } from '#lib/i18n/index.svelte.ts';
	import Button from '#lib/ui/Button.svelte';
	import IncognitoEndDialog from '#lib/ui/IncognitoEndDialog.svelte';

	let endOpen = $state(false);
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
</script>

{#if incognito.active}
	<section class="incognito-banner" aria-label={t('incognito.label')}>
		<div class="site-container">
			<div class="banner-row">
				<p class="short-title">{t('incognito.activeTitle')}</p>
				<p class="full-message">{t('incognito.activeDescription')}</p>
				<Button
					class="end-action"
					variant="secondary"
					size="sm"
					onclick={(event) => {
						if (event.currentTarget instanceof HTMLElement) event.currentTarget.focus();
						endOpen = true;
					}}>{t('incognito.endAction')}</Button
				>
			</div>
			{#if expiry}<p class="expiry" role="status">
					{t('incognito.expires', { time: expiryTime })}
				</p>{/if}
		</div>
	</section>
{/if}

<IncognitoEndDialog bind:open={endOpen} />

<style>
	.incognito-banner {
		padding-block: 6px;
		border-bottom: 1px solid var(--color-border);
		background: var(--color-brand-100);
		color: var(--color-ink);
	}
	.banner-row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
		gap: 4px;
	}
	.short-title {
		min-width: 0;
		font-size: 0.75rem;
		font-weight: 650;
	}
	.full-message {
		display: none;
		font-size: 0.8125rem;
	}
	.banner-row :global(.button) {
		padding-inline: 8px;
		font-size: 0.75rem;
		white-space: nowrap;
	}
	.expiry {
		margin-block: 2px 4px;
		font-size: 0.75rem;
	}
	@media (min-width: 768px) {
		.short-title {
			display: none;
		}
		.full-message {
			display: block;
		}
		.banner-row {
			gap: 12px;
		}
		.banner-row :global(.button) {
			padding-inline: 12px;
			font-size: 0.875rem;
		}
	}
	@media print {
		.incognito-banner {
			display: none;
		}
	}
</style>
