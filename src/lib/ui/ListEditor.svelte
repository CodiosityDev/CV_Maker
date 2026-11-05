<script lang="ts" generics="T">
	import { tick, type Snippet } from 'svelte';
	import { t } from '#lib/i18n/index.svelte.ts';
	import Dialog from './Dialog.svelte';

	interface Props {
		items?: T[];
		item: Snippet<[T, number]>;
		onAdd: () => T;
		label: string;
		disabled?: boolean;
		class?: string;
	}

	let {
		items = $bindable([]),
		item,
		onAdd,
		label,
		disabled = false,
		class: className = ''
	}: Props = $props();
	const uid = $props.id();
	let announcement = $state('');
	let confirmOpen = $state(false);
	let pending = $state.raw<{ index: number; item: T } | null>(null);

	async function focusItem(index: number, action?: 'up' | 'down') {
		await tick();
		const row = document.getElementById(`${uid}-item-${index}`);
		const preferred = action
			? row?.querySelector<HTMLButtonElement>(`[data-action="${action}"]:not(:disabled)`)
			: null;
		const control =
			preferred ??
			row?.querySelector<HTMLElement>(
				'input:not(:disabled), textarea:not(:disabled), select:not(:disabled)'
			) ??
			row?.querySelector<HTMLButtonElement>('button:not(:disabled)');
		if (control) control.focus();
		else document.getElementById(`${uid}-add`)?.focus();
	}

	async function add() {
		if (disabled) return;
		items = [...items, onAdd()];
		announcement = '';
		await focusItem(items.length - 1);
		announcement = t('ui.added', { number: items.length });
	}

	async function move(index: number, offset: -1 | 1) {
		const destination = index + offset;
		if (disabled || destination < 0 || destination >= items.length) return;
		const next = [...items];
		const selected = next.splice(index, 1);
		next.splice(destination, 0, ...selected);
		items = next;
		announcement = '';
		await focusItem(destination, offset === -1 ? 'up' : 'down');
		announcement = t('ui.reordered', { from: index + 1, to: destination + 1 });
	}

	function requestDelete(index: number) {
		if (disabled || index < 0 || index >= items.length) return;
		pending = { index, item: items[index] as T };
		confirmOpen = true;
	}

	async function remove() {
		if (disabled || !pending) return;
		const { index, item: expected } = pending;
		confirmOpen = false;
		pending = null;
		if (index >= items.length || items[index] !== expected) return;
		items = items.filter((_, current) => current !== index);
		announcement = '';
		await focusItem(Math.min(index, items.length - 1));
		announcement = t('ui.removed', { number: index + 1 });
	}
</script>

<section class="list-editor {className}" aria-labelledby="{uid}-label" data-disabled={disabled}>
	<h3 id="{uid}-label">{label}</h3>
	{#if items.length === 0}<p class="empty">{t('ui.emptyList')}</p>{/if}
	<ol>
		{#each items as value, index (index)}
			<li id="{uid}-item-{index}">
				<div class="item-heading">
					<span>{t('ui.itemPosition', { current: index + 1, total: items.length })}</span>
					<div class="item-actions">
						<button
							type="button"
							data-action="up"
							disabled={disabled || index === 0}
							onclick={() => move(index, -1)}
							aria-label={t('ui.moveUp', { number: index + 1 })}>↑</button
						>
						<button
							type="button"
							data-action="down"
							disabled={disabled || index === items.length - 1}
							onclick={() => move(index, 1)}
							aria-label={t('ui.moveDown', { number: index + 1 })}>↓</button
						>
						<button
							type="button"
							class="delete-button"
							{disabled}
							onclick={() => requestDelete(index)}
							aria-label={t('ui.deleteItem', { number: index + 1 })}
						>
							<svg
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="1.75"
								aria-hidden="true"
								><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 10v7m4-7v7" /></svg
							>
						</button>
					</div>
				</div>
				<fieldset {disabled}>{@render item(value, index)}</fieldset>
			</li>
		{/each}
	</ol>
	<button type="button" id="{uid}-add" class="add-button" {disabled} onclick={add}>
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="1.75"
			aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg
		>
		{t('ui.addItem', { label })}
	</button>
	<p class="sr-only" aria-live="polite" aria-atomic="true">{announcement}</p>
</section>

<Dialog
	bind:open={confirmOpen}
	title={t('ui.deleteTitle')}
	description={t('ui.deleteDescription', { number: (pending?.index ?? 0) + 1 })}
>
	{#snippet footer()}
		<button
			type="button"
			class="cancel-button"
			onclick={() => {
				confirmOpen = false;
			}}>{t('common.cancel')}</button
		>
		<button type="button" class="confirm-delete" {disabled} onclick={remove}
			>{t('common.delete')}</button
		>
	{/snippet}
</Dialog>

<style>
	.list-editor {
		min-width: 0;
	}
	h3 {
		margin: 0 0 1rem;
		font-size: 1.125rem;
		font-weight: 700;
	}
	ol {
		display: grid;
		gap: 1rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	li {
		min-width: 0;
		padding: 1rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
	}
	.item-heading {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-bottom: 1rem;
	}
	.item-heading > span {
		color: var(--color-text-muted);
		font-size: 0.875rem;
	}
	.item-actions {
		display: flex;
		gap: 0.25rem;
	}
	button {
		min-width: 44px;
		min-height: 44px;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--color-surface);
		color: var(--color-text);
		font: inherit;
		font-weight: 600;
		cursor: pointer;
	}
	.item-actions button {
		display: grid;
		place-items: center;
		font-size: 1.25rem;
	}
	button:hover:not(:disabled) {
		background: var(--color-surface-muted);
	}
	button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	svg {
		width: 20px;
		height: 20px;
		flex-shrink: 0;
	}
	.delete-button {
		color: var(--color-danger);
	}
	fieldset {
		min-width: 0;
		margin: 0;
		padding: 0;
		border: 0;
	}
	.empty {
		margin: 0 0 1rem;
		padding: 1.25rem;
		border: 1px dashed var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface-muted);
		color: var(--color-text-muted);
		line-height: 1.7;
	}
	.add-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		max-width: 100%;
		margin-top: 1rem;
		padding: 0.625rem 1rem;
		color: var(--color-primary-700);
		text-align: left;
	}
	.cancel-button,
	.confirm-delete {
		padding: 0.625rem 1rem;
	}
	.confirm-delete {
		border-color: var(--color-danger);
		background: var(--color-danger);
		color: var(--color-surface);
	}
	.confirm-delete:hover:not(:disabled) {
		background: var(--color-danger);
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}
</style>
