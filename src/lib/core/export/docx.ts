/**
 * ATS-friendly Word document (.docx). One column, real headings, real bullet lists, plain text.
 * Heavy dependency (`docx`): never import this file statically from UI — use `exportDocx()` from
 * `./index`, which loads it on demand.
 */
import { AlignmentType, Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';
import type { RenderEntry, RenderModel } from '../render/index';

const FONT = 'Arial';
const BODY = 21; // half-points → 10.5 pt
const A4 = { width: 11906, height: 16838 }; // twips
const MARGIN = 1020; // ≈ 18 mm

const text = (value: string, options: { bold?: boolean; size?: number } = {}) =>
	new TextRun({ text: value, bold: options.bold, size: options.size ?? BODY, font: FONT });

const line = (value: string, options: { bold?: boolean; after?: number } = {}) =>
	new Paragraph({ children: [text(value, options)], spacing: { after: options.after ?? 20 } });

function entryParagraphs(entry: RenderEntry): Paragraph[] {
	const out: Paragraph[] = [];
	out.push(
		new Paragraph({
			heading: HeadingLevel.HEADING_3,
			children: [text(entry.title, { bold: true })],
			spacing: { before: 120, after: 20 },
			keepNext: true
		})
	);
	if (entry.subtitle) out.push(line(entry.subtitle, { bold: true }));
	const details = [entry.dateText, entry.location].filter(Boolean).join(' | ');
	if (details) out.push(line(details));
	for (const fact of entry.meta) out.push(line(fact));
	if (entry.link) out.push(line(entry.link.display));
	if (entry.description) out.push(line(entry.description));
	for (const bullet of entry.bullets) {
		out.push(
			new Paragraph({ bullet: { level: 0 }, children: [text(bullet)], spacing: { after: 20 } })
		);
	}
	return out;
}

export async function toDocx(model: RenderModel): Promise<Blob> {
	const p = model.personal;
	const children: Paragraph[] = [];

	children.push(
		new Paragraph({
			heading: HeadingLevel.HEADING_1,
			alignment: AlignmentType.LEFT,
			children: [text(p.fullName || ' ', { bold: true, size: 40 })],
			spacing: { after: 60 }
		})
	);
	if (p.headline) children.push(line(p.headline, { after: 80 }));
	if (p.email) children.push(line(`${model.labels.email}: ${p.email}`));
	if (p.phone) children.push(line(`${model.labels.phone}: ${p.phone}`));
	if (p.location) children.push(line(`${model.labels.location}: ${p.location}`));
	for (const link of p.links) children.push(line(`${link.label}: ${link.display}`));

	for (const section of model.sections) {
		children.push(
			new Paragraph({
				heading: HeadingLevel.HEADING_2,
				children: [text(section.title, { bold: true, size: 24 })],
				spacing: { before: 240, after: 80 },
				border: { bottom: { style: 'single', size: 6, color: '444444', space: 2 } },
				keepNext: true
			})
		);
		if (section.type === 'text') {
			for (const paragraph of section.paragraphs) children.push(line(paragraph, { after: 60 }));
		} else if (section.type === 'skills') {
			for (const group of section.groups) {
				children.push(
					new Paragraph({
						children: [text(`${group.label}: `, { bold: true }), text(group.items.join(', '))],
						spacing: { after: 40 }
					})
				);
			}
		} else {
			for (const entry of section.entries) children.push(...entryParagraphs(entry));
		}
	}

	const doc = new Document({
		creator: 'CV Maker',
		title: p.fullName ? `CV ${p.fullName}` : 'CV',
		styles: { default: { document: { run: { font: FONT, size: BODY } } } },
		sections: [
			{
				properties: {
					page: {
						size: A4,
						margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN }
					}
				},
				children
			}
		]
	});
	return Packer.toBlob(doc);
}
