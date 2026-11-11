import { untrack } from 'svelte';
import {
	applyInline,
	canEditInline,
	editKey,
	inlineCoalesceKey,
	inlineLimit,
	inlineMultiline,
	insertBulletAfter,
	parseEditKey,
	readInline,
	removeBullet,
	type EditTarget
} from '#lib/core/design/index.ts';
import { incognito } from '#lib/core/storage/index.ts';
import { LIMITS } from '#lib/core/schema/limits.ts';
import type { CvStore } from '#lib/core/store/cv-store.svelte.ts';
import type { SectionKey } from '#lib/core/schema/types.ts';
import { t } from '#lib/i18n/index.svelte.ts';
import { formTargetFromElement } from './visual-form-target.ts';

interface Session {
	element: HTMLElement;
	target: EditTarget;
	key: string;
	signature: string;
	written: boolean;
	composing: boolean;
	coalesceKey: string;
	lastText: string;
}
let focusSequence = 0;
interface Options {
	store: CvStore;
	instruction: string;
	onstate: (editing: boolean) => void;
	onmessage: (message: string) => void;
	refresh: (key?: string, activate?: boolean) => void;
	onformrequest: (
		field: string,
		section?: SectionKey | 'personal' | 'target'
	) => void | Promise<void>;
}

/** Owns only the focused DOM text. Svelte receives a new model after the session ends. */
export function createVisualInline(options: Options) {
	const { store } = options;
	const openedId = store.cv.id;
	const openedMode = incognito.active;
	let surface: HTMLElement | undefined;
	let session: Session | undefined;
	let alive = true;
	let skipFocus = false;
	const signature = () => JSON.stringify(store.cv);
	const safe = () =>
		alive &&
		Boolean(surface?.isConnected) &&
		store.cv.id === openedId &&
		store.cv.kind === 'creative' &&
		store.externalChange === 'none' &&
		incognito.active === openedMode &&
		!(incognito.active && incognito.expiredAt);
	const nodeFor = (key: string) =>
		Array.from(surface?.querySelectorAll<HTMLElement>('[data-edit]') ?? []).find(
			(node) => node.dataset.edit === key
		);
	const titleFor = (node: HTMLElement) =>
		node.closest('[data-visual-section]')?.querySelector('h2')?.textContent?.trim() ?? '';
	function label(node: HTMLElement, target: EditTarget) {
		if (target.kind === 'bullet')
			return t('visualEditor.editBullet', { number: target.index + 1, section: titleFor(node) });
		if (target.kind === 'sectionTitle')
			return t('visualEditor.editSection', { section: node.textContent ?? '' });
		const field =
			target.kind === 'summary'
				? t('visualEditor.fieldSummary')
				: target.kind === 'personal'
					? t(target.field === 'fullName' ? 'visualEditor.fieldName' : 'visualEditor.fieldHeadline')
					: t(
							target.field === 'title'
								? 'visualEditor.fieldTitle'
								: target.field === 'subtitle'
									? 'visualEditor.fieldSubtitle'
									: target.field === 'location'
										? 'visualEditor.fieldLocation'
										: 'visualEditor.fieldDescription'
						);
		return t('visualEditor.editText', { field });
	}
	function decorate() {
		if (!surface || !alive) return;
		for (const node of surface.querySelectorAll<HTMLElement>('[data-edit]')) {
			const target = parseEditKey(node.dataset.edit);
			if (!target || !canEditInline(store.cv, target)) continue;
			node.tabIndex = 0;
			node.setAttribute('role', 'textbox');
			node.setAttribute('aria-label', label(node, target));
			node.setAttribute('aria-multiline', String(inlineMultiline(target)));
			node.setAttribute('aria-describedby', options.instruction);
			node.setAttribute('aria-readonly', String(session?.element !== node));
			if (session?.element !== node) node.contentEditable = 'false';
		}
		for (const node of surface.querySelectorAll<HTMLElement>('[data-form-field]')) {
			node.tabIndex = 0;
			node.setAttribute('role', 'button');
			node.setAttribute(
				'aria-label',
				t('visualEditor.openForm', { field: (node.textContent ?? '').trim().slice(0, 70) })
			);
			for (const link of node.querySelectorAll<HTMLAnchorElement>('a')) {
				link.tabIndex = -1;
				link.setAttribute('aria-hidden', 'true');
			}
		}
	}
	function focus(key: string, activate = true) {
		const node = nodeFor(key);
		if (!node || !safe()) return;
		skipFocus = !activate;
		node.focus({ preventScroll: true });
		skipFocus = false;
		if (activate) {
			start(node);
			const selection = window.getSelection();
			const range = document.createRange();
			range.selectNodeContents(node);
			range.collapse(false);
			selection?.removeAllRanges();
			selection?.addRange(range);
		}
	}
	function finish(cancel = false, refocus = false) {
		const current = session;
		if (!current) return;
		if (!cancel) flushComposition();
		session = undefined;
		current.element.contentEditable = 'false';
		current.element.setAttribute('aria-readonly', 'true');
		if (cancel && current.written && safe() && signature() === current.signature) store.undo();
		// Removing a focused template can fire blur inside Svelte's render block.
		// This imperative focus callback must not inherit that render reaction.
		untrack(() => options.onstate(false));
		options.refresh(refocus ? current.key : undefined, false);
	}
	function start(node: HTMLElement) {
		if (session?.element === node || !safe()) return;
		const target = parseEditKey(node.dataset.edit);
		if (!target || !canEditInline(store.cv, target)) return;
		finish();
		session = {
			element: node,
			target,
			key: editKey(target),
			signature: signature(),
			written: false,
			composing: false,
			lastText: node.textContent ?? '',
			coalesceKey: `${inlineCoalesceKey(target)}:focus:${++focusSequence}`
		};
		try {
			node.contentEditable = 'plaintext-only';
		} catch {
			node.contentEditable = 'true';
		}
		if (node.contentEditable !== 'plaintext-only') node.contentEditable = 'true';
		node.setAttribute('aria-readonly', 'false');
		node.focus({ preventScroll: true });
		options.onstate(true);
		options.onmessage(t('visualEditor.limit', { limit: inlineLimit(target) }));
	}
	function currentSession() {
		if (!session) return;
		if (!safe() || signature() !== session.signature) {
			finish();
			return;
		}
		return session;
	}
	function write() {
		const current = currentSession();
		if (!current || current.composing) return;
		const value = current.element.textContent ?? '';
		// A default section heading is displayed text, while its stored override is empty.
		// Merely focusing and leaving it must not create a custom title or an undo step.
		if (value === current.lastText) return;
		current.lastText = value;
		if (readInline(store.cv, current.target) === value) return;
		// Later keystrokes share the first snapshot even when the user pauses for more than 1s.
		store.update((draft) => applyInline(draft, current.target, value), {
			coalesceKey: current.coalesceKey,
			skipHistory: current.written
		});
		current.written = true;
		current.signature = signature();
	}
	function flushComposition() {
		if (!session || !safe() || signature() !== session.signature) return;
		session.composing = false;
		write();
	}
	function selectedLength(element: HTMLElement) {
		const selection = window.getSelection();
		return selection?.rangeCount &&
			element.contains(selection.anchorNode) &&
			element.contains(selection.focusNode)
			? selection.toString().length
			: 0;
	}
	function insert(value: string) {
		const current = currentSession();
		if (!current) return;
		const multiline = inlineMultiline(current.target);
		const plain = value
			.replace(/\r\n?/g, '\n')
			.replace(/\p{Cc}/gu, (character) =>
				character === '\n' || character === '\t' ? character : ''
			);
		const text = multiline ? plain : plain.replace(/\n+/g, ' ');
		const room = Math.max(
			0,
			inlineLimit(current.target) -
				(current.element.textContent ?? '').length +
				selectedLength(current.element)
		);
		let clipped = text.slice(0, room);
		if (/[\uD800-\uDBFF]$/.test(clipped)) clipped = clipped.slice(0, -1);
		const selection = window.getSelection();
		let range = selection?.rangeCount ? selection.getRangeAt(0) : undefined;
		if (!range || !current.element.contains(range.commonAncestorContainer)) {
			range = document.createRange();
			range.selectNodeContents(current.element);
			range.collapse(false);
		}
		range.deleteContents();
		const node = document.createTextNode(clipped);
		range.insertNode(node);
		range.setStartAfter(node);
		range.collapse(true);
		selection?.removeAllRanges();
		selection?.addRange(range);
		write();
	}
	function bullet(change: 'insert' | 'remove') {
		const current = currentSession();
		if (!current || current.target.kind !== 'bullet') return;
		const target = current.target;
		if (
			change === 'insert' &&
			current.element.parentElement &&
			current.element.parentElement.children.length >= LIMITS.bulletsPerItem
		) {
			options.onmessage(t('visualEditor.bulletLimit', { limit: LIMITS.bulletsPerItem }));
			return;
		}
		write();
		finish();
		let index: number | undefined;
		store.update((draft) => {
			index =
				change === 'insert'
					? insertBulletAfter(draft, target.section, target.id, target.index)
					: removeBullet(draft, target.section, target.id, target.index);
		});
		if (index === undefined && change === 'insert')
			options.onmessage(t('visualEditor.bulletLimit', { limit: LIMITS.bulletsPerItem }));
		const next: EditTarget =
			index === undefined
				? { kind: 'entry', section: target.section, id: target.id, field: 'title' }
				: { ...target, index };
		options.refresh(editKey(next), true);
	}
	function activateFrom(event: Event) {
		const node =
			event.target instanceof Element ? event.target.closest<HTMLElement>('[data-edit]') : null;
		if (node && surface?.contains(node)) start(node);
	}
	function form(node: HTMLElement) {
		finish();
		if (!safe()) return;
		const target = formTargetFromElement(node, store.cv);
		if (target) void options.onformrequest(target.field, target.section);
	}
	function keydown(event: KeyboardEvent) {
		const node =
			event.target instanceof Element
				? event.target.closest<HTMLElement>('[data-edit], [data-form-field]')
				: null;
		if (!node) return;
		if (node.hasAttribute('data-form-field')) {
			if (event.key === 'Enter' || event.key === ' ') {
				event.preventDefault();
				form(node);
			}
			return;
		}
		if ((event.ctrlKey || event.metaKey) && ['z', 'y'].includes(event.key.toLowerCase())) {
			event.preventDefault();
			event.stopPropagation();
			finish();
			if (event.key.toLowerCase() === 'y' || event.shiftKey) store.redo();
			else store.undo();
			options.refresh(node.dataset.edit, false);
			return;
		}
		if (event.isComposing || session?.composing) return;
		if (event.key === 'Escape' && session) {
			event.preventDefault();
			event.stopPropagation();
			finish(true, true);
			return;
		}
		if (event.key === 'Enter') {
			event.preventDefault();
			if (!session) start(node);
			else if (session.target.kind === 'bullet') bullet('insert');
			else if (inlineMultiline(session.target)) insert('\n');
			else finish(false, true);
		} else if (
			event.key === 'Backspace' &&
			session?.target.kind === 'bullet' &&
			!(node.textContent ?? '').trim()
		) {
			event.preventDefault();
			bullet('remove');
		}
	}
	function beforeinput(event: InputEvent) {
		const current = currentSession();
		if (!current || current.composing || event.isComposing) return;
		if (
			event.inputType === 'deleteContentBackward' &&
			current.target.kind === 'bullet' &&
			!(current.element.textContent ?? '').trim()
		) {
			event.preventDefault();
			bullet('remove');
			return;
		}
		if (event.inputType === 'insertParagraph' || event.inputType === 'insertLineBreak') {
			event.preventDefault();
			if (current.target.kind === 'bullet') bullet('insert');
			else if (inlineMultiline(current.target)) insert('\n');
			else finish(false, true);
		} else if (event.data && !inlineMultiline(current.target) && /[\r\n]/.test(event.data)) {
			event.preventDefault();
			insert(event.data);
		} else if (
			event.inputType.startsWith('insert') &&
			event.data &&
			(current.element.textContent ?? '').length -
				selectedLength(current.element) +
				event.data.length >
				inlineLimit(current.target)
		) {
			event.preventDefault();
			insert(event.data);
		}
	}
	function paste(event: ClipboardEvent) {
		event.preventDefault();
		insert(event.clipboardData?.getData('text/plain') ?? '');
	}
	function drop(event: DragEvent) {
		event.preventDefault();
		activateFrom(event);
		insert(event.dataTransfer?.getData('text/plain') ?? '');
	}
	function focusin(event: FocusEvent) {
		if (skipFocus) skipFocus = false;
		else activateFrom(event);
	}
	function focusout(event: FocusEvent) {
		if (
			session &&
			!(event.relatedTarget instanceof Node && session.element.contains(event.relatedTarget))
		)
			finish();
	}
	function pointerdown(event: PointerEvent) {
		if (event.button !== 0 || !event.isPrimary) return;
		const node =
			event.target instanceof Element
				? event.target.closest<HTMLElement>('[data-form-field]')
				: null;
		if (!node) {
			// Touch browsers can separate blur and focus into different event tasks.
			// Claim the next inline field before releasing the previous text island.
			activateFrom(event);
			return;
		}
		// Resolve the form target before blur releases and rebuilds the text island.
		event.preventDefault();
		form(node);
	}
	function click(event: MouseEvent) {
		const node =
			event.target instanceof Element
				? event.target.closest<HTMLElement>('[data-form-field]')
				: null;
		if (event.target instanceof Element && event.target.closest('a[href]')) event.preventDefault();
		if (node) {
			event.preventDefault();
			form(node);
		} else activateFrom(event);
	}
	function compositionstart() {
		if (session) session.composing = true;
	}
	function compositionend() {
		if (!session) return;
		session.composing = false;
		if ((session.element.textContent ?? '').length > inlineLimit(session.target)) {
			session.element.textContent = (session.element.textContent ?? '').slice(
				0,
				inlineLimit(session.target)
			);
		}
		write();
	}
	function visibility() {
		if (document.hidden) flushComposition();
	}
	return {
		get active() {
			return Boolean(session);
		},
		get signature() {
			return session?.signature;
		},
		decorate,
		focus,
		finish,
		attach(node: HTMLElement) {
			surface = node;
			document.addEventListener('visibilitychange', visibility, true);
			window.addEventListener('pagehide', flushComposition, true);
			node.addEventListener('focusin', focusin);
			node.addEventListener('focusout', focusout);
			node.addEventListener('click', click);
			node.addEventListener('pointerdown', pointerdown);
			node.addEventListener('keydown', keydown);
			node.addEventListener('beforeinput', beforeinput);
			node.addEventListener('input', write);
			node.addEventListener('paste', paste);
			node.addEventListener('drop', drop);
			node.addEventListener('compositionstart', compositionstart);
			node.addEventListener('compositionend', compositionend);
			decorate();
			return {
				destroy() {
					alive = false;
					session = undefined;
					document.removeEventListener('visibilitychange', visibility, true);
					window.removeEventListener('pagehide', flushComposition, true);
					node.removeEventListener('focusin', focusin);
					node.removeEventListener('focusout', focusout);
					node.removeEventListener('click', click);
					node.removeEventListener('pointerdown', pointerdown);
					node.removeEventListener('keydown', keydown);
					node.removeEventListener('beforeinput', beforeinput);
					node.removeEventListener('input', write);
					node.removeEventListener('paste', paste);
					node.removeEventListener('drop', drop);
					node.removeEventListener('compositionstart', compositionstart);
					node.removeEventListener('compositionend', compositionend);
					surface = undefined;
				}
			};
		}
	};
}
