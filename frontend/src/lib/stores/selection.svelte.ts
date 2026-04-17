let selectedBlockId = $state<string | null>(null);
let isDragging = $state(false);
let isResizing = $state(false);
let dragMaterialId = $state<string | null>(null);
let editingBlockId = $state<string | null>(null);

export const selection = {
	get selectedBlockId() {
		return selectedBlockId;
	},
	set selectedBlockId(id: string | null) {
		selectedBlockId = id;
	},
	get isDragging() {
		return isDragging;
	},
	set isDragging(v: boolean) {
		isDragging = v;
	},
	get isResizing() {
		return isResizing;
	},
	set isResizing(v: boolean) {
		isResizing = v;
	},
	get dragMaterialId() {
		return dragMaterialId;
	},
	set dragMaterialId(id: string | null) {
		dragMaterialId = id;
	},
	get editingBlockId() {
		return editingBlockId;
	},
	set editingBlockId(id: string | null) {
		editingBlockId = id;
	},
	setEditingBlock(id: string | null) {
		editingBlockId = id;
	},
	deselect() {
		selectedBlockId = null;
		editingBlockId = null;
	}
};
