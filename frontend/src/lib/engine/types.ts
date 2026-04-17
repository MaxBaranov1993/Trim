export interface TextureTransform {
	offsetX: number;
	offsetY: number;
	scale: number;
	rotation: number;
	nativeWidth: number;
	nativeHeight: number;
}

export interface AtlasBlock {
	id: string;
	materialId: string;
	x: number;
	y: number;
	width: number;
	height: number;
	textureTransform?: TextureTransform;
}

export interface Slot {
	x: number;
	y: number;
	max_width: number;
	max_height: number;
}

export type PBRChannel = 'baseColor' | 'normal' | 'roughness' | 'metallic' | 'ao' | 'opacity' | 'emission';

export interface MaterialGroup {
	id: string;
	name: string;
	channels: Partial<Record<PBRChannel, File>>;
	thumbnail?: string;
}

export const CANVAS_SIZES = [1024, 2048, 4096, 8192] as const;
export type CanvasSize = (typeof CANVAS_SIZES)[number];

export const BLOCK_SIZES = [64, 128, 256, 512, 1024, 2048, 4096, 8192] as const;
export type BlockSize = (typeof BLOCK_SIZES)[number];
