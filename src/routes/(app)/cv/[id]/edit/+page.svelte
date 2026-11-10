<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';
	import FullEditor from '#lib/ui/editor/FullEditor.svelte';
	import Button from '#lib/ui/Button.svelte';
	import type { PageProps } from './$types';
	let { data }: PageProps = $props();
</script>

<svelte:head><title>{t('editor.title')} · {t('app.name')}</title></svelte:head>

{#if data.cv}
	{#key data.cv.id}<FullEditor initial={data.cv} />{/key}
{:else}
	<div class="missing">
		<h1>{t('wizard.notFound')}</h1>
		<p>{t('wizard.notFoundDescription')}</p>
		<Button href="/cv">{t('nav.myCvs')}</Button>
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
