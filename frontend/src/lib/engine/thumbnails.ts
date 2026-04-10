import type { MaterialGroup } from './types.js';
import { isReady, wasmGenerateThumbnail } from './wasm-bridge.js';

const THUMB_SIZE = 128;

async function fileToBytes(file: File): Promise<Uint8Array> {
	const buffer = await file.arrayBuffer();
	return new Uint8Array(buffer);
}

async function generateSingleThumbnail(file: File): Promise<string> {
	if (isReady()) {
		try {
			const bytes = await fileToBytes(file);
			const thumbBytes = wasmGenerateThumbnail(bytes, THUMB_SIZE);
			const blob = new Blob([thumbBytes], { type: 'image/png' });
			return URL.createObjectURL(blob);
		} catch {
			// Fallback to browser-based thumbnail
		}
	}

	// Browser fallback: use canvas to resize
	return createBrowserThumbnail(file);
}

function createBrowserThumbnail(file: File): Promise<string> {
	return new Promise((resolve) => {
		const url = URL.createObjectURL(file);
		const img = new Image();
		img.onload = () => {
			const canvas = document.createElement('canvas');
			canvas.width = THUMB_SIZE;
			canvas.height = THUMB_SIZE;
			const ctx = canvas.getContext('2d')!;
			ctx.drawImage(img, 0, 0, THUMB_SIZE, THUMB_SIZE);
			URL.revokeObjectURL(url);
			resolve(canvas.toDataURL('image/png'));
		};
		img.onerror = () => {
			URL.revokeObjectURL(url);
			resolve('');
		};
		img.src = url;
	});
}

export async function generateThumbnails(
	groups: MaterialGroup[]
): Promise<MaterialGroup[]> {
	const results: MaterialGroup[] = [];

	for (const group of groups) {
		// Use baseColor for thumbnail, fall back to first available channel
		const thumbFile =
			group.channels.baseColor ??
			group.channels.normal ??
			group.channels.roughness ??
			group.channels.metallic ??
			group.channels.ao ??
			group.channels.opacity ??
			group.channels.emission;

		let thumbnail = '';
		if (thumbFile) {
			thumbnail = await generateSingleThumbnail(thumbFile);
		}

		results.push({ ...group, thumbnail });
	}

	return results;
}
