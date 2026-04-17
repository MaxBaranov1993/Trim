import { Container, Graphics, Text, Sprite, Texture } from 'pixi.js';
import type { AtlasBlock, PBRChannel, TextureTransform } from '$lib/engine/types.js';

const BLOCK_COLOR = 0x3c3c3c;
const BLOCK_SELECTED_COLOR = 0x0d99ff;
const BLOCK_COLLISION_COLOR = 0xe5484d;
const BLOCK_EDITING_COLOR = 0x0d99ff;
const RESIZE_HANDLE_SIZE = 12;
const PENCIL_ICON_SIZE = 20;
const PENCIL_ICON_MARGIN = 4;
const EDIT_HANDLE_RADIUS = 6;
const ROTATE_HANDLE_OFFSET = 28;

export type PencilClickCallback = (blockId: string) => void;

export class BlockSprite {
	container: Container;
	block: AtlasBlock;

	private bg: Graphics;
	private textureContainer: Container;
	private frameMask: Graphics;
	private border: Graphics;
	private label: Text;
	private editHandlesLayer: Container;
	private resizeHandle: Graphics;
	private pencilIcon: Graphics;

	private channelSprites = new Map<PBRChannel, Sprite>();
	private activeChannel: PBRChannel = 'baseColor';
	private nativeResolved = false;

	private _selected = false;
	private _collision = false;
	private _editing = false;

	onPencilClick: PencilClickCallback = () => {};

	constructor(block: AtlasBlock, materialName: string) {
		this.block = block;
		this.container = new Container();
		this.container.eventMode = 'static';
		this.container.cursor = 'grab';

		this.bg = new Graphics();

		this.textureContainer = new Container();

		this.frameMask = new Graphics();

		this.border = new Graphics();
		this.label = new Text({
			text: materialName,
			style: {
				fontSize: 12,
				fill: 0xffffff,
				fontFamily: 'sans-serif'
			}
		});
		this.label.alpha = 0.8;

		this.editHandlesLayer = new Container();
		this.editHandlesLayer.visible = false;

		this.resizeHandle = new Graphics();
		this.resizeHandle.eventMode = 'static';
		this.resizeHandle.cursor = 'nwse-resize';

		this.pencilIcon = new Graphics();
		this.pencilIcon.eventMode = 'static';
		this.pencilIcon.cursor = 'pointer';
		this.pencilIcon.visible = false;
		this.pencilIcon.on('pointerdown', (e) => {
			e.stopPropagation();
			this.onPencilClick(this.block.id);
		});

		this.container.addChild(this.bg);
		this.container.addChild(this.textureContainer);
		this.container.addChild(this.frameMask);
		this.textureContainer.mask = this.frameMask;
		this.container.addChild(this.border);
		this.container.addChild(this.label);
		this.container.addChild(this.editHandlesLayer);
		this.container.addChild(this.resizeHandle);
		this.container.addChild(this.pencilIcon);

		this.updatePosition();
		this.redraw();

		if (block.textureTransform) {
			this.applyTextureTransform(block.textureTransform);
			this.nativeResolved = true;
		}
	}

	setChannelTexture(channel: PBRChannel, texture: Texture) {
		let sprite = this.channelSprites.get(channel);
		if (sprite) {
			sprite.texture = texture;
		} else {
			sprite = new Sprite(texture);
			this.channelSprites.set(channel, sprite);
			this.textureContainer.addChild(sprite);
		}
		sprite.width = texture.width;
		sprite.height = texture.height;
		sprite.visible = channel === this.activeChannel;

		if (!this.nativeResolved && texture.width > 0 && texture.height > 0) {
			this.nativeResolved = true;
			this.onTextureNativeResolved(this.block.id, texture.width, texture.height);
		}
	}

	onTextureNativeResolved: (blockId: string, w: number, h: number) => void = () => {};

	setActiveChannel(channel: PBRChannel) {
		this.activeChannel = channel;
		for (const [ch, sprite] of this.channelSprites) {
			sprite.visible = ch === channel;
		}
	}

	updatePosition() {
		this.container.x = this.block.x;
		this.container.y = this.block.y;
	}

	updateBlock(block: AtlasBlock) {
		const prevTransform = this.block.textureTransform;
		this.block = block;
		this.updatePosition();
		this.redraw();
		if (block.textureTransform && block.textureTransform !== prevTransform) {
			this.applyTextureTransform(block.textureTransform);
			this.nativeResolved = true;
		}
		if (this._editing) this.redrawEditHandles();
	}

	applyTextureTransform(t: TextureTransform) {
		this.textureContainer.pivot.set(t.nativeWidth / 2, t.nativeHeight / 2);
		this.textureContainer.position.set(
			t.offsetX + t.nativeWidth / 2,
			t.offsetY + t.nativeHeight / 2
		);
		this.textureContainer.scale.set(t.scale);
		this.textureContainer.rotation = t.rotation;
		if (this._editing) this.redrawEditHandles();
	}

	set selected(v: boolean) {
		this._selected = v;
		this.pencilIcon.visible = v && !this._editing;
		this.redrawBorder();
	}

	get selected() {
		return this._selected;
	}

	set collision(v: boolean) {
		this._collision = v;
		this.redrawBorder();
	}

	setEditing(v: boolean) {
		this._editing = v;
		this.editHandlesLayer.visible = v;
		this.resizeHandle.visible = !v;
		this.pencilIcon.visible = this._selected && !v;
		this.container.cursor = v ? 'default' : 'grab';
		this.redrawBorder();
		if (v) this.redrawEditHandles();
	}

	get editing() {
		return this._editing;
	}

	private redraw() {
		const { width, height } = this.block;

		this.bg.clear();
		this.bg.rect(0, 0, width, height);
		this.bg.fill({ color: BLOCK_COLOR, alpha: 0.6 });

		this.frameMask.clear();
		this.frameMask.rect(0, 0, width, height);
		this.frameMask.fill({ color: 0xffffff, alpha: 1 });

		this.label.x = 6;
		this.label.y = 4;

		this.resizeHandle.clear();
		this.resizeHandle.moveTo(width, height - RESIZE_HANDLE_SIZE);
		this.resizeHandle.lineTo(width, height);
		this.resizeHandle.lineTo(width - RESIZE_HANDLE_SIZE, height);
		this.resizeHandle.closePath();
		this.resizeHandle.fill({ color: 0xffffff, alpha: 0.4 });

		this.drawPencilIcon();
		this.redrawBorder();
	}

	private drawPencilIcon() {
		const { width } = this.block;
		const x = width - PENCIL_ICON_SIZE - PENCIL_ICON_MARGIN;
		const y = PENCIL_ICON_MARGIN;
		const s = PENCIL_ICON_SIZE;
		const g = this.pencilIcon;
		g.clear();
		g.roundRect(x, y, s, s, 3);
		g.fill({ color: 0x0d99ff, alpha: 1 });
		const cx = x + s / 2;
		const cy = y + s / 2;
		const d = 4;
		g.moveTo(cx - d, cy + d);
		g.lineTo(cx + d - 1, cy - d + 1);
		g.stroke({ color: 0xffffff, width: 1.5 });
		g.moveTo(cx + d - 1, cy - d + 1);
		g.lineTo(cx + d + 1, cy - d - 1);
		g.stroke({ color: 0xffffff, width: 1.5 });
		g.moveTo(cx - d - 1, cy + d + 1);
		g.lineTo(cx - d + 1, cy + d - 1);
		g.stroke({ color: 0xffffff, width: 1.5 });
	}

	pencilIconContainsLocal(localX: number, localY: number): boolean {
		if (!this.pencilIcon.visible) return false;
		const { width } = this.block;
		const x = width - PENCIL_ICON_SIZE - PENCIL_ICON_MARGIN;
		const y = PENCIL_ICON_MARGIN;
		return (
			localX >= x &&
			localX <= x + PENCIL_ICON_SIZE &&
			localY >= y &&
			localY <= y + PENCIL_ICON_SIZE
		);
	}

	private redrawBorder() {
		const { width, height } = this.block;
		this.border.clear();
		this.border.rect(0, 0, width, height);

		if (this._collision) {
			this.border.stroke({ color: BLOCK_COLLISION_COLOR, width: 3 });
		} else if (this._editing) {
			this.border.stroke({ color: BLOCK_EDITING_COLOR, width: 2 });
		} else if (this._selected) {
			this.border.stroke({ color: BLOCK_SELECTED_COLOR, width: 2 });
		} else {
			this.border.stroke({ color: 0x5a5a5a, width: 1 });
		}
	}

	/** Returns the transformed texture corner points in frame-local coords. Order: TL, TR, BR, BL. */
	getTextureCornersLocal(): { x: number; y: number }[] {
		const t = this.block.textureTransform;
		if (!t) return [];
		const nw = t.nativeWidth;
		const nh = t.nativeHeight;
		const cx = t.offsetX + nw / 2;
		const cy = t.offsetY + nh / 2;
		const cos = Math.cos(t.rotation);
		const sin = Math.sin(t.rotation);
		const hx = (nw / 2) * t.scale;
		const hy = (nh / 2) * t.scale;
		const localCorners: [number, number][] = [
			[-hx, -hy],
			[hx, -hy],
			[hx, hy],
			[-hx, hy]
		];
		return localCorners.map(([x, y]) => ({
			x: cx + x * cos - y * sin,
			y: cy + x * sin + y * cos
		}));
	}

	/** Rotate-handle position in frame-local coords (above top edge center of texture). */
	getRotateHandleLocal(): { x: number; y: number } | null {
		const t = this.block.textureTransform;
		if (!t) return null;
		const cx = t.offsetX + t.nativeWidth / 2;
		const cy = t.offsetY + t.nativeHeight / 2;
		const cos = Math.cos(t.rotation);
		const sin = Math.sin(t.rotation);
		const offY = -((t.nativeHeight / 2) * t.scale + ROTATE_HANDLE_OFFSET);
		return {
			x: cx + 0 * cos - offY * sin,
			y: cy + 0 * sin + offY * cos
		};
	}

	private redrawEditHandles() {
		this.editHandlesLayer.removeChildren();
		const t = this.block.textureTransform;
		if (!t) return;

		const corners = this.getTextureCornersLocal();
		const rotHandle = this.getRotateHandleLocal();

		const outline = new Graphics();
		outline.moveTo(corners[0].x, corners[0].y);
		for (let i = 1; i < corners.length; i++) {
			outline.lineTo(corners[i].x, corners[i].y);
		}
		outline.closePath();
		outline.stroke({ color: BLOCK_EDITING_COLOR, width: 1, alpha: 0.9 });
		this.editHandlesLayer.addChild(outline);

		if (rotHandle) {
			const topMid = {
				x: (corners[0].x + corners[1].x) / 2,
				y: (corners[0].y + corners[1].y) / 2
			};
			const line = new Graphics();
			line.moveTo(topMid.x, topMid.y);
			line.lineTo(rotHandle.x, rotHandle.y);
			line.stroke({ color: BLOCK_EDITING_COLOR, width: 1, alpha: 0.7 });
			this.editHandlesLayer.addChild(line);

			const rh = new Graphics();
			rh.circle(rotHandle.x, rotHandle.y, EDIT_HANDLE_RADIUS);
			rh.fill({ color: 0xffffff });
			rh.stroke({ color: BLOCK_EDITING_COLOR, width: 1.5 });
			this.editHandlesLayer.addChild(rh);
		}

		for (const c of corners) {
			const h = new Graphics();
			h.rect(c.x - EDIT_HANDLE_RADIUS, c.y - EDIT_HANDLE_RADIUS, EDIT_HANDLE_RADIUS * 2, EDIT_HANDLE_RADIUS * 2);
			h.fill({ color: 0xffffff });
			h.stroke({ color: BLOCK_EDITING_COLOR, width: 1.5 });
			this.editHandlesLayer.addChild(h);
		}
	}

	/** Hit-test edit-mode handles. Returns 'rotate', 0..3 for corner index, or null. */
	hitTestEditHandle(localX: number, localY: number): 'rotate' | 0 | 1 | 2 | 3 | null {
		if (!this._editing) return null;
		const rot = this.getRotateHandleLocal();
		if (rot) {
			const dx = localX - rot.x;
			const dy = localY - rot.y;
			if (dx * dx + dy * dy <= (EDIT_HANDLE_RADIUS + 2) ** 2) return 'rotate';
		}
		const corners = this.getTextureCornersLocal();
		for (let i = 0; i < corners.length; i++) {
			const c = corners[i];
			if (
				localX >= c.x - EDIT_HANDLE_RADIUS &&
				localX <= c.x + EDIT_HANDLE_RADIUS &&
				localY >= c.y - EDIT_HANDLE_RADIUS &&
				localY <= c.y + EDIT_HANDLE_RADIUS
			) {
				return i as 0 | 1 | 2 | 3;
			}
		}
		return null;
	}

	destroy() {
		this.container.destroy({ children: true });
	}
}
