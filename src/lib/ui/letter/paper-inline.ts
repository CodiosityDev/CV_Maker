import { untrack } from 'svelte';
import {
	applyTextEdit,
	findLetter,
	letterBlockSource,
	letterCoalesceKey,
	letterForeignMatcher,
	LETTER_LIMITS,
	marksAt,
	resolveRuns,
	richToPlain,
	toggleMark,
	updateLetter,
	type LetterTextKey,
	type RichMark,
	type RichMarks,
	type RichRun
} from '#lib/core/letter/index.ts';
import { incognito } from '#lib/core/storage/index.ts';
import type { CvStore } from '#lib/core/store/cv-store.svelte.ts';

export interface PaperSelection {
	key: LetterTextKey;
	start: number;
	end: number;
	marks: RichMarks;
}
interface Paragraph {
	key: LetterTextKey;
	runs: RichRun[];
	fillers: string[];
}
interface Session {
	key: LetterTextKey;
	element: HTMLElement;
	signature: string;
	coalesceKey: string;
	written: boolean;
	composing: boolean;
	range?: { start: number; end: number };
	matcher: ReturnType<typeof letterForeignMatcher>;
	reported?: { signature: string; start: number; end: number };
}
interface Options {
	store: CvStore;
	letterId: string;
	onselection: (selection: PaperSelection | undefined) => void;
	onediting: (editing: boolean) => void;
	onlimit: () => void;
}
let sequence = 0;

function offsets(element: HTMLElement): { start: number; end: number } | undefined {
	const selection = window.getSelection();
	if (!selection?.rangeCount) return;
	const range = selection.getRangeAt(0);
	if (!element.contains(range.startContainer) || !element.contains(range.endContainer)) return;
	const prefix = document.createRange();
	prefix.selectNodeContents(element);
	prefix.setEnd(range.startContainer, range.startOffset);
	const start = prefix.toString().length;
	return { start, end: start + range.toString().length };
}

function restore(element: HTMLElement, start: number, end: number): void {
	const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
	let node = walker.nextNode();
	let at = 0;
	let first: { node: Node; offset: number } | undefined;
	let last: { node: Node; offset: number } | undefined;
	let tail: Node | undefined;
	while (node) {
		const length = node.textContent?.length ?? 0;
		if (!first && start <= at + length) first = { node, offset: Math.max(0, start - at) };
		if (!last && end <= at + length) last = { node, offset: Math.max(0, end - at) };
		at += length;
		tail = node;
		node = walker.nextNode();
	}
	if (!tail) {
		tail = document.createTextNode('');
		element.append(tail);
	}
	first ??= { node: tail, offset: tail.textContent?.length ?? 0 };
	last ??= { node: tail, offset: tail.textContent?.length ?? 0 };
	const range = document.createRange();
	range.setStart(first.node, first.offset);
	range.setEnd(last.node, last.offset);
	const selection = window.getSelection();
	selection?.removeAllRanges();
	selection?.addRange(range);
}

/** Plain text ranges only; strings are never interpreted as markup. */
function fillerRanges(text: string, fillers: string[]): { start: number; end: number }[] {
	if (!fillers.length) return [];
	const alternatives = [...fillers]
		.filter(Boolean)
		.sort((a, b) => b.length - a.length)
		.map((filler) =>
			filler
				.split(/\s+/)
				.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
				.join('[^\\p{L}\\p{N}-]+')
		);
	if (!alternatives.length) return [];
	const pattern = new RegExp(alternatives.join('|'), 'giu');
	return Array.from(text.matchAll(pattern)).flatMap((match) => {
		const start = match.index;
		const end = start + match[0].length;
		return /[\p{L}\p{N}-]/u.test(text[start - 1] ?? '') || /[\p{L}\p{N}-]/u.test(text[end] ?? '')
			? []
			: [{ start, end }];
	});
}

function paint(element: HTMLElement, paragraph: Paragraph, plain: string): void {
	const selected = offsets(element);
	const fragment = document.createDocumentFragment();
	const ranges = fillerRanges(plain, paragraph.fillers);
	let offset = 0;
	for (const run of paragraph.runs) {
		const boundaries = new Set([0, run.text.length]);
		for (const range of ranges) {
			if (range.start > offset && range.start < offset + run.text.length)
				boundaries.add(range.start - offset);
			if (range.end > offset && range.end < offset + run.text.length)
				boundaries.add(range.end - offset);
		}
		const points = Array.from(boundaries).sort((a, b) => a - b);
		for (let i = 1; i < points.length; i++) {
			const from = points[i - 1]!;
			const to = points[i]!;
			const highlighted = ranges.some(
				(range) => range.start <= offset + from && range.end > offset + from
			);
			let node: Node = document.createTextNode(run.text.slice(from, to));
			for (const tag of [run.underline && 'u', run.italic && 'em', run.bold && 'strong']) {
				if (!tag) continue;
				const wrapper = document.createElement(tag);
				wrapper.append(node);
				node = wrapper;
			}
			if (highlighted) {
				const mark = document.createElement('span');
				mark.className = 'letter-filler';
				mark.append(node);
				node = mark;
			}
			fragment.append(node);
		}
		offset += run.text.length;
	}
	element.replaceChildren(fragment);
	if (selected) restore(element, selected.start, selected.end);
}

/** Each editable paragraph owns its DOM; Svelte never caches text nodes inside it. */
export function createPaperInline(options: Options) {
	const { store, letterId } = options;
	const openedId = store.cv.id;
	const openedMode = incognito.active;
	const paragraphs = new Map<HTMLElement, Paragraph>();
	const rendered = new WeakMap<HTMLElement, string>();
	let surface: HTMLElement | undefined;
	let session: Session | undefined;
	let alive = true;
	const signature = () => JSON.stringify(store.cv);
	const safe = () =>
		alive &&
		store.cv.id === openedId &&
		store.externalChange === 'none' &&
		incognito.active === openedMode &&
		!(incognito.active && incognito.expiredAt) &&
		Boolean(findLetter(store.cv, letterId));
	function render(node: HTMLElement, paragraph: Paragraph, force = false) {
		const next = JSON.stringify([paragraph.runs, paragraph.fillers]);
		const plain = richToPlain(paragraph.runs);
		// Native typing can alter the DOM independently of the last model, including during
		// conflict invalidation. Always restore it when its plain text differs from the model.
		if (!force && rendered.get(node) === next && node.textContent === plain) return;
		paint(node, paragraph, plain);
		rendered.set(node, next);
	}
	function setEditable(node: HTMLElement, editable: boolean) {
		const readonly = String(!editable);
		if (node.getAttribute('aria-readonly') !== readonly)
			node.setAttribute('aria-readonly', readonly);
		if (!editable) {
			if (node.contentEditable !== 'false') node.contentEditable = 'false';
			return;
		}
		if (node.contentEditable === 'plaintext-only' || node.contentEditable === 'true') return;
		try {
			node.contentEditable = 'plaintext-only';
		} catch {
			node.contentEditable = 'true';
		}
		if (node.contentEditable !== 'plaintext-only') node.contentEditable = 'true';
	}
	function sync() {
		const editable = safe();
		if (!editable) finish();
		for (const [node, paragraph] of paragraphs) {
			setEditable(node, editable);
			if (!editable) render(node, paragraph, true);
		}
	}
	function selected() {
		if (!session || !safe()) return;
		const letter = findLetter(store.cv, letterId);
		const range = offsets(session.element);
		if (!letter || !range) return;
		session.range = range;
		if (
			session.reported?.signature === session.signature &&
			session.reported.start === range.start &&
			session.reported.end === range.end
		)
			return;
		session.reported = { signature: session.signature, ...range };
		options.onselection({
			key: session.key,
			...range,
			marks: marksAt(
				letterBlockSource(store.cv, letter, session.key),
				range.start,
				range.end,
				session.matcher
			)
		});
	}
	function finish() {
		if (!session) return;
		if (session.composing) {
			session.composing = false;
			write();
		}
		session = undefined;
		untrack(() => {
			options.onselection(undefined);
			options.onediting(false);
		});
	}
	function start(element: HTMLElement) {
		const paragraph = paragraphs.get(element);
		const letter = findLetter(store.cv, letterId);
		if (!paragraph || !letter || !safe() || session?.element === element) return;
		finish();
		session = {
			key: paragraph.key,
			element,
			signature: signature(),
			coalesceKey: `${letterCoalesceKey(letterId, paragraph.key)}:focus:${++sequence}`,
			written: false,
			composing: false,
			matcher: letterForeignMatcher(store.cv, letter)
		};
		options.onediting(true);
	}
	function current() {
		if (!session) return;
		if (!safe() || session.signature !== signature()) {
			finish();
			return;
		}
		return session;
	}
	function write() {
		const editing = current();
		const letter = findLetter(store.cv, letterId);
		if (!editing || !letter || editing.composing) return;
		const source = letterBlockSource(store.cv, letter, editing.key);
		let text = editing.element.textContent ?? '';
		if (text.length > LETTER_LIMITS.paragraph) {
			text = text.slice(0, LETTER_LIMITS.paragraph);
			if (/[\uD800-\uDBFF]$/.test(text)) text = text.slice(0, -1);
			rendered.delete(editing.element);
			editing.element.textContent = text;
			restore(editing.element, text.length, text.length);
			options.onlimit();
		}
		if (richToPlain(source) === text) {
			render(editing.element, {
				key: editing.key,
				runs: resolveRuns(source, editing.matcher),
				fillers: paragraphs.get(editing.element)?.fillers ?? []
			});
			return;
		}
		store.update(
			(draft) =>
				updateLetter(draft, letterId, {
					overrides: { [editing.key]: applyTextEdit(source, text) }
				}),
			{ coalesceKey: editing.coalesceKey, skipHistory: editing.written }
		);
		editing.written = true;
		editing.signature = signature();
		selected();
	}
	function insert(value: string) {
		const editing = current();
		if (!editing) return;
		const selection = offsets(editing.element);
		const before = editing.element.textContent ?? '';
		const start = selection?.start ?? before.length;
		const end = selection?.end ?? before.length;
		const plain = value
			.replace(/\r\n?/g, '\n')
			.replace(/\p{Cc}/gu, (c) => (c === '\n' || c === '\t' ? c : ''));
		const room = Math.max(0, LETTER_LIMITS.paragraph - before.length + end - start);
		let clipped = plain.slice(0, room);
		if (/[\uD800-\uDBFF]$/.test(clipped)) clipped = clipped.slice(0, -1);
		if (clipped.length < plain.length) options.onlimit();
		rendered.delete(editing.element);
		editing.element.textContent = before.slice(0, start) + clipped + before.slice(end);
		restore(editing.element, start + clipped.length, start + clipped.length);
		write();
	}
	function format(mark: RichMark) {
		const editing = current();
		const letter = findLetter(store.cv, letterId);
		const toolbarFocused = document.activeElement?.closest('[role="toolbar"]');
		const range =
			editing && (offsets(editing.element) ?? (toolbarFocused ? editing.range : undefined));
		if (!editing || !letter || !range || range.end <= range.start) return false;
		const runs = toggleMark(
			letterBlockSource(store.cv, letter, editing.key),
			range.start,
			range.end,
			mark,
			editing.matcher
		);
		store.update((draft) => updateLetter(draft, letterId, { overrides: { [editing.key]: runs } }));
		editing.signature = signature();
		editing.written = false;
		editing.coalesceKey = `${letterCoalesceKey(letterId, editing.key)}:focus:${++sequence}`;
		selected();
		return true;
	}
	function eventParagraph(event: Event) {
		const node =
			event.target instanceof Element
				? event.target.closest<HTMLElement>('[data-letter-block]')
				: null;
		return node && paragraphs.has(node) ? node : undefined;
	}
	function focusin(event: FocusEvent) {
		const node = eventParagraph(event);
		if (node) start(node);
	}
	function focusout(event: FocusEvent) {
		if (event.relatedTarget instanceof Node && surface?.contains(event.relatedTarget)) return;
		finish();
	}
	function pointerdown(event: PointerEvent) {
		const node = eventParagraph(event);
		if (node && event.button === 0) start(node);
	}
	function keydown(event: KeyboardEvent) {
		const paragraph = eventParagraph(event);
		if (!paragraph) return;
		if ((event.ctrlKey || event.metaKey) && !event.altKey) {
			const key = event.key.toLowerCase();
			if (!safe() && ['b', 'i', 'u', 'z', 'y'].includes(key)) {
				event.preventDefault();
				return;
			}
			if (['b', 'i', 'u'].includes(key)) {
				event.preventDefault();
				event.stopPropagation();
				format(key === 'b' ? 'bold' : key === 'i' ? 'italic' : 'underline');
			} else if (key === 'z' || key === 'y') {
				event.preventDefault();
				event.stopPropagation();
				finish();
				if (key === 'y' || event.shiftKey) store.redo();
				else store.undo();
			}
		}
		if (event.key === 'Escape') {
			// Let the native modal cancel after ending the editing session.
			if (!paragraph.closest('dialog[open]')) event.preventDefault();
			session?.element.blur();
			finish();
		}
	}
	function beforeinput(event: InputEvent) {
		if (!eventParagraph(event)) return;
		if (!safe()) {
			event.preventDefault();
			sync();
			return;
		}
		if (event.isComposing || session?.composing) return;
		if (event.inputType === 'insertParagraph' || event.inputType === 'insertLineBreak') {
			event.preventDefault();
			insert('\n');
		} else if (event.inputType.startsWith('format')) {
			event.preventDefault();
		} else if (event.data && event.inputType.startsWith('insert')) {
			const editing = current();
			const range = editing && offsets(editing.element);
			if (
				editing &&
				(editing.element.textContent ?? '').length +
					event.data.length -
					((range?.end ?? 0) - (range?.start ?? 0)) >
					LETTER_LIMITS.paragraph
			) {
				event.preventDefault();
				insert(event.data);
			}
		}
	}
	function paste(event: ClipboardEvent) {
		if (!eventParagraph(event)) return;
		event.preventDefault();
		insert(event.clipboardData?.getData('text/plain') ?? '');
	}
	function drop(event: DragEvent) {
		const node = eventParagraph(event);
		if (!node) return;
		event.preventDefault();
		start(node);
		insert(event.dataTransfer?.getData('text/plain') ?? '');
	}
	function input(event: Event) {
		if (!eventParagraph(event)) return;
		if (!safe()) sync();
		else write();
	}
	function compositionstart(event: CompositionEvent) {
		if (eventParagraph(event) && session) session.composing = true;
	}
	function compositionend(event: CompositionEvent) {
		if (eventParagraph(event) && session) {
			session.composing = false;
			write();
		}
	}
	function flush() {
		if (session?.composing) {
			session.composing = false;
			write();
		}
	}
	return {
		format,
		finish,
		sync,
		focus(key: LetterTextKey) {
			const entry = Array.from(paragraphs).find(([, paragraph]) => paragraph.key === key);
			if (!entry || !safe()) return;
			entry[0].focus({ preventScroll: true });
			start(entry[0]);
			restore(entry[0], 0, entry[0].textContent?.length ?? 0);
			selected();
			entry[0].scrollIntoView({ block: 'center', behavior: 'instant' });
		},
		paragraph(node: HTMLElement, paragraph: Paragraph) {
			setEditable(node, safe());
			paragraphs.set(node, paragraph);
			render(node, paragraph);
			return {
				update(next: Paragraph) {
					paragraphs.set(node, next);
					if (session?.element === node && (!safe() || session.signature !== signature())) finish();
					setEditable(node, safe());
					if (!session?.composing || session.element !== node) render(node, next);
				},
				destroy() {
					paragraphs.delete(node);
					rendered.delete(node);
					if (session?.element === node) finish();
				}
			};
		},
		attach(node: HTMLElement) {
			surface = node;
			node.addEventListener('focusin', focusin);
			node.addEventListener('focusout', focusout);
			node.addEventListener('pointerdown', pointerdown);
			node.addEventListener('keydown', keydown);
			node.addEventListener('beforeinput', beforeinput);
			node.addEventListener('input', input);
			node.addEventListener('paste', paste);
			node.addEventListener('drop', drop);
			node.addEventListener('compositionstart', compositionstart);
			node.addEventListener('compositionend', compositionend);
			document.addEventListener('selectionchange', selected);
			document.addEventListener('visibilitychange', flush);
			window.addEventListener('pagehide', flush);
			return {
				destroy() {
					alive = false;
					finish();
					surface = undefined;
					node.removeEventListener('focusin', focusin);
					node.removeEventListener('focusout', focusout);
					node.removeEventListener('pointerdown', pointerdown);
					node.removeEventListener('keydown', keydown);
					node.removeEventListener('beforeinput', beforeinput);
					node.removeEventListener('input', input);
					node.removeEventListener('paste', paste);
					node.removeEventListener('drop', drop);
					node.removeEventListener('compositionstart', compositionstart);
					node.removeEventListener('compositionend', compositionend);
					document.removeEventListener('selectionchange', selected);
					document.removeEventListener('visibilitychange', flush);
					window.removeEventListener('pagehide', flush);
				}
			};
		}
	};
}
