<script lang="ts">
	import { onMount, tick, untrack } from 'svelte';
	import type { HTMLInputAttributes } from 'svelte/elements';
	import { t } from '#lib/i18n/index.svelte.ts';

	type Props = Omit<
		HTMLInputAttributes,
		'value' | 'type' | 'class' | 'children' | 'size' | 'onselect' | 'onkeydown'
	> & {
		label: string;
		value?: string;
		suggestions: (query: string) => string[];
		popularWhenEmpty?: boolean;
		onselect?: (value: string) => void;
		onkeydown?: (event: KeyboardEvent) => void;
		hint?: string;
		error?: string;
		showCounter?: boolean;
		class?: string;
	};
	const generatedId = $props.id();
	let {
		label,
		value = $bindable(''),
		suggestions,
		popularWhenEmpty = false,
		onselect,
		onkeydown,
		id = generatedId,
		hint,
		error,
		required = false,
		maxlength,
		showCounter = false,
		disabled = false,
		autocomplete = 'off',
		class: className = '',
		'aria-describedby': describedBy,
		oninput: suppliedInput,
		onfocus: suppliedFocus,
		onblur: suppliedBlur,
		...rest
	}: Props = $props();
	let container: HTMLDivElement | undefined = $state();
	let input: HTMLInputElement | undefined = $state();
	let list: HTMLUListElement | undefined = $state();
	let results = $state<string[]>([]);
	let query = $state('');
	let active = $state(-1);
	let focused = $state(false);
	let dismissed = $state(false);
	let above = $state(false);
	let listHeight = $state(0);
	let ready = $state(false);
	let timer: ReturnType<typeof setTimeout> | undefined;
	let revealFrame: number | undefined;
	let mounted = false;
	const listId = $derived(`${id}-suggestions`);
	const expanded = $derived(
		focused && !dismissed && !disabled && results.length > 0 && listHeight >= 44
	);
	const counterVisible = $derived(
		showCounter && maxlength != null && value.length >= maxlength * 0.8
	);
	const description = $derived(
		[
			describedBy,
			`${id}-help`,
			hint && `${id}-hint`,
			error && `${id}-error`,
			counterVisible && `${id}-count`
		]
			.filter(Boolean)
			.join(' ') || undefined
	);

	function options(search: string, provider = suggestions, popular = popularWhenEmpty) {
		if (disabled || input?.matches(':disabled') || (!search.trim() && !popular)) return [];
		try {
			return provider(search)
				.filter((item) => maxlength == null || item.length <= maxlength)
				.slice(0, 8);
		} catch {
			return [];
		}
	}
	function refresh() {
		clearTimeout(timer);
		query = value;
		results = options(value);
		active = -1;
		ready = true;
		measure(true);
		void revealAfterUpdate();
	}
	$effect(() => {
		const search = value;
		query = search;
		results = [];
		active = -1;
		ready = false;
		const pending = setTimeout(() => {
			ready = true;
		}, 80);
		timer = pending;
		return () => clearTimeout(pending);
	});
	$effect(() => {
		if (!ready) return;
		// Keep provider reads inside the effect so data loaded after the debounce is tracked.
		const next = options(query);
		untrack(() => {
			// An immediate keyboard refresh already has this list and may have an active option.
			if (next.length === results.length && next.every((item, index) => item === results[index]))
				return;
			results = next;
			active = -1;
		});
	});
	$effect(() => {
		void value;
		if (focused && !dismissed && results.length) {
			const frame = requestAnimationFrame(() => measure());
			return () => cancelAnimationFrame(frame);
		}
	});

	async function revealAfterUpdate() {
		await tick();
		if (!mounted || !focused || dismissed) return;
		if (revealFrame !== undefined) cancelAnimationFrame(revealFrame);
		revealFrame = requestAnimationFrame(() => {
			revealFrame = undefined;
			if (focused && !dismissed) measure(true);
		});
	}
	function measure(revealInput = false) {
		if (!input || !focused) return;
		const viewport = window.visualViewport;
		const top = (viewport?.offsetTop ?? 0) + 8;
		let bottom = (viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight) - 8;
		if (window.innerWidth < 1024) {
			const actions = document.querySelector('.bottom-actions')?.getBoundingClientRect();
			if (actions && actions.bottom > top && actions.top < bottom)
				bottom = Math.min(bottom, actions.top - 8);
		}
		let rect = input.getBoundingClientRect();
		if (revealInput && document.activeElement === input) {
			const offset = rect.bottom > bottom ? rect.bottom - bottom : Math.min(0, rect.top - top);
			if (offset) {
				window.scrollBy({
					top: offset > 0 ? Math.ceil(offset) : Math.floor(offset),
					behavior: 'instant'
				});
				rect = input.getBoundingClientRect();
			}
		}
		// Manual scrolling can move the anchor behind the bar. Hide without latching an explicit close.
		if (rect.top < top - 0.5 || rect.bottom > bottom + 0.5) {
			active = -1;
			listHeight = 0;
			return;
		}
		const below = Math.max(0, bottom - rect.bottom - 4);
		const before = Math.max(0, rect.top - top - 4);
		above = below < 176 && before > below;
		listHeight = Math.min(360, above ? before : below);
	}
	onMount(() => {
		mounted = true;
		const reposition = () => measure();
		const resized = () => {
			measure(!dismissed);
			void revealAfterUpdate();
		};
		function outside(event: PointerEvent) {
			if (event.target instanceof Node && !container?.contains(event.target)) {
				dismissed = true;
				active = -1;
			}
		}
		window.addEventListener('resize', resized);
		document.addEventListener('scroll', reposition, true);
		document.addEventListener('pointerdown', outside);
		window.visualViewport?.addEventListener('resize', resized);
		window.visualViewport?.addEventListener('scroll', reposition);
		return () => {
			mounted = false;
			clearTimeout(timer);
			if (revealFrame !== undefined) cancelAnimationFrame(revealFrame);
			window.removeEventListener('resize', resized);
			document.removeEventListener('scroll', reposition, true);
			document.removeEventListener('pointerdown', outside);
			window.visualViewport?.removeEventListener('resize', resized);
			window.visualViewport?.removeEventListener('scroll', reposition);
		};
	});
	async function revealActive() {
		await tick();
		const option = document.getElementById(`${listId}-${active}`);
		if (!list || !option) return;
		const top = option.offsetTop;
		const bottom = top + option.offsetHeight;
		if (top < list.scrollTop) list.scrollTop = top;
		else if (bottom > list.scrollTop + list.clientHeight)
			list.scrollTop = bottom - list.clientHeight;
	}
	function choose(selected: string) {
		if (disabled || input?.matches(':disabled')) {
			dismissed = true;
			active = -1;
			results = [];
			return;
		}
		input?.focus({ preventScroll: true });
		value = selected;
		dismissed = true;
		active = -1;
		results = [];
		clearTimeout(timer);
		onselect?.(selected);
	}
	function keydown(event: KeyboardEvent) {
		if (disabled || input?.matches(':disabled')) return;
		if (!event.isComposing) {
			if (
				(event.key === 'ArrowDown' || event.key === 'ArrowUp') &&
				!event.ctrlKey &&
				!event.metaKey
			) {
				if (!expanded || query !== value) refresh();
				dismissed = false;
				if (results.length) {
					event.preventDefault();
					active =
						event.key === 'ArrowDown'
							? (active + 1) % results.length
							: (active <= 0 ? results.length : active) - 1;
					void revealActive();
				}
			} else if (event.key === 'Enter' && expanded && active >= 0) {
				const selected = results[active];
				if (selected !== undefined) {
					event.preventDefault();
					choose(selected);
				}
			} else if (event.key === 'Escape') {
				if (expanded) {
					event.preventDefault();
					event.stopPropagation();
				}
				dismissed = true;
				active = -1;
			} else if (event.key === 'Tab') {
				dismissed = true;
				active = -1;
			} else if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) active = -1;
		}
		if (!event.defaultPrevented) onkeydown?.(event);
	}

	function highlight(text: string): { text: string; matched: boolean }[] {
		const fold = (part: string) =>
			part
				.normalize('NFKD')
				.replace(/[\u0300-\u036f]/g, '')
				.toLowerCase();
		const words = fold(query).match(/[a-z0-9+#.]+/g) ?? [];
		if (!words.length) return [{ text, matched: false }];
		let folded = '';
		let offset = 0;
		const positions: { start: number; end: number }[] = [];
		for (const character of text) {
			const part = fold(character);
			for (let index = 0; index < part.length; index++)
				positions.push({ start: offset, end: offset + character.length });
			folded += part;
			offset += character.length;
		}
		const matched = Array.from({ length: text.length }, () => false);
		for (const word of words) {
			let start = folded.indexOf(word);
			while (start >= 0) {
				const from = positions[start]?.start;
				const to = positions[start + word.length - 1]?.end;
				if (from !== undefined && to !== undefined)
					for (let index = from; index < to; index++) matched[index] = true;
				start = folded.indexOf(word, start + word.length);
			}
		}
		const parts: { text: string; matched: boolean }[] = [];
		let start = 0;
		for (let index = 1; index <= text.length; index++) {
			if (index === text.length || matched[index] !== matched[start]) {
				parts.push({ text: text.slice(start, index), matched: matched[start] ?? false });
				start = index;
			}
		}
		return parts;
	}
</script>

<div class="field {className}" bind:this={container}>
	<label id={`${id}-label`} for={id}
		>{label}{#if required}<span class="required" aria-hidden="true"> *</span><span class="sr-only">
				{t('ui.required')}</span
			>{/if}</label
	>
	<div class="input-wrap">
		<input
			{...rest}
			{id}
			type="text"
			{value}
			{required}
			{maxlength}
			{disabled}
			{autocomplete}
			bind:this={input}
			role="combobox"
			aria-autocomplete="list"
			aria-expanded={expanded}
			aria-controls={listId}
			aria-activedescendant={expanded && active >= 0 ? `${listId}-${active}` : undefined}
			aria-describedby={description}
			aria-invalid={error ? true : undefined}
			oninput={(event) => {
				value = event.currentTarget.value;
				dismissed = false;
				results = [];
				active = -1;
				void revealAfterUpdate();
				suppliedInput?.(event);
			}}
			onfocus={(event) => {
				focused = true;
				dismissed = false;
				refresh();
				suppliedFocus?.(event);
			}}
			onblur={(event) => {
				focused = false;
				dismissed = true;
				active = -1;
				suppliedBlur?.(event);
			}}
			onkeydown={keydown}
		/>
		<ul
			id={listId}
			class="suggestions"
			class:above
			role="listbox"
			aria-labelledby={`${id}-label`}
			hidden={!expanded}
			style:max-height={`${listHeight}px`}
			bind:this={list}
		>
			{#each results as result, index (`${index}-${result}`)}
				<li
					id={`${listId}-${index}`}
					role="option"
					aria-selected={active === index}
					tabindex="-1"
					onpointerdown={(event) => event.preventDefault()}
					onclick={() => choose(result)}
					onkeydown={(event) => {
						if (event.key === 'Enter' || event.key === ' ') {
							event.preventDefault();
							choose(result);
						}
					}}
				>
					{#each highlight(result) as part, partIndex (partIndex)}
						{#if part.matched}<strong>{part.text}</strong>{:else}{part.text}{/if}
					{/each}
				</li>
			{/each}
		</ul>
	</div>
	<p id={`${id}-help`} class="sr-only">{t('ui.autocompleteHelp')}</p>
	<p class="sr-only" aria-live="polite" aria-atomic="true">
		{expanded ? t('ui.suggestionCount', { count: results.length }) : ''}
	</p>
	{#if hint}<p id={`${id}-hint`} class="hint">{hint}</p>{/if}
	{#if error}<p id={`${id}-error`} class="error">{error}</p>{/if}
	{#if counterVisible && maxlength != null}<p id={`${id}-count`} class="counter">
			{t('ui.characterCount', { count: value.length, max: maxlength })}
		</p>{/if}
</div>

<style>
	.field {
		display: grid;
		gap: 8px;
		min-width: 0;
	}
	label {
		color: var(--color-text);
		font-size: 0.875rem;
		font-weight: 600;
	}
	.input-wrap {
		position: relative;
		min-width: 0;
	}
	input {
		width: 100%;
		min-width: 0;
		min-height: 48px;
		border: 1px solid var(--color-control-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		padding: 12px;
		color: var(--color-text);
		font-size: 1rem;
		line-height: 1.5;
		transition:
			background-color var(--motion-duration) ease-out,
			border-color var(--motion-duration) ease-out;
	}
	input:hover:not(:disabled):not([aria-invalid='true']) {
		border-color: var(--color-focus);
	}
	input::placeholder {
		color: var(--color-text-muted);
	}
	input[aria-invalid='true'] {
		border-color: var(--color-danger);
	}
	input:disabled {
		background: var(--color-surface-muted);
		cursor: not-allowed;
		opacity: 0.65;
	}
	.suggestions {
		position: absolute;
		z-index: 15;
		top: calc(100% + 4px);
		right: 0;
		left: 0;
		margin: 0;
		padding: 4px;
		overflow-y: auto;
		overscroll-behavior: contain;
		touch-action: pan-y;
		border: 1px solid var(--color-control-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		box-shadow: var(--shadow-card);
		list-style: none;
	}
	.suggestions[hidden] {
		display: none;
	}
	.suggestions.above {
		top: auto;
		bottom: calc(100% + 4px);
	}
	.suggestions li {
		min-height: 44px;
		padding: 10px 12px;
		border-radius: var(--radius-sm);
		color: var(--color-text);
		font-size: 1rem;
		line-height: 1.5;
		overflow-wrap: anywhere;
		cursor: pointer;
	}
	.suggestions li:hover,
	.suggestions li[aria-selected='true'] {
		background: var(--color-mint-50);
		color: var(--color-brand-ink);
	}
	strong {
		font-weight: 700;
	}
	p {
		margin: 0;
		font-size: 0.75rem;
		line-height: 1.5;
	}
	.hint,
	.counter {
		color: var(--color-text-muted);
	}
	.error,
	.required {
		color: var(--color-danger);
	}
	.counter {
		text-align: right;
	}
</style>
