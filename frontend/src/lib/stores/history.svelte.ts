import { atlas } from './atlas.svelte.js';
import type { AtlasBlock } from '$lib/engine/types.js';

const MAX_HISTORY = 50;

interface Snapshot {
	blocks: AtlasBlock[];
}

let undoStack = $state<Snapshot[]>([]);
let redoStack = $state<Snapshot[]>([]);

function takeSnapshot(): Snapshot {
	return {
		blocks: atlas.blocks.map((b) => ({ ...b }))
	};
}

function applySnapshot(snap: Snapshot) {
	// Clear current blocks and set from snapshot
	const currentIds = new Set(atlas.blocks.map((b) => b.id));
	const snapIds = new Set(snap.blocks.map((b) => b.id));

	// Remove blocks not in snapshot
	for (const id of currentIds) {
		if (!snapIds.has(id)) {
			atlas.removeBlock(id);
		}
	}

	// Update or add blocks from snapshot
	for (const block of snap.blocks) {
		if (currentIds.has(block.id)) {
			atlas.updateBlock(block.id, block);
		} else {
			atlas.addBlock({ ...block });
		}
	}
}

export const history = {
	get canUndo() {
		return undoStack.length > 0;
	},
	get canRedo() {
		return redoStack.length > 0;
	},

	/** Call before making a change to save current state */
	push() {
		const snap = takeSnapshot();
		undoStack = [...undoStack.slice(-(MAX_HISTORY - 1)), snap];
		redoStack = [];
	},

	undo() {
		if (undoStack.length === 0) return;

		const currentSnap = takeSnapshot();
		redoStack = [...redoStack, currentSnap];

		const prev = undoStack[undoStack.length - 1];
		undoStack = undoStack.slice(0, -1);
		applySnapshot(prev);
	},

	redo() {
		if (redoStack.length === 0) return;

		const currentSnap = takeSnapshot();
		undoStack = [...undoStack, currentSnap];

		const next = redoStack[redoStack.length - 1];
		redoStack = redoStack.slice(0, -1);
		applySnapshot(next);
	},

	clear() {
		undoStack = [];
		redoStack = [];
	}
};
