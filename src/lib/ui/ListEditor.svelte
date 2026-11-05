<script lang="ts" generics="T">
	import { onDestroy, tick, type Snippet } from 'svelte';
	import { t } from '#lib/i18n/index.svelte.ts';
	import { toast } from './toast.svelte.ts';

	interface Props {
		items?: T[];
		item: Snippet<[T, number]>;
		onAdd: () => T;
		label: string;
		getKey?: (value: T, index: number) => string;
		getSummary?: (value: T) => string;
		emptyMessage?: string;
		showHeading?: boolean;
		onUndo?: () => void;
		undoRevision?: string;
		disabled?: boolean;
		maxItems?: number;
		class?: string;
	}

	let {
		items = $bindable([]),
		item,
		onAdd,
		label,
		getKey,
		getSummary,
		emptyMessage,
		showHeading = true,
		onUndo,
		undoRevision,
		disabled = false,
		maxItems = Infinity,
		class: className = ''
	}: Props = $props();
	const uid = $props.id();
	let announcement = $state('');
	let expanded = $state<string[]>([]);
	let initialized = false;
	let pendingUndo = $state<{ id: number; revision: string | undefined }>();

	function key(value: T, index: number) {
		if (getKey) return getKey(value, index);
		if (value && typeof value === 'object' && 'id' in value) return String(value.id);
		return String(index);
	}
	function summary(value: T) {
		if (getSummary) return getSummary(value);
		if (value && typeof value === 'object' && 'name' in value && value.name)
			return String(value.name);
		return t('ui.newEntry', { label });
	}
	$effect(() => {
		if (!initialized) {
			expanded = items.length ? [key(items[0] as T, 0)] : [];
			initialized = true;
		}
	});
	$effect(() => {
		if (pendingUndo && undoRevision !== pendingUndo.revision) {
			toast.dismiss(pendingUndo.id);
			pendingUndo = undefined;
		}
	});
	onDestroy(() => {
		if (pendingUndo) toast.dismiss(pendingUndo.id);
	});

	function closeMenu(index: number, focus = false) {
		const menu = document.getElementById(`${uid}-menu-${index}`) as HTMLDetailsElement | null;
		if (!menu) return;
		menu.open = false;
		if (focus) menu.querySelector<HTMLElement>('summary')?.focus();
	}
	async function focusItem(index: number, field = false) {
		await tick();
		const row = document.getElementById(`${uid}-item-${index}`);
		if (!row) {
			document.getElementById(`${uid}-add`)?.focus();
			return;
		}
		const card = row.querySelector<HTMLDetailsElement>('.item-card');
		if (field && card) card.open = true;
		const control = field
			? row.querySelector<HTMLElement>(
					'input:not(:disabled), textarea:not(:disabled), select:not(:disabled)'
				)
			: null;
		(control ?? card?.querySelector<HTMLElement>('summary'))?.focus();
	}
	async function add() {
		if (disabled || items.length >= maxItems) return;
		const value = onAdd();
		const index = items.length;
		expanded = [...expanded, key(value, index)];
		items = [...items, value];
		announcement = '';
		await focusItem(index, true);
		announcement = t('ui.addedEntry', { title: summary(value) });
	}
	async function move(index: number, offset: -1 | 1) {
		const destination = index + offset;
		if (disabled || destination < 0 || destination >= items.length) return;
		const next = [...items];
		const value = next.splice(index, 1)[0] as T;
		next.splice(destination, 0, value);
		closeMenu(index);
		items = next;
		announcement = '';
		await focusItem(destination);
		announcement = t('ui.reorderedEntry', { title: summary(value), position: destination + 1 });
	}
	async function remove(index: number) {
		if (disabled || index < 0 || index >= items.length) return;
		const value = items[index] as T;
		const removedKey = key(value, index);
		closeMenu(index);
		items = items.filter((_, at) => at !== index);
		announcement = t('ui.deletedEntry', { title: summary(value) });
		if (pendingUndo) toast.dismiss(pendingUndo.id);
		// Let the parent publish the revision created by this deletion before guarding Undo.
		await tick();
		if (onUndo) {
			const revision = undoRevision;
			const id = toast.info(t('ui.removedShort'), {
				labelKey: 'ui.undo',
				run: () => {
					if (undoRevision !== revision) return;
					onUndo?.();
					expanded = [...expanded, removedKey];
					void focusItem(index, true);
				}
			});
			pendingUndo = { id, revision };
		}
		await focusItem(Math.min(index, items.length - 1));
	}
	function toggleCard(event: Event, itemKey: string) {
		const open = (event.currentTarget as HTMLDetailsElement).open;
		const next = expanded.filter((value) => value !== itemKey);
		expanded = open ? [...next, itemKey] : next;
	}
	function handleEscape(event: KeyboardEvent) {
		if (event.key !== 'Escape') return;
		for (let index = 0; index < items.length; index += 1) {
			const menu = document.getElementById(`${uid}-menu-${index}`) as HTMLDetailsElement | null;
			if (!menu?.open) continue;
			event.preventDefault();
			closeMenu(index, menu.contains(document.activeElement));
		}
	}
</script>

<svelte:window onkeydown={handleEscape} />

<section
	class="list-editor {className}"
	aria-labelledby={showHeading ? `${uid}-label` : undefined}
	aria-label={showHeading ? undefined : label}
	data-disabled={disabled}
>
	{#if showHeading}<h3 id="{uid}-label">{label}</h3>{/if}
	{#if items.length === 0}<p class="empty">{emptyMessage ?? t('ui.emptyList')}</p>{/if}
	<ol>
		{#each items as value, index (key(value, index))}
			{@const itemKey = key(value, index)}
			{@const title = summary(value)}
			<li id="{uid}-item-{index}">
				<details
					class="item-card"
					open={expanded.includes(itemKey)}
					ontoggle={(event) => toggleCard(event, itemKey)}
				>
					<summary class="card-summary" aria-disabled={disabled || undefined}>
						<span>{title}</span>
						<svg
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="1.75"
							aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg
						>
					</summary>
					<fieldset {disabled}>{@render item(value, index)}</fieldset>
				</details>
				<details
					class="action-menu"
					id="{uid}-menu-{index}"
					onfocusout={(event) => {
						if (
							!(event.relatedTarget instanceof Node) ||
							!event.currentTarget.contains(event.relatedTarget)
						)
							closeMenu(index);
					}}
				>
					<summary
						aria-label={t('ui.itemActions', { title })}
						title={t('ui.itemActions', { title })}>⋯</summary
					>
					<div class="menu-actions" role="group" aria-label={t('ui.itemActions', { title })}>
						<button type="button" disabled={disabled || index === 0} onclick={() => move(index, -1)}
							>{t('ui.moveEarlier')}</button
						>
						<button
							type="button"
							disabled={disabled || index === items.length - 1}
							onclick={() => move(index, 1)}>{t('ui.moveLater')}</button
						>
						<button
							type="button"
							class="delete-button"
							{disabled}
							onclick={() => remove(index)}
							aria-label={t('ui.deleteEntry', { title })}>{t('common.delete')}</button
						>
					</div>
				</details>
			</li>
		{/each}
	</ol>
	<button
		type="button"
		id="{uid}-add"
		class="add-button"
		disabled={disabled || items.length >= maxItems}
		onclick={add}
	>
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="1.75"
			aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg
		>
		{t('ui.addItem', { label })}
	</button>
	{#if items.length >= maxItems}<p class="limit">{t('ui.limitReached', { max: maxItems })}</p>{/if}
	<p class="sr-only" aria-live="polite" aria-atomic="true">{announcement}</p>
</section>

<style>
	.list-editor {
		min-width: 0;
	}
	h3 {
		margin: 0 0 0.75rem;
		font-size: 1rem;
		font-weight: 600;
	}
	ol {
		display: grid;
		gap: 0.75rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	li {
		position: relative;
		min-width: 0;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
	}
	summary {
		cursor: pointer;
		list-style: none;
	}
	summary::-webkit-details-marker {
		display: none;
	}
	.card-summary {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-height: 56px;
		padding: 0.75rem 3.75rem 0.75rem 0.875rem;
		color: var(--color-text);
		border-radius: var(--radius-lg);
		font-size: 0.875rem;
		font-weight: 600;
		line-height: 1.5;
	}
	.card-summary span {
		flex: 1;
		min-width: 0;
		overflow-wrap: anywhere;
	}
	.card-summary svg {
		width: 16px;
		height: 16px;
		transition: transform var(--motion-duration) ease-out;
	}
	.item-card[open] > .card-summary svg {
		transform: rotate(90deg);
	}
	fieldset {
		min-width: 0;
		margin: 0;
		padding: 0.25rem 0.875rem 1rem;
		border: 0;
	}
	.action-menu {
		position: absolute;
		z-index: 2;
		top: 6px;
		right: 6px;
	}
	.action-menu[open] {
		z-index: 3;
	}
	.action-menu > summary {
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		border-radius: var(--radius-md);
		color: var(--color-brand-ink);
		font-size: 1.5rem;
	}
	.action-menu > summary:hover {
		background: var(--color-brand-50);
	}
	.menu-actions {
		position: absolute;
		top: 48px;
		right: 0;
		display: grid;
		min-width: 9rem;
		padding: 0.25rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		box-shadow: var(--shadow-card);
	}
	button {
		min-width: 44px;
		min-height: 44px;
		border: 1px solid transparent;
		border-radius: var(--radius-md);
		background: var(--color-brand-50);
		color: var(--color-brand-ink);
		font: inherit;
		font-size: 0.875rem;
		font-weight: 600;
		cursor: pointer;
		transition:
			background-color var(--motion-duration) ease-out,
			transform var(--motion-duration) ease-out;
	}
	button:hover:not(:disabled) {
		background: var(--color-secondary-hover);
	}
	button:active:not(:disabled) {
		transform: translateY(1px);
	}
	button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.menu-actions button {
		padding: 0.5rem 0.75rem;
		background: transparent;
		text-align: left;
	}
	.menu-actions .delete-button {
		color: var(--color-danger);
	}
	svg {
		width: 20px;
		height: 20px;
		flex-shrink: 0;
	}
	.empty {
		margin: 0 0 0.75rem;
		color: var(--color-text-muted);
		font-size: 0.875rem;
		line-height: 1.6;
	}
	.add-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		max-width: 100%;
		margin-top: 0.75rem;
		padding: 0.625rem 0.875rem;
		text-align: left;
	}
	.limit {
		margin: 0.5rem 0 0;
		color: var(--color-text-muted);
		font-size: 0.875rem;
	}
	@media (max-width: 480px) {
		fieldset {
			padding-inline: 10px;
		}
	}
</style>
