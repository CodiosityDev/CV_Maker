import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { cvRepo } from '#lib/core/storage/index.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params }) => {
	const cv = await cvRepo.get(params.id);
	if (cv && !cv.status.wizardCompleted) {
		redirect(307, resolve('/(app)/buat/[id]', { id: cv.id }));
	}
	return { cv };
};
