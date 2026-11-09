/**
 * Bundles the API server into ONE file (server/dist/server.mjs) with its dependencies inlined,
 * so the VPS needs no node_modules: `node --env-file=… server.mjs`.
 *   pnpm build:server
 */
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const root = fileURLToPath(new URL('..', import.meta.url));

export default defineConfig({
	root,
	publicDir: false,
	logLevel: 'warn',
	build: {
		ssr: 'server/src/main.ts',
		outDir: 'server/dist',
		emptyOutDir: true,
		target: 'node22',
		minify: false,
		sourcemap: false,
		copyPublicDir: false,
		rollupOptions: { output: { entryFileNames: 'server.mjs', format: 'es' } }
	},
	ssr: { noExternal: true, target: 'node' }
});
