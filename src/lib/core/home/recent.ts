/**
 * Loads the newest CVs as ready-to-render paper previews for the home page (and, if wanted, the
 * /cv dashboard). Import lazily — see `./index.ts` — because it pulls in storage, schema and render.
 *
 *   const list = await loadRecentCvs();          // or loadRecentCvs({ limit: Infinity }) on /cv
 *   for (const { meta, model } of list.items) {
 *     // <TemplateThumbnail meta={resolveTemplate(meta.templateId, meta.kind)} {model} />
 *   }
 *   list.release();                              // on unmount: frees the photo object URLs
 */
import { cvRepo as defaultCvRepo, assetRepo as defaultAssetRepo } from '../storage/index';
import type { AssetRepository, CvRepository } from '../storage/repo';
import { toCvMeta } from '../schema/meta';
import type { CVMeta } from '../schema/types';
import { toRenderModel, type RenderModel } from '../render/index';
import { HOME_RECENT_LIMIT } from './index';

/** One CV preview: list data for the card + the render model for the paper thumbnail. */
export interface RecentCv {
	meta: CVMeta;
	model: RenderModel;
}

export interface RecentCvList {
	/** Newest first (by `updatedAt`). Empty when no CV could be read. */
	items: RecentCv[];
	/**
	 * Revokes the photo object URLs used by the models. Call it when the previews are removed —
	 * also when the component unmounted before the promise resolved. Safe to call twice.
	 */
	release(): void;
}

export interface LoadRecentOptions {
	/** Maximum number of CVs (default `HOME_RECENT_LIMIT` = 4). */
	limit?: number;
	/** @internal Tests inject their own repositories. */
	repos?: { cvRepo: CvRepository; assetRepo: AssetRepository };
}

/**
 * Reads the newest CVs and builds their render models (the same `toRenderModel` the editor uses,
 * so the thumbnail looks exactly like the CV). Photos are loaded only for Creative CVs (ATS
 * templates never show one). CVs that cannot be read are skipped; a missing photo is not an error.
 * Data never leaves the device.
 */
export async function loadRecentCvs(options: LoadRecentOptions = {}): Promise<RecentCvList> {
	const { cvRepo, assetRepo } = options.repos ?? {
		cvRepo: defaultCvRepo,
		assetRepo: defaultAssetRepo
	};
	const limit = Math.max(0, options.limit ?? HOME_RECENT_LIMIT);
	const urls: string[] = [];
	let released = false;
	const release = () => {
		released = true;
		for (const url of urls.splice(0)) URL.revokeObjectURL(url);
	};

	const metas = (await cvRepo.list()).slice(0, limit);
	const docs = await Promise.all(metas.map((meta) => cvRepo.get(meta.id)));
	const items: RecentCv[] = [];
	for (const cv of docs) {
		if (!cv) continue; // deleted or unreadable since `list()`
		let photoUrl: string | undefined;
		const photoId = cv.personal.photoAssetId;
		if (cv.kind === 'creative' && photoId && !released) {
			photoUrl = (await assetRepo.getPhotoUrl(photoId).catch(() => null)) ?? undefined;
			if (photoUrl) {
				// release() may have run while the photo was loading.
				if (released) URL.revokeObjectURL(photoUrl);
				else urls.push(photoUrl);
			}
		}
		items.push({ meta: toCvMeta(cv), model: toRenderModel(cv, { photoUrl }) });
	}
	return { items, release };
}
