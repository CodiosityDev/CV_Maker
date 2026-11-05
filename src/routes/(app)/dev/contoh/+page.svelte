<!--
	Development-only page (404 in production): loads realistic sample CVs (core fixtures) into
	this browser's local storage so the wizard and preview can be tried without typing.
	Texts are intentionally not translated — this page is never shown to users.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { cvRepo, storage } from '#lib/core/storage/index.ts';
	import { newId, type CVDocument, type CVMeta } from '#lib/core/schema/index.ts';
	import { sampleCvAts, sampleCvCreative } from '#lib/core/fixtures/index.ts';

	let saved = $state<CVMeta[]>([]);
	let busy = $state(false);
	let message = $state('');

	async function refresh() {
		saved = await cvRepo.list();
	}

	onMount(refresh);

	async function load(sample: CVDocument) {
		busy = true;
		try {
			const now = new Date().toISOString();
			const cv: CVDocument = {
				...structuredClone(sample),
				id: newId(),
				// Open on the review step so the full preview and checks are visible right away.
				status: { wizardCompleted: false, wizardStep: 9 },
				createdAt: now,
				updatedAt: now
			};
			await cvRepo.save(cv);
			await goto(resolve('/(app)/buat/[id]', { id: cv.id }));
		} finally {
			busy = false;
		}
	}

	async function wipe() {
		if (!confirm('Hapus SEMUA CV di browser ini?')) return;
		await storage.wipeAll();
		message = 'Semua data di browser ini sudah dihapus.';
		await refresh();
	}
</script>

<svelte:head>
	<title>Data contoh (dev)</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="dev">
	<h1>Data contoh</h1>
	<p>
		Halaman khusus development. Memuat CV contoh (fiktif) ke penyimpanan browser ini, lalu membuka
		wizard di langkah tinjau.
	</p>

	<div class="actions">
		<button type="button" disabled={busy} onclick={() => load(sampleCvAts)}>
			Muat contoh CV ATS — {sampleCvAts.personal.fullName}
		</button>
		<button type="button" disabled={busy} onclick={() => load(sampleCvCreative)}>
			Muat contoh CV Creative — {sampleCvCreative.personal.fullName}
		</button>
	</div>

	<h2>CV di browser ini ({saved.length})</h2>
	{#if saved.length === 0}
		<p>Belum ada.</p>
	{:else}
		<ul>
			{#each saved as cv (cv.id)}
				<li>
					<a href={resolve('/(app)/buat/[id]', { id: cv.id })}>{cv.title}</a>
					<span>· {cv.fullName || 'tanpa nama'} · {cv.kind}</span>
				</li>
			{/each}
		</ul>
	{/if}

	<button type="button" class="danger" onclick={wipe}>Hapus semua data di browser ini</button>
	{#if message}<p role="status">{message}</p>{/if}
</div>

<style>
	.dev {
		max-width: 720px;
		margin: 0 auto;
		padding: 32px 16px 64px;
	}
	h1 {
		font-size: 28px;
		font-weight: 700;
		margin-bottom: 8px;
	}
	h2 {
		font-size: 18px;
		font-weight: 700;
		margin: 32px 0 8px;
	}
	.actions {
		display: grid;
		gap: 12px;
		margin-top: 20px;
	}
	button {
		min-height: 44px;
		padding: 10px 16px;
		border: 1px solid var(--color-ink);
		border-radius: 10px;
		background: var(--color-brand);
		color: var(--color-ink);
		font-weight: 600;
		text-align: left;
		cursor: pointer;
	}
	button:disabled {
		opacity: 0.6;
	}
	.danger {
		margin-top: 24px;
		background: var(--color-coral);
	}
	ul {
		display: grid;
		gap: 6px;
	}
	a {
		color: var(--color-brand-ink);
		font-weight: 600;
	}
</style>
