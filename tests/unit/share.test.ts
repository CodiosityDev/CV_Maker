import { describe, expect, it } from 'vitest';
import { sampleCvAts, sampleCvCreative } from '../../src/lib/core/fixtures/index';
import {
	buildShareSnapshot,
	DEFAULT_SHARE_SETTINGS,
	isSlugShaped,
	isValidCustomSlug,
	parsePublicShare,
	parseShareSaveRequest,
	parseShareSettings,
	type ShareSettings
} from '../../src/lib/core/share/index';
import { safeNext } from '../../src/lib/core/account/index';

const NOW = Date.parse('2026-11-17T00:00:00.000Z');
const all: ShareSettings = {
	showPhone: true,
	showEmail: true,
	showAddress: true,
	showPhoto: true,
	allowDownload: true,
	autoUpdate: false
};
const JPEG = `data:image/jpeg;base64,${Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]).toString('base64')}`;

describe('buildShareSnapshot', () => {
	it('hides contact fields by default and never includes letters or the local photo id', () => {
		const cv = {
			...structuredClone(sampleCvCreative),
			personal: {
				...sampleCvCreative.personal,
				photoAssetId: 'local-photo',
				province: 'Jawa Timur'
			},
			letters: []
		};
		const snapshot = buildShareSnapshot(cv, DEFAULT_SHARE_SETTINGS);
		expect(snapshot.personal.phone).toBe('');
		expect(snapshot.personal.email).toBe('');
		expect(snapshot.personal.city).toBe('');
		expect(snapshot.personal.province).toBeUndefined();
		expect(snapshot.personal.photoAssetId).toBeUndefined();
		expect(snapshot.letters).toBeUndefined();
		expect(snapshot.personal.fullName).toBe(cv.personal.fullName);
		// The original is untouched.
		expect(cv.personal.phone).not.toBe('');
		expect(cv.letters).toEqual([]);
	});

	it('keeps what the user chose to show', () => {
		const snapshot = buildShareSnapshot(structuredClone(sampleCvAts), all);
		expect(snapshot.personal.phone).toBe(sampleCvAts.personal.phone);
		expect(snapshot.personal.email).toBe(sampleCvAts.personal.email);
		expect(snapshot.personal.city).toBe(sampleCvAts.personal.city);
	});
});

describe('slugs and return paths', () => {
	it('accepts readable custom slugs and refuses reserved or odd ones', () => {
		expect(isValidCustomSlug('rizky-pratama')).toBe(true);
		expect(isValidCustomSlug('ab')).toBe(false);
		expect(isValidCustomSlug('-rizky')).toBe(false);
		expect(isValidCustomSlug('rizky--p')).toBe(false);
		expect(isValidCustomSlug('Rizky')).toBe(false);
		expect(isValidCustomSlug('api')).toBe(false);
		expect(isValidCustomSlug('masuk')).toBe(false);
		expect(isValidCustomSlug('a'.repeat(41))).toBe(false);
		expect(isSlugShaped('k7f2q9abcd23')).toBe(true);
		expect(isSlugShaped('../etc')).toBe(false);
	});

	it('only returns to same-site paths after login', () => {
		expect(safeNext('/cv/abc/edit')).toBe('/cv/abc/edit');
		expect(safeNext('//evil.example')).toBe('/cv');
		expect(safeNext('https://evil.example')).toBe('/cv');
		expect(safeNext('/\\evil.example')).toBe('/cv');
		expect(safeNext(null)).toBe('/cv');
	});
});

describe('parseShareSaveRequest', () => {
	const request = (patch: Record<string, unknown> = {}) => ({
		access: 'link',
		discoverable: false,
		settings: DEFAULT_SHARE_SETTINGS,
		snapshot: structuredClone(sampleCvAts),
		photo: null,
		...patch
	});

	it('strips hidden fields even when a modified client sends them', () => {
		const parsed = parseShareSaveRequest(request(), NOW);
		expect(parsed?.snapshot.personal.phone).toBe('');
		expect(parsed?.snapshot.personal.email).toBe('');
	});

	it('rejects unknown settings, bad access, bad CVs and bad photos', () => {
		expect(parseShareSaveRequest(request({ access: 'everyone' }), NOW)).toBeNull();
		expect(
			parseShareSaveRequest(request({ settings: { ...DEFAULT_SHARE_SETTINGS, extra: true } }), NOW)
		).toBeNull();
		expect(parseShareSaveRequest(request({ snapshot: { id: 'x' } }), NOW)).toBeNull();
		expect(parseShareSaveRequest(request({ photo: 'javascript:alert(1)' }), NOW)).toBeNull();
		expect(parseShareSaveRequest(request({ slug: 'api' }), NOW)).toBeNull();
		expect(parseShareSaveRequest(request({ password: 'abc' }), NOW)).toBeNull();
		expect(parseShareSaveRequest(null, NOW)).toBeNull();
	});

	it('only public links can be discoverable, and only Creative + showPhoto keeps a photo', () => {
		expect(parseShareSaveRequest(request({ discoverable: true }), NOW)?.discoverable).toBe(false);
		expect(
			parseShareSaveRequest(request({ access: 'public', discoverable: true }), NOW)?.discoverable
		).toBe(true);
		expect(parseShareSaveRequest(request({ photo: JPEG, settings: all }), NOW)?.photo).toBeNull();
		expect(
			parseShareSaveRequest(
				request({ snapshot: structuredClone(sampleCvCreative), photo: JPEG, settings: all }),
				NOW
			)?.photo
		).toBe(JPEG);
	});

	it('expiry must be in the future and within a year', () => {
		const day = 86_400_000;
		expect(
			parseShareSaveRequest(request({ expiresAt: new Date(NOW + day).toISOString() }), NOW)
		).not.toBeNull();
		expect(
			parseShareSaveRequest(request({ expiresAt: new Date(NOW - day).toISOString() }), NOW)
		).toBeNull();
		expect(
			parseShareSaveRequest(request({ expiresAt: new Date(NOW + 400 * day).toISOString() }), NOW)
		).toBeNull();
	});
});

describe('parsePublicShare / parseShareSettings', () => {
	it('validates what a visitor receives', () => {
		const ok = parsePublicShare({ snapshot: sampleCvAts, photo: null, allowDownload: true });
		expect(ok?.snapshot.personal.fullName).toBe(sampleCvAts.personal.fullName);
		expect(ok?.allowDownload).toBe(true);
		expect(parsePublicShare({ snapshot: {}, photo: null })).toBeNull();
		expect(parsePublicShare({ snapshot: sampleCvAts, photo: 'data:text/html,<b>' })).toBeNull();
		expect(parseShareSettings({ ...DEFAULT_SHARE_SETTINGS })).toEqual(DEFAULT_SHARE_SETTINGS);
		expect(parseShareSettings({ showPhone: 'yes' })).toBeNull();
	});
});
