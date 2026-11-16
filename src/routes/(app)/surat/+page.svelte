<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import type { CVMeta } from '#lib/core/schema/types.ts';
	import { cvRepo, incognito, onExternalChange, storage } from '#lib/core/storage/index.ts';
	import { t } from '#lib/i18n/index.svelte.ts';
	import Button from '#lib/ui/Button.svelte';

	let cvs = $state<CVMeta[]>([]);
	let loading = $state(true);
	let failed = $state(false);
	let memory = $state(false);
	let active = false;
	let request = 0;

	async function refresh() {
		const token = ++request;
		const mode = incognito.active;
		const expiry = incognito.expiredAt;
		try {
			const [list, backend] = await Promise.all([cvRepo.list(), storage.getMode()]);
			if (
				!active ||
				token !== request ||
				mode !== incognito.active ||
				expiry !== incognito.expiredAt
			)
				return;
			cvs = list;
			memory = backend === 'memory';
			failed = false;
		} catch {
			if (active && token === request) failed = true;
		} finally {
			if (active && token === request) loading = false;
		}
	}

	onMount(() => {
		active = true;
		void refresh();
		const stop = onExternalChange((event) => {
			if (event.type === 'wiped') cvs = [];
			else if (event.type === 'cv-removed') cvs = cvs.filter((cv) => cv.id !== event.id);
			void refresh();
		});
		const visible = () => {
			if (document.visibilityState === 'visible') void refresh();
		};
		document.addEventListener('visibilitychange', visible);
		return () => {
			active = false;
			request += 1;
			stop();
			document.removeEventListener('visibilitychange', visible);
		};
	});
	$effect(() => {
		void incognito.active;
		void incognito.expiredAt;
		cvs = [];
		loading = true;
		if (active) void refresh();
	});
</script>

<svelte:head><title>{t('letterEditor.title')} · {t('app.name')}</title></svelte:head>

<div class="site-container letters-home">
	<h1>{t('letterEditor.title')}</h1>
	<p class="intro">{t('letterEditor.chooseCvHint')}</p>
	{#if memory}<p class="notice" role="status">{t('wizard.memoryWarning')}</p>{/if}
	{#if loading}<p class="status" role="status">{t('common.loading')}</p>
	{:else if failed}<div class="notice" role="alert">
			<p>{t('dashboard.loadError')}</p>
			<Button variant="secondary" onclick={refresh}>{t('wizard.retry')}</Button>
		</div>
	{:else if !cvs.length}<div class="empty">
			<p>{t('letterEditor.emptyCv')}</p>
			<Button href="/buat">{t('letterEditor.createCv')}</Button>
		</div>
	{:else}<section aria-label={t('letterEditor.chooseCv')} class="cv-list">
			{#each cvs as cv (cv.id)}
				<a
					class="cv-card"
					data-testid="letter-cv-card"
					href={resolve('/(app)/cv/[id]/surat', { id: cv.id })}
				>
					<h2>{cv.title || t('dashboard.untitled')}</h2>
					<p>{cv.fullName || t('dashboard.nameMissing')}</p>
					<span>{t('letterEditor.count', { count: cv.letterCount })}</span>
				</a>
			{/each}
		</section>{/if}
</div>

<style>
	.letters-home {
		max-width: 1040px;
		padding-block: 32px 64px;
	}
	h1 {
		font-size: clamp(1.875rem, 5vw, 2.75rem);
		font-weight: 650;
	}
	.intro {
		max-width: 38rem;
		margin-top: 12px;
		color: var(--color-text-muted);
		line-height: 1.7;
	}
	.cv-list {
		display: grid;
		gap: 16px;
		margin-top: 28px;
	}
	.cv-card {
		display: grid;
		min-width: 0;
		gap: 10px;
		padding: 24px;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
		color: var(--color-text);
		text-decoration: none;
	}
	.cv-card:hover {
		background: var(--color-mint-50);
	}
	h2 {
		font-size: 1.125rem;
		font-weight: 650;
		overflow-wrap: anywhere;
	}
	.cv-card p {
		overflow-wrap: anywhere;
	}
	.cv-card span {
		color: var(--color-text-muted);
		font-size: 0.875rem;
	}
	.empty {
		display: grid;
		justify-items: start;
		gap: 20px;
		padding-block: 40px;
	}
	.empty p {
		max-width: 34rem;
		line-height: 1.7;
	}
	.status {
		padding-block: 32px;
		color: var(--color-text-muted);
	}
	.notice {
		display: grid;
		justify-items: start;
		gap: 12px;
		margin-top: 24px;
		padding: 20px;
		border-radius: var(--radius-lg);
		background: var(--color-mint-50);
		line-height: 1.7;
	}
	@media (min-width: 768px) {
		.letters-home {
			padding-top: 48px;
		}
		.cv-list {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
</style>
