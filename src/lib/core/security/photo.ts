/**
 * Profile photo processing — runs entirely on the user's device (PROJECT_SPEC §5.1, §11.7).
 *
 * decode (validates it really is an image) → apply EXIF orientation → resize (max 600 px)
 * → re-encode to JPEG ≤ 300 KB. Re-encoding through a canvas drops ALL metadata (EXIF, GPS).
 */

export const PHOTO_LIMITS = {
	/** Reject files above this size before decoding (protects low-end phones). */
	maxInputBytes: 15 * 1024 * 1024,
	maxDimension: 600,
	maxOutputBytes: 300 * 1024,
	outputType: 'image/jpeg'
} as const;

export type PhotoErrorCode = 'not-an-image' | 'too-large' | 'decode-failed' | 'encode-failed';

export class PhotoError extends Error {
	readonly code: PhotoErrorCode;
	constructor(code: PhotoErrorCode) {
		super(`photo: ${code}`);
		this.name = 'PhotoError';
		this.code = code;
	}
}

export interface ProcessedPhoto {
	blob: Blob;
	width: number;
	height: number;
	type: string;
}

/** Scales (width, height) down to fit `max` on the longest side. Never upscales. */
export function fitWithin(
	width: number,
	height: number,
	max: number
): { width: number; height: number } {
	const longest = Math.max(width, height);
	if (longest <= max) return { width, height };
	const scale = max / longest;
	return {
		width: Math.max(1, Math.round(width * scale)),
		height: Math.max(1, Math.round(height * scale))
	};
}

async function encode(
	canvas: OffscreenCanvas | HTMLCanvasElement,
	type: string,
	quality: number
): Promise<Blob | null> {
	if ('convertToBlob' in canvas) return canvas.convertToBlob({ type, quality });
	return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

function createCanvas(width: number, height: number): OffscreenCanvas | HTMLCanvasElement {
	if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height);
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	return canvas;
}

/** Browser-only. Throws `PhotoError` with a code the UI can translate. */
export async function processPhoto(file: Blob): Promise<ProcessedPhoto> {
	if (!file.type.startsWith('image/')) throw new PhotoError('not-an-image');
	if (file.size > PHOTO_LIMITS.maxInputBytes) throw new PhotoError('too-large');

	let bitmap: ImageBitmap;
	try {
		bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
	} catch {
		throw new PhotoError('decode-failed');
	}

	try {
		const size = fitWithin(bitmap.width, bitmap.height, PHOTO_LIMITS.maxDimension);
		const canvas = createCanvas(size.width, size.height);
		const ctx = canvas.getContext('2d') as
			OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null;
		if (!ctx) throw new PhotoError('encode-failed');
		// White background so transparent PNGs don't turn black in JPEG.
		ctx.fillStyle = '#ffffff';
		ctx.fillRect(0, 0, size.width, size.height);
		ctx.imageSmoothingQuality = 'high';
		ctx.drawImage(bitmap, 0, 0, size.width, size.height);

		for (const quality of [0.86, 0.78, 0.7, 0.6, 0.5]) {
			const blob = await encode(canvas, PHOTO_LIMITS.outputType, quality);
			if (blob && blob.size <= PHOTO_LIMITS.maxOutputBytes) {
				return { blob, width: size.width, height: size.height, type: blob.type };
			}
		}
		throw new PhotoError('encode-failed');
	} finally {
		bitmap.close();
	}
}
