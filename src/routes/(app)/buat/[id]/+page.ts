import { cvRepo } from '#lib/core/storage/index.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params }) => ({ cv: await cvRepo.get(params.id) });
