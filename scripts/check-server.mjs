// Starts the built API server (server/dist/server.mjs) WITHOUT settings and checks that it gets
// as far as reading its configuration. A crash while the bundle loads (e.g. a Svelte rune that
// was not compiled, a missing dependency) fails here instead of on the VPS during a deploy.
// Run after `pnpm build:server` (part of `pnpm verify`).
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const file = 'server/dist/server.mjs';
if (!existsSync(file)) {
	console.error(`No ${file}. Run "pnpm build:server" first.`);
	process.exit(1);
}

// Empty environment: the server must load, then stop with a clear config error.
const result = spawnSync(process.execPath, [file], {
	env: { PATH: process.env.PATH ?? '' },
	encoding: 'utf8',
	timeout: 20_000
});
const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
const loaded =
	output.includes('"event":"fatal"') && output.includes('Missing environment variable');
if (!loaded) {
	console.error('✗ server.mjs did not load cleanly:\n' + output.slice(0, 2000));
	process.exit(1);
}
console.log('✓ server.mjs loads and checks its configuration');
