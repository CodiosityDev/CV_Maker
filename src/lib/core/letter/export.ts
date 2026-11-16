/**
 * Cover-letter export: plain text, email text, and Word (loads `docx` on demand, like the CV).
 * Every function takes the `LetterModel` from `toLetterModel` — exactly what the template shows.
 */
import type { LetterBlock, LetterModel } from './index';
import { LETTER_PHRASES } from './phrases';
import { richToPlain } from './rich';

function blockLines(block: LetterBlock): string[] {
	switch (block.kind) {
		case 'text':
		case 'note':
			return [richToPlain(block.runs)];
		case 'identity': {
			const width = Math.max(...block.rows.map((row) => row.label.length));
			return [
				richToPlain(block.intro),
				...block.rows.map((row) => `${row.label.padEnd(width)} : ${richToPlain(row.value)}`)
			];
		}
		case 'list':
			return [
				richToPlain(block.intro),
				...block.items.map((item, index) => `${index + 1}. ${richToPlain(item)}`)
			];
	}
}

/** The letter as plain text (paragraphs separated by a blank line). */
export function letterToPlainText(model: LetterModel): string {
	const parts: string[][] = [];
	if (model.sender.length) parts.push(model.sender);
	parts.push([model.dateLine]);
	if (model.meta.length) parts.push(model.meta.map((m) => `${m.label} : ${richToPlain(m.value)}`));
	parts.push(model.recipient);
	parts.push([model.salutation]);
	for (const block of model.blocks) parts.push(blockLines(block));
	parts.push([model.closing, '', '', model.signatureName]);
	return `${parts
		.map((lines) => lines.filter((line, i) => line || i > 0).join('\n'))
		.filter(Boolean)
		.join('\n\n')
		.trim()}\n`;
}

export async function exportLetterTxt(model: LetterModel): Promise<Blob> {
	return new Blob([letterToPlainText(model)], { type: 'text/plain;charset=utf-8' });
}

/**
 * Subject and body for sending the letter as an email (portals, HR inboxes): no date, address or
 * Lampiran/Perihal; the attachment list becomes one sentence; contact details under the name.
 */
export function letterEmail(model: LetterModel): { subject: string; body: string } {
	const p = LETTER_PHRASES[model.locale];
	const lines: string[] = [model.salutation, ''];
	for (const block of model.blocks) {
		if (block.kind === 'list') lines.push(p.email.attached, '');
		else if (block.kind !== 'identity' && block.kind !== 'note')
			lines.push(richToPlain(block.runs), '');
		else if (block.kind === 'identity') lines.push(...blockLines(block), '');
	}
	lines.push(model.closing, model.signatureName, ...model.contact);
	return {
		subject: p.email.subject(model.position, model.signatureName),
		body: `${lines.join('\n').trim()}\n`
	};
}

/** Word document with the letter's font, size, spacing and bold/italic/underline. */
export async function exportLetterDocx(model: LetterModel): Promise<Blob> {
	const { toLetterDocx } = await import('./docx');
	return toLetterDocx(model);
}
