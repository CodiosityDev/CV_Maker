/**
 * A small PDF 1.7 writer for CVs: A4 pages drawn from a display list (filled shapes, JPEG photos,
 * positioned text, link areas). Text stays real text (selectable, readable by ATS), every glyph
 * placed where the browser laid it out.
 *
 * Coordinates in the display list are CSS pixels from the page's top-left corner.
 */
import { zlibSync } from 'fflate';
import type { TrueTypeFont } from './truetype';
import { HELVETICA_BOLD_WIDTHS, HELVETICA_WIDTHS } from './winansi';

/** Standard (not embedded) fonts — metrics identical to Arial. */
export type StandardFont =
	'Helvetica' | 'Helvetica-Bold' | 'Helvetica-Oblique' | 'Helvetica-BoldOblique';
export type FontRef = { standard: StandardFont } | { embedded: string };

export type Rgb = [number, number, number];

/** Rounded corners: horizontal/vertical radius per corner (CSS px), clockwise from top-left. */
export type Corners = [number, number][];

export interface Shape {
	x: number;
	y: number;
	w: number;
	h: number;
	corners?: Corners;
}

export type DrawOp =
	| { kind: 'fill'; shape: Shape; color: Rgb }
	| { kind: 'image'; shape: Shape; clip?: Shape; image: PdfImage }
	| {
			kind: 'text';
			font: FontRef;
			/** CSS px. */
			size: number;
			color: Rgb;
			/** Baseline. */
			y: number;
			/** WinAnsi codes and the x where each glyph starts. */
			codes: number[];
			xs: number[];
	  };

export interface PdfImage {
	/** JPEG bytes. */
	jpeg: Uint8Array;
	width: number;
	height: number;
}

export interface PdfLink {
	x: number;
	y: number;
	w: number;
	h: number;
	uri: string;
}

export interface PdfPage {
	ops: DrawOp[];
	links: PdfLink[];
}

export interface PdfInfo {
	title?: string;
	author?: string;
	subject?: string;
	keywords?: string;
}

export interface PdfInput {
	pages: PdfPage[];
	/** Embedded fonts by the key used in `{ embedded: key }`. */
	fonts?: Record<string, TrueTypeFont>;
	info?: PdfInfo;
	/** Extra ASCII data kept in the file (not shown) — see `payload.ts`. */
	data?: string;
	/** Document language, e.g. "id" (screen readers, ATS). */
	lang?: string;
}

/** A4 in CSS px (96 dpi) and PDF points. */
export const PAGE_WIDTH_PX = (210 * 96) / 25.4;
export const PAGE_HEIGHT_PX = (297 * 96) / 25.4;
const PT = 0.75;
const PAGE_WIDTH_PT = 595.28;
const PAGE_HEIGHT_PT = 841.89;

const encoder = new TextEncoder();
const num = (value: number) => {
	const rounded = Math.round(value * 100) / 100;
	return Object.is(rounded, -0) ? '0' : String(rounded);
};

/** PDF text string: literal for printable ASCII, UTF-16BE otherwise. */
export function pdfString(text: string): string {
	if (/^[\x20-\x7e]*$/.test(text)) return `(${text.replace(/[\\()]/g, (c) => `\\${c}`)})`;
	let hex = 'FEFF';
	for (let i = 0; i < text.length; i++)
		hex += text.charCodeAt(i).toString(16).padStart(4, '0').toUpperCase();
	return `<${hex}>`;
}

function latin1(text: string): Uint8Array {
	const out = new Uint8Array(text.length);
	for (let i = 0; i < text.length; i++) out[i] = text.charCodeAt(i) & 0xff;
	return out;
}

/** Path for a (rounded) rectangle in PDF points; y flipped. */
function shapePath(shape: Shape): string {
	const x = shape.x * PT;
	const top = PAGE_HEIGHT_PT - shape.y * PT;
	const w = shape.w * PT;
	const h = shape.h * PT;
	const corners = shape.corners?.map(([rx, ry]): [number, number] => [
		Math.min(rx * PT, w / 2),
		Math.min(ry * PT, h / 2)
	]);
	if (!corners || corners.every(([rx, ry]) => rx <= 0 || ry <= 0))
		return `${num(x)} ${num(top - h)} ${num(w)} ${num(h)} re\n`;
	const k = 0.5523;
	const [[tlx, tly], [trx, try_], [brx, bry], [blx, bly]] = corners as [
		[number, number],
		[number, number],
		[number, number],
		[number, number]
	];
	const bottom = top - h;
	const right = x + w;
	return [
		`${num(x + tlx)} ${num(top)} m`,
		`${num(right - trx)} ${num(top)} l`,
		`${num(right - trx + trx * k)} ${num(top)} ${num(right)} ${num(top - try_ + try_ * k)} ${num(right)} ${num(top - try_)} c`,
		`${num(right)} ${num(bottom + bry)} l`,
		`${num(right)} ${num(bottom + bry - bry * k)} ${num(right - brx + brx * k)} ${num(bottom)} ${num(right - brx)} ${num(bottom)} c`,
		`${num(x + blx)} ${num(bottom)} l`,
		`${num(x + blx - blx * k)} ${num(bottom)} ${num(x)} ${num(bottom + bly - bly * k)} ${num(x)} ${num(bottom + bly)} c`,
		`${num(x)} ${num(top - tly)} l`,
		`${num(x)} ${num(top - tly + tly * k)} ${num(x + tlx - tlx * k)} ${num(top)} ${num(x + tlx)} ${num(top)} c`,
		'h',
		''
	].join('\n');
}

const color = (rgb: Rgb, op: 'rg' | 'RG') => `${rgb.map((c) => num(c / 255)).join(' ')} ${op}\n`;

/** Builds the PDF file. */
export function buildPdf(input: PdfInput): Uint8Array {
	const objects: (Uint8Array | undefined)[] = [];
	const alloc = () => objects.push(undefined);
	const put = (id: number, body: string) => {
		objects[id - 1] = latin1(`${id} 0 obj\n${body}\nendobj\n`);
	};
	const putStream = (id: number, dict: string, data: Uint8Array, compress = true) => {
		const payload = compress ? zlibSync(data, { level: 9 }) : data;
		const head = latin1(
			`${id} 0 obj\n<< ${dict}${compress ? ' /Filter /FlateDecode' : ''} /Length ${payload.length} >>\nstream\n`
		);
		const tail = latin1('\nendstream\nendobj\n');
		const out = new Uint8Array(head.length + payload.length + tail.length);
		out.set(head);
		out.set(payload, head.length);
		out.set(tail, head.length + payload.length);
		objects[id - 1] = out;
	};

	const catalogId = alloc();
	const pagesId = alloc();
	const infoId = alloc();

	// Fonts: one resource name per font actually used.
	const fontNames = new Map<string, { name: string; widths: number[] }>();
	const fontIds = new Map<string, number>();
	const fontKey = (font: FontRef) => ('standard' in font ? font.standard : `E:${font.embedded}`);
	function useFont(font: FontRef) {
		const key = fontKey(font);
		const known = fontNames.get(key);
		if (known) return known;
		const name = `F${fontNames.size + 1}`;
		const id = alloc();
		fontIds.set(name, id);
		let widths: number[];
		if ('standard' in font) {
			widths = font.standard.includes('Bold') ? HELVETICA_BOLD_WIDTHS : HELVETICA_WIDTHS;
			put(
				id,
				`<< /Type /Font /Subtype /Type1 /BaseFont /${font.standard} /Encoding /WinAnsiEncoding >>`
			);
		} else {
			const ttf = input.fonts?.[font.embedded];
			if (!ttf) throw new Error(`pdf: font ${font.embedded} missing`);
			widths = ttf.widths;
			const fileId = alloc();
			const descriptorId = alloc();
			putStream(fileId, `/Length1 ${ttf.bytes.length}`, ttf.bytes);
			const flags = 32 + (ttf.italicAngle ? 64 : 0);
			put(
				descriptorId,
				`<< /Type /FontDescriptor /FontName /${ttf.name} /Flags ${flags} /FontBBox [${ttf.bbox.join(' ')}] /ItalicAngle ${num(ttf.italicAngle)} /Ascent ${ttf.ascent} /Descent ${ttf.descent} /CapHeight ${ttf.capHeight} /StemV 80 /FontFile2 ${fileId} 0 R >>`
			);
			put(
				id,
				`<< /Type /Font /Subtype /TrueType /BaseFont /${ttf.name} /FirstChar 32 /LastChar 255 /Widths [${ttf.widths.join(' ')}] /Encoding /WinAnsiEncoding /FontDescriptor ${descriptorId} 0 R >>`
			);
		}
		const entry = { name, widths };
		fontNames.set(key, entry);
		return entry;
	}

	const imageIds = new Map<PdfImage, string>();
	const imageObjects = new Map<string, number>();
	function useImage(image: PdfImage) {
		const known = imageIds.get(image);
		if (known) return known;
		const name = `Im${imageIds.size + 1}`;
		const id = alloc();
		putStream(
			id,
			`/Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode`,
			image.jpeg,
			false
		);
		imageIds.set(image, name);
		imageObjects.set(name, id);
		return name;
	}

	const pageIds: number[] = [];
	for (const page of input.pages) {
		const pageId = alloc();
		const contentId = alloc();
		pageIds.push(pageId);
		let content = '';
		const usedFonts = new Set<string>();
		const usedImages = new Set<string>();
		for (const op of page.ops) {
			if (op.kind === 'fill') {
				content += color(op.color, 'rg') + shapePath(op.shape) + 'f\n';
			} else if (op.kind === 'image') {
				const name = useImage(op.image);
				usedImages.add(name);
				const { x, y, w, h } = op.shape;
				content += 'q\n';
				if (op.clip) content += shapePath(op.clip) + 'W n\n';
				content += `${num(w * PT)} 0 0 ${num(h * PT)} ${num(x * PT)} ${num(PAGE_HEIGHT_PT - (y + h) * PT)} cm\n/${name} Do\nQ\n`;
			} else if (op.codes.length) {
				const font = useFont(op.font);
				usedFonts.add(font.name);
				const sizePt = op.size * PT;
				const advance = (code: number) => ((font.widths[code - 32] ?? 500) * op.size) / 1000;
				// A glyph that had more room on screen (a contextual alternate, a fallback font) is
				// centred in it: half the gap each side, so text extraction sees no word space.
				const xs = op.xs.map((x, i) => {
					const next = op.xs[i + 1];
					const room = next === undefined ? 0 : next - x - advance(op.codes[i]!);
					return room > op.size * 0.08 ? x + room / 2 : x;
				});
				let tj = '';
				let run = '';
				op.codes.forEach((code, i) => {
					run +=
						code < 0x20 || code > 0x7e || code === 0x28 || code === 0x29 || code === 0x5c
							? `\\${code.toString(8).padStart(3, '0')}`
							: String.fromCharCode(code);
					const next = xs[i + 1];
					if (next === undefined) return;
					const natural = ((font.widths[code - 32] ?? 500) * sizePt) / 1000;
					const wanted = (next - xs[i]!) * PT;
					const adjust = Math.round(((natural - wanted) * 1000) / sizePt);
					if (Math.abs(adjust) >= 1) {
						tj += `(${run}) ${adjust} `;
						run = '';
					}
				});
				tj += `(${run})`;
				content +=
					`BT\n/${font.name} ${num(sizePt)} Tf\n` +
					color(op.color, 'rg') +
					`1 0 0 1 ${num(xs[0]! * PT)} ${num(PAGE_HEIGHT_PT - op.y * PT)} Tm\n[${tj}] TJ\nET\n`;
			}
		}
		putStream(contentId, '', latin1(content));

		const annots = page.links.map((link) => {
			const id = alloc();
			const x = link.x * PT;
			const top = PAGE_HEIGHT_PT - link.y * PT;
			put(
				id,
				`<< /Type /Annot /Subtype /Link /Rect [${num(x)} ${num(top - link.h * PT)} ${num(x + link.w * PT)} ${num(top)}] /Border [0 0 0] /A << /S /URI /URI ${pdfString(link.uri)} >> >>`
			);
			return `${id} 0 R`;
		});
		const fonts = [...usedFonts].map((name) => `/${name} ${fontIds.get(name)} 0 R`).join(' ');
		const images = [...usedImages]
			.map((name) => `/${name} ${imageObjects.get(name)} 0 R`)
			.join(' ');
		put(
			pageId,
			`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_WIDTH_PT} ${PAGE_HEIGHT_PT}] /Resources << /ProcSet [/PDF /Text /ImageC] /Font << ${fonts} >> /XObject << ${images} >> >> /Contents ${contentId} 0 R${annots.length ? ` /Annots [${annots.join(' ')}]` : ''} >>`
		);
	}

	put(
		pagesId,
		`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`
	);
	let dataRef = '';
	if (input.data !== undefined) {
		const dataId = alloc();
		putStream(dataId, '/Type /CVMakerData', latin1(input.data), false);
		dataRef = ` /CVMakerData ${dataId} 0 R`;
	}
	const lang = input.lang ? ` /Lang ${pdfString(input.lang)}` : '';
	put(catalogId, `<< /Type /Catalog /Pages ${pagesId} 0 R${lang}${dataRef} >>`);
	const info = input.info ?? {};
	const date = new Date()
		.toISOString()
		.replace(/[-:T]/g, '')
		.replace(/\.\d+Z$/, 'Z');
	put(
		infoId,
		`<< ${info.title ? `/Title ${pdfString(info.title)} ` : ''}${info.author ? `/Author ${pdfString(info.author)} ` : ''}${info.subject ? `/Subject ${pdfString(info.subject)} ` : ''}${info.keywords ? `/Keywords ${pdfString(info.keywords)} ` : ''}/Creator (CV Maker) /Producer (CV Maker) /CreationDate (D:${date}) >>`
	);

	// File: header, objects, cross-reference table, trailer.
	const header = latin1('%PDF-1.7\n%\xe2\xe3\xcf\xd3\n');
	const offsets: number[] = [];
	let length = header.length;
	for (const object of objects) {
		if (!object) throw new Error('pdf: object not written');
		offsets.push(length);
		length += object.length;
	}
	let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
	for (const offset of offsets) xref += `${String(offset).padStart(10, '0')} 00000 n \n`;
	xref += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R /Info ${infoId} 0 R >>\nstartxref\n${length}\n%%EOF\n`;
	const tail = encoder.encode(xref);
	const out = new Uint8Array(length + tail.length);
	out.set(header);
	let position = header.length;
	for (const object of objects) {
		out.set(object!, position);
		position += object!.length;
	}
	out.set(tail, position);
	return out;
}
