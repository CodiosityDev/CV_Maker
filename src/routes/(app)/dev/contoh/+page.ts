// Development-only tool: 404 in production builds.
import { dev } from '$app/env';
import { error } from '@sveltejs/kit';

export function load() {
	if (!dev) error(404);
}
