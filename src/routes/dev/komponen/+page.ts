import { dev } from '$app/env';
import { error } from '@sveltejs/kit';

export const prerender = false;

export function load() {
	if (!dev) error(404);
}
