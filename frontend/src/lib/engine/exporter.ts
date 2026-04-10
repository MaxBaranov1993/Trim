import { atlas } from '$lib/stores/atlas.svelte.js';
import { wasmCompositeAtlas } from './wasm-bridge.js';
import JSZip from 'jszip';
import type { PBRChannel } from './types.js';

export interface ExportResult {
	channel: PBRChannel;
	filename: string;
	data: Uint8Array;
}

const CHANNEL_FILENAMES: Record<PBRChannel, string> = {
	baseColor: 'basecolor.png',
	normal: 'normal.png',
	roughness: 'roughness.png',
	metallic: 'metallic.png',
	ao: 'ao.png',
	opacity: 'opacity.png',
	emission: 'emission.png'
};

async function fileToBytes(file: File): Promise<Uint8Array> {
	const buffer = await file.arrayBuffer();
	return new Uint8Array(buffer);
}

export async function exportAtlas(
	onProgress?: (channel: string, index: number, total: number) => void
): Promise<ExportResult[]> {
	const blocks = atlas.blocks;
	const materials = atlas.materials;
	const channels: PBRChannel[] = ['baseColor', 'normal', 'roughness', 'metallic', 'ao', 'opacity', 'emission'];

	// Find which channels actually have data
	const activeChannels = channels.filter((ch) =>
		blocks.some((block) => {
			const mat = materials.find((m) => m.id === block.materialId);
			return mat?.channels[ch];
		})
	);

	const results: ExportResult[] = [];

	for (let ci = 0; ci < activeChannels.length; ci++) {
		const channel = activeChannels[ci];
		onProgress?.(channel, ci, activeChannels.length);

		// Collect image bytes for each block
		const imageBytes: Uint8Array[] = [];
		const layoutBlocks: {
			x: number;
			y: number;
			width: number;
			height: number;
			image_index: number;
		}[] = [];

		for (const block of blocks) {
			const mat = materials.find((m) => m.id === block.materialId);
			const file = mat?.channels[channel];
			if (!file) continue;

			const bytes = await fileToBytes(file);
			const imageIndex = imageBytes.length;
			imageBytes.push(bytes);

			layoutBlocks.push({
				x: block.x,
				y: block.y,
				width: block.width,
				height: block.height,
				image_index: imageIndex
			});
		}

		if (layoutBlocks.length === 0) continue;

		// Flatten image bytes for WASM
		const totalSize = imageBytes.reduce((sum, b) => sum + b.length, 0);
		const flatImages = new Uint8Array(totalSize);
		const offsets: number[] = [];
		let offset = 0;
		for (const bytes of imageBytes) {
			flatImages.set(bytes, offset);
			offset += bytes.length;
			offsets.push(offset);
		}

		const layoutJson = JSON.stringify({
			canvas_width: atlas.canvasWidth,
			canvas_height: atlas.canvasHeight,
			blocks: layoutBlocks
		});

		const pngBytes = wasmCompositeAtlas(layoutJson, flatImages, JSON.stringify(offsets));

		results.push({
			channel,
			filename: CHANNEL_FILENAMES[channel],
			data: pngBytes
		});
	}

	return results;
}

export function downloadBlob(data: Uint8Array, filename: string) {
	const blob = new Blob([data], { type: 'image/png' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
}

export async function downloadAsZip(results: ExportResult[]) {
	const zip = new JSZip();
	for (const result of results) {
		zip.file(result.filename, result.data);
	}
	const blob = await zip.generateAsync({ type: 'blob' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = 'atlas.zip';
	a.click();
	URL.revokeObjectURL(url);
}
