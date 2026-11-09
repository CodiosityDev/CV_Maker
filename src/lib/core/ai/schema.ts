/**
 * Valibot schemas for the AI contract. The browser builds requests that always pass; the server
 * uses the same schema to reject anything else (strict: too long → rejected, not truncated).
 */
import * as v from 'valibot';
import { EXPERIENCE_TYPES } from '../schema/types';
import { LIMITS } from '../schema/limits';
import { AI_PROFILE_LIMITS, AI_TASKS, type AiRequest } from './types';

const text = (max: number) => v.pipe(v.string(), v.maxLength(max));
const list = <T extends v.GenericSchema>(item: T, max: number) =>
	v.pipe(v.array(item), v.maxLength(max));
const bullets = list(text(LIMITS.bullet), AI_PROFILE_LIMITS.bulletsPerItem);
const skills = list(text(LIMITS.title), AI_PROFILE_LIMITS.skillsPerGroup);

export const AiProfileSchema = v.strictObject({
	locale: v.picklist(['id', 'en']),
	targetRole: text(LIMITS.title),
	education: list(
		v.strictObject({
			degree: text(LIMITS.short),
			major: text(LIMITS.title),
			institution: text(LIMITS.title),
			gpa: text(LIMITS.gpa)
		}),
		AI_PROFILE_LIMITS.education
	),
	experience: list(
		v.strictObject({
			type: v.picklist(EXPERIENCE_TYPES),
			role: text(LIMITS.title),
			company: text(LIMITS.title),
			bullets
		}),
		AI_PROFILE_LIMITS.experience
	),
	organizations: list(
		v.strictObject({ role: text(LIMITS.title), name: text(LIMITS.title), bullets }),
		AI_PROFILE_LIMITS.organizations
	),
	projects: list(
		v.strictObject({ name: text(LIMITS.title), role: text(LIMITS.title), bullets }),
		AI_PROFILE_LIMITS.projects
	),
	skills: v.strictObject({ hard: skills, tools: skills, soft: skills }),
	certifications: list(text(LIMITS.title), AI_PROFILE_LIMITS.certifications),
	summary: text(LIMITS.summary)
});

export const AiRequestSchema = v.strictObject({
	task: v.picklist(AI_TASKS),
	profile: AiProfileSchema
});

/** Parses an untrusted request body; `undefined` when it does not match the contract. */
export function parseAiRequest(input: unknown): AiRequest | undefined {
	const result = v.safeParse(AiRequestSchema, input);
	return result.success ? result.output : undefined;
}
