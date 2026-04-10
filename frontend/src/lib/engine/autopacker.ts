import { atlas } from '$lib/stores/atlas.svelte.js';
import { wasmAutoPack } from './wasm-bridge.js';
import { nearestPowerOfTwo } from './grid.js';

interface PackResult {
	id: string;
	x: number;
	y: number;
	width: number;
	height: number;
	placed: boolean;
}

/**
 * Auto-pack all materials that aren't yet placed on canvas.
 * If `repackAll` is true, repack all materials including already placed ones.
 */
export function autoPackMaterials(padding: number = 0, repackAll: boolean = false) {
	const materials = atlas.materials;
	const existingBlocks = atlas.blocks;

	// Determine which materials to pack
	const placedMaterialIds = new Set(existingBlocks.map((b) => b.materialId));
	const toPack = repackAll
		? materials
		: materials.filter((m) => !placedMaterialIds.has(m.id));

	if (toPack.length === 0) return;

	// Build pack items — use default size 256 for new, existing size for repack
	const items = toPack.map((m) => {
		const existing = existingBlocks.find((b) => b.materialId === m.id);
		return {
			id: m.id,
			width: existing ? existing.width : 256,
			height: existing ? existing.height : 256
		};
	});

	const resultJson = wasmAutoPack(
		JSON.stringify(items),
		atlas.canvasWidth,
		atlas.canvasHeight,
		padding
	);

	const results: PackResult[] = JSON.parse(resultJson);

	if (repackAll) {
		// Remove all existing blocks
		for (const block of [...existingBlocks]) {
			atlas.removeBlock(block.id);
		}
	}

	// Add new blocks from pack results
	for (const result of results) {
		if (!result.placed) continue;

		// Remove existing block for this material if repacking
		if (repackAll) {
			// Already removed above
		}

		const existingBlock = atlas.blocks.find((b) => b.materialId === result.id);
		if (existingBlock) {
			// Update position
			atlas.updateBlock(existingBlock.id, {
				x: result.x,
				y: result.y,
				width: result.width,
				height: result.height
			});
		} else {
			atlas.addBlock({
				id: crypto.randomUUID(),
				materialId: result.id,
				x: result.x,
				y: result.y,
				width: result.width,
				height: result.height
			});
		}
	}

	// Count unplaced
	const unplaced = results.filter((r) => !r.placed).length;
	return { placed: results.filter((r) => r.placed).length, unplaced };
}
