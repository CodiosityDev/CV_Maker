<script module lang="ts">
	let modalCount = 0;
	let previousOverflow = '';

	function lockScroll() {
		if (modalCount === 0) {
			previousOverflow = document.documentElement.style.overflow;
			document.documentElement.style.overflow = 'hidden';
		}
		modalCount += 1;
	}

	function unlockScroll() {
		modalCount = Math.max(0, modalCount - 1);
		if (modalCount === 0) document.documentElement.style.overflow = previousOverflow;
	}
</script>

<script lang="ts">
	import { onDestroy, type Snippet } from 'svelte';
	import { t } from '#lib/i18n/index.svelte.ts';

	interface Props {
		open?: boolean;
		title?: string;
		description?: string;
		children?: Snippet;
		footer?: Snippet;
		disabled?: boolean;
		closeOnBackdrop?: boolean;
		presentation?: 'dialog' | 'sheet';
		class?: string;
	}

	let {
		open = $bindable(false),
		title,
		description,
		children,
		footer,
		disabled = false,
		closeOnBackdrop = false,
		presentation = 'dialog',
		class: className = ''
	}: Props = $props();

	const uid = $props.id();
	let dialog = $state<HTMLDialogElement>();
	let trigger: HTMLElement | null = null;
	let scrollLocked = false;

	$effect(() => {
		if (!dialog?.isConnected) return;
		if (open && !dialog.open) {
			trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
			if (!scrollLocked) {
				lockScroll();
				scrollLocked = true;
			}
			dialog.showModal();
		} else if (!open && dialog.open) {
			dialog.close();
		}
	});

	function close() {
		open = false;
		dialog?.close();
	}

	function closed() {
		if (dialog?.open) return;
		open = false;
		if (scrollLocked) {
			unlockScroll();
			scrollLocked = false;
		}
		const active = document.activeElement;
		if (
			trigger?.isConnected &&
			(!active || active === document.body || active === dialog || dialog?.contains(active))
		) {
			trigger.focus();
		}
		trigger = null;
	}

	function backdrop(event: MouseEvent) {
		if (!closeOnBackdrop || event.target !== dialog || !dialog) return;
		const bounds = dialog.getBoundingClientRect();
		if (
			event.clientX < bounds.left ||
			event.clientX > bounds.right ||
			event.clientY < bounds.top ||
			event.clientY > bounds.bottom
		) {
			close();
		}
	}

	function containFocus(event: KeyboardEvent) {
		if (event.key !== 'Tab' || !dialog) return;
		const controls = Array.from(
			dialog.querySelectorAll<HTMLElement>(
				'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]'
			)
		).filter(
			(control) =>
				control.tabIndex >= 0 &&
				!control.matches(':disabled') &&
				control.getClientRects().length > 0 &&
				getComputedStyle(control).visibility !== 'hidden'
		);
		const first = controls[0];
		const last = controls.at(-1);
		if (!first || !last) return;
		if (event.shiftKey && document.activeElement === first) {
			event.preventDefault();
			last.focus();
		} else if (!event.shiftKey && document.activeElement === last) {
			event.preventDefault();
			first.focus();
		}
	}

	onDestroy(() => {
		if (dialog?.open) dialog.close();
		if (scrollLocked) {
			unlockScroll();
			scrollLocked = false;
		}
		if (trigger?.isConnected) trigger.focus();
	});
</script>

<dialog
	bind:this={dialog}
	class="ui-dialog {presentation === 'sheet' ? 'ui-sheet' : ''} {className}"
	aria-labelledby="{uid}-title"
	aria-describedby={description ? `${uid}-description` : undefined}
	oncancel={close}
	onclose={closed}
	onclick={backdrop}
	onkeydown={containFocus}
>
	<div class="dialog-heading">
		<h2 id="{uid}-title">{title ?? t('ui.dialogTitle')}</h2>
		<button type="button" class="close-button" onclick={close} aria-label={t('ui.close')}>
			<svg
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="1.75"
				aria-hidden="true"
			>
				<path d="m6 6 12 12M18 6 6 18" />
			</svg>
		</button>
	</div>
	{#if description}<p id="{uid}-description" class="dialog-description">{description}</p>{/if}
	<fieldset class="dialog-body" {disabled}>
		{@render children?.()}
	</fieldset>
	{#if footer}
		<fieldset class="dialog-footer" {disabled}>{@render footer()}</fieldset>
	{/if}
</dialog>

<style>
	.ui-dialog {
		width: min(36rem, calc(100% - 2rem));
		max-width: none;
		max-height: calc(100vh - 2rem);
		max-height: calc(100dvh - 2rem);
		margin: auto;
		padding: 1.5rem;
		overflow-y: auto;
		overscroll-behavior: contain;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
		color: var(--color-text);
		box-shadow: var(--shadow-dialog);
	}
	.ui-dialog[open] {
		animation: appear 180ms ease-out;
	}
	.ui-dialog::backdrop {
		background: var(--color-backdrop);
	}
	.dialog-heading {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
	}
	h2 {
		margin: 0;
		padding-top: 0.5rem;
		font-size: 1.25rem;
		font-weight: 700;
		line-height: 1.5;
		overflow-wrap: anywhere;
	}
	.close-button {
		display: grid;
		width: 44px;
		min-width: 44px;
		height: 44px;
		place-items: center;
		border: 0;
		border-radius: var(--radius-sm);
		background: var(--color-brand-50);
		color: var(--color-brand-ink);
		cursor: pointer;
		transition:
			background-color var(--motion-duration) ease-out,
			color var(--motion-duration) ease-out;
	}
	.close-button:hover {
		background: var(--color-brand-100);
	}
	svg {
		width: 20px;
		height: 20px;
	}
	.dialog-description {
		margin: 1rem 0 0;
		color: var(--color-text-muted);
		line-height: 1.7;
	}
	.dialog-body,
	.dialog-footer {
		min-width: 0;
		margin: 1.5rem 0 0;
		padding: 0;
		border: 0;
	}
	.dialog-footer {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: 0.75rem;
		padding-top: 1.25rem;
		border-top: 1px solid var(--color-border);
	}
	@keyframes appear {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
	@media (max-width: 767px) {
		.ui-sheet {
			width: 100%;
			max-height: calc(100vh - 1rem);
			max-height: calc(100dvh - 1rem);
			margin: auto 0 0;
			padding-bottom: max(1.5rem, env(safe-area-inset-bottom));
			border-radius: var(--radius-lg) var(--radius-lg) 0 0;
		}
		.ui-sheet[open] {
			animation-name: slide-up;
		}
		@keyframes slide-up {
			from {
				opacity: 0;
				transform: translateY(100%);
			}
			to {
				opacity: 1;
				transform: translateY(0);
			}
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.ui-dialog[open] {
			animation: none;
		}
	}
</style>
