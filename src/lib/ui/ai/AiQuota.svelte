<script lang="ts">
	import type { Snippet } from 'svelte';
	import { t } from '#lib/i18n/index.svelte.ts';
	import Button from '#lib/ui/Button.svelte';
	import { aiSession } from './session.svelte.ts';

	let {
		id,
		quotaText,
		rewarding = false,
		disabled = false,
		onreward,
		children
	}: {
		id?: string;
		quotaText?: string;
		rewarding?: boolean;
		disabled?: boolean;
		onreward: () => void;
		children?: Snippet;
	} = $props();
	const exhausted = $derived(aiSession.quota?.remaining === 0);
</script>

{#if aiSession.quota}<p {id} class="quota" data-testid="ai-quota" aria-live="polite">
		{quotaText ??
			t('aiAssist.quota', {
				remaining: aiSession.quota.remaining,
				limit: aiSession.quota.limit
			})}{#if exhausted}
			{t('aiAssist.reset')}{/if}
	</p>{/if}
{@render children?.()}
{#if exhausted && aiSession.quota?.rewards?.remaining}<div class="reward">
		<Button variant="secondary" disabled={rewarding || disabled} onclick={onreward}
			>{t('aiAssist.reward', { count: aiSession.quota.rewards.remaining })}</Button
		>
		<p class="hint">{t('aiAssist.rewardHint')}</p>
	</div>{/if}

<style>
	p {
		line-height: 1.6;
	}
	.hint,
	.quota {
		margin-top: 0.5rem;
		color: var(--color-text-muted);
		font-size: 0.8125rem;
	}
	.reward {
		margin-top: 0.75rem;
	}
</style>
