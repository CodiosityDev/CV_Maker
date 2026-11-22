/**
 * "Simpan PDF": builds the CV's PDF on this device and saves it straight to a file — no print
 * dialog. Chrome/Edge on a computer open a "Save as" window (the user picks the folder); other
 * browsers download it like any file.
 *
 * The PDF keeps the CV data (see core/pdf/payload.ts) so it can be uploaded again to keep editing.
 * Everything runs locally; nothing is sent anywhere. Loaded on demand (print page only).
 */
import { mount, tick, unmount } from 'svelte';
import type { CVDocument } from '#lib/core/schema/types.ts';
import { toRenderModel } from '#lib/core/render/index.ts';
import { assetRepo, backupRepo } from '#lib/core/storage/index.ts';
import { downloadBlob } from '#lib/core/export/index.ts';
import { resolveTemplate } from '#lib/templates/registry.ts';
import { buildPdf, PAGE_HEIGHT_PX, PAGE_WIDTH_PX, type FontRef } from '#lib/core/pdf/document.ts';
import { capturePages, helveticaFont } from '#lib/core/pdf/capture.ts';
import { parseTrueType, type TrueTypeFont } from '#lib/core/pdf/truetype.ts';
import { encodeCvPayload } from '#lib/core/pdf/payload.ts';

/** Plus Jakarta Sans (creative templates): static files in /static/fonts/pdf (OFL), 400/600/700. */
const jakartaKey = (weight: number, italic: boolean) => {
	const nearest = weight >= 650 ? 700 : weight >= 550 ? 600 : 400;
	return `jakarta-${nearest}-${italic ? 'italic' : 'normal'}`;
};

async function loadFont(key: string): Promise<TrueTypeFont | undefined> {
	try {
		const response = await fetch(`/fonts/pdf/plus-jakarta-sans-latin-${key.slice(8)}.woff`);
		if (!response.ok) return undefined;
		const [, weight, style] = key.split('-');
		const name =
			`PlusJakartaSans-${weight === '700' ? 'Bold' : weight === '600' ? 'SemiBold' : 'Regular'}${style === 'italic' ? 'Italic' : ''}`.replace(
				'RegularItalic',
				'Italic'
			);
		return parseTrueType(new Uint8Array(await response.arrayBuffer()), name);
	} catch {
		return undefined;
	}
}

export interface PdfResult {
	blob: Blob;
	/** Some characters (non-Latin script, emoji) cannot be shown in the PDF. */
	unsupported: boolean;
}

/** Lays the CV out off screen and turns it into a PDF file. */
export async function createCvPdf(
	cv: CVDocument,
	options: { embedData?: boolean } = {}
): Promise<PdfResult> {
	const meta = resolveTemplate(cv.templateId, cv.kind);
	const Template = (await meta.load()).default;
	let photoUrl: string | undefined;
	if (meta.supportsPhoto && cv.personal.photoAssetId)
		photoUrl = (await assetRepo.getPhotoUrl(cv.personal.photoAssetId)) ?? undefined;

	// Off-screen "printer": columns of one A4 page each.
	const host = document.createElement('div');
	host.setAttribute('aria-hidden', 'true');
	host.style.cssText = `position:fixed;left:-100000px;top:0;width:${PAGE_WIDTH_PX}px;pointer-events:none;contain:layout style;color-scheme:light;`;
	const pages = document.createElement('div');
	pages.style.cssText = `width:${PAGE_WIDTH_PX}px;height:${PAGE_HEIGHT_PX}px;column-width:${PAGE_WIDTH_PX}px;column-gap:0;column-fill:auto;background:#fff;color:#000;`;
	host.append(pages);
	document.body.append(host);
	let component: ReturnType<typeof mount> | undefined;
	try {
		component = mount(Template, {
			target: pages,
			props: { model: toRenderModel(cv, { photoUrl }) }
		});
		await tick();
		await document.fonts.ready;
		await Promise.all(
			[...pages.querySelectorAll('img')].map((img) => img.decode().catch(() => undefined))
		);

		const fonts: Record<string, TrueTypeFont> = {};
		const wanted = new Set<string>();
		// First pass decides which embedded fonts are needed; text falls back to Helvetica if a
		// font file cannot be loaded.
		const usesJakarta = (family: string) => /plus jakarta sans/i.test(family);
		for (const element of pages.querySelectorAll('*')) {
			const style = getComputedStyle(element);
			if (usesJakarta(style.fontFamily))
				wanted.add(jakartaKey(Number(style.fontWeight) || 400, style.fontStyle !== 'normal'));
		}
		await Promise.all(
			[...wanted].map(async (key) => {
				const font = await loadFont(key);
				if (font) fonts[key] = font;
			})
		);
		const pickFont = (family: string, weight: number, italic: boolean): FontRef => {
			const key = jakartaKey(weight, italic);
			return usesJakarta(family) && fonts[key] ? { embedded: key } : helveticaFont(weight, italic);
		};

		const captured = await capturePages(pages, pickFont);
		let data: string | undefined;
		if (options.embedData !== false) {
			const backup = await backupRepo.export([cv.id]);
			data = await encodeCvPayload(await backup.text());
		}
		const bytes = buildPdf({
			pages: captured.pages,
			fonts,
			data,
			lang: cv.locale,
			info: {
				title: [cv.personal.fullName, cv.targetRole].filter(Boolean).join(' – ') || cv.title,
				author: cv.personal.fullName || undefined,
				subject: 'Curriculum Vitae'
			}
		});
		return {
			blob: new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }),
			unsupported: captured.unsupported
		};
	} finally {
		if (component) await unmount(component);
		host.remove();
		if (photoUrl) URL.revokeObjectURL(photoUrl);
	}
}

interface SaveFilePicker {
	showSaveFilePicker?: (options: {
		suggestedName: string;
		types: { description: string; accept: Record<string, string[]> }[];
	}) => Promise<{
		createWritable(): Promise<{ write(data: Blob): Promise<void>; close(): Promise<void> }>;
	}>;
}

/** Writes the finished PDF to where the user chose. */
export type SaveTarget = (blob: Blob) => Promise<void>;

/**
 * Asks WHERE to save, right on the click (browsers allow the "Save as" window only then): Chrome
 * and Edge on a computer open it so the user picks the folder; other browsers download normally.
 * Resolves null when the user closed the window without choosing.
 */
export async function chooseSaveTarget(fileName: string): Promise<SaveTarget | null> {
	const picker = (window as unknown as SaveFilePicker).showSaveFilePicker;
	// Inside an iframe the picker is blocked; phones never have it.
	if (picker && window.self === window.top) {
		try {
			const handle = await picker.call(window, {
				suggestedName: fileName,
				types: [{ description: 'PDF', accept: { 'application/pdf': ['.pdf'] } }]
			});
			return async (blob) => {
				const writable = await handle.createWritable();
				await writable.write(blob);
				await writable.close();
			};
		} catch (error) {
			if (error instanceof DOMException && error.name === 'AbortError') return null;
			// Picker refused (policy, permissions): fall back to a download.
		}
	}
	return async (blob) => downloadBlob(blob, fileName);
}
