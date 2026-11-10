/**
 * PDF → plain text with pdf.js (lazy-loaded: only downloaded when someone scans a PDF).
 * Hardened for untrusted files: no scripting/XFA, no font loading, no network (the file is read from
 * memory), parsing happens in pdf.js's own worker.
 */
import { ScanError, SCAN_MAX_PAGES, type ExtractedCv } from './types';
import { pdfPagesToText, type PdfPageText } from './text';

interface PdfJsTextItem {
	str?: unknown;
	transform?: unknown;
	width?: unknown;
	height?: unknown;
}

let pdfjsPromise: Promise<typeof import('pdfjs-dist')> | undefined;

async function loadPdfJs(): Promise<typeof import('pdfjs-dist')> {
	// `?worker`: bundled by Vite as a normal same-origin .js worker (no .mjs MIME surprises on Apache).
	pdfjsPromise ??= Promise.all([
		import('pdfjs-dist'),
		import('pdfjs-dist/build/pdf.worker.min.mjs?worker')
	]).then(([pdfjs, { default: PdfWorker }]) => {
		pdfjs.GlobalWorkerOptions.workerPort = new PdfWorker();
		return pdfjs;
	});
	try {
		return await pdfjsPromise;
	} catch (error) {
		pdfjsPromise = undefined; // e.g. offline on first use: allow a retry
		throw error;
	}
}

function toItem(raw: PdfJsTextItem): PdfPageText['items'][number] | undefined {
	if (typeof raw.str !== 'string' || !Array.isArray(raw.transform)) return undefined;
	const [, , , , x, y] = raw.transform as number[];
	if (typeof x !== 'number' || typeof y !== 'number') return undefined;
	return {
		str: raw.str,
		x,
		y,
		width: typeof raw.width === 'number' ? raw.width : 0,
		height: typeof raw.height === 'number' ? Math.abs(raw.height) : 0
	};
}

/** Reads a PDF (bytes). Throws ScanError. */
export async function extractPdf(bytes: Uint8Array): Promise<ExtractedCv> {
	let pdfjs: typeof import('pdfjs-dist');
	try {
		pdfjs = await loadPdfJs();
	} catch {
		throw new ScanError('failed');
	}

	const task = pdfjs.getDocument({
		data: bytes,
		disableFontFace: true,
		useSystemFonts: false,
		useWorkerFetch: false,
		enableXfa: false,
		stopAtErrors: false,
		isOffscreenCanvasSupported: false
	});
	try {
		const doc = await task.promise;
		const pageCount = doc.numPages;
		const pages: PdfPageText[] = [];
		let images = 0;
		let emptyPages = 0;
		const { OPS } = pdfjs;
		const imageOps = new Set<number>([
			OPS.paintImageXObject,
			OPS.paintInlineImageXObject,
			OPS.paintImageMaskXObject
		]);

		for (let number = 1; number <= Math.min(pageCount, SCAN_MAX_PAGES); number += 1) {
			const page = await doc.getPage(number);
			const [, , width = 595] = page.view;
			const content = await page.getTextContent();
			const items = (content.items as PdfJsTextItem[])
				.map(toItem)
				.filter((item) => item !== undefined);
			if (!items.some((item) => item.str.trim())) emptyPages += 1;
			pages.push({ width, items });
			const ops = await page.getOperatorList();
			images += ops.fnArray.filter((op) => imageOps.has(op)).length;
			page.cleanup();
		}

		const { text, columns } = pdfPagesToText(pages);
		return {
			kind: 'pdf',
			text,
			pages: pageCount,
			layout: {
				imageOnly: pages.length > 0 && emptyPages === pages.length,
				columns,
				tables: false,
				textBoxes: false,
				images,
				contactInHeaderFooter: false
			}
		};
	} catch (error) {
		if (error instanceof ScanError) throw error;
		const name = error instanceof Error ? error.name : '';
		if (name === 'PasswordException') throw new ScanError('encrypted');
		if (name === 'InvalidPDFException') throw new ScanError('damaged');
		throw new ScanError('failed');
	} finally {
		void task.destroy();
	}
}
