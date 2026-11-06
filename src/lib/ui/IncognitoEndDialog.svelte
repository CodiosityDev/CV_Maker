<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { incognito } from '#lib/core/storage/index.ts';
	import { t } from '#lib/i18n/index.svelte.ts';
	import { getIncognitoUiContext } from '#lib/ui/incognito-context.ts';
	import { toast } from '#lib/ui/toast.svelte.ts';
	import Button from '#lib/ui/Button.svelte';
	import Dialog from '#lib/ui/Dialog.svelte';

	let { open = $bindable(false) }: { open?: boolean } = $props();
	const session = getIncognitoUiContext();
	let ending = $state(false);
	let failed = $state(false);

	async function end() {
		if (ending || !incognito.active) return;
		ending = true;
		failed = false;
		try {
			// Cancel pending editor saves before returning to the normal repository.
			session?.prepareToEnd();
			await incognito.end();
			open = false;
			await goto(resolve('/(app)/buat'));
			toast.success(t('incognito.ended'));
		} catch {
			failed = true;
		} finally {
			ending = false;
		}
	}
</script>

<Dialog
	bind:open
	title={t('incognito.endTitle')}
	description={t('incognito.endDescription')}
	disabled={ending}
>
	{#if failed}<p role="alert">{t('incognito.actionError')}</p>{/if}
	{#snippet footer()}
		<Button variant="secondary" disabled={ending} onclick={() => (open = false)}
			>{t('common.cancel')}</Button
		>
		<Button loading={ending} onclick={end}>{t('incognito.endAction')}</Button>
	{/snippet}
</Dialog>
