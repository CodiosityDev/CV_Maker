/** Pure text helpers for the CV scanner (no browser APIs: unit-tested in Node). */
import { SCAN_MAX_CHARS } from './types';

const CHARS_PER_PAGE = 3600;
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/** Trims every line, removes empty lines and control characters, caps the length. */
export function normalizeLines(text: string): string {
	return text
		.slice(0, SCAN_MAX_CHARS * 2)
		.replace(/\r\n?/g, '\n')
		.replace(CONTROL, '')
		.replace(/[\t\u00A0\u2000-\u200B\u202F\u3000]+/g, ' ')
		.split('\n')
		.map((line) => line.replace(/ {2,}/g, ' ').trim())
		.filter(Boolean)
		.join('\n')
		.slice(0, SCAN_MAX_CHARS);
}

/** Rough A4 page count for text without real pages (DOCX/TXT). */
export function estimatePages(text: string): number {
	return Math.max(1, Math.ceil(text.length / CHARS_PER_PAGE));
}

/** One text run of a PDF page (from pdf.js `getTextContent`, y grows upwards). */
export interface PdfTextItem {
	str: string;
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface PdfPageText {
	width: number;
	items: PdfTextItem[];
}

interface Segment {
	row: number;
	x: number;
	y: number;
	text: string;
	words: number;
}

/** Rows of items with the same baseline, split into segments where there is a wide gap. */
function segmentsOf(page: PdfPageText): Segment[] {
	const items = page.items
		.filter((item) => item.str.trim() && Number.isFinite(item.x) && Number.isFinite(item.y))
		.sort((a, b) => b.y - a.y || a.x - b.x);
	const rows: PdfTextItem[][] = [];
	for (const item of items) {
		const row = rows.at(-1);
		const first = row?.[0];
		const tolerance = Math.max(2, 0.5 * Math.min(item.height || 10, first?.height || 10));
		if (row && first && Math.abs(first.y - item.y) <= tolerance) row.push(item);
		else rows.push([item]);
	}

	const segments: Segment[] = [];
	for (const [index, row] of rows.entries()) {
		row.sort((a, b) => a.x - b.x);
		let current: Segment | undefined;
		let end = 0;
		for (const item of row) {
			const size = item.height || 10;
			const gap = item.x - end;
			if (!current || gap > Math.max(page.width * 0.05, size * 2)) {
				current = { row: index, x: item.x, y: item.y, text: item.str, words: 0 };
				segments.push(current);
			} else {
				const needsSpace = gap > size * 0.15 && !/\s$/.test(current.text) && !/^\s/.test(item.str);
				current.text += (needsSpace ? ' ' : '') + item.str;
			}
			end = Math.max(end, item.x + item.width);
		}
	}
	for (const segment of segments) {
		segment.text = segment.text.replace(/\s+/g, ' ').trim();
		segment.words = segment.text.split(' ').filter((w) => /\p{L}/u.test(w)).length;
	}
	return segments;
}

/**
 * Plain text in reading order + whether the page uses columns. A column = several sentence-like
 * segments that start in the middle of the page; those pages are read column by column.
 */
export function pdfPagesToText(pages: readonly PdfPageText[]): { text: string; columns: boolean } {
	let columns = false;
	const out: string[] = [];
	for (const page of pages) {
		const segments = segmentsOf(page);
		const wordy = segments.filter((s) => s.words >= 3);
		const middle = wordy.filter((s) => s.x >= page.width * 0.3 && s.x <= page.width * 0.7);
		const twoColumns = middle.length >= 5 && middle.length >= wordy.length * 0.2;

		if (twoColumns) {
			columns = true;
			const split = Math.min(...middle.map((s) => s.x)) - 2;
			const left = segments.filter((s) => s.x < split);
			const right = segments.filter((s) => s.x >= split);
			out.push(...left.map((s) => s.text), ...right.map((s) => s.text));
		} else {
			// Same row → one line (e.g. "Data Analyst Intern    Jan 2023 – Mar 2023").
			let lastRow = -1;
			for (const segment of segments) {
				if (segment.row === lastRow) out[out.length - 1] += ` ${segment.text}`;
				else out.push(segment.text);
				lastRow = segment.row;
			}
		}
		out.push('');
	}
	return { text: normalizeLines(out.join('\n')), columns };
}
