/**
 * Template registry (PROJECT_SPEC §7.1). Single source of truth for which CV templates exist.
 *
 *   import { resolveTemplate, templatesFor } from '#lib/templates/registry.ts';
 *   const meta = resolveTemplate(cv.templateId, cv.kind);   // never undefined
 *   const Template = (await meta.load()).default;          // lazy: each template is its own chunk
 *
 * Contains NO user-facing text: names/descriptions live in i18n (`templates.<id>.name`, `.description`).
 *
 * Adding a template: create the .svelte file (props: `{ model: RenderModel }`, pure, no side effects),
 * then add ONE entry below. The automated contract tests (tests/templates) pick it up automatically.
 */
import type { Component } from 'svelte';
import type { CVKind, CVTheme } from '../core/schema/types';
import type { RenderModel } from '../core/render/index';

export type TemplateComponent = Component<{ model: RenderModel }>;

export interface TemplateMeta {
	/** Stable slug stored in `cv.templateId`, e.g. 'ats-klasik'. */
	id: string;
	kind: CVKind;
	/** Shows `model.personal.photoUrl` (creative only — ATS templates must never show a photo). */
	supportsPhoto: boolean;
	/** Uses `model.theme.accentColor`. */
	supportsAccentColor: boolean;
	/** Lazy import of the component. */
	load: () => Promise<{ default: TemplateComponent }>;
}

export const TEMPLATES: readonly TemplateMeta[] = [
	{
		id: 'ats-klasik',
		kind: 'ats',
		supportsPhoto: false,
		supportsAccentColor: false,
		load: () => import('./ats/AtsKlasik.svelte')
	},
	{
		id: 'ats-modern',
		kind: 'ats',
		supportsPhoto: false,
		supportsAccentColor: false,
		load: () => import('./ats/AtsModern.svelte')
	},
	{
		id: 'ats-ringkas',
		kind: 'ats',
		supportsPhoto: false,
		supportsAccentColor: false,
		load: () => import('./ats/AtsRingkas.svelte')
	},
	{
		id: 'creative-sidebar',
		kind: 'creative',
		supportsPhoto: true,
		supportsAccentColor: true,
		load: () => import('./creative/CreativeSidebar.svelte')
	},
	{
		id: 'creative-header',
		kind: 'creative',
		supportsPhoto: true,
		supportsAccentColor: true,
		load: () => import('./creative/CreativeHeader.svelte')
	},
	{
		id: 'creative-timeline',
		kind: 'creative',
		supportsPhoto: true,
		supportsAccentColor: true,
		load: () => import('./creative/CreativeTimeline.svelte')
	}
];

/** Fallback used when a CV refers to a template that does not exist (yet). */
const FALLBACK_ID: Record<CVKind, string> = { ats: 'ats-klasik', creative: 'ats-klasik' };

export function getTemplate(id: string): TemplateMeta | undefined {
	return TEMPLATES.find((template) => template.id === id);
}

/** Templates offered for a CV kind, in display order. */
export function templatesFor(kind: CVKind): TemplateMeta[] {
	return TEMPLATES.filter((template) => template.kind === kind);
}

/**
 * The template to render for a CV. Never undefined:
 * the requested template if it exists and matches the kind → first template of that kind → ATS Klasik.
 */
export function resolveTemplate(templateId: string, kind: CVKind): TemplateMeta {
	const requested = getTemplate(templateId);
	if (requested && requested.kind === kind) return requested;
	const sameKind = templatesFor(kind)[0];
	if (sameKind) return sameKind;
	return getTemplate(FALLBACK_ID[kind]) ?? (TEMPLATES[0] as TemplateMeta);
}

/** Default template id when a CV is created or switched to a kind. */
export function defaultTemplateId(kind: CVKind): string {
	return resolveTemplate('', kind).id;
}

/**
 * Patch for switching a CV between ATS and Creative: keeps the content, picks a template of the
 * new kind, and drops theme options the new template cannot use. Apply inside `store.update`.
 */
export function switchKindPatch(
	kind: CVKind,
	theme: CVTheme
): { kind: CVKind; templateId: string; theme: CVTheme } {
	const template = resolveTemplate('', kind);
	return {
		kind,
		templateId: template.id,
		theme: template.supportsAccentColor ? { ...theme } : { ...theme, accentColor: undefined }
	};
}
