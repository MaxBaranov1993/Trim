import { Container, Graphics, Text, Sprite, Texture } from 'pixi.js';
import type { AtlasBlock, PBRChannel } from '$lib/engine/types.js';

const BLOCK_COLOR = 0x44668a;
const BLOCK_SELECTED_COLOR = 0x8be9fd;
const BLOCK_COLLISION_COLOR = 0xff5555;
const RESIZE_HANDLE_SIZE = 12;

export class BlockSprite {
	container: Container;
	block: AtlasBlock;

	private bg: Graphics;
	private border: Graphics;
	private label: Text;
	private resizeHandle: Graphics;

	// Per-channel texture sprites
	private channelSprites = new Map<PBRChannel, Sprite>();
	private activeChannel: PBRChannel = 'baseColor';

	private _selected = false;
	private _collision = false;

	constructor(block: AtlasBlock, materialName: string) {
		this.block = block;
		this.container = new Container();
		this.container.eventMode = 'static';
		this.container.cursor = 'grab';

		this.bg = new Graphics();
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

		this.resizeHandle = new Graphics();
		this.resizeHandle.eventMode = 'static';
		this.resizeHandle.cursor = 'nwse-resize';

		this.container.addChild(this.bg);
		// Channel sprites will be inserted at index 1+
		this.container.addChild(this.border);
		this.container.addChild(this.label);
		this.container.addChild(this.resizeHandle);

		this.updatePosition();
		this.redraw();
	}

	setChannelTexture(channel: PBRChannel, texture: Texture) {
		let sprite = this.channelSprites.get(channel);
		if (sprite) {
			sprite.texture = texture;
		} else {
			sprite = new Sprite(texture);
			this.channelSprites.set(channel, sprite);
			// Insert after bg (index 1), before border
			const borderIdx = this.container.getChildIndex(this.border);
			this.container.addChildAt(sprite, borderIdx);
		}
		sprite.width = this.block.width;
		sprite.height = this.block.height;
		sprite.visible = channel === this.activeChannel;
	}

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
		this.block = block;
		this.updatePosition();
		this.redraw();
	}

	set selected(v: boolean) {
		this._selected = v;
		this.redrawBorder();
	}

	get selected() {
		return this._selected;
	}

	set collision(v: boolean) {
		this._collision = v;
		this.redrawBorder();
	}

	private redraw() {
		const { width, height } = this.block;

		this.bg.clear();
		this.bg.rect(0, 0, width, height);
		this.bg.fill({ color: BLOCK_COLOR, alpha: 0.6 });

		// Resize all channel sprites
		for (const sprite of this.channelSprites.values()) {
			sprite.width = width;
			sprite.height = height;
		}

		this.label.x = 6;
		this.label.y = 4;

		this.resizeHandle.clear();
		this.resizeHandle.moveTo(width, height - RESIZE_HANDLE_SIZE);
		this.resizeHandle.lineTo(width, height);
		this.resizeHandle.lineTo(width - RESIZE_HANDLE_SIZE, height);
		this.resizeHandle.closePath();
		this.resizeHandle.fill({ color: 0xffffff, alpha: 0.4 });

		this.redrawBorder();
	}

	private redrawBorder() {
		const { width, height } = this.block;
		this.border.clear();
		this.border.rect(0, 0, width, height);

		if (this._collision) {
			this.border.stroke({ color: BLOCK_COLLISION_COLOR, width: 3 });
		} else if (this._selected) {
			this.border.stroke({ color: BLOCK_SELECTED_COLOR, width: 2 });
		} else {
			this.border.stroke({ color: 0x6688aa, width: 1 });
		}
	}

	destroy() {
		this.container.destroy({ children: true });
	}
}
