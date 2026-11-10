/**
 * Date ranges written in CVs ("Jan 2024 – Jun 2024", "2021 - 2025", "Agustus 2022 - Sekarang",
 * "03/2023 – present") → DateRange. A year without a month becomes YYYY-01 and is reported as
 * guessed, so the UI can ask the user to check it.
 */
import type { DateRange, YearMonth } from '../schema/types';

const MONTHS: Record<string, number> = {
	jan: 1,
	januari: 1,
	january: 1,
	feb: 2,
	februari: 2,
	february: 2,
	peb: 2,
	mar: 3,
	maret: 3,
	march: 3,
	apr: 4,
	april: 4,
	mei: 5,
	may: 5,
	jun: 6,
	juni: 6,
	june: 6,
	jul: 7,
	juli: 7,
	july: 7,
	agu: 8,
	agt: 8,
	ags: 8,
	agus: 8,
	agustus: 8,
	aug: 8,
	august: 8,
	sep: 9,
	sept: 9,
	september: 9,
	okt: 10,
	oct: 10,
	oktober: 10,
	october: 10,
	nov: 11,
	nop: 11,
	november: 11,
	nopember: 11,
	des: 12,
	dec: 12,
	desember: 12,
	december: 12
};
const MONTH_WORD = Object.keys(MONTHS)
	.sort((a, b) => b.length - a.length)
	.join('|');
const PRESENT =
	'sekarang|saat ini|kini|present|now|current|current(?:ly)?|today|hingga kini|sampai sekarang';
// One point in time: "Jan 2024", "Januari 2024", "01/2024", "2024-01", "2024".
const POINT = `(?:(?:${MONTH_WORD})\\.?\\s+(?:19|20)\\d{2}|\\d{1,2}[/.-](?:19|20)\\d{2}|(?:19|20)\\d{2}[/.-]\\d{1,2}|(?:19|20)\\d{2})`;
const RANGE = new RegExp(
	`(${POINT})\\s*(?:-|–|—|s\\.?d\\.?|sampai|hingga|to|until)\\s*(${POINT}|${PRESENT})`,
	'i'
);
const SINGLE = new RegExp(`(${POINT})`, 'i');
const PRESENT_RE = new RegExp(`^(?:${PRESENT})$`, 'i');

export interface ParsedPoint {
	value: YearMonth;
	/** true when only the year was written. */
	guessed: boolean;
}

/** "Jan 2024" → { '2024-01' }, "2024" → { '2024-01', guessed }. */
export function parsePoint(text: string): ParsedPoint | undefined {
	const raw = text.trim().toLowerCase().replace(/\.$/, '');
	let match = raw.match(new RegExp(`^(${MONTH_WORD})\\.?\\s+((?:19|20)\\d{2})$`));
	if (match) return point(Number(match[2]), MONTHS[match[1] as string]);
	match = raw.match(/^(\d{1,2})[/.-]((?:19|20)\d{2})$/);
	if (match) return point(Number(match[2]), Number(match[1]));
	match = raw.match(/^((?:19|20)\d{2})[/.-](\d{1,2})$/);
	if (match) return point(Number(match[1]), Number(match[2]));
	match = raw.match(/^((?:19|20)\d{2})$/);
	if (match) return { ...point(Number(match[1]), 1)!, guessed: true };
	return undefined;
}

function point(year: number, month: number | undefined): ParsedPoint | undefined {
	if (!month || month < 1 || month > 12 || year < 1950 || year > 2100) return undefined;
	return { value: `${year}-${String(month).padStart(2, '0')}`, guessed: false };
}

export interface FoundDates {
	range: DateRange;
	/** Some month was not written (YYYY-01 was used). */
	guessed: boolean;
	/** The text with the date part removed (and dangling separators trimmed). */
	rest: string;
}

/** Finds the first date range (or single date) in a line. */
export function findDates(line: string): FoundDates | undefined {
	const range = line.match(RANGE);
	if (range && range.index !== undefined) {
		const start = parsePoint(range[1] as string);
		const endText = (range[2] as string).trim();
		const current = PRESENT_RE.test(endText);
		const end = current ? undefined : parsePoint(endText);
		if (start) {
			return {
				range: { start: start.value, end: end?.value, current },
				guessed: start.guessed || Boolean(end?.guessed),
				rest: cut(line, range.index, range[0].length)
			};
		}
	}
	const single = line.match(SINGLE);
	if (single && single.index !== undefined) {
		const at = parsePoint(single[1] as string);
		if (at) {
			return {
				range: { start: at.value, end: at.value, current: false },
				guessed: at.guessed,
				rest: cut(line, single.index, single[0].length)
			};
		}
	}
	return undefined;
}

function cut(line: string, index: number, length: number): string {
	return `${line.slice(0, index)} ${line.slice(index + length)}`
		.replace(/[([]\s*[)\]]/g, ' ')
		.replace(/\s{2,}/g, ' ')
		.replace(/^[\s,|·•–—-]+|[\s,|·•–—(-]+$/g, '')
		.trim();
}
