import { describe, expect, it } from 'vitest';
import {
	isValidPhone,
	normalizePhone,
	validateAll,
	validateStep,
	WIZARD_STEPS,
	type ValidationMessageKey
} from '../../src/lib/core/wizard/index';
import { emptyCvAts, sampleCvAts } from '../../src/lib/core/fixtures/index';
import { loadDictionary, translate, type MessageKey } from '../../src/lib/i18n/translate';
import type { CVDocument } from '../../src/lib/core/schema/index';

const clone = (cv: CVDocument): CVDocument => structuredClone(cv);

describe('phone', () => {
	it('normalizes common Indonesian formats', () => {
		for (const input of [
			'081234567890',
			'0812-3456-7890',
			'0812 3456 7890',
			'(0812) 3456-7890',
			'6281234567890',
			'+62 812 3456 7890',
			'81234567890'
		]) {
			expect(normalizePhone(input), input).toBe('+62 812-3456-7890');
		}
		expect(normalizePhone('0341-551234')).toBe('+62 341-5512-34');
	});

	it('keeps valid international numbers', () => {
		expect(normalizePhone('+65 9123 4567')).toBe('+6591234567');
	});

	it('rejects non-phone input', () => {
		for (const input of ['', 'abc', '12345', '0000000000', '+62 0812 3456 7890', '0812']) {
			expect(isValidPhone(input), input).toBe(false);
			expect(normalizePhone(input), input).toBeUndefined();
		}
	});
});

describe('wizard steps', () => {
	it('has 11 steps with the optional ones marked', () => {
		expect(WIZARD_STEPS.map((s) => s.id)).toEqual([
			'type',
			'target',
			'personal',
			'education',
			'experience',
			'organizations',
			'projects',
			'skills',
			'summary',
			'review',
			'done'
		]);
		expect(WIZARD_STEPS.filter((s) => s.optional).map((s) => s.id)).toEqual([
			'experience',
			'organizations',
			'projects',
			'skills',
			'summary'
		]);
	});

	it('the complete sample CV has no issues', () => {
		expect(validateAll(sampleCvAts)).toEqual([]);
	});

	it('requires name, email and phone', () => {
		expect(validateStep('personal', emptyCvAts)).toEqual([
			{ field: 'personal.fullName', messageKey: 'validation.required' },
			{ field: 'personal.email', messageKey: 'validation.required' },
			{ field: 'personal.phone', messageKey: 'validation.required' }
		]);
		const cv = clone(sampleCvAts);
		cv.personal.email = 'rizky@';
		cv.personal.phone = '123';
		expect(validateStep('personal', cv).map((i) => i.messageKey)).toEqual([
			'validation.emailInvalid',
			'validation.phoneInvalid'
		]);
	});

	it('requires at least one education entry with an institution', () => {
		expect(validateStep('education', emptyCvAts)).toEqual([
			{ field: 'education', messageKey: 'validation.educationRequired' }
		]);
		const cv = clone(sampleCvAts);
		cv.education[0]!.institution = ' ';
		expect(validateStep('education', cv)).toEqual([
			{ field: 'education.edu-1.institution', messageKey: 'validation.required' }
		]);
	});

	it('flags end dates before start dates', () => {
		const cv = clone(sampleCvAts);
		cv.experience[0]!.dates = { start: '2023-07', end: '2023-01', current: false };
		expect(validateStep('experience', cv)).toEqual([
			{ field: 'experience.exp-1.dates', messageKey: 'validation.dateOrder' }
		]);
		cv.experience[0]!.dates.current = true;
		expect(validateStep('experience', cv)).toEqual([]);
	});

	it('optional sections: empty items are fine, half-filled items need a heading', () => {
		const cv = clone(emptyCvAts);
		cv.organizations.push({ id: 'o1', name: '', role: '', dates: { current: false }, bullets: [] });
		expect(validateStep('organizations', cv)).toEqual([]);
		cv.organizations[0]!.role = 'Bendahara';
		expect(validateStep('organizations', cv)).toEqual([
			{ field: 'organizations.o1.name', messageKey: 'validation.itemTitleRequired' }
		]);
	});

	it('every validation message key exists in both UI languages', async () => {
		await loadDictionary('en');
		const keys: ValidationMessageKey[] = [
			'validation.required',
			'validation.nameTooShort',
			'validation.emailInvalid',
			'validation.phoneInvalid',
			'validation.educationRequired',
			'validation.dateOrder',
			'validation.itemTitleRequired'
		];
		for (const key of keys) {
			const typed: MessageKey = key; // compile-time: must be a real i18n key
			expect(translate('id', typed)).not.toBe(key);
			expect(translate('en', typed)).not.toBe(key);
		}
	});
});
