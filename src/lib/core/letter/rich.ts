/**
 * Formatted text for the cover letter: arrays of `RichRun` ({ text, bold?, italic?, underline? }).
 * Pure functions, no HTML anywhere — the UI renders runs as elements and edits through offsets in
 * the PLAIN text (never `document.execCommand`, never innerHTML).
 *
 *   // contenteditable input → keep formatting of untouched text
 *   const runs = applyTextEdit(source, element.textContent ?? '');
 *   // toolbar B / I / U on the selection (offsets in the plain text)
 *   const next = toggleMark(source, start, end, 'italic', matcher);
 *   const pressed = marksAt(source, start, end, matcher);   // { bold, italic, underline }
 *
 * `italic` is tri-state: undefined = automatic (foreign terms in Indonesian letters, see
 * core/foreign), true / false = the user's choice. `resolveRuns` turns automatic into real values.
 */
import { normalizeRuns } from '../schema/schema';
import type { RichRun } from '../schema/types';
import { foreignParts, type ForeignMatcher } from '../foreign/index';

export type RichMark = 'bold' | 'italic' | 'underline';
export type RichMarks = Record<RichMark, boolean>;

/** One unformatted run ('' → no runs). */
export function richFromPlain(text: string): RichRun[] {
	return normalizeRuns([{ text }]);
}

/** The text without formatting. */
export function richToPlain(runs: readonly RichRun[]): string {
	return runs.map((run) => run.text).join('');
}

/** The runs between two offsets of the plain text (formatting kept). */
export function sliceRuns(runs: readonly RichRun[], start: number, end: number): RichRun[] {
	const out: RichRun[] = [];
	let at = 0;
	for (const run of runs) {
		const from = Math.max(start, at);
		const to = Math.min(end, at + run.text.length);
		if (to > from) out.push({ ...run, text: run.text.slice(from - at, to - at) });
		at += run.text.length;
		if (at >= end) break;
	}
	return out;
}

function marksOf(run: RichRun | undefined): Omit<RichRun, 'text'> {
	if (!run) return {};
	const { text: _text, ...marks } = run;
	return marks;
}

/**
 * The runs after the user typed: `nextPlain` is the whole new text of the paragraph. Only the
 * changed middle part is replaced; it takes the formatting of the character before it (like a word
 * processor). Formatting of untouched text is kept.
 */
export function applyTextEdit(runs: readonly RichRun[], nextPlain: string): RichRun[] {
	const before = richToPlain(runs);
	if (before === nextPlain) return normalizeRuns(runs);
	let prefix = 0;
	const max = Math.min(before.length, nextPlain.length);
	while (prefix < max && before[prefix] === nextPlain[prefix]) prefix++;
	let suffix = 0;
	while (
		suffix < max - prefix &&
		before[before.length - 1 - suffix] === nextPlain[nextPlain.length - 1 - suffix]
	)
		suffix++;
	const inserted = nextPlain.slice(prefix, nextPlain.length - suffix);
	const head = sliceRuns(runs, 0, prefix);
	const tail = sliceRuns(runs, before.length - suffix, before.length);
	const style = marksOf(head[head.length - 1] ?? sliceRuns(runs, prefix, prefix + 1)[0]);
	return normalizeRuns([...head, ...(inserted ? [{ ...style, text: inserted }] : []), ...tail]);
}

/** Automatic italics made real: every run gets `italic: true | false`. */
export function resolveRuns(runs: readonly RichRun[], matcher?: ForeignMatcher): RichRun[] {
	const plain = richToPlain(runs);
	const auto: boolean[] = [];
	for (const part of foreignParts(plain, matcher))
		for (let i = 0; i < part.text.length; i++) auto.push(part.italic);
	const out: RichRun[] = [];
	let at = 0;
	for (const run of runs) {
		let pieceStart = 0;
		for (let i = 1; i <= run.text.length; i++) {
			const italicAt = (index: number) => run.italic ?? auto[at + index] ?? false;
			if (i === run.text.length || italicAt(i) !== italicAt(pieceStart)) {
				out.push({
					...run,
					text: run.text.slice(pieceStart, i),
					italic: italicAt(pieceStart)
				});
				pieceStart = i;
			}
		}
		at += run.text.length;
	}
	return normalizeRuns(out);
}

function has(run: RichRun, mark: RichMark): boolean {
	return mark === 'italic' ? run.italic === true : run[mark] === true;
}

/**
 * Which marks the selection has (true = every character), counting automatic italics. A collapsed
 * selection reports the character before the cursor — the toolbar state while typing.
 */
export function marksAt(
	runs: readonly RichRun[],
	start: number,
	end: number,
	matcher?: ForeignMatcher
): RichMarks {
	const resolved = resolveRuns(runs, matcher);
	const from = start === end ? Math.max(0, start - 1) : start;
	const to = start === end ? Math.max(1, start) : end;
	const selected = sliceRuns(resolved, from, to);
	const all = (mark: RichMark) => selected.length > 0 && selected.every((run) => has(run, mark));
	return { bold: all('bold'), italic: all('italic'), underline: all('underline') };
}

/**
 * Toggles a mark on the selection: on when part of it lacks the mark, otherwise off. Turning
 * italics off on a foreign term stores `italic: false` (it stays upright from then on).
 */
export function toggleMark(
	runs: readonly RichRun[],
	start: number,
	end: number,
	mark: RichMark,
	matcher?: ForeignMatcher
): RichRun[] {
	if (end <= start) return normalizeRuns(runs);
	const on = !marksAt(runs, start, end, matcher)[mark];
	const plain = richToPlain(runs);
	const middle = sliceRuns(runs, start, end).map((run): RichRun => {
		const next: RichRun = { ...run };
		if (mark === 'italic') next.italic = on;
		else if (on) next[mark] = true;
		else delete next[mark];
		return next;
	});
	return normalizeRuns([
		...sliceRuns(runs, 0, start),
		...middle,
		...sliceRuns(runs, end, plain.length)
	]);
}
