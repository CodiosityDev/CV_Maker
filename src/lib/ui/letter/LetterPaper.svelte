<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import {
		findLetter,
		letterConciseMessageKey,
		LETTER_LIMITS,
		toLetterModel,
		updateLetter,
		type LetterTextKey,
		type RichMark
	} from '#lib/core/letter/index.ts';
	import type { ConcisePoint, ConciseReport } from '#lib/core/ats/concise.ts';
	import type { CvStore } from '#lib/core/store/cv-store.svelte.ts';
	import { incognito } from '#lib/core/storage/index.ts';
	import { t } from '#lib/i18n/index.svelte.ts';
	import FormalLetter from '#lib/templates/letter/FormalLetter.svelte';
	import { createPaperInline, type PaperSelection } from './paper-inline.ts';

	let {
		store,
		letterId,
		report,
		aiKeys = [],
		onediting
	}: {
		store: CvStore;
		letterId: string;
		report?: ConciseReport;
		aiKeys?: readonly LetterTextKey[];
		onediting?: (editing: boolean) => void;
	} = $props();
	const uid = $props.id();
	const letter = $derived(findLetter(store.cv, letterId));
	const model = $derived(letter ? toLetterModel(store.cv, letter) : undefined);
	let viewport = $state<HTMLDivElement>();
	let paper = $state<HTMLDivElement>();
	let scale = $state(1);
	let fit = $state(1);
	let height = $state(0);
	let zoomed = $state(false);
	let keyboardBottom = $state(0);
	let selection = $state<PaperSelection>();
	let message = $state('');
	let toolbar = $state<HTMLDivElement>();
	const marks: RichMark[] = ['bold', 'italic', 'underline'];
	const inline = untrack(() =>
		createPaperInline({
			store,
			letterId,
			onselection: (value) => (selection = value),
			onediting: (editing) => onediting?.(editing),
			onlimit: () =>
				(message = t('letterEditor.paragraphLimit', { limit: LETTER_LIMITS.paragraph }))
		})
	);
	const activePoint = $derived(
		report?.points.find((point) => point.key === selection?.key && point.level !== 'ok')
	);
	const changed = $derived(
		model?.blocks.filter((block) => block.kind === 'text' && !block.auto) ?? []
	);
	function measure() {
		if (!viewport || !paper) return;
		const width = paper.offsetWidth;
		if (!width) return;
		fit = Math.min(1, viewport.clientWidth / width);
		scale = zoomed && fit < 0.75 ? 0.75 : fit;
		height = paper.offsetHeight * scale;
	}
	function keyboard() {
		const visual = window.visualViewport;
		keyboardBottom = visual
			? Math.max(0, window.innerHeight - visual.height - visual.offsetTop)
			: 0;
	}
	onMount(() => {
		const observer = new ResizeObserver(measure);
		if (viewport) observer.observe(viewport);
		if (paper) observer.observe(paper);
		window.visualViewport?.addEventListener('resize', keyboard);
		window.visualViewport?.addEventListener('scroll', keyboard);
		measure();
		keyboard();
		return () => {
			observer.disconnect();
			window.visualViewport?.removeEventListener('resize', keyboard);
			window.visualViewport?.removeEventListener('scroll', keyboard);
		};
	});
	$effect(() => {
		void zoomed;
		untrack(measure);
	});
	$effect(() => {
		void store.externalChange;
		void store.cv.id;
		void incognito.active;
		void incognito.expiredAt;
		void letter;
		untrack(() => inline.sync());
	});
	function reason(point: ConcisePoint) {
		return point.issues
			.map((issue) =>
				t(letterConciseMessageKey(issue), {
					fillers: point.fillers.join('", "'),
					words: point.words
				})
			)
			.join(' ');
	}
	function format(mark: RichMark) {
		if (!inline.format(mark)) message = t('letterEditor.selectionHint');
	}
	function toolbarKey(event: KeyboardEvent) {
		if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
		const buttons = Array.from(
			toolbar?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []
		);
		if (!buttons.length) return;
		event.preventDefault();
		const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
		const next =
			event.key === 'Home'
				? 0
				: event.key === 'End'
					? buttons.length - 1
					: (index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
		buttons[next]?.focus();
	}
	function reset(key: LetterTextKey) {
		if (store.externalChange !== 'none') return;
		inline.finish();
		store.update((draft) => updateLetter(draft, letterId, { overrides: { [key]: undefined } }));
	}
	export function focusParagraph(key: LetterTextKey) {
		inline.focus(key);
	}
	export function finishEditing() {
		inline.finish();
	}
</script>

<section
	class="letter-paper"
	data-testid="letter-paper"
	aria-label={t('letterEditor.preview')}
	use:inline.attach
>
	<div class="paper-hint-row">
		<p id={`${uid}-hint`} class="hint">{t('letterEditor.editHint')}</p>
		{#if fit < 0.75}
			<button type="button" class="zoom-button" onclick={() => (zoomed = !zoomed)}>
				{t(zoomed ? 'letterEditor.zoomFit' : 'letterEditor.zoomIn')}
			</button>
		{/if}
		{#if model?.locale === 'id'}
			<details class="foreign-help">
				<summary aria-label={t('letterEditor.foreignHint')} title={t('letterEditor.foreignHint')}>
					<svg
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="1.7"
						aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 10v7M12 7v1" /></svg
					>
				</summary>
				<p>{t('letterEditor.foreignHint')}</p>
			</details>
		{/if}
	</div>
	{#if selection}
		<div class="format-toolbar-anchor">
			<div
				class="format-toolbar"
				role="toolbar"
				tabindex="-1"
				aria-label={t('letterEditor.formatting')}
				aria-orientation="horizontal"
				style:--letter-keyboard-bottom={`${keyboardBottom}px`}
				bind:this={toolbar}
				onkeydown={toolbarKey}
			>
				{#each marks as mark, index (mark)}
					<button
						type="button"
						disabled={store.externalChange !== 'none'}
						class:pressed={selection.marks[mark]}
						aria-label={t(`letterEditor.${mark}`)}
						aria-pressed={selection.marks[mark]}
						aria-keyshortcuts={index === 0
							? 'Control+b Meta+b'
							: index === 1
								? 'Control+i Meta+i'
								: 'Control+u Meta+u'}
						data-testid={`letter-format-${mark}`}
						onpointerdown={(event) => event.preventDefault()}
						onclick={() => format(mark)}
						>{#if mark === 'bold'}<strong>B</strong>{:else if mark === 'italic'}<em>I</em>{:else}<u
								>U</u
							>{/if}</button
					>
				{/each}
				<span>{t(`letter.blocks.${selection.key}`)}</span>
			</div>
		</div>
	{/if}
	<div class="paper-viewport" bind:this={viewport}>
		<div
			class="paper-space"
			style:height={`${height}px`}
			style:width={zoomed ? `${793.7 * scale}px` : '100%'}
		>
			<div class="paper-scale" bind:this={paper} style:transform={`scale(${scale})`}>
				{#if model}
					<FormalLetter {model}>
						{#snippet textBlock(block)}
							{@const point = report?.points.find((item) => item.key === block.key)}
							<div
								class="editable-paragraph"
								class:wordy={point?.level === 'wordy'}
								class:very-wordy={point?.level === 'veryWordy'}
								data-letter-block={block.key}
								data-testid={`letter-block-${block.key}`}
								data-level={point?.level}
								contenteditable="plaintext-only"
								role="textbox"
								tabindex="0"
								aria-multiline="true"
								aria-label={t('letterEditor.editParagraph', {
									paragraph: t(`letter.blocks.${block.key}`)
								})}
								aria-describedby={`${uid}-hint`}
								title={point && point.level !== 'ok' ? reason(point) : undefined}
								use:inline.paragraph={{
									key: block.key,
									runs: block.runs,
									fillers: point?.fillers ?? []
								}}
							></div>
						{/snippet}
					</FormalLetter>
					{#if model.pageEstimate > 1}<div class="page-boundary" aria-hidden="true"></div>{/if}
				{/if}
			</div>
		</div>
	</div>
	{#if model && model.pageEstimate > 1}<p class="page-warning">
			{t('letterEditor.pageWarning')}
		</p>{/if}
	{#if activePoint}
		<div class="paragraph-note" role="status">
			<strong
				>{t('letterEditor.wordyParagraph', {
					paragraph: t(`letter.blocks.${activePoint.key as LetterTextKey}`)
				})}</strong
			>
			<p>{reason(activePoint)}</p>
			<button type="button" onclick={() => inline.focus(activePoint.key as LetterTextKey)}
				>{t('letterEditor.fix')}</button
			>
		</div>
	{/if}
	{#if changed.length}
		<div class="changed-list">
			{#each changed as block (block.key)}
				<div class="changed-row">
					<span
						>{t(`letter.blocks.${block.key as LetterTextKey}`)} · {t(
							aiKeys.includes(block.key as LetterTextKey)
								? 'letterEditor.aiWritten'
								: 'letterEditor.changed'
						)}</span
					>
					<button
						type="button"
						data-testid={`letter-block-reset-${block.key}`}
						disabled={store.externalChange !== 'none'}
						onclick={() => reset(block.key as LetterTextKey)}
						>{t('letterEditor.resetParagraph')}</button
					>
				</div>
			{/each}
		</div>
	{/if}
	<p class="sr-only" aria-live="polite">{message}</p>
</section>

<style>
	.letter-paper {
		min-width: 0;
		position: relative;
	}
	.hint {
		margin: 0 0 0.5rem;
		color: var(--color-text-muted);
		font-size: 0.8125rem;
		line-height: 1.5;
	}
	.paper-hint-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		justify-content: space-between;
		min-height: 44px;
	}
	.paper-hint-row .hint {
		min-width: 0;
		flex: 1;
		margin: 0;
	}
	.foreign-help {
		position: relative;
		flex-shrink: 0;
	}
	.foreign-help summary {
		display: grid;
		place-items: center;
		width: 44px;
		min-height: 44px;
		border-radius: var(--radius-sm);
		color: var(--color-brand-ink);
		cursor: pointer;
		list-style: none;
	}
	.foreign-help summary::-webkit-details-marker {
		display: none;
	}
	.foreign-help summary:focus-visible {
		outline: 2px solid var(--color-focus);
		outline-offset: 2px;
	}
	.foreign-help svg {
		width: 18px;
		height: 18px;
	}
	.foreign-help p {
		position: absolute;
		top: 100%;
		right: 0;
		z-index: 8;
		width: min(18rem, calc(100vw - 3rem));
		margin: 0;
		padding: 0.75rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		color: var(--color-text);
		font-size: 0.8125rem;
		line-height: 1.5;
	}
	.paper-viewport {
		width: 100%;
		min-width: 0;
		overflow: auto;
		overscroll-behavior: contain;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: #fff;
	}
	.paper-space {
		position: relative;
		min-height: 1px;
	}
	.paper-scale {
		position: absolute;
		top: 0;
		left: 0;
		width: 210mm;
		transform-origin: top left;
	}
	.editable-paragraph {
		position: relative;
		margin: 0;
		min-height: 1em;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
		cursor: text;
		outline-offset: 1mm;
	}
	.editable-paragraph:focus {
		outline: 0.4mm solid #4f46a8;
	}
	.wordy {
		border-left: 0.5mm dotted #9b3a25;
		padding-left: 2mm;
		margin-left: -2.5mm;
	}
	.very-wordy {
		border-left: 0.9mm dotted #9b3a25;
		padding-left: 2mm;
		margin-left: -2.9mm;
	}
	.very-wordy::before {
		position: absolute;
		left: -5mm;
		top: 0;
		content: '!';
		font-weight: 700;
		color: #9b3a25;
	}
	.editable-paragraph :global(.letter-filler) {
		background: #fff1e1;
		color: #000;
		text-decoration: underline;
		text-decoration-color: #9b3a25;
		text-underline-offset: 2px;
	}
	.format-toolbar-anchor {
		position: sticky;
		top: 0;
		z-index: 5;
		height: 0;
	}
	.format-toolbar {
		position: absolute;
		top: 0;
		right: 0;
		z-index: 5;
		display: flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.375rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		color: var(--color-text);
	}
	.format-toolbar button {
		min-width: 44px;
		min-height: 44px;
		border: 0;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--color-text);
		font-size: 1rem;
		cursor: pointer;
	}
	.format-toolbar button.pressed {
		background: var(--color-brand-50);
		color: var(--color-brand-ink);
	}
	.format-toolbar span {
		min-width: 0;
		padding-inline: 0.375rem;
		font-size: 0.75rem;
	}
	.zoom-button,
	.paragraph-note button,
	.changed-row button {
		min-height: 44px;
		padding: 0.5rem 0.625rem;
		border: 0;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--color-brand-ink);
		font: inherit;
		font-size: 0.8125rem;
		cursor: pointer;
	}
	.zoom-button {
		flex-shrink: 0;
	}
	button:focus-visible {
		outline: 2px solid var(--color-focus);
		outline-offset: 2px;
	}
	.page-boundary {
		position: absolute;
		top: 297mm;
		width: 100%;
		border-top: 1px dashed #777;
		pointer-events: none;
	}
	.page-warning {
		margin-top: 0.75rem;
		color: var(--color-danger);
		font-size: 0.8125rem;
		line-height: 1.5;
	}
	.paragraph-note {
		margin-top: 0.75rem;
		padding: 0.75rem;
		border-radius: var(--radius-md);
		background: var(--color-cream);
		color: var(--color-text);
		font-size: 0.8125rem;
		line-height: 1.5;
	}
	.paragraph-note p {
		margin-top: 0.25rem;
	}
	.changed-list {
		margin-top: 0.75rem;
	}
	.changed-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 0.25rem 0.5rem;
		padding-block: 0.375rem;
		border-top: 1px solid var(--color-border);
	}
	.changed-row span {
		font-size: 0.75rem;
		color: var(--color-text-muted);
	}
	.changed-row button:disabled {
		cursor: default;
		opacity: 0.55;
	}
	@media (max-width: 767px) {
		.format-toolbar {
			position: fixed;
			top: auto;
			bottom: var(--letter-keyboard-bottom, 0px);
			left: 0.75rem;
			right: 0.75rem;
			z-index: 80;
			margin-bottom: max(0.5rem, env(safe-area-inset-bottom));
		}
	}
</style>
