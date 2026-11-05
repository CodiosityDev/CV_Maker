# CV Maker

Free CV builder for fresh graduates: create an **ATS-friendly** or **creative** CV with a guided flow.
No account needed: your CV is stored only on your own device (browser IndexedDB).

## Tech

SvelteKit 3 (Svelte 5 runes) · TypeScript · Tailwind CSS v4 · Vite · static build for Cloudflare Pages.

## Development

Requirements: Node.js ≥ 22 and pnpm.

```sh
pnpm install
pnpm dev          # start dev server
pnpm verify       # type-check, lint, unit tests, build, bundle-size budget
pnpm test:e2e     # Playwright (first time: pnpm exec playwright install chromium)
```

## Project structure

```
src/lib/core/       data model, local storage, export, ATS checks (no UI)
src/lib/ui/         UI components
src/lib/templates/  CV templates (ats/, creative/)
src/lib/i18n/       translations (id, en)
src/routes/         pages
static/_headers     security headers (Cloudflare Pages)
```

Imports use the `#lib` alias (e.g. `import { t } from '#lib/i18n/index.svelte'`).

## Privacy

No CV data leaves the user's device. No third-party scripts, fonts or trackers.
