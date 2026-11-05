import { describe, expect, it } from 'vitest';
import { displayUrl, sanitizeUrl } from '../../src/lib/core/security/url';

describe('sanitizeUrl', () => {
	it('accepts http(s) and adds https:// when the scheme is missing', () => {
		expect(sanitizeUrl('https://www.linkedin.com/in/rizky')).toBe(
			'https://www.linkedin.com/in/rizky'
		);
		expect(sanitizeUrl('linkedin.com/in/rizky')).toBe('https://linkedin.com/in/rizky');
		expect(sanitizeUrl('  github.com/rizky  ')).toBe('https://github.com/rizky');
		expect(sanitizeUrl('http://contoh.co.id')).toBe('http://contoh.co.id/');
	});

	it('turns a bare email into mailto:', () => {
		expect(sanitizeUrl('nama@contoh.com')).toBe('mailto:nama@contoh.com');
		expect(sanitizeUrl('mailto:nama@contoh.com')).toBe('mailto:nama@contoh.com');
	});

	it('rejects dangerous or invalid URLs', () => {
		for (const bad of [
			'javascript:alert(1)',
			'JaVaScRiPt:alert(1)',
			'java\tscript:alert(1)',
			' javascript:alert(1)',
			'data:text/html,<script>alert(1)</script>',
			'vbscript:msgbox(1)',
			'file:///etc/passwd',
			'//evil.example',
			'https://user:pass@evil.example',
			'mailto:not-an-email',
			'https://localhostx',
			'',
			'   ',
			undefined,
			null
		]) {
			expect(sanitizeUrl(bad), String(bad)).toBeUndefined();
		}
	});
});

describe('displayUrl', () => {
	it('shortens URLs for print', () => {
		expect(displayUrl('https://www.linkedin.com/in/rizky/')).toBe('linkedin.com/in/rizky');
		expect(displayUrl('https://github.com/rizky')).toBe('github.com/rizky');
		expect(displayUrl('mailto:nama@contoh.com')).toBe('nama@contoh.com');
	});
});
