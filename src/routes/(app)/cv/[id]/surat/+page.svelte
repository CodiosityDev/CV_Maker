<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';
	import Button from '#lib/ui/Button.svelte';
	import LetterWorkspace from '#lib/ui/letter/LetterWorkspace.svelte';
	import type { PageProps } from './$types';
	let { data }: PageProps = $props();
</script>

<svelte:head><title>{t('letterEditor.title')} · {t('app.name')}</title></svelte:head>

{#if data.cv}{#key data.cv.id}<LetterWorkspace initial={data.cv} />{/key}
{:else}<div class="missing">
		<h1>{t('wizard.notFound')}</h1>
		<p>{t('wizard.notFoundDescription')}</p>
		<Button href="/surat">{t('letterEditor.backToLetters')}</Button>
	</div>{/if}

<style>
	.missing {
		max-width: 36rem;
		margin: 4rem auto;
		padding: 1.25rem;
	}
	.missing h1 {
		font-size: 2rem;
	}
	.missing p {
		margin: 1rem 0 2rem;
		color: var(--color-text-muted);
	}
</style>
