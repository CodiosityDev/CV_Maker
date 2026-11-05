/** Random, collision-safe id (UUID v4). Used for CVs, items and assets. */
export function newId(): string {
	return crypto.randomUUID();
}

export const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
export const CUSTOM_SECTION_KEY_PATTERN = /^custom:[a-z0-9-]{1,40}$/;
export const YEAR_MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
export const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
export const SLUG_PATTERN = /^[a-z0-9-]{1,40}$/;

/** New key for a user-created custom section. */
export function newCustomSectionKey(): `custom:${string}` {
	return `custom:${newId().slice(0, 8)}`;
}
