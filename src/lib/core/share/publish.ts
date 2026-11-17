/**
 * Browser side of sharing: uploads a CV snapshot (and, if allowed, its photo) and keeps links
 * with "Perbarui otomatis" up to date after edits.
 *
 *   const result = await publishShare(cv, { access: 'link', discoverable: false, settings });
 *   shareSync.cvSaved(cv);   // call after each autosave in the editor (cheap when not shared)
 *
 * Nothing is uploaded unless the user pressed "Bagikan" for that CV.
 */
import { shareClient, type Result } from '../account/index';
import type { CVDocument } from '../schema/types';
import { assetRepo } from '../storage/index';
import { buildShareSnapshot, type ShareInfo, type ShareSaveRequest } from './index';

export type PublishOptions = Omit<ShareSaveRequest, 'snapshot' | 'photo'>;

async function blobToDataUrl(blob: Blob): Promise<string> {
	const bytes = new Uint8Array(await blob.arrayBuffer());
	let binary = '';
	for (let i = 0; i < bytes.length; i += 0x8000) {
		binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
	}
	return `data:${blob.type};base64,${btoa(binary)}`;
}

/** The photo as a data URL when the shared page may show it (Creative + showPhoto). */
async function photoFor(cv: CVDocument, options: PublishOptions): Promise<string | null> {
	const id = cv.personal.photoAssetId;
	if (cv.kind !== 'creative' || !options.settings.showPhoto || !id) return null;
	const blob = await assetRepo.getPhotoBlob(id).catch(() => null);
	return blob ? blobToDataUrl(blob) : null;
}

/** Uploads the CV with the given sharing options. Updates the auto-sync cache on success. */
export async function publishShare(
	cv: CVDocument,
	options: PublishOptions
): Promise<Result<ShareInfo>> {
	const result = await shareClient.save(cv.id, {
		...options,
		snapshot: buildShareSnapshot(cv, options.settings),
		photo: await photoFor(cv, options)
	});
	if (result.ok) shareSync.remember(result.data);
	return result;
}

const AUTO_DELAY_MS = 5_000;

let known: Map<string, ShareInfo> | undefined;
let loading: Promise<void> | undefined;
const timers = new Map<string, ReturnType<typeof setTimeout>>();

/** Keeps links with `autoUpdate` in sync with the editor. */
export const shareSync = {
	/** Loads the user's links once (call after login). Failures leave auto-sync off. */
	async load(force = false): Promise<void> {
		if (loading && !force) return loading;
		loading = (async () => {
			const result = await shareClient.list();
			known = result.ok ? new Map(result.data.map((info) => [info.cvId, info])) : undefined;
		})();
		return loading;
	},
	remember(info: ShareInfo): void {
		known ??= new Map();
		known.set(info.cvId, info);
	},
	forget(cvId: string): void {
		known?.delete(cvId);
		const timer = timers.get(cvId);
		if (timer) clearTimeout(timer);
		timers.delete(cvId);
	},
	/** Clears everything (logout, account deleted). */
	reset(): void {
		known = undefined;
		loading = undefined;
		for (const timer of timers.values()) clearTimeout(timer);
		timers.clear();
	},
	info(cvId: string): ShareInfo | undefined {
		return known?.get(cvId);
	},
	/**
	 * After the editor saved `cv`: re-uploads it a few seconds later when its link has
	 * "Perbarui otomatis" (several quick edits = one upload). Pass a plain object, not a proxy.
	 */
	cvSaved(cv: CVDocument): void {
		const info = known?.get(cv.id);
		if (!info || !info.settings.autoUpdate || info.access === 'private') return;
		const previous = timers.get(cv.id);
		if (previous) clearTimeout(previous);
		timers.set(
			cv.id,
			setTimeout(() => {
				timers.delete(cv.id);
				const current = known?.get(cv.id);
				if (!current?.settings.autoUpdate) return;
				void publishShare(cv, {
					access: current.access,
					discoverable: current.discoverable,
					settings: current.settings
				});
			}, AUTO_DELAY_MS)
		);
	}
};
