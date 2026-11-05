/**
 * Safe, readable download file names: `CV_Rizky_Aditya_Pratama_Data_Analyst.pdf`.
 * Only ASCII letters, digits and underscores (works on every OS and when uploaded to job portals).
 */
export type ExportExtension = 'pdf' | 'docx' | 'txt' | 'json';

function slugPart(value: string | undefined): string {
	return (value ?? '')
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '') // strip accents
		.replace(/[^A-Za-z0-9]+/g, '_')
		.replace(/^_+|_+$/g, '')
		.slice(0, 40)
		.replace(/_+$/g, '');
}

export function exportFileName(
	info: { fullName?: string; targetRole?: string; title?: string },
	extension: ExportExtension
): string {
	const parts = ['CV', slugPart(info.fullName) || slugPart(info.title), slugPart(info.targetRole)];
	const base = parts.filter(Boolean).join('_') || 'CV';
	return `${base}.${extension}`;
}

/** Name for a backup file: `CVMaker_Backup_2026-11-05.json`. */
export function backupFileName(date = new Date()): string {
	return `CVMaker_Backup_${date.toISOString().slice(0, 10)}.json`;
}
