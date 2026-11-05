/**
 * Default: prerender every page to static HTML (landing, /privasi, /tentang, ...).
 *
 * App routes that work with the user's local data (/buat, /cv, /cv/[id]/...) must opt out
 * in their own `+layout.ts` / `+page.ts`:
 *   export const prerender = false;
 *   export const ssr = false;
 * They are then served by the SPA shell `200.html` (see vite.config.ts and static/_redirects).
 */
export const prerender = true;
