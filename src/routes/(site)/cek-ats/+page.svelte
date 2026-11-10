<script lang="ts">
	import { onMount, type Component } from 'svelte';
	import { t } from '#lib/i18n/index.svelte.ts';
	import Button from '#lib/ui/Button.svelte';
	let Workspace = $state<Component>();
	let failed = $state(false);
	let mounted = false;
	async function load() {
		failed = false;
		try {
			const module = await import('#lib/ui/ats-check/Workspace.svelte');
			if (mounted) Workspace = module.default;
		} catch {
			if (mounted) failed = true;
		}
	}
	onMount(() => {
		mounted = true;
		// This request contains no CV data and never blocks the local scanner.
		void import('#lib/ui/ai/session.svelte.ts')
			.then((module) => module.refreshAiQuota())
			.catch(() => {});
		void load();
		return () => {
			mounted = false;
		};
	});
</script>

<svelte:head>
	<title>{t('atsCheck.pageTitle')} · {t('app.name')}</title>
	<meta name="description" content={t('atsCheck.description')} />
</svelte:head>

<main id="main" class="site-container ats-page" tabindex="-1">
	<h1>{t('atsCheck.pageTitle')}</h1>
	<p class="intro">{t('atsCheck.description')}</p>
	{#if Workspace}<Workspace />
	{:else if failed}<div class="startup" role="alert">
			<p>{t('atsCheck.loadFailed')}</p>
			<Button variant="secondary" onclick={load}>{t('atsCheck.retry')}</Button>
		</div>
	{:else}<p class="startup" role="status">{t('atsCheck.loading')}</p>{/if}
	<noscript><p>{t('atsCheck.needsJavaScript')}</p></noscript>
</main>

<style>
	.ats-page {
		max-width: 58rem;
		padding-block: 2.5rem 4rem;
	}
	h1 {
		font-size: clamp(2rem, 4vw, 2.75rem);
		color: var(--color-text);
	}
	.intro {
		max-width: 42rem;
		margin-block: 1rem 2rem;
		color: var(--color-text-muted);
	}
	.startup {
		display: grid;
		justify-items: start;
		gap: 1rem;
		min-height: 12rem;
	}
</style>
