/**
 * DOCX → plain text. A .docx is a ZIP of XML files; only the main document, headers and footers are
 * read. A small streaming tag scanner (linear time, no DOM) keeps it usable in a worker and safe on
 * hostile files: entries are size-checked BEFORE they are inflated (zip bombs).
 */
import { strFromU8, unzipSync } from 'fflate';
import { ScanError, type ExtractedCv } from './types';
import { estimatePages, normalizeLines } from './text';

/** Largest XML part we inflate (a long CV is < 1 MB of XML). */
const MAX_PART_BYTES = 8 * 1024 * 1024;

const ENTITY: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

function decodeEntities(text: string): string {
	return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, name: string) => {
		if (name[0] === '#') {
			const code =
				name[1] === 'x' || name[1] === 'X' ? parseInt(name.slice(2), 16) : +name.slice(1);
			return Number.isFinite(code) && code > 0 && code <= 0x10ffff
				? String.fromCodePoint(code)
				: '';
		}
		return ENTITY[name.toLowerCase()] ?? match;
	});
}

interface PartText {
	text: string;
	tables: boolean;
	textBoxes: boolean;
}

// One token per tag we care about, or a run of text. Other tags are matched and ignored.
const TOKEN = /<(\/?)([\w:]+)[^>]*?(\/?)>|([^<]+)/g;

/** Text of one WordprocessingML part, one paragraph per line; list items start with "• ". */
export function wordXmlToText(xml: string): PartText {
	const lines: string[] = [];
	let line = '';
	let inText = false;
	let fallbackDepth = 0; // <mc:Fallback> repeats text boxes for old Word versions: skip it
	let listItem = false;
	let tables = false;
	let textBoxes = false;

	for (const match of xml.matchAll(TOKEN)) {
		const [, closing, name, selfClosing, text] = match;
		if (text !== undefined) {
			if (inText && fallbackDepth === 0) line += decodeEntities(text);
			continue;
		}
		if (name === 'mc:Fallback') {
			if (!selfClosing) fallbackDepth += closing ? -1 : 1;
			if (fallbackDepth < 0) fallbackDepth = 0;
			continue;
		}
		if (fallbackDepth > 0) continue;
		switch (name) {
			case 'w:t':
				inText = !closing && !selfClosing;
				break;
			case 'w:tab':
				if (!closing) line += '\t';
				break;
			case 'w:br':
			case 'w:cr':
				if (!closing) {
					lines.push((listItem ? '• ' : '') + line);
					line = '';
					listItem = false;
				}
				break;
			case 'w:numPr':
				if (!closing) listItem = true;
				break;
			case 'w:tbl':
				tables = true;
				break;
			case 'w:txbxContent':
				textBoxes = true;
				break;
			case 'w:p':
				if (closing) {
					lines.push((listItem ? '• ' : '') + line);
					line = '';
					listItem = false;
				} else if (!selfClosing) {
					// A new paragraph inside an unfinished one (text box): close the outer line first.
					if (line) lines.push(line);
					line = '';
					listItem = false;
				}
				break;
		}
	}
	if (line) lines.push(line);
	return { text: lines.join('\n'), tables, textBoxes };
}

const CONTACT = /[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,24}|(?:\+62|62|0)8\d[\d\s.-]{6,20}/i;

/** Reads a .docx file (bytes). Throws ScanError. */
export function extractDocx(bytes: Uint8Array): ExtractedCv {
	let files: Record<string, Uint8Array>;
	let images = 0;
	try {
		files = unzipSync(bytes, {
			filter(file) {
				if (/^word\/media\//.test(file.name)) images += 1;
				const wanted =
					file.name === 'word/document.xml' || /^word\/(header|footer)\d*\.xml$/.test(file.name);
				if (wanted && file.originalSize > MAX_PART_BYTES) throw new ScanError('damaged');
				return wanted;
			}
		});
	} catch (error) {
		throw error instanceof ScanError ? error : new ScanError('damaged');
	}
	const document = files['word/document.xml'];
	if (!document) throw new ScanError('unsupported');

	const body = wordXmlToText(strFromU8(document));
	const edges = Object.keys(files)
		.filter((name) => name !== 'word/document.xml')
		.map((name) => wordXmlToText(strFromU8(files[name] as Uint8Array)).text)
		.join('\n');
	const bodyText = normalizeLines(body.text);
	// Header/footer text first, as Word shows it: contact details there still count as present.
	const text = normalizeLines(`${edges}\n${bodyText}`);
	if (!text) throw new ScanError('empty');

	return {
		kind: 'docx',
		text,
		pages: estimatePages(bodyText),
		layout: {
			imageOnly: false,
			columns: false,
			tables: body.tables,
			textBoxes: body.textBoxes,
			images,
			contactInHeaderFooter: CONTACT.test(edges) && !CONTACT.test(bodyText)
		}
	};
}
