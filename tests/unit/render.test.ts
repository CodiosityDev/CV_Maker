import { describe, expect, it } from 'vitest';
import { toRenderModel, type RenderSection } from '../../src/lib/core/render/index';
import { formatDateRange, formatYearMonth } from '../../src/lib/core/render/format';
import { emptyCvAts, sampleCvAts, sampleCvCreative } from '../../src/lib/core/fixtures/index';

const clone = <T>(value: T): T => structuredClone(value);
const keys = (sections: RenderSection[]) => sections.map((s) => s.key);

describe('date formatting', () => {
	it('formats months in the CV language', () => {
		expect(formatYearMonth('2023-12', 'id')).toBe('Des 2023');
		expect(formatYearMonth('2023-12', 'en')).toBe('Dec 2023');
		expect(formatYearMonth('2023-13', 'id')).toBeUndefined();
	});

	it('formats ranges', () => {
		expect(formatDateRange({ start: '2023-07', end: '2023-12', current: false }, 'id')).toBe(
			'Jul 2023 – Des 2023'
		);
		expect(formatDateRange({ start: '2022-01', current: true }, 'id')).toBe('Jan 2022 – Sekarang');
		expect(formatDateRange({ start: '2022-01', current: true }, 'en')).toBe('Jan 2022 – Present');
		expect(formatDateRange({ start: '2024-07', end: '2024-07', current: false }, 'en')).toBe(
			'Jul 2024'
		);
		expect(formatDateRange({ current: false }, 'id')).toBeUndefined();
	});
});

describe('toRenderModel', () => {
	it('keeps the configured order with translated titles', () => {
		const model = toRenderModel(sampleCvAts);
		expect(keys(model.sections)).toEqual(sampleCvAts.layout.order);
		expect(model.sections[1]).toMatchObject({ key: 'education', title: 'Pendidikan' });
	});

	it('prepares entries: subtitle, meta, dates, bullets', () => {
		const education = toRenderModel(sampleCvAts).sections.find((s) => s.key === 'education');
		expect(education?.type).toBe('entries');
		if (education?.type !== 'entries') return;
		const entry = education.entries[0]!;
		expect(entry.title).toBe('Universitas Harapan Bangsa');
		expect(entry.subtitle).toBe('S1 Sistem Informasi');
		expect(entry.meta[0]).toBe('IPK 3.62/4.00');
		expect(entry.meta[1]).toMatch(/^Skripsi: /);
		expect(entry.dateText).toBe('Agu 2020 – Agu 2024');
	});

	it('labels non-full-time experience types', () => {
		const exp = toRenderModel(sampleCvCreative).sections.find((s) => s.key === 'experience');
		if (exp?.type !== 'entries') throw new Error('expected entries');
		expect(exp.entries[0]!.meta).toEqual(['Magang']);
		expect(exp.entries[1]!.dateText).toBe('Jan 2022 – Sekarang');
	});

	it('removes hidden sections, applies custom titles and renders custom sections', () => {
		const model = toRenderModel(sampleCvCreative);
		expect(keys(model.sections)).not.toContain('certifications');
		expect(model.sections.find((s) => s.key === 'projects')?.title).toBe('Proyek Desain');
		expect(model.sections.find((s) => s.key === 'custom:portfolio')?.title).toBe('Pameran & Karya');
	});

	it('removes empty sections, blank bullets and items without a heading', () => {
		const cv = clone(sampleCvAts);
		cv.awards = [];
		cv.experience[0]!.bullets = ['  ', 'Isi', ''];
		cv.organizations.push({
			id: 'blank',
			name: ' ',
			role: '',
			dates: { current: false },
			bullets: []
		});
		const model = toRenderModel(cv);
		expect(keys(model.sections)).not.toContain('awards');
		const exp = model.sections.find((s) => s.key === 'experience');
		if (exp?.type !== 'entries') throw new Error('expected entries');
		expect(exp.entries[0]!.bullets).toEqual(['Isi']);
		const org = model.sections.find((s) => s.key === 'organizations');
		if (org?.type !== 'entries') throw new Error('expected entries');
		expect(org.entries.map((e) => e.id)).not.toContain('blank');
	});

	it('renders nothing but the name area for an empty CV', () => {
		const model = toRenderModel(emptyCvAts);
		expect(model.sections).toEqual([]);
		expect(model.personal.links).toEqual([]);
	});

	it('sanitizes links and drops unsafe ones', () => {
		const cv = clone(sampleCvCreative);
		cv.personal.links.push({ id: 'x', label: 'Klik', url: 'javascript:alert(1)' });
		const links = toRenderModel(cv).personal.links;
		expect(links).toHaveLength(2);
		expect(links[0]).toEqual({
			label: 'Portofolio',
			href: 'https://nadiamaharani.example.com/',
			display: 'nadiamaharani.example.com'
		});
	});

	it('builds contact info with safe hrefs', () => {
		const { personal } = toRenderModel(sampleCvAts);
		expect(personal.location).toBe('Malang, Jawa Timur');
		expect(personal.emailHref).toBe('mailto:rizky.pratama@example.com');
		expect(personal.phoneHref).toBe('tel:+6281234567890');
	});

	it('only passes the photo to creative CVs', () => {
		expect(toRenderModel(sampleCvAts, { photoUrl: 'blob:x' }).personal.photoUrl).toBeUndefined();
		expect(toRenderModel(sampleCvCreative, { photoUrl: 'blob:x' }).personal.photoUrl).toBe(
			'blob:x'
		);
	});

	it('uses English labels for English CVs', () => {
		const cv = clone(sampleCvAts);
		cv.locale = 'en';
		const model = toRenderModel(cv);
		expect(model.sections[1]?.title).toBe('Education');
		expect(model.labels.present).toBe('Present');
	});
});
