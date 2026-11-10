<script lang="ts">
	import { onMount, type Component } from 'svelte';
	import type { CvStore } from '#lib/core/store/cv-store.svelte.ts';
	import type { AiTask } from '#lib/core/ai/types.ts';
	import { t } from '#lib/i18n/index.svelte.ts';
	import Button from './Button.svelte';
	let { store, task }: { store: CvStore; task: AiTask } = $props();
	let Panel = $state<Component<{ store: CvStore; task: AiTask }>>();
	let failed = $state(false);
	let mounted = false;
	async function load() {
		failed = false;
		try {
			const module = await import('./ai/AiAssistPanel.svelte');
			if (mounted) Panel = module.default;
		} catch {
			if (mounted) failed = true;
		}
	}
	onMount(() => {
		mounted = true;
		void load();
		return () => {
			mounted = false;
		};
	});
</script>

{#if Panel}<Panel {store} {task} />
{:else if failed}<p role="status">
		{t('ai.errors.unavailable')}
		<Button variant="ghost" onclick={load}>{t('wizard.retry')}</Button>
	</p>
{:else}<Button variant="ghost" disabled
		>{t(
			task === 'headline'
				? 'aiAssist.headline'
				: task === 'skills'
					? 'aiAssist.skills'
					: 'aiAssist.write'
		)}</Button
	>{/if}
