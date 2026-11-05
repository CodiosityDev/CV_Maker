<script lang="ts">
	import { tick } from 'svelte';
	import { LIMITS } from '#lib/core/schema/index.ts';
	import { t } from '#lib/i18n/index.svelte.ts';

	let {
		id,
		items,
		label,
		examples = [],
		onChange
	}: {
		id: string;
		items: string[];
		label: string;
		examples?: string[];
		onChange: (items: string[], operation?: 'edit' | 'structure') => void;
	} = $props();
	let announcement = $state('');
	let full = $derived(items.length >= LIMITS.bulletsPerItem);

	function grow(element: HTMLTextAreaElement, _value: string) {
		let frame: number | undefined;
		let previousWidth: number | undefined;
		function resize() {
			if (!element.clientWidth) return;
			element.style.height = 'auto';
			const style = getComputedStyle(element);
			const border = parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
			element.style.height = `${element.scrollHeight + border}px`;
		}
		function schedule() {
			if (frame !== undefined) cancelAnimationFrame(frame);
			frame = requestAnimationFrame(() => {
				frame = undefined;
				resize();
			});
		}
		const observer = new ResizeObserver(([entry]) => {
			const width = entry?.contentRect.width;
			if (width === undefined || width === previousWidth) return;
			previousWidth = width;
			schedule();
		});
		observer.observe(element);
		schedule();
		return {
			update: schedule,
			destroy() {
				observer.disconnect();
				if (frame !== undefined) cancelAnimationFrame(frame);
			}
		};
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
			if (event.relatedTarget instanceof Node && !element.contains(event.relatedTarget))
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

	async function focus(index: number) {
		await tick();
		const control = document.getElementById(`${id}.${index}`) as HTMLTextAreaElement | null;
		if (control) {
			control.focus();
			control.setSelectionRange(control.value.length, control.value.length);
		} else document.getElementById(`${id}-add`)?.focus();
	}
	async function add(index = items.length, text = '') {
		if (full) {
			announcement = t('wizard.bullets.limit', { count: LIMITS.bulletsPerItem });
			return;
		}
		const next = [...items];
		next.splice(index, 0, text.slice(0, LIMITS.bullet));
		onChange(next, 'structure');
		announcement = '';
		await focus(index);
		announcement = t('wizard.bullets.added', { number: index + 1 });
	}
	async function remove(index: number) {
		onChange(
			items.filter((_, current) => current !== index),
			'structure'
		);
		announcement = '';
		await focus(Math.max(0, index - 1));
		announcement = t('wizard.bullets.removed', { number: index + 1 });
	}
	async function move(index: number, offset: -1 | 1) {
		const destination = index + offset;
		if (destination < 0 || destination >= items.length) return;
		const next = [...items];
		const [selected] = next.splice(index, 1);
		next.splice(destination, 0, selected ?? '');
		onChange(next, 'structure');
		announcement = '';
		await focus(destination);
		announcement = t('wizard.bullets.moved', { from: index + 1, to: destination + 1 });
	}
	function keydown(event: KeyboardEvent, index: number) {
		if (event.isComposing) return;
		if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
			event.preventDefault();
			void move(index, event.key === 'ArrowUp' ? -1 : 1);
			return;
		}
		const control = event.currentTarget as HTMLTextAreaElement;
		if (event.key === 'Backspace' && !control.value.trim()) {
			event.preventDefault();
			void remove(index);
		} else if (
			event.key === 'Enter' &&
			!event.shiftKey &&
			!event.ctrlKey &&
			!event.metaKey &&
			control.selectionStart === control.value.length &&
			control.selectionEnd === control.value.length
		) {
			event.preventDefault();
			void add(index + 1);
		}
	}
	async function paste(event: ClipboardEvent, index: number) {
		const text = event.clipboardData?.getData('text/plain');
		if (!text) return;
		const marker = /^\s*(?:[•*-]\s*|\d+[.)]\s*|[a-zA-Z][.)]\s*)/;
		if (!/[\r\n]/.test(text) && !marker.test(text)) return;
		event.preventDefault();
		const control = event.currentTarget as HTMLTextAreaElement;
		const lines = text
			.split(/\r\n|\r|\n/)
			.map((line) => line.replace(marker, '').trim())
			.filter(Boolean);
		if (!lines.length) return;
		lines[0] = control.value.slice(0, control.selectionStart) + (lines[0] ?? '');
		lines[lines.length - 1] += control.value.slice(control.selectionEnd);
		const capacity = LIMITS.bulletsPerItem - items.length + 1;
		const limited = lines.length > capacity || lines.some((line) => line.length > LIMITS.bullet);
		const inserted = lines.slice(0, capacity).map((line) => line.slice(0, LIMITS.bullet));
		const next = [...items];
		next.splice(index, 1, ...inserted);
		onChange(next, 'structure');
		announcement = '';
		await focus(index + inserted.length - 1);
		announcement = limited
			? t('wizard.bullets.pasteLimited', { count: LIMITS.bulletsPerItem })
			: t('wizard.bullets.added', { number: index + inserted.length });
	}
</script>

<fieldset class="bullets" aria-describedby={`${id}-help`}>
	<legend>{label}</legend>
	<p id={`${id}-help`} class="sr-only">{t('wizard.bullets.help')}</p>
	{#if !items.length}<p class="empty">{t('wizard.bullets.empty')}</p>{/if}
	<ol>
		{#each items as value, index (index)}
			<li class="bullet-row">
				<span class="marker" aria-hidden="true">•</span>
				<div class="bullet-field">
					<textarea
						id={`${id}.${index}`}
						aria-label={t('wizard.bullets.point', { number: index + 1 })}
						aria-describedby={`${id}-help${value.length >= LIMITS.bullet * 0.8 ? ` ${id}.${index}-count` : ''}`}
						rows="1"
						maxlength={LIMITS.bullet}
						{value}
						use:grow={value}
						oninput={(event) =>
							onChange(
								items.map((entry, at) => (at === index ? event.currentTarget.value : entry)),
								'edit'
							)}
						onkeydown={(event) => keydown(event, index)}
						onpaste={(event) => void paste(event, index)}></textarea>
					{#if value.length >= LIMITS.bullet * 0.8}<p id={`${id}.${index}-count`} class="counter">
							{t('ui.characterCount', { count: value.length, max: LIMITS.bullet })}
						</p>{/if}
				</div>
				<details class="point-menu" use:dismissMenu>
					<summary aria-label={t('wizard.bullets.actions', { number: index + 1 })}>⋯</summary>
					<div class="menu-options">
						<button
							type="button"
							disabled={index === 0}
							onclick={(event) => {
								event.currentTarget.closest('details')?.removeAttribute('open');
								void move(index, -1);
							}}>{t('wizard.bullets.moveUp')}</button
						>
						<button
							type="button"
							disabled={index === items.length - 1}
							onclick={(event) => {
								event.currentTarget.closest('details')?.removeAttribute('open');
								void move(index, 1);
							}}>{t('wizard.bullets.moveDown')}</button
						>
						<button
							type="button"
							class="menu-delete"
							aria-label={t('wizard.bullets.remove', { number: index + 1 })}
							onclick={(event) => {
								event.currentTarget.closest('details')?.removeAttribute('open');
								void remove(index);
							}}>{t('common.delete')}</button
						>
					</div>
				</details>
				<button
					type="button"
					class="remove-point"
					aria-label={t('wizard.bullets.remove', { number: index + 1 })}
					onclick={() => void remove(index)}>×</button
				>
			</li>
		{/each}
	</ol>
	<div class="add-row">
		<button
			type="button"
			id={`${id}-add`}
			class="add-point"
			disabled={full}
			onclick={() => void add()}>{t('wizard.bullets.add')}</button
		>
		{#if full}<p class="limit">
				{t('wizard.bullets.limit', { count: LIMITS.bulletsPerItem })}
			</p>{/if}
	</div>
	{#if examples.length}
		<details class="bullet-examples">
			<summary>{t('wizard.bullets.examples')}</summary>
			<ul class="examples">
				{#each examples as example, index (index)}<li>
						<button
							type="button"
							class="example-chip"
							disabled={full}
							onclick={() => void add(items.length, example)}>{example}</button
						>
					</li>{/each}
			</ul>
		</details>
	{/if}
	<p class="sr-only" aria-live="polite" aria-atomic="true">{announcement}</p>
</fieldset>

<style>
	.bullets {
		min-width: 0;
		margin: 0;
		padding: 0;
		border: 0;
	}
	legend {
		margin-bottom: 0.625rem;
		padding: 0;
		font-size: 0.875rem;
		font-weight: 600;
	}
	ol,
	.examples {
		display: grid;
		gap: 0.5rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.bullet-row {
		display: grid;
		grid-template-columns: 0.5rem minmax(0, 1fr) 44px 44px;
		align-items: start;
		gap: 0.25rem;
		min-width: 0;
	}
	.marker {
		padding-top: 0.625rem;
		color: var(--color-brand-ink);
		line-height: 1.5;
	}
	.bullet-field {
		min-width: 0;
	}
	textarea {
		display: block;
		box-sizing: border-box;
		width: 100%;
		min-height: 44px;
		border: 1px solid var(--color-control-border);
		border-radius: var(--radius-md);
		padding: 0.5625rem 0.625rem;
		background: var(--color-surface);
		color: var(--color-text);
		font: inherit;
		font-size: 1rem;
		line-height: 1.5;
		resize: none;
		overflow-y: hidden;
	}
	button,
	.point-menu > summary {
		box-sizing: border-box;
		min-width: 44px;
		min-height: 44px;
		border: 0;
		border-radius: var(--radius-md);
		background: transparent;
		color: var(--color-brand-ink);
		font: inherit;
		font-weight: 600;
		cursor: pointer;
	}
	button:hover:not(:disabled),
	.point-menu > summary:hover {
		background: var(--color-brand-50);
	}
	button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.remove-point {
		font-size: 1.5rem;
	}
	.menu-delete {
		display: none;
	}
	.point-menu {
		position: relative;
	}
	.point-menu > summary {
		display: grid;
		place-items: center;
		list-style: none;
		font-size: 1.25rem;
	}
	.point-menu > summary::-webkit-details-marker {
		display: none;
	}
	.menu-options {
		position: absolute;
		z-index: 5;
		top: calc(100% + 0.25rem);
		right: 0;
		display: grid;
		min-width: 8rem;
		padding: 0.25rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		box-shadow: var(--shadow-card);
	}
	.menu-options button {
		padding: 0.5rem 0.75rem;
		text-align: left;
		white-space: nowrap;
	}
	.add-row {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-top: 0.5rem;
	}
	.add-point {
		padding: 0.5rem 0.75rem;
		background: var(--color-brand-50);
	}
	.empty,
	.limit {
		margin: 0;
		color: var(--color-text-muted);
		font-size: 0.875rem;
		line-height: 1.5;
	}
	.counter {
		margin: 0.25rem 0 0;
		color: var(--color-text-muted);
		font-size: 0.75rem;
		text-align: right;
	}
	.bullet-examples {
		margin-top: 0.5rem;
	}
	.bullet-examples > summary {
		min-height: 44px;
		padding: 0.625rem 0;
		color: var(--color-brand-ink);
		font-size: 0.875rem;
		cursor: pointer;
	}
	.example-chip {
		width: 100%;
		padding: 0.625rem 0.75rem;
		border-radius: var(--radius-md);
		background: var(--color-mint-50);
		font-size: 0.875rem;
		font-weight: 400;
		line-height: 1.5;
		text-align: left;
		overflow-wrap: anywhere;
	}
	@media (max-width: 767px) {
		.bullet-row {
			grid-template-columns: 0.5rem minmax(0, 1fr);
			row-gap: 0;
		}
		.marker,
		.bullet-field {
			grid-row: 1;
		}
		.point-menu {
			grid-column: 2;
			grid-row: 2;
			justify-self: end;
		}
		.remove-point {
			display: none;
		}
		.menu-delete {
			display: block;
		}
	}
	@media (max-width: 480px) {
		.bullets {
			margin-inline: -26px;
		}
		.bullet-row {
			position: relative;
			grid-template-columns: minmax(0, 1fr);
		}
		.marker {
			position: absolute;
			top: 0;
			left: -8px;
		}
		.bullet-field,
		.point-menu {
			grid-column: 1;
		}
		legend {
			padding-inline: 26px;
		}
		.add-row,
		.bullet-examples {
			padding-inline: 26px;
		}
	}
</style>
