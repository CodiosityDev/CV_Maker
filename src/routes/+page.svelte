<!-- Placeholder landing page (M0). Replaced by the real landing page in milestone M2. -->
<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';
</script>

<svelte:head>
	<title>{t('app.name')}</title>
	<meta name="description" content={t('app.tagline')} />
</svelte:head>

<main id="main" class="mx-auto max-w-2xl px-4 py-16">
	<h1 class="text-3xl font-bold">{t('app.name')}</h1>
	<p class="mt-4 text-lg">{t('app.tagline')}</p>
</main>
