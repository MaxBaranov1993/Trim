<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Texture } from 'pixi.js';
	import { PixiCanvas } from '$lib/canvas/PixiCanvas.js';
	import { atlas } from '$lib/stores/atlas.svelte.js';
	import { selection } from '$lib/stores/selection.svelte.js';
	import { history } from '$lib/stores/history.svelte.js';
	import { project } from '$lib/stores/project.svelte.js';
	import type { PBRChannel } from '$lib/engine/types.js';

	let containerEl: HTMLDivElement;
	let pixiCanvas: PixiCanvas | null = null;

	const textureCache = new Map<string, Map<PBRChannel, Texture>>();
	const objectUrls = new Set<string>();

	onMount(async () => {
		pixiCanvas = new PixiCanvas();
		await pixiCanvas.init(containerEl, atlas.canvasWidth, atlas.canvasHeight);

		pixiCanvas.onBlockSelect = (id) => {
			selection.selectedBlockId = id;
		};

		pixiCanvas.onDeselect = () => {
			selection.selectedBlockId = null;
		};

		pixiCanvas.onBlockUpdate = (id, updates) => {
			history.push();
			atlas.updateBlock(id, updates);
			project.markDirty();
		};

		pixiCanvas.onBlockDrop = async (materialId, x, y) => {
			const material = atlas.materials.find((m) => m.id === materialId);
			if (!material) return;

			history.push();

			const block = {
				id: crypto.randomUUID(),
				materialId,
				x,
				y,
				width: 256,
				height: 256
			};

			atlas.addBlock(block);
			pixiCanvas?.addBlock(block, material.name);
			pixiCanvas?.setBlocks(atlas.blocks);
			await loadBlockTextures(block.id, materialId);
			pixiCanvas?.selectBlock(block.id);
			selection.selectedBlockId = block.id;
			project.markDirty();
		};
	});

	onDestroy(() => {
		pixiCanvas?.destroy();
		for (const url of objectUrls) {
			URL.revokeObjectURL(url);
		}
		objectUrls.clear();
		textureCache.clear();
	});

	async function loadBlockTextures(blockId: string, materialId: string) {
		const material = atlas.materials.find((m) => m.id === materialId);
		if (!material) return;

		const channels: PBRChannel[] = ['baseColor', 'normal', 'roughness', 'metallic', 'ao', 'opacity', 'emission'];

		for (const channel of channels) {
			const file = material.channels[channel];
			if (!file) continue;

			let channelMap = textureCache.get(materialId);
			if (!channelMap) {
				channelMap = new Map();
				textureCache.set(materialId, channelMap);
			}

			let texture = channelMap.get(channel);
			if (!texture) {
				try {
					const blob = new Blob([await file.arrayBuffer()], { type: file.type || 'image/png' });
					const bitmap = await createImageBitmap(blob);
					texture = Texture.from(bitmap);
					channelMap.set(channel, texture);
				} catch (err) {
					console.warn(`Failed to load texture ${channel}:`, err);
					continue;
				}
			}

			pixiCanvas?.setBlockChannelTexture(blockId, channel, texture!);
		}
	}

	$effect(() => {
		const w = atlas.canvasWidth;
		const h = atlas.canvasHeight;
		pixiCanvas?.resize(w, h);
	});

	$effect(() => {
		const blocks = atlas.blocks;
		pixiCanvas?.setBlocks([...blocks]);
	});

	$effect(() => {
		const ch = atlas.activeChannel;
		pixiCanvas?.setActiveChannel(ch);
	});

	export function fitToView() {
		pixiCanvas?.fitToView();
	}

	export function deleteSelected() {
		if (!selection.selectedBlockId) return;
		history.push();
		const id = selection.selectedBlockId;
		atlas.removeBlock(id);
		pixiCanvas?.removeBlock(id);
		pixiCanvas?.setBlocks(atlas.blocks);
		selection.selectedBlockId = null;
		project.markDirty();
	}

	export function nudgeSelected(dx: number, dy: number, gridStep: number) {
		if (!selection.selectedBlockId) return;
		const block = atlas.blocks.find((b) => b.id === selection.selectedBlockId);
		if (!block) return;
		history.push();
		atlas.updateBlock(block.id, {
			x: Math.max(0, block.x + dx * gridStep),
			y: Math.max(0, block.y + dy * gridStep)
		});
		pixiCanvas?.updateBlockData(atlas.blocks.find((b) => b.id === block.id)!);
		project.markDirty();
	}

	/** Re-sync all blocks after undo/redo or project load */
	export async function syncFromStore() {
		if (!pixiCanvas) return;
		// Remove all sprites
		for (const id of [...pixiCanvas['blockSprites'].keys()]) {
			pixiCanvas.removeBlock(id);
		}
		// Re-add from store
		for (const block of atlas.blocks) {
			const mat = atlas.materials.find((m) => m.id === block.materialId);
			pixiCanvas.addBlock(block, mat?.name ?? '?');
			await loadBlockTextures(block.id, block.materialId);
		}
		pixiCanvas.setBlocks(atlas.blocks);
	}
</script>

<div class="canvas-container" bind:this={containerEl}></div>

<style>
	.canvas-container {
		flex: 1;
		width: 100%;
		height: 100%;
		overflow: hidden;
	}

	.canvas-container :global(canvas) {
		display: block;
	}
</style>
