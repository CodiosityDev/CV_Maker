<script lang="ts">
	import { onDestroy, tick, type Snippet } from 'svelte';
	import {
		addCustomSection,
		canAddCustomSection,
		editorSections,
		moveSection,
		moveSectionTo,
		removeCustomSection,
		renameSection,
		setSectionHidden,
		type EditorSection
	} from '#lib/core/layout/index.ts';
	import { LIMITS, newId, type SectionKey } from '#lib/core/schema/index.ts';
	import type { CvStore } from '#lib/core/store/cv-store.svelte.ts';
	import { incognito } from '#lib/core/storage/index.ts';
	import { t } from '#lib/i18n/index.svelte.ts';
	import Button from '../Button.svelte';
	import Dialog from '../Dialog.svelte';
	import Input from '../Input.svelte';
	import Toggle from '../Toggle.svelte';
	import { toast } from '../toast.svelte.ts';

	let { store, renderSection }: { store: CvStore; renderSection: Snippet<[EditorSection]> } =
		$props();
	const uid = $props.id();
	const sections = $derived(editorSections(store.cv));
	const canAdd = $derived(canAddCustomSection(store.cv));
	let initialized = false;
	let expanded = $state<SectionKey[]>([]);
	let announcement = $state('');
	let renameKey = $state<SectionKey>();
	let deleteKey = $state<SectionKey>();
	let renameOpen = $state(false);
	let deleteOpen = $state(false);
	let addOpen = $state(false);
	let title = $state('');
	let addedTitle = $state('');
	const renamed = $derived(sections.find((section) => section.key === renameKey));
	const deleted = $derived(sections.find((section) => section.key === deleteKey));
	let pendingUndo = $state<{ id: number; revision: string }>();
	let drag = $state<{ key: SectionKey; pointerId: number; target: number }>();
	let list: HTMLOListElement;

	$effect(() => {
		if (!initialized && sections.length) {
			expanded = [sections[0]!.key];
			initialized = true;
		}
	});
	$effect(() => {
		const revision = `${store.cv.updatedAt}:${store.externalChange}`;
		if (pendingUndo && revision !== pendingUndo.revision) {
			toast.dismiss(pendingUndo.id);
			pendingUndo = undefined;
		}
	});
	$effect(() => {
		if (!renameOpen) {
			renameKey = undefined;
			title = '';
		} else if (!renamed) renameOpen = false;
		if (!deleteOpen) deleteKey = undefined;
		else if (!deleted) deleteOpen = false;
		if (!addOpen) addedTitle = '';
	});
	onDestroy(() => {
		if (pendingUndo) toast.dismiss(pendingUndo.id);
	});

	function mutate(change: Parameters<CvStore['update']>[0]) {
		store.update(change, { coalesceKey: `layout.${newId()}` });
	}
	function rowId(key: SectionKey) {
		return `${uid}-${key}`;
	}
	function closeMenu(key: SectionKey, focus = false) {
		const menu = document.getElementById(`${rowId(key)}-menu`) as HTMLDetailsElement | null;
		if (menu) {
			menu.open = false;
			if (focus) menu.querySelector('summary')?.focus();
		}
	}
	function dismissMenu(element: HTMLDetailsElement) {
		function outside(event: Event) {
			if (event.target instanceof Node && !element.contains(event.target)) element.open = false;
		}
		function keydown(event: KeyboardEvent) {
			if (event.key === 'Escape' && element.open) {
				event.preventDefault();
				event.stopPropagation();
				element.open = false;
				element.querySelector('summary')?.focus();
			}
		}
		function blur(event: FocusEvent) {
			if (!(event.relatedTarget instanceof Node) || !element.contains(event.relatedTarget))
				element.open = false;
		}
		document.addEventListener('pointerdown', outside);
		element.addEventListener('keydown', keydown);
		element.addEventListener('focusout', blur);
		return {
			destroy() {
				document.removeEventListener('pointerdown', outside);
				element.removeEventListener('keydown', keydown);
				element.removeEventListener('focusout', blur);
			}
		};
	}
	async function moved(key: SectionKey, control: string) {
		announcement = '';
		await tick();
		document.getElementById(`${rowId(key)}-${control}`)?.focus();
		const section = sections.find((candidate) => candidate.key === key);
		if (section)
			announcement = t('editor.sections.moved', {
				title: section.title,
				position: section.index + 1,
				total: sections.length
			});
	}
	function move(section: EditorSection, direction: -1 | 1) {
		if (direction === -1 ? !section.canMoveUp : !section.canMoveDown) return;
		mutate((draft) => moveSection(draft, section.key, direction));
		void moved(section.key, direction === -1 ? 'up' : 'down');
	}
	function startDrag(event: PointerEvent, section: EditorSection) {
		if (event.button !== 0 || !window.matchMedia('(min-width: 1024px)').matches) return;
		event.preventDefault();
		closeMenu(section.key);
		(event.currentTarget as HTMLButtonElement).setPointerCapture(event.pointerId);
		drag = { key: section.key, pointerId: event.pointerId, target: section.index };
	}
	function trackDrag(event: PointerEvent) {
		if (!drag || drag.pointerId !== event.pointerId) return;
		const row = document
			.elementFromPoint(event.clientX, event.clientY)
			?.closest<HTMLElement>('[data-section-key]');
		if (!row || !list.contains(row)) return;
		const section = sections.find((candidate) => candidate.key === row.dataset.sectionKey);
		if (section) drag.target = section.index;
	}
	function finishDrag(event: PointerEvent, cancelled = false) {
		if (!drag || drag.pointerId !== event.pointerId) return;
		const { key, target } = drag;
		drag = undefined;
		const handle = event.currentTarget as HTMLButtonElement;
		if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
		const current = sections.find((section) => section.key === key);
		if (cancelled || !current || current.index === target) return;
		mutate((draft) => moveSectionTo(draft, key, target));
		void moved(key, 'drag');
	}
	function beginRename(section: EditorSection) {
		closeMenu(section.key, true);
		renameKey = section.key;
		title = section.renamed || section.custom ? section.title : '';
		renameOpen = true;
	}
	function saveTitle(event: SubmitEvent) {
		event.preventDefault();
		if (!renamed || (renamed.custom && !title.trim())) return;
		mutate((draft) => renameSection(draft, renamed.key, title));
		renameOpen = false;
	}
	async function addSection(event: SubmitEvent) {
		event.preventDefault();
		if (!addedTitle.trim() || !canAdd) return;
		let key: SectionKey | undefined;
		mutate((draft) => {
			key = addCustomSection(draft, addedTitle);
		});
		if (!key) return;
		expanded = [...expanded, key];
		addOpen = false;
		addedTitle = '';
		await tick();
		document.getElementById(`${rowId(key)}-toggle`)?.focus();
	}
	async function deleteSection() {
		if (!deleted?.custom) return;
		const key = deleted.key;
		const index = deleted.index;
		mutate((draft) => removeCustomSection(draft, key));
		deleteOpen = false;
		if (pendingUndo) toast.dismiss(pendingUndo.id);
		await tick();
		const revision = `${store.cv.updatedAt}:${store.externalChange}`;
		const id = toast.info(t('editor.sections.removed'), {
			labelKey: 'ui.undo',
			run: () => {
				if (`${store.cv.updatedAt}:${store.externalChange}` !== revision) return;
				store.undo();
				expanded = [...expanded, key];
				void tick().then(() => document.getElementById(`${rowId(key)}-toggle`)?.focus());
			}
		});
		pendingUndo = { id, revision };
		const next = sections[Math.min(index, sections.length - 1)];
		if (next) document.getElementById(`${rowId(next.key)}-toggle`)?.focus();
		else document.getElementById(`${uid}-add`)?.focus();
	}
</script>

<div class="section-list">
	<ol bind:this={list}>
		{#each sections as section (section.key)}
			<li
				id={rowId(section.key)}
				data-testid="editor-section"
				data-section-key={section.key}
				class:drag-source={drag?.key === section.key}
				class:drag-target={drag && drag.target === section.index && drag.key !== section.key}
			>
				<div class="section-heading">
					<h2>
						<button
							id={`${rowId(section.key)}-toggle`}
							type="button"
							data-section-toggle
							aria-expanded={expanded.includes(section.key)}
							aria-controls={`${rowId(section.key)}-panel`}
							onclick={() =>
								(expanded = expanded.includes(section.key)
									? expanded.filter((key) => key !== section.key)
									: [...expanded, section.key])}
						>
							<span class="section-title">{section.title}</span>
							<svg
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="1.75"
								aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg
							>
						</button>
					</h2>
					<div class="section-meta">
						<span>{t('editor.sections.count', { count: section.count })}</span>
						{#if section.hidden}<span>{t('editor.sections.hidden')}</span>{/if}
					</div>
					<div class="section-toolbar">
						<button
							type="button"
							id={`${rowId(section.key)}-up`}
							aria-label={t('editor.sections.up', { title: section.title })}
							aria-disabled={!section.canMoveUp}
							onclick={() => move(section, -1)}
							><svg
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="1.75"
								aria-hidden="true"><path d="M12 19V5m-6 6 6-6 6 6" /></svg
							></button
						>
						<button
							type="button"
							id={`${rowId(section.key)}-down`}
							aria-label={t('editor.sections.down', { title: section.title })}
							aria-disabled={!section.canMoveDown}
							onclick={() => move(section, 1)}
							><svg
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="1.75"
								aria-hidden="true"><path d="M12 5v14m-6-6 6 6 6-6" /></svg
							></button
						>
						<button
							type="button"
							class="drag-handle"
							id={`${rowId(section.key)}-drag`}
							aria-label={t('editor.sections.drag', { title: section.title })}
							onpointerdown={(event) => startDrag(event, section)}
							onpointermove={trackDrag}
							onpointerup={finishDrag}
							onpointercancel={(event) => finishDrag(event, true)}
							onlostpointercapture={(event) => finishDrag(event, true)}
							><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"
								><circle cx="9" cy="6" r="1.4" /><circle cx="15" cy="6" r="1.4" /><circle
									cx="9"
									cy="12"
									r="1.4"
								/><circle cx="15" cy="12" r="1.4" /><circle cx="9" cy="18" r="1.4" /><circle
									cx="15"
									cy="18"
									r="1.4"
								/></svg
							></button
						>
						<details id={`${rowId(section.key)}-menu`} class="section-menu" use:dismissMenu>
							<summary aria-label={t('editor.sections.more', { title: section.title })}>⋯</summary>
							<div class="menu-actions">
								<button type="button" onclick={() => beginRename(section)}
									>{t('editor.sections.rename')}</button
								>
								<Toggle
									label={t('editor.sections.showOnCv')}
									bind:checked={
										() => !section.hidden,
										(visible) => mutate((draft) => setSectionHidden(draft, section.key, !visible))
									}
								/>
								{#if section.custom}<button
										type="button"
										class="danger"
										onclick={() => {
											closeMenu(section.key, true);
											deleteKey = section.key;
											deleteOpen = true;
										}}>{t('editor.sections.delete')}</button
									>{/if}
							</div>
						</details>
					</div>
				</div>
				<div
					id={`${rowId(section.key)}-panel`}
					class="section-content"
					role="region"
					aria-labelledby={`${rowId(section.key)}-toggle`}
					hidden={!expanded.includes(section.key)}
				>
					{@render renderSection(section)}
				</div>
			</li>
		{/each}
	</ol>
	<Button
		id={`${uid}-add`}
		variant="secondary"
		disabled={!canAdd}
		onclick={() => {
			addedTitle = '';
			addOpen = true;
		}}>{t('editor.sections.add')}</Button
	>
	{#if !canAdd}<p class="limit">
			{t('editor.sections.limit', { count: LIMITS.customSections })}
		</p>{/if}
	<p class="sr-only" aria-live="polite" aria-atomic="true" data-testid="section-order-status">
		{announcement}
	</p>
</div>

{#if renameOpen && renamed}
	<Dialog bind:open={renameOpen} title={t('editor.sections.renameTitle')}>
		<form onsubmit={saveTitle} autocomplete={incognito.active ? 'off' : undefined}>
			<Input
				label={t('editor.sections.titleLabel')}
				autocomplete={incognito.active ? 'off' : undefined}
				bind:value={title}
				maxlength={LIMITS.title}
				showCounter
				placeholder={renamed.defaultTitle}
				hint={!renamed.custom
					? t('editor.sections.defaultTitle', { title: renamed.defaultTitle })
					: undefined}
			/>
			<div class="dialog-actions">
				<Button variant="ghost" onclick={() => (renameOpen = false)}>{t('common.cancel')}</Button
				><Button type="submit" disabled={renamed.custom && !title.trim()}>{t('common.save')}</Button
				>
			</div>
		</form>
	</Dialog>
{/if}

{#if deleteOpen && deleted}
	<Dialog
		bind:open={deleteOpen}
		title={t('editor.sections.deleteTitle')}
		description={t('editor.sections.deleteDescription', {
			title: deleted.title,
			count: deleted.count
		})}
	>
		{#snippet footer()}<Button variant="ghost" onclick={() => (deleteOpen = false)}
				>{t('common.cancel')}</Button
			><Button variant="danger" onclick={deleteSection}>{t('common.delete')}</Button>{/snippet}
	</Dialog>
{/if}

{#if addOpen}
	<Dialog bind:open={addOpen} title={t('editor.sections.addTitle')}>
		<form onsubmit={addSection} autocomplete={incognito.active ? 'off' : undefined}>
			<Input
				label={t('editor.sections.titleLabel')}
				autocomplete={incognito.active ? 'off' : undefined}
				bind:value={addedTitle}
				maxlength={LIMITS.title}
				showCounter
				placeholder={t('editor.sections.addPlaceholder')}
				required
			/>
			<div class="dialog-actions">
				<Button variant="ghost" onclick={() => (addOpen = false)}>{t('common.cancel')}</Button
				><Button type="submit" disabled={!addedTitle.trim() || !canAdd}>{t('common.add')}</Button>
			</div>
		</form>
	</Dialog>
{/if}

<style>
	.section-list {
		display: grid;
		gap: 1rem;
		min-width: 0;
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
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
	}
	.section-heading {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 0.25rem 0.5rem;
		align-items: center;
		padding: 0.75rem;
	}
	h2 {
		grid-column: 1 / -1;
		margin: 0;
		font-size: 1rem;
	}
	h2 button {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		width: 100%;
		min-height: 44px;
		border: 0;
		border-radius: var(--radius-sm);
		background: transparent;
		padding: 0.25rem;
		color: var(--color-text);
		font: inherit;
		font-weight: 650;
		text-align: left;
		cursor: pointer;
		scroll-margin-top: 6rem;
	}
	h2 button > svg {
		transition: transform 160ms ease-out;
	}
	h2 button[aria-expanded='true'] > svg {
		transform: rotate(180deg);
	}
	.section-title {
		min-width: 0;
		overflow-wrap: anywhere;
	}
	.section-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem 0.75rem;
		min-width: 0;
		color: var(--color-text-muted);
		font-size: 0.75rem;
		line-height: 1.5;
		padding-left: 0.25rem;
	}
	.section-toolbar {
		display: flex;
		gap: 0.125rem;
	}
	.section-toolbar > button,
	.section-menu > summary {
		display: grid;
		place-items: center;
		flex-shrink: 0;
		width: 44px;
		min-height: 44px;
		border: 0;
		border-radius: var(--radius-sm);
		background: var(--color-brand-50);
		color: var(--color-brand-ink);
		cursor: pointer;
	}
	.section-toolbar > button[aria-disabled='true'] {
		opacity: 0.45;
		cursor: default;
	}
	.section-toolbar > .drag-handle {
		display: none;
		touch-action: none;
		cursor: grab;
	}
	svg {
		width: 20px;
		height: 20px;
		flex-shrink: 0;
	}
	.section-menu {
		position: relative;
	}
	.section-menu > summary {
		font-size: 1.25rem;
		line-height: 1;
		list-style: none;
	}
	.section-menu > summary::-webkit-details-marker {
		display: none;
	}
	.menu-actions {
		position: absolute;
		z-index: 5;
		top: calc(100% + 0.375rem);
		right: 0;
		display: grid;
		gap: 0.25rem;
		width: 224px;
		max-width: calc(100vw - 3rem);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		padding: 0.5rem;
		box-shadow: var(--shadow-card);
	}
	.menu-actions > button {
		min-height: 44px;
		border: 0;
		border-radius: var(--radius-sm);
		background: transparent;
		padding: 0.5rem;
		color: var(--color-text);
		font: inherit;
		font-size: 0.875rem;
		text-align: left;
		cursor: pointer;
	}
	.menu-actions > button:hover {
		background: var(--color-brand-50);
	}
	.menu-actions > .danger {
		color: var(--color-coral-ink);
	}
	.section-content {
		min-width: 0;
		padding: 0.25rem 0.75rem 1rem;
	}
	.section-content[hidden] {
		display: none;
	}
	.section-content:not([hidden]) {
		animation: ui-content-reveal 160ms ease-out;
	}
	.dialog-actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: 0.5rem;
		margin-top: 1.25rem;
	}
	.limit {
		margin: 0;
		color: var(--color-text-muted);
		font-size: 0.875rem;
		line-height: 1.6;
	}
	.drag-source {
		opacity: 0.65;
	}
	.drag-target {
		outline: 2px solid var(--color-brand-ink);
		outline-offset: 3px;
	}
	@media (min-width: 1024px) {
		.section-heading {
			grid-template-columns: minmax(0, 1fr) auto;
		}
		h2 {
			grid-column: 1;
		}
		.section-meta {
			grid-column: 1;
		}
		.section-toolbar {
			grid-column: 2;
			grid-row: 1 / 3;
		}
		.section-toolbar > .drag-handle {
			display: grid;
		}
	}
</style>
