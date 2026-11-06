import { defineConfig } from 'vitest/config';
import tailwindcss from '@tailwindcss/vite';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';

/**
 * Routes that exist in the plan but may not be built yet (e.g. the landing page links to
 * /buat before the wizard exists). Prerender 404s on these paths only warn; any other
 * broken internal link fails the build.
 */
const PLANNED_APP_ROUTES = ['/buat', '/cv'];

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for all project files (Svelte 4 syntax becomes a compile error).
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter({
				// App routes (/buat, /cv/...) are client-only and served through this SPA shell.
				// Content pages (/, /privasi, /tentang) are prerendered to real HTML.
				fallback: '200.html',
				precompress: false
			}),
			csp: {
				mode: 'hash',
				directives: {
					'default-src': ['self'],
					'script-src': ['self'],
					'style-src': ['self', 'unsafe-inline'],
					'img-src': ['self', 'data:', 'blob:'],
					'font-src': ['self'],
					'connect-src': ['self'],
					'worker-src': ['self'],
					'manifest-src': ['self'],
					'object-src': ['none'],
					'base-uri': ['self'],
					'form-action': ['self']
				}
			},
			prerender: {
				handleHttpError: ({ path, status, message }) => {
					const planned = PLANNED_APP_ROUTES.some((r) => path === r || path.startsWith(`${r}/`));
					if (status === 404 && planned) {
						console.warn(`[prerender] link to not-yet-built route ignored: ${path}`);
						return;
					}
					throw new Error(message);
				}
			}
		})
	],
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'unit',
					environment: 'node',
					include: [
						'src/**/*.{test,spec}.{js,ts}',
						'tests/unit/**/*.{test,spec}.{js,ts}',
						'tests/templates/**/*.{test,spec}.{js,ts}'
					],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
