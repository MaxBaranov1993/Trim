import init, {
	greet,
	check_collision,
	get_available_slots,
	generate_thumbnail,
	composite_atlas,
	auto_pack
} from '$lib/wasm/trimm_core.js';

let initialized = false;

export async function initWasm(): Promise<void> {
	if (initialized) return;
	await init();
	initialized = true;
}

export function isReady(): boolean {
	return initialized;
}

export function wasmGreet(): string {
	return greet();
}

export function wasmCheckCollision(blocksJson: string, newBlockJson: string): boolean {
	return check_collision(blocksJson, newBlockJson);
}

export function wasmGetAvailableSlots(
	blocksJson: string,
	canvasW: number,
	canvasH: number,
	minSize: number
): string {
	return get_available_slots(blocksJson, canvasW, canvasH, minSize);
}

export function wasmGenerateThumbnail(data: Uint8Array, maxSize: number): Uint8Array {
	return generate_thumbnail(data, maxSize);
}

export function wasmCompositeAtlas(
	layoutJson: string,
	flatImages: Uint8Array,
	offsetsJson: string
): Uint8Array {
	return composite_atlas(layoutJson, flatImages, offsetsJson);
}

export function wasmAutoPack(
	itemsJson: string,
	canvasW: number,
	canvasH: number,
	padding: number
): string {
	return auto_pack(itemsJson, canvasW, canvasH, padding);
}
