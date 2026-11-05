import { describe, expect, it } from 'vitest';
import { loadGuidance } from '../../src/lib/core/content/index';
import { WIZARD_STEP_IDS } from '../../src/lib/core/wizard/index';

function shape(value: unknown): unknown {
	if (Array.isArray(value)) return 'array';
	if (value && typeof value === 'object') {
		return Object.fromEntries(
			Object.entries(value)
				.sort(([a], [b]) => a.localeCompare(b))
				.map(([k, v]) => [k, shape(v)])
		);
	}
	return typeof value;
}

describe('guidance content', () => {
	it('loads both languages with the same structure', async () => {
		const [id, en] = await Promise.all([loadGuidance('id'), loadGuidance('en')]);
		expect(shape(en)).toEqual(shape(id));
		expect(en.summaryExamples.map((s) => s.field)).toEqual(id.summaryExamples.map((s) => s.field));
	});

	it('caches per locale', async () => {
		expect(await loadGuidance('id')).toBe(await loadGuidance('id'));
	});

	it('has tips for every content step and no empty strings', async () => {
		for (const locale of ['id', 'en'] as const) {
			const guidance = await loadGuidance(locale);
			for (const step of WIZARD_STEP_IDS) {
				expect(guidance.stepTips[step].length, `${locale}:${step}`).toBeGreaterThan(0);
			}
			const strings = JSON.stringify(guidance).match(/"(?:[^"\\]|\\.)*"/g) ?? [];
			expect(strings).not.toContain('""');
		}
	});

	it('contains no HTML', async () => {
		for (const locale of ['id', 'en'] as const) {
			expect(JSON.stringify(await loadGuidance(locale))).not.toMatch(/<[a-z/]/i);
		}
	});
});
