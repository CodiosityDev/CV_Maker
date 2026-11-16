<script lang="ts">
	import { onMount } from 'svelte';
	import { t } from '#lib/i18n/index.svelte.ts';
	import type { PageProps } from './$types';
	let { data }: PageProps = $props();
	let Print = $state.raw<typeof import('#lib/ui/letter/LetterPrint.svelte').default>();
	let failed = $state(false);
	let active = false;
	let request = 0;
	function load() {
		const token = ++request;
		failed = false;
		void import('#lib/ui/letter/LetterPrint.svelte').then(
			(module) => {
				if (active && token === request) Print = module.default;
			},
			() => {
				if (active && token === request) failed = true;
			}
		);
	}
	onMount(() => {
		active = true;
		load();
		return () => {
			active = false;
			request += 1;
		};
	});
</script>

{#if Print}{#key (data.cv?.id ?? '') + ':' + data.letterId}<Print {data} />{/key}
{:else}<div class="print-loading" role={failed ? 'alert' : 'status'}>
		<p>{t(failed ? 'printPage.loadError' : 'common.loading')}</p>
		{#if failed}<button type="button" onclick={load}>{t('wizard.retry')}</button>{/if}
	</div>{/if}

<style>
	.print-loading {
		display: grid;
		justify-items: start;
		gap: 16px;
		max-width: 40rem;
		margin: 40px auto;
		padding: 24px;
		line-height: 1.7;
	}
	button {
		min-height: 44px;
		padding: 10px 16px;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-brand);
		color: var(--color-on-brand);
		font: inherit;
		cursor: pointer;
	}
</style>
