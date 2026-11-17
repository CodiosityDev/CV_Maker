<script lang="ts" module>
	import { ensureMessages, registerNamespace } from '#lib/i18n/index.svelte.ts';
	import { homeId } from '#lib/i18n/messages/home.id.ts';

	// Own i18n namespace: only returning visitors load this text (landing JS budget, §10).
	registerNamespace('home', homeId);
</script>

<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { resolve } from '$app/paths';
	import { formatEdited, setHomeRecentEnabled } from '#lib/core/home/index.ts';
	import { loadRecentCvs, type RecentCv, type RecentCvList } from '#lib/core/home/recent.ts';
	import type { CVMeta } from '#lib/core/schema/types.ts';
	import { onExternalChange } from '#lib/core/storage/index.ts';
	import { i18n, t } from '#lib/i18n/index.svelte.ts';
	import { resolveTemplate } from '#lib/templates/registry.ts';
	import TemplateThumbnail from '#lib/ui/TemplateThumbnail.svelte';

	/** Home page "Continue your CV" strip. Loaded lazily by the landing page only when CVs exist. */
	let items = $state.raw<RecentCv[]>([]);
	let hidden = $state(false);
	let now = $state(Date.now());
	let showButton = $state<HTMLButtonElement>();
	let current: RecentCvList | undefined;
	let request = 0;
	let active = true;

	async function refresh() {
		const id = ++request;
		try {
			// English text is fetched before the strip first appears (no mixed-language flash).
			const [list] = await Promise.all([loadRecentCvs(), ensureMessages()]);
			if (!active || id !== request) {
				list.release();
				return;
			}
			current?.release();
			current = list;
			items = list.items;
			now = Date.now();
		} catch {
			// Keep what is shown; the landing page below still works.
		}
	}

	onMount(() => {
		void refresh();
		// Saves/deletes in other tabs (BroadcastChannel) keep the strip current.
		const stop = onExternalChange(() => void refresh());
		const visible = () => {
			if (document.visibilityState === 'visible') now = Date.now();
		};
		document.addEventListener('visibilitychange', visible);
		return () => {
			active = false;
			request += 1;
			stop();
			document.removeEventListener('visibilitychange', visible);
			current?.release();
		};
	});

	function href(meta: CVMeta) {
		return meta.wizardCompleted
			? resolve('/(app)/cv/[id]/edit', { id: meta.id })
			: resolve('/(app)/buat/[id]', { id: meta.id });
	}

	function edited(updatedAt: string) {
		const age = now - Date.parse(updatedAt);
		if (age < 60_000) return t('homeRecent.editedNow');
		return t('homeRecent.edited', { time: formatEdited(updatedAt, i18n.locale, now) });
	}

	async function hide() {
		setHomeRecentEnabled(false);
		hidden = true;
		await tick();
		showButton?.focus();
	}

	function show() {
		setHomeRecentEnabled(true);
		hidden = false;
	}
</script>

{#if hidden}
	<div class="site-container hidden-note" role="status">
		<p>{t('homeRecent.hidden')}</p>
		<button type="button" class="text-button" bind:this={showButton} onclick={show}
			>{t('homeRecent.show')}</button
		>
	</div>
{:else if items.length}
	<section class="recent" aria-labelledby="recent-title" data-testid="home-recent">
		<div class="site-container">
			<div class="recent-heading">
				<h2 id="recent-title">{t('homeRecent.title')}</h2>
				<a class="view-all" href={resolve('/(app)/cv')}>{t('homeRecent.viewAll')}</a>
			</div>
			<ul class="grid">
				<li class="card">
					<div class="paper blank" aria-hidden="true">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"
							><path d="M12 5v14M5 12h14" /></svg
						>
					</div>
					<a class="card-link" href={resolve('/(app)/buat')}>{t('homeRecent.newCv')}</a>
				</li>
				{#each items as { meta, model } (meta.id)}
					<li class="card" data-testid="home-recent-card">
						<TemplateThumbnail
							meta={resolveTemplate(meta.templateId, meta.kind)}
							{model}
							loadingLabel={t('homeRecent.thumbnailLoading')}
							errorLabel={t('homeRecent.thumbnailError')}
						/>
						<a class="card-link" href={href(meta)}>{meta.title || t('homeRecent.untitled')}</a>
						<p class="card-meta">
							{t(meta.kind === 'ats' ? 'homeRecent.kindAts' : 'homeRecent.kindCreative')}
							· <time datetime={meta.updatedAt}>{edited(meta.updatedAt)}</time>
						</p>
						{#if !meta.wizardCompleted}
							<p class="unfinished">{t('homeRecent.unfinished')}</p>
						{/if}
					</li>
				{/each}
			</ul>
			<button type="button" class="text-button hide-button" onclick={hide}
				>{t('homeRecent.hide')}</button
			>
		</div>
	</section>
{/if}

<style>
	.recent {
		padding-block: 32px 24px;
		border-bottom: 1px solid var(--color-border);
		background: var(--color-surface);
	}
	@media (prefers-reduced-motion: no-preference) {
		.recent {
			animation: appear 200ms ease-out;
		}
		@keyframes appear {
			from {
				opacity: 0;
			}
		}
	}
	.recent-heading {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: 8px 16px;
	}
	h2 {
		font-size: clamp(22px, 2.6vw, 26px);
		font-weight: 650;
	}
	.view-all {
		display: inline-flex;
		align-items: center;
		min-height: 44px;
		font-size: 0.9375rem;
		font-weight: 600;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 24px 16px;
		margin: 20px 0 0;
		padding: 0;
		list-style: none;
	}
	.card {
		position: relative;
		min-width: 0;
	}
	.card :global(.thumbnail),
	.paper {
		box-shadow: var(--shadow-card);
		transition:
			border-color 150ms,
			box-shadow 150ms;
	}
	.card:hover :global(.thumbnail),
	.card:hover .paper {
		border-color: var(--color-brand);
	}
	.card:has(.card-link:focus-visible) :global(.thumbnail),
	.card:has(.card-link:focus-visible) .paper {
		outline: 3px solid var(--color-focus);
		outline-offset: 2px;
	}
	.paper {
		display: grid;
		place-items: center;
		width: 100%;
		aspect-ratio: 210 / 297;
		border: 1px dashed var(--color-border);
		border-radius: 6px;
		background: var(--color-brand-50);
		color: var(--color-brand-ink);
	}
	.paper svg {
		width: 40px;
		height: 40px;
	}
	.card-link {
		display: flex;
		align-items: center;
		min-height: 44px;
		margin-top: 4px;
		color: var(--color-text);
		font-size: 0.9375rem;
		font-weight: 600;
		line-height: 1.4;
		text-decoration: none;
		overflow-wrap: anywhere;
	}
	.card-link:focus-visible {
		outline: none;
	}
	/* The whole card (paper + text) is the link's click area. */
	.card-link::after {
		content: '';
		position: absolute;
		inset: 0;
	}
	.card:hover .card-link {
		text-decoration: underline;
	}
	.card-meta,
	.unfinished {
		margin-top: 2px;
		color: var(--color-text-muted);
		font-size: 0.8125rem;
		line-height: 1.5;
	}
	.unfinished {
		color: var(--color-brand-ink);
		font-weight: 600;
	}
	.text-button {
		min-height: 44px;
		padding: 0;
		border: 0;
		background: none;
		color: var(--color-brand-ink);
		font: inherit;
		font-size: 0.875rem;
		font-weight: 600;
		cursor: pointer;
	}
	.text-button:hover {
		text-decoration: underline;
	}
	.hide-button {
		margin-top: 16px;
		color: var(--color-text-muted);
		font-weight: 500;
	}
	.hidden-note {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px 12px;
		padding-block: 12px;
		color: var(--color-text-muted);
		font-size: 0.875rem;
	}
	@media (min-width: 640px) {
		.grid {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}
	@media (min-width: 1024px) {
		.recent {
			padding-block: 40px 28px;
		}
		.grid {
			grid-template-columns: repeat(5, minmax(0, 1fr));
			gap: 28px 20px;
		}
	}
</style>
