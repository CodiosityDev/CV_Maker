import { describe, expect, it } from 'vitest';
import { getDictionary, monthName, monthNames, translate } from '../../src/lib/i18n/translate';
import { LOCALES, isLocale } from '../../src/lib/i18n/types';

function leafKeys(node: unknown, prefix = ''): string[] {
	if (typeof node === 'string') return [prefix];
	return Object.entries(node as Record<string, unknown>).flatMap(([k, v]) =>
		leafKeys(v, prefix ? `${prefix}.${k}` : k)
	);
}

describe('i18n dictionaries', () => {
	it('every locale has exactly the same keys as the Indonesian source', () => {
		const source = leafKeys(getDictionary('id')).sort();
		for (const locale of LOCALES) {
			expect(leafKeys(getDictionary(locale)).sort()).toEqual(source);
		}
	});

	it('has no empty messages', () => {
		for (const locale of LOCALES) {
			const dict = getDictionary(locale);
			for (const key of leafKeys(dict)) {
				expect(translate(locale, key as never).trim(), `${locale}:${key}`).not.toBe('');
			}
		}
	});
});

describe('translate', () => {
	it('returns the message for the requested locale', () => {
		expect(translate('id', 'common.next')).toBe('Lanjut');
		expect(translate('en', 'common.next')).toBe('Next');
	});

	it('returns the key itself when missing', () => {
		expect(translate('en', 'does.not.exist' as never)).toBe('does.not.exist');
	});

	it('does not resolve prototype properties as messages', () => {
		expect(translate('id', 'constructor' as never)).toBe('constructor');
		expect(translate('id', '__proto__.toString' as never)).toBe('__proto__.toString');
	});
});

describe('month names', () => {
	it('formats months per locale', () => {
		expect(monthName('id', 1)).toBe('Januari');
		expect(monthName('en', 12)).toBe('December');
		expect(monthNames('id', 'short')).toHaveLength(12);
	});
});

describe('isLocale', () => {
	it('accepts only supported locales', () => {
		expect(isLocale('id')).toBe(true);
		expect(isLocale('en')).toBe(true);
		expect(isLocale('fr')).toBe(false);
		expect(isLocale(null)).toBe(false);
	});
});
