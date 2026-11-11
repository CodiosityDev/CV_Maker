<script lang="ts">
	import { onDestroy, onMount, tick, untrack } from 'svelte';
	import {
		columnSections,
		placeSection,
		resolveDesign,
		type DesignColumn
	} from '#lib/core/design/index.ts';
	import { moveSectionTo } from '#lib/core/layout/index.ts';
	import { toRenderModel, type RenderModel } from '#lib/core/render/index.ts';
	import type { SectionKey } from '#lib/core/schema/types.ts';
	import type { CvStore } from '#lib/core/store/cv-store.svelte.ts';
	import { incognito } from '#lib/core/storage/index.ts';
	import { resolveTemplate, type TemplateComponent } from '#lib/templates/registry.ts';
	import { t } from '#lib/i18n/index.svelte.ts';
	import VisualDesignPanel from './VisualDesignPanel.svelte';
	import { createVisualInline } from './visual-inline.ts';
	import { getIncognitoUiContext } from '#lib/ui/incognito-context.ts';

	let {
		store,
		photoUrl,
		onformrequest
	}: {
		store: CvStore;
		photoUrl?: string;
		onformrequest: (
			field: string,
			section?: SectionKey | 'personal' | 'target'
		) => void | Promise<void>;
	} = $props();
	const uid = $props.id();
	const openedId = untrack(() => store.cv.id);
	const openedMode = untrack(() => incognito.active);
	const incognitoUi = getIncognitoUiContext();
	let mounted = true;
	let Template = $state<TemplateComponent>();
	let displayedTemplateId: string | undefined;
	let failed = $state(false);
	let retry = $state(0);
	let viewport = $state<HTMLDivElement>();
	let paper = $state<HTMLDivElement>();
	let scale = $state(0);
	let height = $state(0);
	let editing = $state(false);
	let textEpoch = $state(0);
	let textWasOwned = false;
	let message = $state('');
	let rendered = $state.raw<RenderModel>(untrack(editingModel));
	const design = $derived(resolveDesign(store.cv));
	const meta = $derived(resolveTemplate(store.cv.templateId, 'creative'));
	const sidebar = $derived(meta.id === 'creative-sidebar');
	interface Box {
		key: SectionKey;
		column: DesignColumn;
		top: number;
		edge: number;
	}
	let boxes = $state.raw<Box[]>([]);
	let menu = $state<{ key: SectionKey; trigger: HTMLButtonElement; left: number; top: number }>();
	let popup = $state<HTMLDivElement>();
	interface Drop {
		column: DesignColumn;
		index: number;
		before?: SectionKey;
		top: number;
		left: number;
		width: number;
	}
	interface Drag {
		key: SectionKey;
		id: number;
		startX: number;
		startY: number;
		x: number;
		y: number;
		moving: boolean;
		signature: string;
		element: HTMLButtonElement;
	}
	let drag = $state<Drag>();
	let drop = $state<Drop>();
	let scrollFrame: number | undefined;
	let suppressClickUntil = 0;
	let measureFrame: number | undefined;
	const inline = untrack(() =>
		createVisualInline({
			store,
			instruction: `${uid}-help`,
			onstate: (value) => {
				if (!value) textWasOwned = true;
				editing = value;
			},
			onmessage: (value) => (message = value),
			refresh,
			onformrequest: (field, section) => onformrequest(field, section)
		})
	);
	function editingModel() {
		const next = toRenderModel(store.cv, { photoUrl, editing: true });
		// The printed model splits paragraphs. The editing island keeps the exact stored line breaks.
		for (const section of next.sections)
			if (section.type === 'text') section.paragraphs = [store.cv.summary];
		return next;
	}
	function safe() {
		return (
			mounted &&
			store.cv.id === openedId &&
			store.cv.kind === 'creative' &&
			store.externalChange === 'none' &&
			incognito.active === openedMode &&
			!incognito.expiredAt
		);
	}
	function finishActive() {
		inline.finish();
	}
	function releaseText() {
		if (!textWasOwned) return;
		// Native editing can replace Svelte's cached Text nodes. Rebuild only after
		// focus leaves the editing session; Tab into another field keeps it mounted.
		textWasOwned = false;
		textEpoch = untrack(() => textEpoch) + 1;
	}
	onMount(() =>
		incognitoUi?.registerBeforeStart(async () => {
			finishActive();
			await store.flush();
			return store.saveState !== 'error';
		})
	);
	async function refresh(key?: string, activate = false) {
		await tick();
		if (!safe() || (inline.active && !key)) return;
		rendered = editingModel();
		releaseText();
		await tick();
		if (!safe()) return;
		inline.decorate();
		measure();
		if (key) inline.focus(key, activate);
	}
	$effect(() => {
		const next = editingModel();
		const signature = JSON.stringify(store.cv);
		void t('visualEditor.editHint');
		void incognito.active;
		void incognito.expiredAt;
		void store.externalChange;
		if (!safe()) {
			stopDrag();
			menu = undefined;
			inline.finish();
			return;
		}
		if (drag && drag.signature !== signature) stopDrag();
		if (inline.active && inline.signature !== signature) inline.finish();
		if (!editing) {
			rendered = next;
			releaseText();
		}
		void tick().then(() => {
			if (safe()) {
				inline.decorate();
				scheduleMeasure();
			}
		});
	});
	$effect(() => {
		const requested = meta;
		const available = safe();
		void retry;
		if (available && untrack(() => Template && displayedTemplateId === requested.id)) return;
		let current = true;
		Template = undefined;
		failed = false;
		if (!available) return;
		void requested.load().then(
			(module) => {
				if (current && safe()) {
					displayedTemplateId = requested.id;
					Template = module.default;
					rendered = editingModel();
					void tick().then(() => {
						if (current && safe()) {
							inline.decorate();
							scheduleMeasure();
						}
					});
				}
			},
			() => {
				if (current && safe()) failed = true;
			}
		);
		return () => {
			current = false;
		};
	});
	function measure() {
		if (!viewport || !paper || !safe()) return;
		const width = paper.offsetWidth;
		if (!width) return;
		const nextScale = Math.min(1, viewport.clientWidth / width);
		const rescaled = scale !== nextScale;
		scale = nextScale;
		height = paper.offsetHeight * nextScale;
		if (rescaled) {
			scheduleMeasure();
			return;
		}
		const stage = viewport.getBoundingClientRect();
		boxes = Array.from(paper.querySelectorAll<HTMLElement>('[data-visual-section]')).map(
			(element) => {
				const key = element.dataset.visualSection as SectionKey;
				const column = sidebar
					? ((element.closest<HTMLElement>('[data-visual-column]')?.dataset
							.visualColumn as DesignColumn) ?? 'main')
					: 'main';
				element.dataset.sectionKey = key;
				element.dataset.column = column;
				const left = !sidebar || (column === 'side') === (design.sidePosition === 'left');
				return {
					key,
					column,
					top: Math.max(0, element.getBoundingClientRect().top - stage.top - 10),
					edge: left ? 0 : Math.max(0, stage.width - 44)
				};
			}
		);
	}
	function scheduleMeasure() {
		if (measureFrame !== undefined) cancelAnimationFrame(measureFrame);
		measureFrame = requestAnimationFrame(() => {
			measureFrame = undefined;
			measure();
		});
	}
	$effect(() => {
		const stage = viewport;
		const page = paper;
		void Template;
		if (!stage || !page) return;
		const observer = new ResizeObserver(scheduleMeasure);
		observer.observe(stage);
		observer.observe(page);
		scheduleMeasure();
		return () => observer.disconnect();
	});
	function title(key: SectionKey) {
		return rendered.sections.find((section) => section.key === key)?.title ?? key;
	}
	function visible(column: DesignColumn, excluding?: SectionKey) {
		return rendered.sections.filter(
			(section) =>
				section.key !== excluding &&
				(!sidebar || (design.side.includes(section.key) ? 'side' : 'main') === column)
		);
	}
	function fullPeers(column: DesignColumn, excluding: SectionKey) {
		return (sidebar ? columnSections(store.cv, column) : store.cv.layout.order).filter(
			(key) => key !== excluding
		);
	}
	async function closeMenu(focus = true) {
		const trigger = menu?.trigger;
		menu = undefined;
		await tick();
		if (focus && trigger?.isConnected) trigger.focus({ preventScroll: true });
	}
	async function openMenu(event: MouseEvent, key: SectionKey) {
		if (performance.now() < suppressClickUntil) return;
		finishActive();
		if (menu?.key === key) {
			void closeMenu();
			return;
		}
		const trigger = event.currentTarget as HTMLButtonElement;
		const rect = trigger.getBoundingClientRect();
		menu = {
			key,
			trigger,
			left: Math.max(8, Math.min(innerWidth - 236, rect.left)),
			top: Math.max(8, Math.min(innerHeight - 220, rect.bottom + 4))
		};
		await tick();
		popup?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
	}
	function menuKeys(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			event.preventDefault();
			event.stopPropagation();
			void closeMenu();
			return;
		}
		if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key) || !popup) return;
		const buttons = Array.from(popup.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
		const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
		const index =
			event.key === 'Home'
				? 0
				: event.key === 'End'
					? buttons.length - 1
					: (at + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
		event.preventDefault();
		buttons[index]?.focus();
	}
	function columnOf(key: SectionKey): DesignColumn {
		return sidebar && design.side.includes(key) ? 'side' : 'main';
	}
	function canMove(key: SectionKey, direction: -1 | 1) {
		const peers = visible(columnOf(key));
		const at = peers.findIndex((section) => section.key === key);
		return direction < 0 ? at > 0 : at >= 0 && at < peers.length - 1;
	}
	function move(key: SectionKey, column: DesignColumn, index: number) {
		finishActive();
		if (!safe()) return;
		const peers = visible(column, key);
		const before = peers[Math.min(index, peers.length)]?.key;
		const all = fullPeers(column, key);
		const position = before ? all.indexOf(before) : all.length;
		const currentPeers = sidebar ? columnSections(store.cv, column) : store.cv.layout.order;
		if (columnOf(key) === column && currentPeers.indexOf(key) === position) {
			void closeMenu();
			return;
		}
		store.update((draft) => {
			// Single-column templates retain the saved sidebar preferences for a later template switch.
			if (sidebar) placeSection(draft, key, column, position);
			else moveSectionTo(draft, key, position);
		});
		message = t('visualEditor.moved', {
			section: title(key),
			column: t(column === 'side' ? 'visualEditor.sideColumn' : 'visualEditor.mainColumn'),
			position: index + 1
		});
		void closeMenu();
		void refresh();
	}
	function shift(key: SectionKey, direction: -1 | 1) {
		const column = columnOf(key);
		const at = visible(column).findIndex((section) => section.key === key);
		move(key, column, at + direction);
	}
	function destination(x: number, y: number): Drop | undefined {
		if (!drag || !paper || !viewport) return;
		const stage = viewport.getBoundingClientRect();
		if (x < stage.left - 44 || x > stage.right + 44 || y < stage.top - 64 || y > stage.bottom + 64)
			return;
		let column: DesignColumn = 'main';
		let bounds =
			paper.querySelector<HTMLElement>('[data-visual-column="main"]')?.getBoundingClientRect() ??
			stage;
		if (sidebar) {
			const side = paper
				.querySelector<HTMLElement>('[data-visual-column="side"]')
				?.getBoundingClientRect();
			const width = stage.width * (design.sideWidth === 27 ? 57 / 210 : design.sideWidth / 100);
			const padding = (stage.width * 14) / 210;
			const left =
				side?.left ??
				(design.sidePosition === 'left' ? stage.left + padding : stage.right - padding - width);
			const right = side?.right ?? left + width;
			if (x >= left - 12 && x <= right + 12) {
				column = 'side';
				bounds = side ?? new DOMRect(left, stage.top + padding, width, stage.height - padding * 2);
			}
		}
		const peers = visible(column, drag.key);
		let index = peers.length;
		for (let at = 0; at < peers.length; at++) {
			const element = Array.from(paper.querySelectorAll<HTMLElement>('[data-visual-section]')).find(
				(node) => node.dataset.visualSection === peers[at]!.key
			);
			const rect = element?.getBoundingClientRect();
			if (rect && y < rect.top + rect.height / 2) {
				index = at;
				break;
			}
		}
		const before = peers[index]?.key;
		const anchor = peers[index] ?? peers.at(-1);
		const element =
			anchor &&
			Array.from(paper.querySelectorAll<HTMLElement>('[data-visual-section]')).find(
				(node) => node.dataset.visualSection === anchor.key
			);
		const rect = element?.getBoundingClientRect();
		return {
			column,
			index,
			before,
			left: Math.max(0, bounds.left - stage.left),
			width: Math.min(stage.width, bounds.width),
			top: Math.max(0, (rect ? (before ? rect.top : rect.bottom) : bounds.top + 44) - stage.top)
		};
	}
	function autoScroll() {
		scrollFrame = undefined;
		if (!drag?.moving || !safe()) return;
		const delta =
			drag.y < 64
				? -12 * (1 - drag.y / 64)
				: drag.y > innerHeight - 64
					? 12 * (1 - (innerHeight - drag.y) / 64)
					: 0;
		if (delta) {
			window.scrollBy({ top: delta, behavior: 'instant' });
			measure();
			drop = destination(drag.x, drag.y);
		}
		scrollFrame = requestAnimationFrame(autoScroll);
	}
	function stopDrag() {
		if (drag?.element.hasPointerCapture(drag.id)) drag.element.releasePointerCapture(drag.id);
		if (scrollFrame !== undefined) cancelAnimationFrame(scrollFrame);
		scrollFrame = undefined;
		drag = undefined;
		drop = undefined;
	}
	function startDrag(event: PointerEvent, key: SectionKey) {
		if (event.button !== 0 || !safe()) return;
		finishActive();
		menu = undefined;
		(event.currentTarget as HTMLButtonElement).setPointerCapture(event.pointerId);
		drag = {
			key,
			id: event.pointerId,
			x: event.clientX,
			y: event.clientY,
			startX: event.clientX,
			startY: event.clientY,
			moving: false,
			signature: JSON.stringify(store.cv),
			element: event.currentTarget as HTMLButtonElement
		};
	}
	function trackDrag(event: PointerEvent) {
		if (!drag || event.pointerId !== drag.id) return;
		drag.x = event.clientX;
		drag.y = event.clientY;
		if (!drag.moving && Math.hypot(drag.x - drag.startX, drag.y - drag.startY) >= 5) {
			drag.moving = true;
			scrollFrame = requestAnimationFrame(autoScroll);
		}
		if (drag.moving) {
			event.preventDefault();
			drop = destination(drag.x, drag.y);
		}
	}
	function endDrag(event: PointerEvent, cancelled = false) {
		if (!drag || event.pointerId !== drag.id) return;
		const current = drag;
		const target = drop;
		if ((event.currentTarget as HTMLButtonElement).hasPointerCapture(event.pointerId))
			(event.currentTarget as HTMLButtonElement).releasePointerCapture(event.pointerId);
		stopDrag();
		if (current.moving) {
			suppressClickUntil = performance.now() + 200;
			event.preventDefault();
			if (!cancelled && target) move(current.key, target.column, target.index);
		}
	}
	onDestroy(() => {
		mounted = false;
		stopDrag();
		menu = undefined;
		if (measureFrame !== undefined) cancelAnimationFrame(measureFrame);
	});
</script>

<svelte:window
	onresize={scheduleMeasure}
	onpointerdown={(event) => {
		if (
			menu &&
			event.target instanceof Node &&
			!popup?.contains(event.target) &&
			!menu.trigger.contains(event.target)
		)
			void closeMenu(false);
	}}
/>

<div class="visual-editor" data-testid="visual-editor">
	<div class="design-controls">
		<VisualDesignPanel {store} onbeforechange={finishActive} />
		<details class="section-navigator">
			<summary>{t('visualEditor.sections')}</summary>
			<div class="section-rows">
				{#each rendered.sections as section (section.key)}
					<div class="section-row" data-section-key={section.key}>
						<span>{section.title}</span>
						<button
							type="button"
							aria-haspopup="menu"
							aria-expanded={menu?.key === section.key}
							aria-label={t('visualEditor.sectionMenu', { section: section.title })}
							onclick={(event) => openMenu(event, section.key)}
						>
							<svg
								width="20"
								height="20"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="1.75"
								aria-hidden="true"><path d="M5 6h14M5 12h14M5 18h14" /></svg
							>
						</button>
					</div>
				{/each}
			</div>
		</details>
	</div>
	<div class="canvas-area">
		<p id={`${uid}-help`} class="help">{t('visualEditor.help')} {t('visualEditor.editHint')}</p>
		<div
			class="canvas"
			role="region"
			bind:this={viewport}
			style:height={height ? `${height}px` : undefined}
			aria-label={t('visualEditor.canvas')}
		>
			<div
				class="paper"
				data-testid="visual-paper"
				bind:this={paper}
				use:inline.attach
				style:transform={`scale(${scale})`}
			>
				{#key textEpoch}{#if Template}<Template model={rendered} />{/if}{/key}
			</div>
			{#if !Template}
				<div class="loading" role="status">
					<p>{t(failed ? 'visualEditor.loadError' : 'visualEditor.loading')}</p>
					{#if failed}<button type="button" onclick={() => retry++}
							>{t('visualEditor.retry')}</button
						>{/if}
				</div>
			{/if}
			{#each boxes as box (box.key)}
				<button
					type="button"
					class="section-handle"
					class:dragging={drag?.moving && drag.key === box.key}
					data-testid="visual-section-handle"
					data-section-key={box.key}
					style:top={`${box.top}px`}
					style:left={`${box.edge}px`}
					aria-label={t('visualEditor.dragSection', { section: title(box.key) })}
					aria-haspopup="menu"
					aria-expanded={menu?.key === box.key}
					onpointerdown={(event) => startDrag(event, box.key)}
					onpointermove={trackDrag}
					onpointerup={endDrag}
					onpointercancel={(event) => endDrag(event, true)}
					onclick={(event) => openMenu(event, box.key)}
				>
					<svg
						width="18"
						height="20"
						viewBox="0 0 18 20"
						fill="none"
						stroke="currentColor"
						stroke-width="1.75"
						stroke-linecap="round"
						aria-hidden="true"
						><path d="M6 4h.01M12 4h.01M6 10h.01M12 10h.01M6 16h.01M12 16h.01" /></svg
					>
				</button>
			{/each}
			{#if drag?.moving && drop}<div
					class="drop-line"
					style:top={`${drop.top}px`}
					style:left={`${drop.left}px`}
					style:width={`${drop.width}px`}
					aria-hidden="true"
				></div>{/if}
		</div>
		<p class="hint">{t('visualEditor.dragHint')}</p>
		<p class="status" role="status" aria-live="polite">{message}</p>
	</div>
</div>
{#if menu}
	{@const key = menu.key}
	<div
		class="section-menu"
		role="menu"
		tabindex="-1"
		aria-label={t('visualEditor.sectionMenu', { section: title(key) })}
		bind:this={popup}
		style:left={`${menu.left}px`}
		style:top={`${menu.top}px`}
		onkeydown={menuKeys}
		onfocusout={(event) => {
			if (!(event.relatedTarget instanceof Node && popup?.contains(event.relatedTarget)))
				void closeMenu(false);
		}}
	>
		<button
			type="button"
			role="menuitem"
			disabled={!canMove(key, -1)}
			onclick={() => shift(key, -1)}>{t('visualEditor.moveUp')}</button
		>
		<button type="button" role="menuitem" disabled={!canMove(key, 1)} onclick={() => shift(key, 1)}
			>{t('visualEditor.moveDown')}</button
		>
		{#if sidebar}<button
				type="button"
				role="menuitem"
				onclick={() =>
					move(
						key,
						columnOf(key) === 'side' ? 'main' : 'side',
						visible(columnOf(key) === 'side' ? 'main' : 'side', key).length
					)}
				>{t(columnOf(key) === 'side' ? 'visualEditor.moveMain' : 'visualEditor.moveSide')}</button
			>{/if}
	</div>
{/if}

<style>
	.visual-editor {
		display: grid;
		gap: 1rem;
		min-width: 0;
	}
	.design-controls,
	.canvas-area {
		min-width: 0;
	}
	.design-controls {
		display: grid;
		align-content: start;
		gap: 1rem;
	}
	.help,
	.hint,
	.status {
		color: var(--color-text-muted);
		font-size: 0.875rem;
	}
	.help {
		margin-bottom: 0.75rem;
	}
	.hint,
	.status {
		margin-top: 0.75rem;
	}
	.status {
		min-height: 1.5em;
	}
	.canvas {
		position: relative;
		width: 210mm;
		max-width: 100%;
		overflow: hidden;
		margin-inline: auto;
		aspect-ratio: 210 / 297;
		background: var(--color-paper);
		color-scheme: light;
		box-shadow: var(--shadow-paper);
	}
	.paper {
		position: absolute;
		top: 0;
		left: 0;
		width: 210mm;
		min-height: 297mm;
		transform-origin: top left;
		background: var(--color-paper);
		color: var(--color-paper-ink);
		--color-focus: var(--color-paper-focus);
	}
	.paper :global([data-edit]),
	.paper :global([data-form-field]) {
		cursor: text;
		outline-offset: 2px;
	}
	.paper :global([data-edit]:hover),
	.paper :global([data-form-field]:hover) {
		outline: 1px solid var(--color-paper-focus);
	}
	.paper :global([data-edit]:focus),
	.paper :global([data-form-field]:focus) {
		outline: 2px solid var(--color-paper-focus);
	}
	.paper :global([data-edit]) {
		min-height: 1em;
	}
	.paper :global([contenteditable='plaintext-only']),
	.paper :global([contenteditable='true']) {
		white-space: pre-wrap;
		caret-color: var(--color-paper-ink);
	}
	.paper :global([data-form-field]) {
		cursor: pointer;
	}
	.section-navigator {
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
	}
	.section-navigator summary {
		min-height: 48px;
		padding: 0.75rem;
		cursor: pointer;
		font-weight: 600;
	}
	.section-rows {
		padding: 0 0.75rem 0.75rem;
	}
	.section-row {
		display: flex;
		gap: 0.5rem;
		justify-content: space-between;
		align-items: center;
		font-size: 0.875rem;
		border-top: 1px solid var(--color-border);
	}
	.section-row span {
		min-width: 0;
		overflow-wrap: anywhere;
	}
	button {
		min-width: 44px;
		min-height: 44px;
		border: 0;
		border-radius: var(--radius-sm);
		background: var(--color-brand-50);
		color: var(--color-brand-ink);
		font: inherit;
		cursor: pointer;
	}
	.section-row button {
		flex-shrink: 0;
		display: grid;
		place-items: center;
	}
	.section-handle {
		display: none;
		position: absolute;
		z-index: 2;
		width: 44px;
		height: 44px;
		padding: 0;
		place-items: center;
		touch-action: none;
		opacity: 0.8;
		cursor: grab;
	}
	.section-handle:focus-visible,
	.section-handle:hover,
	.section-handle.dragging {
		opacity: 1;
	}
	.section-handle.dragging {
		cursor: grabbing;
	}
	.drop-line {
		position: absolute;
		z-index: 3;
		height: 3px;
		background: var(--color-brand-ink);
		pointer-events: none;
	}
	.section-menu {
		position: fixed;
		z-index: 60;
		width: min(228px, calc(100vw - 16px));
		display: grid;
		gap: 2px;
		padding: 0.5rem;
		background: var(--color-surface);
		color: var(--color-text);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-dialog);
	}
	.section-menu button {
		text-align: left;
		padding: 0.5rem 0.75rem;
		background: transparent;
		color: inherit;
	}
	.section-menu button:hover:not(:disabled) {
		background: var(--color-brand-50);
	}
	.section-menu button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.loading {
		position: absolute;
		inset: 0;
		display: grid;
		align-content: start;
		justify-items: center;
		gap: 0.75rem;
		padding: 2rem;
		color: var(--color-text-muted);
		background: var(--color-surface);
	}
	@media (min-width: 768px) {
		.section-handle {
			display: grid;
		}
	}
	@media (min-width: 1100px) {
		.visual-editor {
			grid-template-columns: 230px minmax(0, 1fr);
			align-items: start;
		}
		.design-controls {
			position: sticky;
			top: 1rem;
		}
	}
</style>
