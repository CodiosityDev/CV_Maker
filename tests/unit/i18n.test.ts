import { beforeAll, describe, expect, it } from 'vitest';
import {
	isDictionaryLoaded,
	loadDictionary,
	monthName,
	monthNames,
	registerNamespace,
	translate,
	type MessageKey
} from '../../src/lib/i18n/translate';
import { id } from '../../src/lib/i18n/messages/id';
import { en } from '../../src/lib/i18n/messages/en';
import { siteId } from '../../src/lib/i18n/messages/site.id';
import { siteEn } from '../../src/lib/i18n/messages/site.en';
import { appId } from '../../src/lib/i18n/messages/app.id';
import { appEn } from '../../src/lib/i18n/messages/app.en';
import { isLocale } from '../../src/lib/i18n/types';

function leafKeys(node: unknown, prefix = ''): string[] {
	if (typeof node === 'string') return [prefix];
	return Object.entries(node as Record<string, unknown>).flatMap(([k, v]) =>
		leafKeys(v, prefix ? `${prefix}.${k}` : k)
	);
}

const PARTS = {
	base: { id, en },
	site: { id: siteId, en: siteEn },
	app: { id: appId, en: appEn }
};

describe('i18n dictionaries', () => {
	for (const [part, dicts] of Object.entries(PARTS)) {
		it(`${part}: English has exactly the same keys as Indonesian`, () => {
			expect(leafKeys(dicts.en).sort()).toEqual(leafKeys(dicts.id).sort());
		});

		it(`${part}: no empty messages and no HTML`, () => {
			for (const dict of [dicts.id, dicts.en]) {
				for (const key of leafKeys(dict)) {
					const value = key
						.split('.')
						.reduce<unknown>((node, k) => (node as Record<string, unknown>)[k], dict);
					expect(String(value).trim(), key).not.toBe('');
					expect(String(value), key).not.toMatch(/<[a-z/]/i);
				}
			}
		});
	}

	it('namespaces never share a top-level key (they are merged)', () => {
		const tops = Object.values(PARTS).flatMap((p) => Object.keys(p.id));
		expect(new Set(tops).size).toBe(tops.length);
	});
});

describe('translate with namespaces', () => {
	it('base messages work without any namespace', () => {
		expect(translate('id', 'common.next')).toBe('Lanjut');
	});

	it('namespace keys resolve only after registration', () => {
		expect(translate('id', 'landing.title')).toBe('landing.title');
		registerNamespace('site', siteId);
		expect(translate('id', 'landing.title')).toBe(siteId.landing.title);
	});

	describe('English', () => {
		beforeAll(async () => {
			registerNamespace('app', appId);
			await loadDictionary('en');
		});

		it('loads English base and every registered namespace', () => {
			expect(isDictionaryLoaded('en')).toBe(true);
			expect(translate('en', 'common.next')).toBe('Next');
			expect(translate('en', 'landing.title')).toBe(siteEn.landing.title);
			expect(translate('en', 'preview.retry')).toBe(appEn.preview.retry);
		});
	});

	it('returns the key itself when missing', () => {
		expect(translate('en', 'does.not.exist' as MessageKey)).toBe('does.not.exist');
	});

	it('does not resolve prototype properties as messages', () => {
		expect(translate('id', 'constructor' as MessageKey)).toBe('constructor');
		expect(translate('id', '__proto__.toString' as MessageKey)).toBe('__proto__.toString');
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
