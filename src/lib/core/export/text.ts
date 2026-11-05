/**
 * Plain-text CV (for pasting into job-portal forms). Structured, ATS-friendly, no formatting.
 */
import type { RenderEntry, RenderModel } from '../render/index';

function entryLines(entry: RenderEntry): string[] {
	const lines: string[] = [];
	lines.push([entry.title, entry.subtitle].filter(Boolean).join(' — '));
	const details = [entry.dateText, entry.location].filter(Boolean).join(' | ');
	if (details) lines.push(details);
	for (const fact of entry.meta) lines.push(fact);
	if (entry.link) lines.push(entry.link.display);
	if (entry.description) lines.push(entry.description);
	for (const bullet of entry.bullets) lines.push(`- ${bullet}`);
	return lines;
}

export function toPlainText(model: RenderModel): string {
	const p = model.personal;
	const lines: string[] = [];

	if (p.fullName) lines.push(p.fullName.toUpperCase());
	if (p.headline) lines.push(p.headline);
	const contact = [
		p.email && `${model.labels.email}: ${p.email}`,
		p.phone && `${model.labels.phone}: ${p.phone}`,
		p.location && `${model.labels.location}: ${p.location}`
	].filter(Boolean);
	if (contact.length) lines.push(contact.join(' | '));
	for (const link of p.links) lines.push(`${link.label}: ${link.display}`);

	for (const section of model.sections) {
		lines.push('', section.title.toUpperCase());
		if (section.type === 'text') {
			lines.push(...section.paragraphs);
		} else if (section.type === 'skills') {
			for (const group of section.groups) lines.push(`${group.label}: ${group.items.join(', ')}`);
		} else {
			section.entries.forEach((entry, index) => {
				if (index > 0) lines.push('');
				lines.push(...entryLines(entry));
			});
		}
	}

	return `${lines.join('\n').trim()}\n`;
}
