/**
 * Cover letter as a Word document (.docx): A4, 25 mm margins, the letter's font/size/spacing,
 * bold/italic/underline from the runs. Heavy dependency (`docx`): load through
 * `exportLetterDocx()` (./export), never import this file statically from UI.
 */
import {
	AlignmentType,
	Document,
	Packer,
	Paragraph,
	Tab,
	TabStopType,
	TextRun,
	type ParagraphChild
} from 'docx';
import type { LetterFont, RichRun } from '../schema/types';
import type { LetterModel } from './index';

const A4 = { width: 11906, height: 16838 }; // twips
const MARGIN = 1417; // 25 mm
const DOCX_FONT: Record<LetterFont, string> = {
	times: 'Times New Roman',
	arial: 'Arial',
	calibri: 'Calibri',
	georgia: 'Georgia'
};

export async function toLetterDocx(model: LetterModel): Promise<Blob> {
	const { style } = model;
	const font = DOCX_FONT[style.font];
	const size = style.size * 2; // half-points
	const line = Math.round(240 * style.lineHeight);
	const gap = Math.round(style.size * 20 * 0.8); // ≈ one blank line between blocks, in twips
	const body = style.align === 'justify' ? AlignmentType.JUSTIFIED : AlignmentType.LEFT;

	const run = (r: RichRun): TextRun =>
		new TextRun({
			text: r.text,
			bold: r.bold,
			italics: r.italic === true,
			underline: r.underline ? {} : undefined,
			font,
			size
		});
	const plain = (text: string) => new TextRun({ text, font, size });
	const paragraph = (
		children: ParagraphChild[],
		options: {
			after?: number;
			align?: (typeof AlignmentType)[keyof typeof AlignmentType];
			keepNext?: boolean;
		} = {}
	) =>
		new Paragraph({
			children,
			alignment: options.align ?? AlignmentType.LEFT,
			spacing: { line, after: options.after ?? 0 },
			keepNext: options.keepNext
		});
	const lines = (items: readonly string[], after = gap) =>
		items.map((text, i) => paragraph([plain(text)], { after: i === items.length - 1 ? after : 0 }));

	const children: Paragraph[] = [];
	if (model.sender.length) children.push(...lines(model.sender));
	if (model.dateLine)
		children.push(
			paragraph([plain(model.dateLine)], {
				after: gap,
				align: model.locale === 'id' ? AlignmentType.RIGHT : AlignmentType.LEFT
			})
		);
	if (model.meta.length) {
		const labelWidth = 1400;
		model.meta.forEach((meta, i) =>
			children.push(
				new Paragraph({
					tabStops: [{ type: TabStopType.LEFT, position: labelWidth }],
					spacing: { line, after: i === model.meta.length - 1 ? gap : 0 },
					children: [
						plain(meta.label),
						new TextRun({ children: [new Tab(), ': '], font, size }),
						...meta.value.map(run)
					]
				})
			)
		);
	}
	children.push(...lines(model.recipient));
	children.push(paragraph([plain(model.salutation)], { after: gap }));

	for (const block of model.blocks) {
		if (block.kind === 'text' || block.kind === 'note') {
			children.push(paragraph(block.runs.map(run), { after: gap, align: body }));
		} else if (block.kind === 'identity') {
			children.push(paragraph(block.intro.map(run), { align: body, keepNext: true }));
			block.rows.forEach((row, i) =>
				children.push(
					new Paragraph({
						tabStops: [{ type: TabStopType.LEFT, position: 3000 }],
						indent: { left: 360 },
						spacing: { line, after: i === block.rows.length - 1 ? gap : 0 },
						children: [
							plain(row.label),
							new TextRun({ children: [new Tab(), ': '], font, size }),
							...row.value.map(run)
						]
					})
				)
			);
		} else {
			children.push(paragraph(block.intro.map(run), { align: body, keepNext: true }));
			block.items.forEach((item, i) =>
				children.push(
					new Paragraph({
						indent: { left: 720, hanging: 360 },
						spacing: { line, after: i === block.items.length - 1 ? gap : 0 },
						children: [
							plain(`${i + 1}.`),
							new TextRun({ children: [new Tab()], font, size }),
							...item.map(run)
						]
					})
				)
			);
		}
	}

	children.push(paragraph([plain(model.closing)], { keepNext: true }));
	for (let i = 0; i < 3; i++) children.push(paragraph([plain('')], { keepNext: true }));
	children.push(paragraph([plain(model.signatureName || ' ')]));

	const doc = new Document({
		creator: 'CV Maker',
		title: model.locale === 'id' ? 'Surat Lamaran' : 'Cover Letter',
		styles: { default: { document: { run: { font, size } } } },
		sections: [
			{
				properties: {
					page: { size: A4, margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN } }
				},
				children
			}
		]
	});
	return Packer.toBlob(doc);
}
