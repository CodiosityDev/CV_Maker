/**
 * Browser only: reads a laid-out CV template into PDF pages (display lists for `buildPdf`).
 *
 * The template is laid out inside a multi-column box one A4 page tall with A4-wide columns, so the
 * browser itself splits it into pages exactly like printing does (`break-inside: avoid`, floats,
 * min-height …): column N is page N. Then every box and every character is read back with
 * getClientRects() — the PDF puts each glyph where the browser drew it.
 *
 * Drawn: background colours, solid borders (also rounded), photos (object-fit: cover, clipped to
 * the border radius), absolutely positioned empty ::before/::after dots, disc list markers, text,
 * and link areas. That is everything the CV templates use.
 */
import {
	PAGE_HEIGHT_PX,
	PAGE_WIDTH_PX,
	type Corners,
	type DrawOp,
	type FontRef,
	type PdfImage,
	type PdfPage,
	type Rgb,
	type Shape
} from './document';
import { winAnsiCode } from './winansi';

/** Which embedded font file a text style needs (fonts not listed fall back to Helvetica). */
export type FontPicker = (family: string, weight: number, italic: boolean) => FontRef;

export const helveticaFont = (weight: number, italic: boolean): FontRef => ({
	standard:
		weight >= 600
			? italic
				? 'Helvetica-BoldOblique'
				: 'Helvetica-Bold'
			: italic
				? 'Helvetica-Oblique'
				: 'Helvetica'
});

export interface CaptureResult {
	pages: PdfPage[];
	/** Text that could not be encoded (non-Latin scripts, emoji): drawn as nothing. */
	unsupported: boolean;
}

function parseColor(value: string): { rgb: Rgb; alpha: number } | undefined {
	const match = /rgba?\(([^)]+)\)/.exec(value);
	if (!match) return undefined;
	const parts = match[1]!
		.split(/[\s,/]+/)
		.filter(Boolean)
		.map(Number);
	if (parts.length < 3 || parts.some((n) => Number.isNaN(n))) return undefined;
	const alpha = parts[3] ?? 1;
	if (alpha <= 0.01) return undefined;
	// Translucent colours are mixed with the white paper.
	const mix = (c: number) => Math.round(c * alpha + 255 * (1 - alpha));
	return { rgb: [mix(parts[0]!), mix(parts[1]!), mix(parts[2]!)], alpha };
}

const px = (value: string) => Number.parseFloat(value) || 0;

/** CSS border-radius of one corner → [rx, ry] in px for a box of w × h. */
function cornerRadius(value: string, w: number, h: number): [number, number] {
	const [first = '0', second = first] = value.split(' ');
	const resolve = (part: string, size: number) =>
		part.endsWith('%') ? (px(part) / 100) * size : px(part);
	return [resolve(first, w), resolve(second, h)];
}

function corners(style: CSSStyleDeclaration, w: number, h: number): Corners | undefined {
	const list: Corners = [
		cornerRadius(style.borderTopLeftRadius, w, h),
		cornerRadius(style.borderTopRightRadius, w, h),
		cornerRadius(style.borderBottomRightRadius, w, h),
		cornerRadius(style.borderBottomLeftRadius, w, h)
	];
	return list.some(([rx, ry]) => rx > 0 && ry > 0) ? list : undefined;
}

/** Same corners shrunk by the border widths (the padding box). */
function inset(
	list: Corners | undefined,
	top: number,
	right: number,
	bottom: number,
	left: number
) {
	if (!list) return undefined;
	const [tl, tr, br, bl] = list as [
		[number, number],
		[number, number],
		[number, number],
		[number, number]
	];
	return [
		[Math.max(0, tl[0] - left), Math.max(0, tl[1] - top)],
		[Math.max(0, tr[0] - right), Math.max(0, tr[1] - top)],
		[Math.max(0, br[0] - right), Math.max(0, br[1] - bottom)],
		[Math.max(0, bl[0] - left), Math.max(0, bl[1] - bottom)]
	] as Corners;
}

interface Box {
	page: number;
	x: number;
	y: number;
	w: number;
	h: number;
}

/** Photo as JPEG at print resolution, cropped like object-fit: cover. */
async function photoJpeg(
	img: HTMLImageElement,
	w: number,
	h: number
): Promise<PdfImage | undefined> {
	if (!img.naturalWidth || !img.naturalHeight || w <= 0 || h <= 0) return undefined;
	const density = Math.min(4, 1200 / Math.max(w, h));
	const width = Math.max(1, Math.round(w * density));
	const height = Math.max(1, Math.round(h * density));
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	const context = canvas.getContext('2d');
	if (!context) return undefined;
	context.fillStyle = '#fff';
	context.fillRect(0, 0, width, height);
	const fit = getComputedStyle(img).objectFit;
	const scale =
		fit === 'contain'
			? Math.min(width / img.naturalWidth, height / img.naturalHeight)
			: fit === 'fill'
				? NaN
				: Math.max(width / img.naturalWidth, height / img.naturalHeight);
	if (Number.isNaN(scale)) context.drawImage(img, 0, 0, width, height);
	else {
		const dw = img.naturalWidth * scale;
		const dh = img.naturalHeight * scale;
		context.drawImage(img, (width - dw) / 2, (height - dh) / 2, dw, dh);
	}
	const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, 'image/jpeg', 0.9));
	if (!blob) return undefined;
	return { jpeg: new Uint8Array(await blob.arrayBuffer()), width, height };
}

/**
 * Reads `root` — a multi-column box (`column-width` = A4 width, height = A4 height) holding the
 * template — into PDF pages.
 */
export async function capturePages(
	root: HTMLElement,
	pickFont: FontPicker
): Promise<CaptureResult> {
	const origin = root.getBoundingClientRect();
	const count = Math.max(1, Math.ceil(root.scrollWidth / PAGE_WIDTH_PX - 0.05));
	const pages: PdfPage[] = Array.from({ length: count }, () => ({ ops: [], links: [] }));
	let unsupported = false;

	const locate = (
		rect: DOMRect | { left: number; top: number; width: number; height: number }
	): Box => {
		const left = rect.left - origin.left;
		const page = Math.min(count - 1, Math.max(0, Math.floor((left + 1) / PAGE_WIDTH_PX)));
		return {
			page,
			x: left - page * PAGE_WIDTH_PX,
			y: rect.top - origin.top,
			w: rect.width,
			h: rect.height
		};
	};
	const visible = (box: Box) => box.w > 0.01 && box.h > 0.01 && box.y < PAGE_HEIGHT_PX + 1;
	const push = (page: number, op: DrawOp) => pages[page]?.ops.push(op);

	/** Background + borders of one box (CSS box model, solid borders). */
	function paintBox(style: CSSStyleDeclaration, box: Box, first: boolean, last: boolean) {
		const background = parseColor(style.backgroundColor);
		const widths = {
			top: style.borderTopStyle === 'none' || !first ? 0 : px(style.borderTopWidth),
			right: style.borderRightStyle === 'none' ? 0 : px(style.borderRightWidth),
			bottom: style.borderBottomStyle === 'none' || !last ? 0 : px(style.borderBottomWidth),
			left: style.borderLeftStyle === 'none' ? 0 : px(style.borderLeftWidth)
		};
		const round = corners(style, box.w, box.h);
		const borderColors = {
			top: parseColor(style.borderTopColor),
			right: parseColor(style.borderRightColor),
			bottom: parseColor(style.borderBottomColor),
			left: parseColor(style.borderLeftColor)
		};
		const outer: Shape = { x: box.x, y: box.y, w: box.w, h: box.h, corners: round };
		const inner: Shape = {
			x: box.x + widths.left,
			y: box.y + widths.top,
			w: box.w - widths.left - widths.right,
			h: box.h - widths.top - widths.bottom,
			corners: inset(round, widths.top, widths.right, widths.bottom, widths.left)
		};
		const sides = (['top', 'right', 'bottom', 'left'] as const).filter(
			(side) => widths[side] > 0 && borderColors[side]
		);
		if (round && sides.length) {
			// Rounded border (photo frames, timeline dots): the border colour, then the inside on top.
			push(box.page, { kind: 'fill', shape: outer, color: borderColors[sides[0]!]!.rgb });
			push(box.page, {
				kind: 'fill',
				shape: inner,
				color: background?.rgb ?? [255, 255, 255]
			});
			return inner;
		}
		if (background) push(box.page, { kind: 'fill', shape: outer, color: background.rgb });
		for (const side of sides) {
			const color = borderColors[side]!.rgb;
			const width = widths[side];
			const shape: Shape =
				side === 'top'
					? { x: box.x, y: box.y, w: box.w, h: width }
					: side === 'bottom'
						? { x: box.x, y: box.y + box.h - width, w: box.w, h: width }
						: side === 'left'
							? { x: box.x, y: box.y, w: width, h: box.h }
							: { x: box.x + box.w - width, y: box.y, w: width, h: box.h };
			push(box.page, { kind: 'fill', shape, color });
		}
		return inner;
	}

	/** Empty, absolutely positioned ::before/::after (e.g. the timeline dots). */
	function paintPseudo(element: Element, which: '::before' | '::after') {
		const style = getComputedStyle(element, which);
		if (style.content !== '""' && style.content !== "''") return;
		if (style.display === 'none' || (style.position !== 'absolute' && style.position !== 'fixed'))
			return;
		const host = getComputedStyle(element);
		if (host.position === 'static') return;
		const rect = element.getBoundingClientRect();
		const border = (side: 'Top' | 'Right' | 'Bottom' | 'Left') =>
			style[`border${side}Style`] === 'none' ? 0 : px(style[`border${side}Width`]);
		const extraW =
			style.boxSizing === 'border-box'
				? 0
				: border('Left') + border('Right') + px(style.paddingLeft) + px(style.paddingRight);
		const extraH =
			style.boxSizing === 'border-box'
				? 0
				: border('Top') + border('Bottom') + px(style.paddingTop) + px(style.paddingBottom);
		const left = rect.left + px(host.borderLeftWidth) + px(style.left);
		const top = rect.top + px(host.borderTopWidth) + px(style.top);
		const box = locate({
			left,
			top,
			width: px(style.width) + extraW,
			height: px(style.height) + extraH
		});
		if (visible(box)) paintBox(style, box, true, true);
	}

	const ascents = new Map<string, number>();
	const measure = document.createElement('canvas').getContext('2d');
	function ascentOf(style: CSSStyleDeclaration): number {
		const font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
		let ascent = ascents.get(font);
		if (ascent === undefined) {
			ascent = px(style.fontSize) * 0.9;
			if (measure) {
				measure.font = font;
				const metrics = measure.measureText('Hg');
				if (metrics.fontBoundingBoxAscent) ascent = metrics.fontBoundingBoxAscent;
			}
			ascents.set(font, ascent);
		}
		return ascent;
	}

	function fontOf(style: CSSStyleDeclaration): FontRef {
		return pickFont(
			style.fontFamily,
			Number(style.fontWeight) || 400,
			style.fontStyle !== 'normal'
		);
	}

	/** Every character of a text node, grouped into one text op per line. */
	function paintText(node: Text, style: CSSStyleDeclaration) {
		const text = node.data;
		if (!text.trim()) return;
		const color = parseColor(style.color)?.rgb ?? [0, 0, 0];
		const size = px(style.fontSize);
		const font = fontOf(style);
		const ascent = ascentOf(style);
		const upper = style.textTransform === 'uppercase';
		const range = document.createRange();
		let run: { page: number; top: number; y: number; codes: number[]; xs: number[] } | undefined;
		const flush = () => {
			if (run?.codes.length)
				push(run.page, { kind: 'text', font, size, color, y: run.y, codes: run.codes, xs: run.xs });
			run = undefined;
		};
		for (let i = 0; i < text.length; i++) {
			const unit = text.charCodeAt(i);
			const pair = unit >= 0xd800 && unit <= 0xdbff && i + 1 < text.length;
			const end = pair ? i + 2 : i + 1;
			let char = text.slice(i, end);
			if (upper) char = char.toUpperCase();
			const codePoint = char.codePointAt(0)!;
			range.setStart(node, i);
			range.setEnd(node, end);
			if (pair) i++;
			if (codePoint === 0x0a || codePoint === 0x0d) continue;
			const rect = range.getClientRects()[0];
			const space = codePoint === 0x20 || codePoint === 0x09;
			if (!rect || (rect.width < 0.01 && (space || rect.height < 0.01))) continue;
			const code = space ? 0x20 : winAnsiCode(codePoint);
			if (code === undefined) {
				unsupported = true;
				continue;
			}
			if (code < 0) continue;
			const box = locate(rect);
			if (
				!run ||
				run.page !== box.page ||
				Math.abs(run.top - box.y) > 0.5 ||
				box.x < (run.xs.at(-1) ?? 0) - 0.5
			) {
				flush();
				run = { page: box.page, top: box.y, y: box.y + ascent, codes: [], xs: [] };
			}
			run.codes.push(code);
			run.xs.push(box.x);
		}
		flush();
		range.detach();
	}

	/** Disc bullet of a list item, left of its first line (as browsers draw "• "). */
	function paintMarker(item: HTMLElement, style: CSSStyleDeclaration) {
		if (style.listStyleType !== 'disc' || style.listStylePosition !== 'outside') return;
		const walker = document.createTreeWalker(item, NodeFilter.SHOW_TEXT);
		const range = document.createRange();
		for (
			let node = walker.nextNode() as Text | null;
			node;
			node = walker.nextNode() as Text | null
		) {
			const index = node.data.search(/\S/);
			if (index < 0) continue;
			range.setStart(node, index);
			range.setEnd(node, index + 1);
			const rect = range.getClientRects()[0];
			if (!rect) continue;
			const textStyle = getComputedStyle(node.parentElement ?? item);
			const itemRect = item.getClientRects()[0] ?? rect;
			const contentLeft = itemRect.left + px(style.borderLeftWidth) + px(style.paddingLeft);
			// Drawn like Chromium's disc marker: a circle ascent/3 wide, 7 px before the text, its
			// top half an ascent below the top of the first line's text.
			const ascent = Math.round(ascentOf(style));
			const diameter = Math.floor((Math.floor((ascent * 2) / 3) + 1) / 2);
			const lineTop = rect.top + ascentOf(textStyle) - ascentOf(style);
			const top = lineTop + Math.floor((3 * (ascent - Math.floor((ascent * 2) / 3))) / 2);
			const box = locate({
				left: contentLeft - 7 - diameter,
				top,
				width: diameter,
				height: diameter
			});
			push(box.page, {
				kind: 'fill',
				shape: { ...box, corners: Array.from({ length: 4 }, () => [diameter, diameter]) },
				color: parseColor(style.color)?.rgb ?? [0, 0, 0]
			});
			return;
		}
	}

	async function walk(element: Element) {
		const style = getComputedStyle(element);
		if (style.display === 'none') return;
		const shown = style.visibility !== 'hidden' && Number(style.opacity) > 0.01;
		if (shown && element !== root) {
			const rects = [...element.getClientRects()];
			let inner: Shape | undefined;
			rects.forEach((rect, index) => {
				const box = locate(rect);
				if (!visible(box)) return;
				const content = paintBox(style, box, index === 0, index === rects.length - 1);
				if (index === 0) inner = { ...content, x: box.x + (content.x - box.x), y: content.y };
				if (element instanceof HTMLAnchorElement && /^(https?:|mailto:|tel:)/i.test(element.href))
					pages[box.page]?.links.push({
						x: box.x,
						y: box.y,
						w: box.w,
						h: box.h,
						uri: element.href
					});
			});
			if (element instanceof HTMLImageElement && rects[0] && inner) {
				const box = locate(rects[0]);
				const padding = {
					top: px(style.paddingTop),
					right: px(style.paddingRight),
					bottom: px(style.paddingBottom),
					left: px(style.paddingLeft)
				};
				const shape: Shape = {
					x: inner.x + padding.left,
					y: inner.y + padding.top,
					w: inner.w - padding.left - padding.right,
					h: inner.h - padding.top - padding.bottom,
					corners: inner.corners
				};
				const image = await photoJpeg(element, shape.w, shape.h);
				if (image)
					push(box.page, {
						kind: 'image',
						shape: { x: shape.x, y: shape.y, w: shape.w, h: shape.h },
						clip: shape.corners ? shape : undefined,
						image
					});
			}
			if (style.display === 'list-item' && element instanceof HTMLElement)
				paintMarker(element, style);
			paintPseudo(element, '::before');
		}
		for (const child of element.childNodes) {
			if (child.nodeType === Node.TEXT_NODE) {
				if (shown) paintText(child as Text, style);
			} else if (child instanceof Element && !(child instanceof SVGElement)) await walk(child);
		}
		if (shown && element !== root) paintPseudo(element, '::after');
	}

	await walk(root);
	return { pages, unsupported };
}
