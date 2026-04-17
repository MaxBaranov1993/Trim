import type { AtlasBlock, CanvasSize, PBRChannel, MaterialGroup } from '$lib/engine/types.js';

let canvasWidth = $state<CanvasSize>(2048);
let canvasHeight = $state<CanvasSize>(2048);
let blocks = $state<AtlasBlock[]>([]);
let materials = $state<MaterialGroup[]>([]);
let activeChannel = $state<PBRChannel>('baseColor');
let padding = $state(0);

export const atlas = {
	get canvasWidth() {
		return canvasWidth;
	},
	set canvasWidth(v: CanvasSize) {
		canvasWidth = v;
	},
	get canvasHeight() {
		return canvasHeight;
	},
	set canvasHeight(v: CanvasSize) {
		canvasHeight = v;
	},
	get blocks() {
		return blocks;
	},
	get materials() {
		return materials;
	},
	get activeChannel() {
		return activeChannel;
	},
	set activeChannel(v: PBRChannel) {
		activeChannel = v;
	},
	get padding() {
		return padding;
	},
	set padding(v: number) {
		padding = v;
	},

	addBlock(block: AtlasBlock) {
		blocks.push(block);
	},
	removeBlock(id: string) {
		blocks = blocks.filter((b) => b.id !== id);
	},
	updateBlock(id: string, updates: Partial<AtlasBlock>) {
		const idx = blocks.findIndex((b) => b.id === id);
		if (idx !== -1) {
			blocks[idx] = { ...blocks[idx], ...updates };
		}
	},
	addMaterial(material: MaterialGroup) {
		materials.push(material);
	},
	addEmptyMaterial(name: string): string {
		const id = crypto.randomUUID();
		materials.push({ id, name, channels: {} });
		return id;
	},
	setMaterials(mats: MaterialGroup[]) {
		materials = mats;
	},
	setMaterialChannel(materialId: string, channel: PBRChannel, file: File | null) {
		const idx = materials.findIndex((m) => m.id === materialId);
		if (idx === -1) return;
		const prev = materials[idx];
		const nextChannels = { ...prev.channels };
		if (file) {
			nextChannels[channel] = file;
		} else {
			delete nextChannels[channel];
		}
		materials[idx] = { ...prev, channels: nextChannels };
	},
	setMaterialThumbnail(materialId: string, thumbnail: string) {
		const idx = materials.findIndex((m) => m.id === materialId);
		if (idx === -1) return;
		materials[idx] = { ...materials[idx], thumbnail };
	},
	renameMaterial(materialId: string, name: string) {
		const idx = materials.findIndex((m) => m.id === materialId);
		if (idx === -1) return;
		materials[idx] = { ...materials[idx], name };
	},
	removeMaterial(id: string) {
		// Remove all blocks using this material
		blocks = blocks.filter((b) => b.materialId !== id);
		materials = materials.filter((m) => m.id !== id);
	},
	clearAll() {
		blocks = [];
		materials = [];
	}
};
