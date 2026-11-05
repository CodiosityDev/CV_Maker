// Checks the gzip size of the JavaScript needed for the initial load of key pages.
// Budgets: PROJECT_SPEC §10. Run after `pnpm build`.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const BUILD_DIR = 'build';
const KB = 1024;

/** page HTML file → budget in KB (gzip) */
const BUDGETS = {
	'index.html': 60, // landing
	'200.html': 150 // SPA shell for app routes (route chunks are lazy and checked separately later)
};

/** @param {string} html */
function jsAssetsOf(html) {
	const found = new Set();
	// Matches "/_app/...", "./_app/..." and "../_app/..." (SvelteKit emits relative paths by default).
	for (const match of html.matchAll(
		/["'(](?:\.{1,2}\/)*\/?(_app\/immutable\/[^"'()\s]+\.js)["')]/g
	)) {
		if (match[1]) found.add(match[1]);
	}
	return [...found];
}

/** @param {string} file */
function gzipSize(file) {
	return gzipSync(readFileSync(file), { level: 9 }).length;
}

if (!existsSync(BUILD_DIR)) {
	console.error(`No ${BUILD_DIR}/ folder. Run "pnpm build" first.`);
	process.exit(1);
}

let failed = false;
for (const [page, budgetKb] of Object.entries(BUDGETS)) {
	const htmlPath = join(BUILD_DIR, page);
	if (!existsSync(htmlPath)) {
		console.error(`✗ ${page}: not found in ${BUILD_DIR}/`);
		failed = true;
		continue;
	}
	const assets = jsAssetsOf(readFileSync(htmlPath, 'utf8'));
	const total = assets.reduce((sum, asset) => sum + gzipSize(join(BUILD_DIR, asset)), 0);
	const ok = total <= budgetKb * KB;
	if (!ok) failed = true;
	console.log(
		`${ok ? '✓' : '✗'} ${page}: ${(total / KB).toFixed(1)} KB gzip JS (${assets.length} files) — budget ${budgetKb} KB`
	);
}

process.exit(failed ? 1 : 0);
