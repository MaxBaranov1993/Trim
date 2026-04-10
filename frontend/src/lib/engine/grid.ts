import { BLOCK_SIZES, type BlockSize } from './types.js';

export function snapToGrid(value: number, gridSize: number): number {
	return Math.round(value / gridSize) * gridSize;
}

export function clampToCanvas(
	value: number,
	size: number,
	canvasSize: number
): number {
	return Math.max(0, Math.min(value, canvasSize - size));
}

export function nearestPowerOfTwo(value: number): BlockSize {
	let closest: BlockSize = BLOCK_SIZES[0];
	let minDiff = Infinity;
	for (const s of BLOCK_SIZES) {
		const diff = Math.abs(value - s);
		if (diff < minDiff) {
			minDiff = diff;
			closest = s;
		}
	}
	return closest;
}

export function getGridStep(canvasWidth: number, canvasHeight: number): number {
	const minDim = Math.min(canvasWidth, canvasHeight);
	if (minDim <= 1024) return 64;
	if (minDim <= 2048) return 128;
	if (minDim <= 4096) return 256;
	return 512;
}

export function isPowerOfTwo(n: number): boolean {
	return n > 0 && (n & (n - 1)) === 0;
}
