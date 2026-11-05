/**
 * Indonesian-first phone handling. Accepts what people actually type:
 * '0812 3456 7890', '62812-3456-7890', '+62 812 3456 7890', '(0812) 3456-7890'.
 */

/** Digits with an optional leading '+'. */
function compact(input: string): string {
	const trimmed = input.trim();
	const digits = trimmed.replace(/\D/g, '');
	return trimmed.startsWith('+') ? `+${digits}` : digits;
}

function toE164(input: string): string | undefined {
	let value = compact(input);
	if (value.startsWith('+')) {
		// International number
	} else if (value.startsWith('62')) {
		value = `+${value}`;
	} else if (value.startsWith('0')) {
		value = `+62${value.slice(1)}`;
	} else if (value.startsWith('8')) {
		value = `+62${value}`;
	} else {
		return undefined;
	}
	const digits = value.slice(1);
	if (value.startsWith('+62')) {
		// Indonesian numbers: 9–12 digits after the country code (mobile & landline).
		const national = digits.slice(2);
		return /^[1-9]\d{7,11}$/.test(national) ? value : undefined;
	}
	return /^[1-9]\d{7,14}$/.test(digits) ? value : undefined;
}

export function isValidPhone(input: string): boolean {
	return toE164(input) !== undefined;
}

/**
 * Normalized display form, or `undefined` if it doesn't look like a phone number.
 * Indonesian mobile: '+62 812-3456-7890'. Other numbers: '+<digits>'.
 * Call on blur, not on every keystroke.
 */
export function normalizePhone(input: string): string | undefined {
	const e164 = toE164(input);
	if (!e164) return undefined;
	if (!e164.startsWith('+62')) return e164;
	const national = e164.slice(3);
	const groups = [national.slice(0, 3), national.slice(3, 7), national.slice(7)].filter(Boolean);
	return `+62 ${groups.join('-')}`;
}
