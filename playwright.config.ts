import { defineConfig, devices } from '@playwright/test';

/**
 * E2E runs against the production build (vite preview) at three reference viewports:
 * small phone, tablet and desktop. See PROJECT_SPEC §10 / §14 (Definition of Done).
 */
export default defineConfig({
	testDir: 'tests/e2e',
	testMatch: '**/*.e2e.ts',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	reporter: process.env.CI ? 'github' : 'list',
	use: {
		baseURL: 'http://localhost:4173',
		trace: 'retain-on-failure'
	},
	webServer: {
		command: 'pnpm build && pnpm preview --port 4173 --strictPort',
		port: 4173,
		reuseExistingServer: !process.env.CI,
		timeout: 180_000
	},
	projects: [
		{
			name: 'mobile-360',
			use: {
				...devices['Desktop Chrome'],
				viewport: { width: 360, height: 780 },
				isMobile: true,
				hasTouch: true
			}
		},
		{
			name: 'tablet-768',
			use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 }, hasTouch: true }
		},
		{
			name: 'desktop-1280',
			use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } }
		}
	]
});
