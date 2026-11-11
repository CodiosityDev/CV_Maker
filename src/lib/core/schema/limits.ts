/**
 * Length/count limits (PROJECT_SPEC §5.1). Use these for `maxlength` and counters in the UI;
 * the schema truncates anything longer when data is loaded or imported.
 */
export const LIMITS = {
	fullName: 100,
	headline: 120,
	summary: 800,
	bullet: 300,
	/** Generic single-line field: institution, role, company, item titles, ... */
	title: 150,
	/** Short fields: degree, gpa, city, phone, score, ... */
	short: 60,
	email: 254,
	url: 500,
	cvTitle: 80,
	/** gpa and gpaScale, e.g. '3.65' / '4.00' */
	gpa: 10,
	itemsPerSection: 20,
	bulletsPerItem: 8,
	skillsPerGroup: 50,
	links: 10,
	customSections: 5,
	description: 400
} as const;

export const FONT_SCALE = { min: 0.9, max: 1.1, default: 1 } as const;

/** Visual editor (creative CVs). */
export const DESIGN_LIMITS = {
	/** Side column width, % of the page. */
	sideWidth: { min: 22, max: 40, default: 27 }
} as const;
