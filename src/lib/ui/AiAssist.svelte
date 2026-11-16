<script lang="ts">
	import { onMount, type Component } from 'svelte';
	import type { CvStore } from '#lib/core/store/cv-store.svelte.ts';
	import type { AiTask } from '#lib/core/ai/types.ts';
	import { incognito } from '#lib/core/storage/incognito.svelte.ts';
	import { t } from '#lib/i18n/index.svelte.ts';
	import Button from './Button.svelte';
	let {
		store,
		task,
		deferLoad = false
	}: { store: CvStore; task: AiTask; deferLoad?: boolean } = $props();
	type Activation = { source: string; mode: boolean };
	let Panel = $state<Component<{ store: CvStore; task: AiTask; activation?: Activation }>>();
	let activation = $state.raw<Activation>();
	let failed = $state(false);
	let loading = $state(false);
	let mounted = false;
	let pending: Promise<typeof import('./ai/AiAssistPanel.svelte')> | undefined;
	const available = $derived(
		store.externalChange !== 'removed' && !(incognito.active && incognito.expiredAt)
	);
	const label = $derived(
		task === 'headline'
			? t('aiAssist.headline')
			: task === 'skills'
				? t('aiAssist.skills')
				: t(store.cv.summary.trim() ? 'aiAssist.improve' : 'aiAssist.write')
	);
	const signature = () => JSON.stringify($state.snapshot(store.cv));
	async function load(activate = false) {
		if (!mounted || loading || !available) return;
		const id = store.cv.id;
		const mode = incognito.active;
		const source = activate ? signature() : '';
		loading = true;
		failed = false;
		try {
			const module = await (pending ??= import('./ai/AiAssistPanel.svelte'));
			if (mounted && available && store.cv.id === id && incognito.active === mode) {
				activation = activate && source === signature() ? { source, mode } : undefined;
				Panel = module.default;
			}
		} catch {
			pending = undefined;
			if (mounted && available && store.cv.id === id && incognito.active === mode) failed = true;
		} finally {
			if (mounted) loading = false;
		}
	}
	onMount(() => {
		mounted = true;
		if (!deferLoad) void load();
		return () => {
			mounted = false;
		};
	});
</script>

{#if Panel}<Panel {store} {task} {activation} />
{:else if failed}<p role="status">
		{t('ai.errors.unavailable')}
		<Button variant="ghost" onclick={() => void load(deferLoad)}>{t('wizard.retry')}</Button>
	</p>
{:else}<Button
		variant="ghost"
		disabled={!deferLoad || loading || !available}
		loading={deferLoad && loading}
		onclick={() => void load(true)}>{label}</Button
	>{/if}
