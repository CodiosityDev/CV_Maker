/**
 * WinAnsiEncoding (PDF 32000-1 Annex D) for the simple fonts of generated PDFs.
 * Text outside it cannot be drawn with these fonts: `encodeWinAnsi` reports it.
 */

/** Unicode → WinAnsi for the 0x80–0x9F block (the rest of 0x20–0xFF is Latin-1 as is). */
const SPECIAL: Record<number, number> = {
	0x20ac: 0x80,
	0x201a: 0x82,
	0x0192: 0x83,
	0x201e: 0x84,
	0x2026: 0x85,
	0x2020: 0x86,
	0x2021: 0x87,
	0x02c6: 0x88,
	0x2030: 0x89,
	0x0160: 0x8a,
	0x2039: 0x8b,
	0x0152: 0x8c,
	0x017d: 0x8e,
	0x2018: 0x91,
	0x2019: 0x92,
	0x201c: 0x93,
	0x201d: 0x94,
	0x2022: 0x95,
	0x2013: 0x96,
	0x2014: 0x97,
	0x02dc: 0x98,
	0x2122: 0x99,
	0x0161: 0x9a,
	0x203a: 0x9b,
	0x0153: 0x9c,
	0x017e: 0x9e,
	0x0178: 0x9f
};

/** Characters drawn as another one (same look in a CV). */
const SUBSTITUTE: Record<number, number> = {
	0x00a0: 0x20, // no-break space
	0x2009: 0x20, // thin space
	0x202f: 0x20, // narrow no-break space
	0x2010: 0x2d, // hyphen
	0x2011: 0x2d, // non-breaking hyphen
	0x2212: 0x2d, // minus sign
	0x2032: 0x27, // prime
	0x00ad: -1 // soft hyphen: invisible
};

/** WinAnsi code for a Unicode code point; -1 = draw nothing; undefined = not encodable. */
export function winAnsiCode(codePoint: number): number | undefined {
	const substitute = SUBSTITUTE[codePoint];
	if (substitute !== undefined) return substitute;
	if ((codePoint >= 0x20 && codePoint <= 0x7e) || (codePoint >= 0xa1 && codePoint <= 0xff))
		return codePoint;
	return SPECIAL[codePoint];
}

/** Unicode code point of a WinAnsi code (for font cmap lookups). */
export function unicodeOf(code: number): number | undefined {
	if ((code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff)) return code;
	for (const [unicode, value] of Object.entries(SPECIAL))
		if (value === code) return Number(unicode);
	return undefined;
}

/** True when every character can be drawn (else the PDF would show "?" boxes). */
export function isWinAnsiText(text: string): boolean {
	for (const char of text) {
		const code = char.codePointAt(0)!;
		if (code === 0x0a || code === 0x0d || code === 0x09) continue;
		if (winAnsiCode(code) === undefined) return false;
	}
	return true;
}

/**
 * Glyph widths (1/1000 em) of Helvetica and Helvetica-Bold for WinAnsi codes 32–255 — the
 * metrics of the standard PDF fonts (identical to Arial, which the ATS templates use).
 */
export const HELVETICA_WIDTHS = [
	278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556,
	556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667,
	611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667,
	667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500,
	222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
	500, 556, 0, 222, 556, 333, 1000, 556, 556, 333, 1000, 667, 333, 1000, 0, 611, 0, 0, 222, 222,
	333, 333, 350, 556, 1000, 333, 1000, 500, 333, 944, 0, 500, 667, 278, 333, 556, 556, 556, 556,
	260, 556, 333, 737, 370, 556, 584, 0, 737, 552, 400, 549, 333, 333, 333, 576, 537, 333, 333, 333,
	365, 556, 834, 834, 834, 611, 667, 667, 667, 667, 667, 667, 1000, 722, 667, 667, 667, 667, 278,
	278, 278, 278, 722, 722, 778, 778, 778, 778, 778, 584, 778, 722, 722, 722, 722, 667, 667, 611,
	556, 556, 556, 556, 556, 556, 889, 500, 556, 556, 556, 556, 278, 278, 278, 278, 556, 556, 556,
	556, 556, 556, 556, 549, 611, 556, 556, 556, 556, 500, 556, 500
];
export const HELVETICA_BOLD_WIDTHS = [
	278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556,
	556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667,
	611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667,
	667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556,
	278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584,
	500, 556, 0, 278, 556, 500, 1000, 556, 556, 333, 1000, 667, 333, 1000, 0, 611, 0, 0, 278, 278,
	500, 500, 350, 556, 1000, 333, 1000, 556, 333, 944, 0, 500, 667, 278, 333, 556, 556, 556, 556,
	280, 556, 333, 737, 370, 556, 584, 0, 737, 552, 400, 549, 333, 333, 333, 576, 556, 333, 333, 333,
	365, 556, 834, 834, 834, 611, 722, 722, 722, 722, 722, 722, 1000, 722, 667, 667, 667, 667, 278,
	278, 278, 278, 722, 722, 778, 778, 778, 778, 778, 584, 778, 722, 722, 722, 722, 667, 667, 611,
	556, 556, 556, 556, 556, 556, 889, 556, 556, 556, 556, 556, 278, 278, 278, 278, 611, 611, 611,
	611, 611, 611, 611, 549, 611, 611, 611, 611, 611, 556, 611, 556
];
