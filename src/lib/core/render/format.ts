import type { DateRange, Locale, YearMonth } from '../schema/types';
import { CV_LABELS } from './labels';

const formatters = new Map<Locale, Intl.DateTimeFormat>();

function monthFormatter(locale: Locale): Intl.DateTimeFormat {
	let formatter = formatters.get(locale);
	if (!formatter) {
		formatter = new Intl.DateTimeFormat(locale === 'id' ? 'id-ID' : 'en-US', {
			month: 'short',
			year: 'numeric',
			timeZone: 'UTC'
		});
		formatters.set(locale, formatter);
	}
	return formatter;
}

/** '2024-07' → 'Jul 2024'. Returns undefined for missing/invalid input. */
export function formatYearMonth(value: YearMonth | undefined, locale: Locale): string | undefined {
	if (!value) return undefined;
	const match = /^(\d{4})-(\d{2})$/.exec(value);
	if (!match) return undefined;
	const year = Number(match[1]);
	const month = Number(match[2]);
	if (month < 1 || month > 12) return undefined;
	// Strip the trailing "." some locales add to abbreviated months.
	return monthFormatter(locale)
		.format(new Date(Date.UTC(year, month - 1, 1)))
		.replace('.', '');
}

/**
 * 'Jul 2024 – Sekarang', 'Feb 2023 – Jun 2023', 'Mar 2024'.
 * Returns undefined when there is nothing to show.
 */
export function formatDateRange(range: DateRange | undefined, locale: Locale): string | undefined {
	if (!range) return undefined;
	const start = formatYearMonth(range.start, locale);
	const end = range.current ? CV_LABELS[locale].present : formatYearMonth(range.end, locale);
	if (start && end) return start === end ? start : `${start} – ${end}`;
	return start ?? end;
}

/** Characters allowed in a tel: link. */
export function phoneHref(phone: string): string | undefined {
	const digits = phone.replace(/[^\d+]/g, '');
	return /^\+?\d{6,15}$/.test(digits) ? `tel:${digits}` : undefined;
}
