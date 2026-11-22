/**
 * Just enough TrueType to embed a font in a PDF as a simple font (WinAnsiEncoding):
 * WOFF 1.0 → plain sfnt bytes, plus the metrics the PDF font dictionary needs.
 */
import { unzlibSync } from 'fflate';
import { unicodeOf } from './winansi';

export interface TrueTypeFont {
	/** The sfnt (TTF) file to embed as /FontFile2. */
	bytes: Uint8Array;
	/** PostScript-safe name, e.g. "PlusJakartaSans-Bold". */
	name: string;
	/** Advance widths for WinAnsi codes 32–255 in 1/1000 em. */
	widths: number[];
	ascent: number;
	descent: number;
	capHeight: number;
	italicAngle: number;
	bbox: [number, number, number, number];
}

const tag = (view: DataView, offset: number) =>
	String.fromCharCode(
		view.getUint8(offset),
		view.getUint8(offset + 1),
		view.getUint8(offset + 2),
		view.getUint8(offset + 3)
	);

/** WOFF 1.0 → sfnt. Plain TTF/OTF input is returned unchanged. */
export function woffToSfnt(input: Uint8Array): Uint8Array {
	const view = new DataView(input.buffer, input.byteOffset, input.byteLength);
	if (tag(view, 0) !== 'wOFF') return input;
	const flavor = view.getUint32(4);
	const numTables = view.getUint16(12);
	const tables: { tag: number; checksum: number; data: Uint8Array }[] = [];
	for (let i = 0; i < numTables; i++) {
		const entry = 44 + i * 20;
		const offset = view.getUint32(entry + 4);
		const compLength = view.getUint32(entry + 8);
		const origLength = view.getUint32(entry + 12);
		const raw = input.subarray(offset, offset + compLength);
		const data = compLength < origLength ? unzlibSync(raw) : raw;
		if (data.length !== origLength) throw new Error('woff: bad table');
		tables.push({ tag: view.getUint32(entry), checksum: view.getUint32(entry + 16), data });
	}
	tables.sort((a, b) => a.tag - b.tag);
	let size = 12 + numTables * 16;
	for (const table of tables) size += (table.data.length + 3) & ~3;
	const out = new Uint8Array(size);
	const outView = new DataView(out.buffer);
	let entrySelector = 0;
	while (1 << (entrySelector + 1) <= numTables) entrySelector++;
	const searchRange = (1 << entrySelector) * 16;
	outView.setUint32(0, flavor);
	outView.setUint16(4, numTables);
	outView.setUint16(6, searchRange);
	outView.setUint16(8, entrySelector);
	outView.setUint16(10, numTables * 16 - searchRange);
	let offset = 12 + numTables * 16;
	tables.forEach((table, i) => {
		const record = 12 + i * 16;
		outView.setUint32(record, table.tag);
		outView.setUint32(record + 4, table.checksum);
		outView.setUint32(record + 8, offset);
		outView.setUint32(record + 12, table.data.length);
		out.set(table.data, offset);
		offset += (table.data.length + 3) & ~3;
	});
	return out;
}

/** Glyph id for a code point from a format 4 or 12 cmap subtable (0 = missing). */
function cmapLookup(view: DataView, sub: number): (codePoint: number) => number {
	const format = view.getUint16(sub);
	if (format === 12) {
		const groups = view.getUint32(sub + 12);
		return (codePoint) => {
			for (let i = 0; i < groups; i++) {
				const group = sub + 16 + i * 12;
				const start = view.getUint32(group);
				if (codePoint >= start && codePoint <= view.getUint32(group + 4))
					return view.getUint32(group + 8) + codePoint - start;
			}
			return 0;
		};
	}
	if (format !== 4) return () => 0;
	const segCount = view.getUint16(sub + 6) / 2;
	const ends = sub + 14;
	const starts = ends + segCount * 2 + 2;
	const deltas = starts + segCount * 2;
	const rangeOffsets = deltas + segCount * 2;
	return (codePoint) => {
		for (let i = 0; i < segCount; i++) {
			if (view.getUint16(ends + i * 2) < codePoint) continue;
			const start = view.getUint16(starts + i * 2);
			if (start > codePoint) return 0;
			const delta = view.getInt16(deltas + i * 2);
			const rangeOffset = view.getUint16(rangeOffsets + i * 2);
			if (rangeOffset === 0) return (codePoint + delta) & 0xffff;
			const glyph = view.getUint16(rangeOffsets + i * 2 + rangeOffset + (codePoint - start) * 2);
			return glyph === 0 ? 0 : (glyph + delta) & 0xffff;
		}
		return 0;
	};
}

/** Parses a WOFF/TTF file for embedding. Throws on fonts it cannot read. */
export function parseTrueType(input: Uint8Array, name: string): TrueTypeFont {
	const bytes = woffToSfnt(input);
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const tables = new Map<string, number>();
	for (let i = 0; i < view.getUint16(4); i++) {
		const record = 12 + i * 16;
		tables.set(tag(view, record), view.getUint32(record + 8));
	}
	const table = (name: string) => {
		const offset = tables.get(name);
		if (offset === undefined) throw new Error(`ttf: no ${name} table`);
		return offset;
	};
	const head = table('head');
	const unitsPerEm = view.getUint16(head + 18);
	const scale = (value: number) => Math.round((value * 1000) / unitsPerEm);
	const hhea = table('hhea');
	const numberOfHMetrics = view.getUint16(hhea + 34);
	const hmtx = table('hmtx');
	const advance = (glyph: number) =>
		view.getUint16(hmtx + Math.min(glyph, numberOfHMetrics - 1) * 4);

	const cmap = table('cmap');
	let subtable = -1;
	for (let i = 0; i < view.getUint16(cmap + 2); i++) {
		const record = cmap + 4 + i * 8;
		const platform = view.getUint16(record);
		const encoding = view.getUint16(record + 2);
		const offset = cmap + view.getUint32(record + 4);
		const format = view.getUint16(offset);
		const unicode = (platform === 3 && (encoding === 1 || encoding === 10)) || platform === 0;
		if (unicode && (format === 4 || format === 12)) {
			subtable = offset;
			if (format === 12) break;
		}
	}
	if (subtable < 0) throw new Error('ttf: no unicode cmap');
	const glyphOf = cmapLookup(view, subtable);
	const widths: number[] = [];
	const missing = scale(advance(0));
	for (let code = 32; code <= 255; code++) {
		const unicode = unicodeOf(code);
		const glyph = unicode === undefined ? 0 : glyphOf(unicode);
		widths.push(glyph ? scale(advance(glyph)) : missing);
	}

	let ascent = scale(view.getInt16(hhea + 4));
	let descent = scale(view.getInt16(hhea + 6));
	let capHeight = ascent;
	const os2 = tables.get('OS/2');
	if (os2 !== undefined) {
		if (view.getUint16(os2) >= 2) capHeight = scale(view.getInt16(os2 + 88));
		ascent = scale(view.getInt16(os2 + 68)) || ascent;
		descent = scale(view.getInt16(os2 + 70)) || descent;
	}
	const post = tables.get('post');
	const italicAngle = post === undefined ? 0 : view.getInt32(post + 4) / 65536;
	return {
		bytes,
		name: name.replace(/[^A-Za-z0-9-]/g, ''),
		widths,
		ascent,
		descent,
		capHeight,
		italicAngle,
		bbox: [
			scale(view.getInt16(head + 36)),
			scale(view.getInt16(head + 38)),
			scale(view.getInt16(head + 40)),
			scale(view.getInt16(head + 42))
		]
	};
}
