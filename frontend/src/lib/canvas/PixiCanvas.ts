import { Application, Container, Graphics, Texture } from 'pixi.js';
import { BlockSprite } from './BlockSprite.js';
import { snapToGrid, clampToCanvas, nearestPowerOfTwo } from '$lib/engine/grid.js';
import { wasmCheckCollision } from '$lib/engine/wasm-bridge.js';
import type { AtlasBlock, PBRChannel } from '$lib/engine/types.js';

export type BlockEventCallback = (blockId: string) => void;
export type BlockUpdateCallback = (blockId: string, block: Partial<AtlasBlock>) => void;
export type BlockDropCallback = (materialId: string, x: number, y: number) => void;
export type DeselectCallback = () => void;

export class PixiCanvas {
	app: Application;
	viewport: Container;
	gridLayer: Container;
	blocksLayer: Container;
	ghostLayer: Container;

	private _zoom = 1;
	private _panX = 0;
	private _panY = 0;
	private _isPanning = false;
	private _lastPointerX = 0;
	private _lastPointerY = 0;

	private canvasWidth: number;
	private canvasHeight: number;
	private gridStep: number;

	private blockSprites = new Map<string, BlockSprite>();
	private selectedBlockId: string | null = null;

	// Drag state
	private draggingBlockId: string | null = null;
	private dragOffsetX = 0;
	private dragOffsetY = 0;
	private dragOrigX = 0;
	private dragOrigY = 0;

	// Resize state
	private resizingBlockId: string | null = null;
	private resizeStartW = 0;
	private resizeStartH = 0;
	private resizeStartMouseX = 0;
	private resizeStartMouseY = 0;

	// Ghost block for drop preview
	private ghostGraphics: Graphics | null = null;

	// Callbacks
	onBlockSelect: BlockEventCallback = () => {};
	onBlockUpdate: BlockUpdateCallback = () => {};
	onBlockDrop: BlockDropCallback = () => {};
	onDeselect: DeselectCallback = () => {};

	// Reference to current blocks for collision checks
	private currentBlocks: AtlasBlock[] = [];

	constructor() {
		this.app = new Application();
		this.viewport = new Container();
		this.gridLayer = new Container();
		this.blocksLayer = new Container();
		this.ghostLayer = new Container();
		this.canvasWidth = 2048;
		this.canvasHeight = 2048;
		this.gridStep = 128;
	}

	async init(container: HTMLElement, canvasW: number, canvasH: number) {
		this.canvasWidth = canvasW;
		this.canvasHeight = canvasH;

		await this.app.init({
			resizeTo: container,
			background: 0x1a1a2e,
			antialias: true
		});

		container.appendChild(this.app.canvas);

		this.viewport.addChild(this.gridLayer);
		this.viewport.addChild(this.blocksLayer);
		this.viewport.addChild(this.ghostLayer);
		this.app.stage.addChild(this.viewport);

		this.app.stage.eventMode = 'static';
		this.app.stage.hitArea = this.app.screen;

		this.setupInteraction();
		this.setupDropZone(container);
		this.fitToView();
		this.drawGrid();
	}

	private setupInteraction() {
		const canvas = this.app.canvas;

		canvas.addEventListener('wheel', (e: WheelEvent) => {
			e.preventDefault();
			const rect = canvas.getBoundingClientRect();
			const mouseX = e.clientX - rect.left;
			const mouseY = e.clientY - rect.top;
			const oldZoom = this._zoom;
			const zoomFactor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
			this._zoom = Math.max(0.05, Math.min(10, this._zoom * zoomFactor));
			this._panX = mouseX - (mouseX - this._panX) * (this._zoom / oldZoom);
			this._panY = mouseY - (mouseY - this._panY) * (this._zoom / oldZoom);
			this.updateViewport();
		});

		canvas.addEventListener('pointerdown', (e: PointerEvent) => {
			if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
				this._isPanning = true;
				this._lastPointerX = e.clientX;
				this._lastPointerY = e.clientY;
				canvas.style.cursor = 'grabbing';
				e.preventDefault();
				return;
			}

			if (e.button === 0 && !e.shiftKey) {
				// Check if clicking on a block
				const worldPos = this.screenToWorld(e.clientX, e.clientY);
				const hitBlock = this.hitTestBlock(worldPos.x, worldPos.y);

				if (hitBlock) {
					// Check if hitting resize handle
					const sprite = this.blockSprites.get(hitBlock.id);
					if (sprite) {
						const localX = worldPos.x - hitBlock.x;
						const localY = worldPos.y - hitBlock.y;
						const handleSize = 24;

						if (
							localX > hitBlock.width - handleSize &&
							localY > hitBlock.height - handleSize
						) {
							// Start resize
							this.resizingBlockId = hitBlock.id;
							this.resizeStartW = hitBlock.width;
							this.resizeStartH = hitBlock.height;
							this.resizeStartMouseX = worldPos.x;
							this.resizeStartMouseY = worldPos.y;
							return;
						}
					}

					// Start block drag
					this.selectBlock(hitBlock.id);
					this.draggingBlockId = hitBlock.id;
					this.dragOffsetX = worldPos.x - hitBlock.x;
					this.dragOffsetY = worldPos.y - hitBlock.y;
					this.dragOrigX = hitBlock.x;
					this.dragOrigY = hitBlock.y;
					canvas.style.cursor = 'grabbing';
				} else {
					this.deselectBlock();
				}
			}
		});

		canvas.addEventListener('pointermove', (e: PointerEvent) => {
			if (this._isPanning) {
				const dx = e.clientX - this._lastPointerX;
				const dy = e.clientY - this._lastPointerY;
				this._panX += dx;
				this._panY += dy;
				this._lastPointerX = e.clientX;
				this._lastPointerY = e.clientY;
				this.updateViewport();
				return;
			}

			if (this.draggingBlockId) {
				const worldPos = this.screenToWorld(e.clientX, e.clientY);
				const sprite = this.blockSprites.get(this.draggingBlockId);
				if (!sprite) return;

				let newX = snapToGrid(worldPos.x - this.dragOffsetX, this.gridStep);
				let newY = snapToGrid(worldPos.y - this.dragOffsetY, this.gridStep);
				newX = clampToCanvas(newX, sprite.block.width, this.canvasWidth);
				newY = clampToCanvas(newY, sprite.block.height, this.canvasHeight);

				sprite.block = { ...sprite.block, x: newX, y: newY };
				sprite.updatePosition();

				const hasCollision = this.checkCollision(sprite.block);
				sprite.collision = hasCollision;
				return;
			}

			if (this.resizingBlockId) {
				const worldPos = this.screenToWorld(e.clientX, e.clientY);
				const sprite = this.blockSprites.get(this.resizingBlockId);
				if (!sprite) return;

				const dx = worldPos.x - this.resizeStartMouseX;
				const dy = worldPos.y - this.resizeStartMouseY;

				let newW = nearestPowerOfTwo(this.resizeStartW + dx);
				let newH = nearestPowerOfTwo(this.resizeStartH + dy);

				// Clamp to canvas bounds
				if (sprite.block.x + newW > this.canvasWidth) {
					newW = nearestPowerOfTwo(this.canvasWidth - sprite.block.x);
				}
				if (sprite.block.y + newH > this.canvasHeight) {
					newH = nearestPowerOfTwo(this.canvasHeight - sprite.block.y);
				}

				sprite.updateBlock({ ...sprite.block, width: newW, height: newH });

				const hasCollision = this.checkCollision(sprite.block);
				sprite.collision = hasCollision;
				return;
			}
		});

		const stopInteraction = () => {
			if (this.draggingBlockId) {
				const sprite = this.blockSprites.get(this.draggingBlockId);
				if (sprite) {
					if (this.checkCollision(sprite.block)) {
						// Revert to original position
						sprite.updateBlock({
							...sprite.block,
							x: this.dragOrigX,
							y: this.dragOrigY
						});
					}
					sprite.collision = false;
					this.onBlockUpdate(this.draggingBlockId, {
						x: sprite.block.x,
						y: sprite.block.y
					});
				}
				this.draggingBlockId = null;
			}

			if (this.resizingBlockId) {
				const sprite = this.blockSprites.get(this.resizingBlockId);
				if (sprite) {
					if (this.checkCollision(sprite.block)) {
						// Revert resize
						sprite.updateBlock({
							...sprite.block,
							width: this.resizeStartW,
							height: this.resizeStartH
						});
					}
					sprite.collision = false;
					this.onBlockUpdate(this.resizingBlockId, {
						width: sprite.block.width,
						height: sprite.block.height
					});
				}
				this.resizingBlockId = null;
			}

			this._isPanning = false;
			this.app.canvas.style.cursor = 'default';
		};

		canvas.addEventListener('pointerup', stopInteraction);
		canvas.addEventListener('pointerleave', stopInteraction);
		canvas.addEventListener('contextmenu', (e) => e.preventDefault());
	}

	private setupDropZone(container: HTMLElement) {
		container.addEventListener('dragover', (e) => {
			e.preventDefault();
			if (e.dataTransfer) {
				e.dataTransfer.dropEffect = 'copy';
			}

			const worldPos = this.screenToWorld(e.clientX, e.clientY);
			this.showGhost(worldPos.x, worldPos.y);
		});

		container.addEventListener('dragleave', () => {
			this.hideGhost();
		});

		container.addEventListener('drop', (e) => {
			e.preventDefault();
			const materialId = e.dataTransfer?.getData('text/plain');
			if (!materialId) return;

			const worldPos = this.screenToWorld(e.clientX, e.clientY);
			const x = snapToGrid(worldPos.x - 128, this.gridStep);
			const y = snapToGrid(worldPos.y - 128, this.gridStep);

			this.hideGhost();
			this.onBlockDrop(
				materialId,
				clampToCanvas(x, 256, this.canvasWidth),
				clampToCanvas(y, 256, this.canvasHeight)
			);
		});
	}

	private showGhost(worldX: number, worldY: number) {
		const size = 256;
		const x = snapToGrid(worldX - size / 2, this.gridStep);
		const y = snapToGrid(worldY - size / 2, this.gridStep);

		if (!this.ghostGraphics) {
			this.ghostGraphics = new Graphics();
			this.ghostLayer.addChild(this.ghostGraphics);
		}

		this.ghostGraphics.clear();
		this.ghostGraphics.rect(
			clampToCanvas(x, size, this.canvasWidth),
			clampToCanvas(y, size, this.canvasHeight),
			size,
			size
		);
		this.ghostGraphics.fill({ color: 0x8be9fd, alpha: 0.15 });
		this.ghostGraphics.stroke({ color: 0x8be9fd, width: 2, alpha: 0.5 });
	}

	private hideGhost() {
		if (this.ghostGraphics) {
			this.ghostGraphics.clear();
		}
	}

	// --- Block management ---

	addBlock(block: AtlasBlock, materialName: string) {
		const sprite = new BlockSprite(block, materialName);
		this.blockSprites.set(block.id, sprite);
		this.blocksLayer.addChild(sprite.container);
	}

	removeBlock(id: string) {
		const sprite = this.blockSprites.get(id);
		if (sprite) {
			this.blocksLayer.removeChild(sprite.container);
			sprite.destroy();
			this.blockSprites.delete(id);
		}
		if (this.selectedBlockId === id) {
			this.selectedBlockId = null;
		}
	}

	setBlockChannelTexture(blockId: string, channel: PBRChannel, texture: Texture) {
		const sprite = this.blockSprites.get(blockId);
		if (sprite) {
			sprite.setChannelTexture(channel, texture);
		}
	}

	setActiveChannel(channel: PBRChannel) {
		for (const sprite of this.blockSprites.values()) {
			sprite.setActiveChannel(channel);
		}
	}

	updateBlockData(block: AtlasBlock) {
		const sprite = this.blockSprites.get(block.id);
		if (sprite) {
			sprite.updateBlock(block);
		}
	}

	selectBlock(id: string) {
		// Deselect previous
		if (this.selectedBlockId) {
			const prev = this.blockSprites.get(this.selectedBlockId);
			if (prev) prev.selected = false;
		}

		this.selectedBlockId = id;
		const sprite = this.blockSprites.get(id);
		if (sprite) {
			sprite.selected = true;
		}
		this.onBlockSelect(id);
	}

	deselectBlock() {
		if (this.selectedBlockId) {
			const sprite = this.blockSprites.get(this.selectedBlockId);
			if (sprite) sprite.selected = false;
			this.selectedBlockId = null;
		}
		this.onDeselect();
	}

	setBlocks(blocks: AtlasBlock[]) {
		this.currentBlocks = blocks;
	}

	// --- Collision ---

	private checkCollision(testBlock: AtlasBlock): boolean {
		const otherBlocks = this.currentBlocks.filter((b) => b.id !== testBlock.id);
		if (otherBlocks.length === 0) return false;

		try {
			return wasmCheckCollision(
				JSON.stringify(otherBlocks.map((b) => ({
					id: b.id,
					x: b.x,
					y: b.y,
					width: b.width,
					height: b.height
				}))),
				JSON.stringify({
					id: testBlock.id,
					x: testBlock.x,
					y: testBlock.y,
					width: testBlock.width,
					height: testBlock.height
				})
			);
		} catch {
			// Fallback: JS collision check
			return otherBlocks.some(
				(b) =>
					testBlock.x < b.x + b.width &&
					testBlock.x + testBlock.width > b.x &&
					testBlock.y < b.y + b.height &&
					testBlock.y + testBlock.height > b.y
			);
		}
	}

	// --- Coordinate conversion ---

	screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
		const rect = this.app.canvas.getBoundingClientRect();
		const canvasX = screenX - rect.left;
		const canvasY = screenY - rect.top;
		return {
			x: (canvasX - this._panX) / this._zoom,
			y: (canvasY - this._panY) / this._zoom
		};
	}

	private hitTestBlock(worldX: number, worldY: number): AtlasBlock | null {
		// Test in reverse order (top-most first)
		for (let i = this.currentBlocks.length - 1; i >= 0; i--) {
			const b = this.currentBlocks[i];
			if (
				worldX >= b.x &&
				worldX <= b.x + b.width &&
				worldY >= b.y &&
				worldY <= b.y + b.height
			) {
				return b;
			}
		}
		return null;
	}

	// --- Viewport ---

	private updateViewport() {
		this.viewport.x = this._panX;
		this.viewport.y = this._panY;
		this.viewport.scale.set(this._zoom);
	}

	fitToView() {
		const screenW = this.app.screen.width;
		const screenH = this.app.screen.height;
		const padding = 40;
		const scaleX = (screenW - padding * 2) / this.canvasWidth;
		const scaleY = (screenH - padding * 2) / this.canvasHeight;
		this._zoom = Math.min(scaleX, scaleY);
		this._panX = (screenW - this.canvasWidth * this._zoom) / 2;
		this._panY = (screenH - this.canvasHeight * this._zoom) / 2;
		this.updateViewport();
	}

	drawGrid() {
		this.gridLayer.removeChildren();

		const bg = new Graphics();
		bg.rect(0, 0, this.canvasWidth, this.canvasHeight);
		bg.fill(0x2a2a3e);
		bg.stroke({ color: 0x444466, width: 2 });
		this.gridLayer.addChild(bg);

		const grid = new Graphics();
		const subStep = this.gridStep;
		for (let x = subStep; x < this.canvasWidth; x += subStep) {
			grid.moveTo(x, 0);
			grid.lineTo(x, this.canvasHeight);
		}
		for (let y = subStep; y < this.canvasHeight; y += subStep) {
			grid.moveTo(0, y);
			grid.lineTo(this.canvasWidth, y);
		}
		grid.stroke({ color: 0x3a3a55, width: 1 });

		const majorStep = subStep * 4;
		const majorGrid = new Graphics();
		for (let x = majorStep; x < this.canvasWidth; x += majorStep) {
			majorGrid.moveTo(x, 0);
			majorGrid.lineTo(x, this.canvasHeight);
		}
		for (let y = majorStep; y < this.canvasHeight; y += majorStep) {
			majorGrid.moveTo(0, y);
			majorGrid.lineTo(this.canvasWidth, y);
		}
		majorGrid.stroke({ color: 0x555577, width: 1 });

		this.gridLayer.addChild(grid);
		this.gridLayer.addChild(majorGrid);
	}

	resize(canvasW: number, canvasH: number) {
		this.canvasWidth = canvasW;
		this.canvasHeight = canvasH;
		this.gridStep = this.calcGridStep();
		this.drawGrid();
		this.fitToView();
	}

	private calcGridStep(): number {
		const minDim = Math.min(this.canvasWidth, this.canvasHeight);
		if (minDim <= 1024) return 64;
		if (minDim <= 2048) return 128;
		if (minDim <= 4096) return 256;
		return 512;
	}

	destroy() {
		for (const sprite of this.blockSprites.values()) {
			sprite.destroy();
		}
		this.blockSprites.clear();
		this.app.destroy(true);
	}

	get zoom() {
		return this._zoom;
	}
}
