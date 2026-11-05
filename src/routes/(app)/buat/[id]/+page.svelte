<script lang="ts">
	import type { PageProps } from './$types';
	import { t } from '#lib/i18n/index.svelte.ts';
	import Wizard from '#lib/ui/wizard/Wizard.svelte';
	import Button from '#lib/ui/Button.svelte';
	let { data }: PageProps = $props();
</script>

<svelte:head><title>{t('wizard.steps.type.title')} · {t('app.name')}</title></svelte:head>

{#if data.cv}
	{#key data.cv.id}<Wizard initial={data.cv} />{/key}
{:else}
	<div class="missing">
		<h1>{t('wizard.notFound')}</h1>
		<p>{t('wizard.notFoundDescription')}</p>
		<Button href="/buat">{t('wizard.startNew')}</Button>
	</div>
{/if}

<style>
	.missing {
		max-width: 36rem;
		margin: 4rem auto;
		padding: 1.25rem;
	}
	h1 {
		font-size: 2rem;
	}
	p {
		margin: 1rem 0 2rem;
		color: var(--color-text-muted);
	}
</style>
