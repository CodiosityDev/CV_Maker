/**
 * Removes contact details from CV text before the AI review sees it (PROJECT_SPEC §12: the AI never
 * receives name, email, phone or links). Used by the browser AND again by the server.
 */
import { headingSection } from '../scan/analyze';

// Bounded repeats: the server runs these on untrusted text (no quadratic backtracking).
const EMAIL = /[^\s@<>()[\]:;,]{1,64}@[^\s@<>()[\]:;,]{1,190}\.[a-z]{2,24}/gi;
const URL =
	/\b(?:https?:\/\/|www\.)\S+|\b[\w-]{1,63}(?:\.[\w-]{1,63}){0,4}\.(?:com|id|net|org|io|dev|me|co|app|xyz|link)\b(?:\/\S*)?/gi;
// Phone-like: 9+ digits with optional + ( ) . - and spaces between them — never across lines
// ("2021 - 2025" above a phone number must survive).
const PHONE = /(?:\+|\b)\d[\d \t().-]{7,24}\d\b/g;
const HANDLE = /(?<![\w.])@[\w.]{2,40}/g;
/** "Alamat:", "Address:", "Domisili:" lines carry the home address. */
const ADDRESS_LINE =
	/^(?:alamat|domisili|address|tempat(?:,)? tanggal lahir|ttl|date of birth)\b.*$/gim;
/** Personal data lines common in Indonesian CVs. */
const PERSONAL_LINE =
	/^(?:nama(?: lengkap)?|name|full name|jenis kelamin|gender|agama|religion|status(?: perkawinan)?|marital status|tanggal lahir|tempat lahir|nik|no\.? ktp|kewarganegaraan|nationality)\s*[:：].*$/gim;
/** Lines that are only one or two words like "Email", "Telepon", "LinkedIn" (labels left behind). */
const LABEL_ONLY =
	/^(?:e-?mail|telepon|telp|phone|hp|no\.? hp|whatsapp|wa|linkedin|github|portfolio|portofolio|website|instagram|kontak|contact)\s*[:：]?\s*$/gim;

/** Email addresses, links, phone numbers, @handles and personal-data lines → removed. Idempotent. */
export function redactContacts(text: string): string {
	return text
		.replace(EMAIL, '')
		.replace(URL, '')
		.replace(PHONE, (match) => ((match.match(/\d/g) ?? []).length >= 9 ? '' : match))
		.replace(HANDLE, '')
		.replace(ADDRESS_LINE, '')
		.replace(PERSONAL_LINE, '')
		.replace(LABEL_ONLY, '')
		.split('\n')
		.map((line) =>
			line
				.replace(/\s{2,}/g, ' ')
				// Leftover separators of removed contact details; bullet markers ("• ", "- ") stay.
				.replace(/^[\s|·,]+|[\s|•·,–-]+$/g, '')
		)
		.filter(Boolean)
		.join('\n');
}

/**
 * CV text ready for the AI: the header block above the first section heading (name, headline,
 * contact line, address) is dropped, then `redactContacts`. Without any heading, the first line
 * (usually the name) is dropped.
 */
export function redactCvText(text: string, maxLength = Infinity): string {
	const lines = text.split('\n').filter((line) => line.trim());
	const first = lines.findIndex((line) => headingSection(line) !== undefined);
	const body = first >= 0 ? lines.slice(first) : lines.slice(1);
	const redacted = redactContacts(body.join('\n'));
	return redacted.length > maxLength ? redacted.slice(0, maxLength) : redacted;
}
