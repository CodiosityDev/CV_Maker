/**
 * Identifies an image by its first bytes ("magic numbers") instead of trusting a declared MIME type.
 * Used for photos coming from untrusted files (backup import).
 */
export type SniffedImageType = 'image/jpeg' | 'image/png' | 'image/webp';

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0) =>
	bytes.length >= offset + signature.length &&
	signature.every((value, index) => bytes[offset + index] === value);

/** The real image type of `data`, or `undefined` if it is not a JPEG, PNG or WebP image. */
export function sniffImageType(data: ArrayBuffer | Uint8Array): SniffedImageType | undefined {
	const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
	if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg';
	if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
	// "RIFF" <4-byte size> "WEBP"
	if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8))
		return 'image/webp';
	return undefined;
}
