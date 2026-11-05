import { beforeAll, describe, expect, it } from 'vitest';
import {
	isDictionaryLoaded,
	loadDictionary,
	monthName,
	monthNames,
	translate,
	type MessageKey
} from '../../src/lib/i18n/translate';
import { id } from '../../src/lib/i18n/messages/id';
import { en } from '../../src/lib/i18n/messages/en';
import { isLocale } from '../../src/lib/i18n/types';

function leafKeys(node: unknown, prefix = ''): string[] {
	if (typeof node === 'string') return [prefix];
	return Object.entries(node as Record<string, unknown>).flatMap(([k, v]) =>
		leafKeys(v, prefix ? `${prefix}.${k}` : k)
	);
}

describe('i18n dictionaries', () => {
	it('English has exactly the same keys as the Indonesian source', () => {
		expect(leafKeys(en).sort()).toEqual(leafKeys(id).sort());
	});

	it('has no empty messages', () => {
		for (const [name, dict] of Object.entries({ id, en })) {
			for (const key of leafKeys(dict)) {
				expect(translate(name as 'id' | 'en', key as MessageKey).trim(), `${name}:${key}`).not.toBe(
					''
				);
			}
		}
	});
});

describe('translate', () => {
	beforeAll(async () => {
		await loadDictionary('en');
	});

	it('loads English on demand', () => {
		expect(isDictionaryLoaded('id')).toBe(true);
		expect(isDictionaryLoaded('en')).toBe(true);
	});

	it('returns the message for the requested locale', () => {
		expect(translate('id', 'common.next')).toBe('Lanjut');
		expect(translate('en', 'common.next')).toBe('Next');
	});

	it('interpolates parameters', () => {
		expect(translate('id', 'common.next', { unused: 1 })).toBe('Lanjut');
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
