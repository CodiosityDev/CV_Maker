/**
 * Schema migrations. Every stored or imported CV goes through `loadCvDocument()`:
 *   raw → migrate to CURRENT_SCHEMA_VERSION → validate/normalize → CVDocument
 *
 * To change the schema later:
 *   1. bump `schemaVersion` in types.ts and CURRENT_SCHEMA_VERSION in defaults.ts
 *   2. add `MIGRATIONS[oldVersion] = (doc) => newShapedDoc`
 *   3. add a test with a real old-version document
 */
import * as v from 'valibot';
import { CURRENT_SCHEMA_VERSION } from './defaults';
import { cvDocumentSchema } from './schema';
import type { CVDocument } from './types';

type RawDoc = Record<string, unknown>;
type Migration = (doc: RawDoc) => RawDoc;

/** MIGRATIONS[n] upgrades a document from version n to n + 1. */
const MIGRATIONS: Record<number, Migration> = {};

export type LoadErrorCode = 'not-an-object' | 'unknown-version' | 'newer-version' | 'invalid';

export type LoadResult =
	{ ok: true; cv: CVDocument; migrated: boolean } | { ok: false; error: LoadErrorCode };

function isPlainObject(value: unknown): value is RawDoc {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Validates, migrates and normalizes untrusted CV data. Never throws. */
export function loadCvDocument(raw: unknown): LoadResult {
	if (!isPlainObject(raw)) return { ok: false, error: 'not-an-object' };

	let version = raw.schemaVersion;
	if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
		return { ok: false, error: 'unknown-version' };
	}
	if (version > CURRENT_SCHEMA_VERSION) return { ok: false, error: 'newer-version' };

	let doc = raw;
	const migrated = version < CURRENT_SCHEMA_VERSION;
	while (version < CURRENT_SCHEMA_VERSION) {
		const migrate = MIGRATIONS[version];
		if (!migrate) return { ok: false, error: 'unknown-version' };
		doc = migrate(doc);
		version += 1;
		doc = { ...doc, schemaVersion: version };
	}

	const result = v.safeParse(cvDocumentSchema, doc);
	if (!result.success) return { ok: false, error: 'invalid' };
	return { ok: true, cv: result.output, migrated };
}
