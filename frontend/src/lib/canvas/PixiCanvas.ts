import { Application, Container, Graphics, Texture } from 'pixi.js';
import { BlockSprite } from './BlockSprite.js';
import { snapToGrid, clampToCanvas, nearestPowerOfTwo } from '$lib/engine/grid.js';
import { wasmCheckCollision } from '$lib/engine/wasm-bridge.js';
import type { AtlasBlock, PBRChannel, TextureTransform } from '$lib/engine/types.js';

export type BlockEventCallback = (blockId: string) => void;
export type BlockUpdateCallback = (blockId: string, block: Partial<AtlasBlock>) => void;
export type BlockDropCallback = (materialId: string, x: number, y: number) => void;
export type DeselectCallback = () => void;
export type BlockTransformUpdateCallback = (blockId: string, transform: TextureTransform) => void;
export type TextureNativeResolvedCallback = (blockId: string, w: number, h: number) => void;
export type EditModeChangeCallback = (blockId: string | null) => void;

type EditMode = 'none' | 'pan' | 'scale' | 'rotate';

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

	// Edit mode state
	private editingBlockId: string | null = null;
	private editMode: EditMode = 'none';
	private editScaleCornerIdx: 0 | 1 | 2 | 3 = 0;
	private editStartTransform: TextureTransform | null = null;
	private editStartMouseWorld = { x: 0, y: 0 };
	private editStartRotationAngle = 0;

	// Keyboard handler reference (for cleanup)
	private keydownHandler: ((e: KeyboardEvent) => void) | null = null;

	// Callbacks
	onBlockSelect: BlockEventCallback = () => {};
	onBlockUpdate: BlockUpdateCallback = () => {};
	onBlockDrop: BlockDropCallback = () => {};
	onDeselect: DeselectCallback = () => {};
	onBlockTransformUpdate: BlockTransformUpdateCallback = () => {};
	onTextureNativeResolved: TextureNativeResolvedCallback = () => {};
	onEditModeChange: EditModeChangeCallback = () => {};

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
			background: 0x1e1e1e,
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
		this.setupKeyboard();
		this.fitToView();
		this.drawGrid();
	}

	private setupKeyboard() {
		this.keydownHandler = (e: KeyboardEvent) => {
			if (e.key === 'Escape' && this.editingBlockId) {
				this.setEditingBlock(null);
			}
		};
		window.addEventListener('keydown', this.keydownHandler);
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
				const worldPos = this.screenToWorld(e.clientX, e.clientY);

				// Edit-mode interaction has priority
				if (this.editingBlockId) {
					const editBlock = this.currentBlocks.find((b) => b.id === this.editingBlockId);
					const editSprite = editBlock ? this.blockSprites.get(editBlock.id) : null;
					if (editBlock && editSprite) {
						const localX = worldPos.x - editBlock.x;
						const localY = worldPos.y - editBlock.y;
						const handleHit = editSprite.hitTestEditHandle(localX, localY);

						if (handleHit === 'rotate') {
							this.beginRotate(editBlock, worldPos.x, worldPos.y);
							return;
						} else if (handleHit !== null) {
							this.beginScale(editBlock, handleHit, worldPos.x, worldPos.y);
							return;
						}

						// Inside frame → pan the texture
						if (
							localX >= 0 &&
							localY >= 0 &&
							localX <= editBlock.width &&
							localY <= editBlock.height
						) {
							this.beginPan(editBlock, worldPos.x, worldPos.y);
							return;
						}

						// Clicked outside editing block → exit edit mode
						this.setEditingBlock(null);
						// fall through to normal block-hit logic below
					}
				}

				const hitBlock = this.hitTestBlock(worldPos.x, worldPos.y);

				if (hitBlock) {
					const sprite = this.blockSprites.get(hitBlock.id);
					if (sprite) {
						const localX = worldPos.x - hitBlock.x;
						const localY = worldPos.y - hitBlock.y;

						// Pencil icon (selected blocks only) → enter edit mode
						if (
							this.selectedBlockId === hitBlock.id &&
							sprite.pencilIconContainsLocal(localX, localY)
						) {
							this.setEditingBlock(hitBlock.id);
							return;
						}

						const handleSize = 24;
						if (
							localX > hitBlock.width - handleSize &&
							localY > hitBlock.height - handleSize
						) {
							this.resizingBlockId = hitBlock.id;
							this.resizeStartW = hitBlock.width;
							this.resizeStartH = hitBlock.height;
							this.resizeStartMouseX = worldPos.x;
							this.resizeStartMouseY = worldPos.y;
							return;
						}
					}

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

		canvas.addEventListener('dblclick', (e: MouseEvent) => {
			const worldPos = this.screenToWorld(e.clientX, e.clientY);
			const hitBlock = this.hitTestBlock(worldPos.x, worldPos.y);
			if (hitBlock) {
				this.selectBlock(hitBlock.id);
				this.setEditingBlock(hitBlock.id);
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

			if (this.editMode !== 'none' && this.editingBlockId) {
				const worldPos = this.screenToWorld(e.clientX, e.clientY);
				this.updateEditDrag(worldPos.x, worldPos.y, e.shiftKey);
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
			if (this.editMode !== 'none' && this.editingBlockId) {
				this.endEditDrag();
				return;
			}

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
		this.ghostGraphics.fill({ color: 0x0d99ff, alpha: 0.15 });
		this.ghostGraphics.stroke({ color: 0x0d99ff, width: 2, alpha: 0.6 });
	}

	private hideGhost() {
		if (this.ghostGraphics) {
			this.ghostGraphics.clear();
		}
	}

	// --- Block management ---

	addBlock(block: AtlasBlock, materialName: string) {
		const sprite = new BlockSprite(block, materialName);
		sprite.onPencilClick = (id) => this.setEditingBlock(id);
		sprite.onTextureNativeResolved = (id, w, h) => this.onTextureNativeResolved(id, w, h);
		this.blockSprites.set(block.id, sprite);
		this.blocksLayer.addChild(sprite.container);
	}

	removeBlock(id: string) {
		if (this.editingBlockId === id) {
			this.editingBlockId = null;
			this.editMode = 'none';
			this.editStartTransform = null;
			this.onEditModeChange(null);
		}
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
		// Exit edit mode if switching to a different block
		if (this.editingBlockId && this.editingBlockId !== id) {
			this.setEditingBlock(null);
		}

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
		if (this.editingBlockId) {
			this.setEditingBlock(null);
		}
		if (this.selectedBlockId) {
			const sprite = this.blockSprites.get(this.selectedBlockId);
			if (sprite) sprite.selected = false;
			this.selectedBlockId = null;
		}
		this.onDeselect();
	}

	setBlocks(blocks: AtlasBlock[]) {
		this.currentBlocks = blocks;
		// Sync visual sprites with store data
		for (const block of blocks) {
			const sprite = this.blockSprites.get(block.id);
			if (sprite) {
				sprite.updateBlock(block);
				if (block.textureTransform) {
					sprite.applyTextureTransform(block.textureTransform);
				}
			}
		}
	}

	// --- Edit mode ---

	setEditingBlock(id: string | null) {
		if (this.editingBlockId === id) return;

		if (this.editingBlockId) {
			const prev = this.blockSprites.get(this.editingBlockId);
			if (prev) prev.setEditing(false);
		}

		this.editingBlockId = id;
		this.editMode = 'none';
		this.editStartTransform = null;

		if (id) {
			const sprite = this.blockSprites.get(id);
			if (sprite) sprite.setEditing(true);
		}

		this.onEditModeChange(id);
	}

	private beginPan(block: AtlasBlock, worldX: number, worldY: number) {
		if (!block.textureTransform) return;
		this.editMode = 'pan';
		this.editStartTransform = { ...block.textureTransform };
		this.editStartMouseWorld = { x: worldX, y: worldY };
		this.app.canvas.style.cursor = 'grabbing';
	}

	private beginScale(block: AtlasBlock, cornerIdx: 0 | 1 | 2 | 3, worldX: number, worldY: number) {
		if (!block.textureTransform) return;
		this.editMode = 'scale';
		this.editScaleCornerIdx = cornerIdx;
		this.editStartTransform = { ...block.textureTransform };
		this.editStartMouseWorld = { x: worldX, y: worldY };
		this.app.canvas.style.cursor = 'nwse-resize';
	}

	private beginRotate(block: AtlasBlock, worldX: number, worldY: number) {
		if (!block.textureTransform) return;
		const t = block.textureTransform;
		const cx = block.x + t.offsetX + t.nativeWidth / 2;
		const cy = block.y + t.offsetY + t.nativeHeight / 2;
		this.editMode = 'rotate';
		this.editStartTransform = { ...t };
		this.editStartMouseWorld = { x: worldX, y: worldY };
		this.editStartRotationAngle = Math.atan2(worldY - cy, worldX - cx);
		this.app.canvas.style.cursor = 'grabbing';
	}

	private updateEditDrag(worldX: number, worldY: number, shiftKey: boolean) {
		if (!this.editingBlockId || !this.editStartTransform) return;
		const block = this.currentBlocks.find((b) => b.id === this.editingBlockId);
		const sprite = this.blockSprites.get(this.editingBlockId);
		if (!block || !sprite) return;

		const t0 = this.editStartTransform;
		const nw = t0.nativeWidth;
		const nh = t0.nativeHeight;

		if (this.editMode === 'pan') {
			const dx = worldX - this.editStartMouseWorld.x;
			const dy = worldY - this.editStartMouseWorld.y;
			const next: TextureTransform = {
				...t0,
				offsetX: t0.offsetX + dx,
				offsetY: t0.offsetY + dy
			};
			block.textureTransform = next;
			sprite.block = { ...block };
			sprite.applyTextureTransform(next);
			return;
		}

		if (this.editMode === 'scale') {
			// Compute texture center in frame coords at start
			const cxStart = t0.offsetX + nw / 2;
			const cyStart = t0.offsetY + nh / 2;
			// Opposite corner in local texture space (unrotated, unscaled) for cornerIdx
			// Corners order: 0=TL, 1=TR, 2=BR, 3=BL. Opposite: 0<->2, 1<->3.
			const oppIdx = (this.editScaleCornerIdx + 2) % 4;
			const locals: [number, number][] = [
				[-nw / 2, -nh / 2],
				[nw / 2, -nh / 2],
				[nw / 2, nh / 2],
				[-nw / 2, nh / 2]
			];
			const [lox, loy] = locals[oppIdx];
			const [ldx, ldy] = locals[this.editScaleCornerIdx];
			const cos = Math.cos(t0.rotation);
			const sin = Math.sin(t0.rotation);
			// Anchor (opposite corner) in frame coords
			const anchorX = cxStart + (lox * cos - loy * sin) * t0.scale;
			const anchorY = cyStart + (lox * sin + loy * cos) * t0.scale;
			// Moving corner at start (frame coords)
			const movingStartX = cxStart + (ldx * cos - ldy * sin) * t0.scale;
			const movingStartY = cyStart + (ldx * sin + ldy * cos) * t0.scale;

			const dStart = Math.hypot(movingStartX - anchorX, movingStartY - anchorY);
			const dNow = Math.hypot(worldX - block.x - anchorX, worldY - block.y - anchorY);
			if (dStart < 0.001) return;

			let newScale = (t0.scale * dNow) / dStart;
			newScale = Math.max(0.05, Math.min(20, newScale));

			// Keep anchor fixed: newCenter = anchor + (Cstart - anchor) * (newScale / oldScale)
			const k = newScale / t0.scale;
			const newCx = anchorX + (cxStart - anchorX) * k;
			const newCy = anchorY + (cyStart - anchorY) * k;

			const next: TextureTransform = {
				...t0,
				scale: newScale,
				offsetX: newCx - nw / 2,
				offsetY: newCy - nh / 2
			};
			block.textureTransform = next;
			sprite.block = { ...block };
			sprite.applyTextureTransform(next);
			return;
		}

		if (this.editMode === 'rotate') {
			const cx = t0.offsetX + nw / 2;
			const cy = t0.offsetY + nh / 2;
			const currentAngle = Math.atan2(worldY - block.y - cy, worldX - block.x - cx);
			let newRotation = t0.rotation + (currentAngle - this.editStartRotationAngle);
			if (shiftKey) {
				const step = Math.PI / 12; // 15deg
				newRotation = Math.round(newRotation / step) * step;
			}
			const next: TextureTransform = { ...t0, rotation: newRotation };
			block.textureTransform = next;
			sprite.block = { ...block };
			sprite.applyTextureTransform(next);
			return;
		}
	}

	private endEditDrag() {
		if (!this.editingBlockId) {
			this.editMode = 'none';
			this.editStartTransform = null;
			this.app.canvas.style.cursor = 'default';
			return;
		}
		const block = this.currentBlocks.find((b) => b.id === this.editingBlockId);
		if (block && block.textureTransform) {
			this.onBlockTransformUpdate(this.editingBlockId, block.textureTransform);
		}
		this.editMode = 'none';
		this.editStartTransform = null;
		this.app.canvas.style.cursor = 'default';
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
		bg.fill(0x2c2c2c);
		bg.stroke({ color: 0x4c4c4c, width: 2 });
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
		grid.stroke({ color: 0x3c3c3c, width: 1 });

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
		majorGrid.stroke({ color: 0x555555, width: 1 });

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
		if (this.keydownHandler) {
			window.removeEventListener('keydown', this.keydownHandler);
			this.keydownHandler = null;
		}
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
