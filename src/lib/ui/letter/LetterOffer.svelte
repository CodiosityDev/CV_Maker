<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { t } from '#lib/i18n/index.svelte.ts';
	import { incognito } from '#lib/core/storage/index.ts';
	import Button from '#lib/ui/Button.svelte';
	import {
		didDownloadCv,
		didSkipLetter,
		readLetterOffer,
		skipLetterOffer
	} from './offer.svelte.ts';
	let { cvId, beforeLeave }: { cvId: string; beforeLeave?: (event: MouseEvent) => void } = $props();
	let ready = $state(false);
	onMount(() => {
		readLetterOffer(cvId);
		ready = true;
	});
	$effect(() => {
		void incognito.active;
		readLetterOffer(cvId);
	});
</script>

{#if ready && didDownloadCv(cvId) && !didSkipLetter(cvId)}<aside
		class="letter-offer"
		data-testid="letter-offer"
		aria-label={t('letterEditor.title')}
	>
		<p>{t('letterEditor.promptTitle')}</p>
		<div>
			<Button
				href={resolve('/(app)/cv/[id]/surat', { id: cvId })}
				variant="secondary"
				onclick={beforeLeave}>{t('letterEditor.promptCreate')}</Button
			><Button variant="ghost" onclick={() => skipLetterOffer(cvId)}
				>{t('letterEditor.promptSkip')}</Button
			>
		</div>
	</aside>{/if}

<style>
	.letter-offer {
		display: grid;
		gap: 12px;
		padding: 18px;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-mint-50);
	}
	p {
		margin: 0;
		font-size: 0.875rem;
		line-height: 1.7;
	}
	div {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	@media print {
		.letter-offer {
			display: none !important;
		}
	}
</style>
