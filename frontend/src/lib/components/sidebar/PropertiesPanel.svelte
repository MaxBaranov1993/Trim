<script lang="ts">
	import { atlas } from '$lib/stores/atlas.svelte.js';
	import { selection } from '$lib/stores/selection.svelte.js';
	import { BLOCK_SIZES, type BlockSize } from '$lib/engine/types.js';

	let selectedBlock = $derived(
		selection.selectedBlockId
			? atlas.blocks.find((b) => b.id === selection.selectedBlockId)
			: null
	);

	let materialName = $derived(
		selectedBlock
			? atlas.materials.find((m) => m.id === selectedBlock.materialId)?.name ?? '—'
			: '—'
	);

	function setWidth(e: Event) {
		if (!selectedBlock) return;
		const val = Number((e.target as HTMLSelectElement).value) as BlockSize;
		atlas.updateBlock(selectedBlock.id, { width: val });
	}

	function setHeight(e: Event) {
		if (!selectedBlock) return;
		const val = Number((e.target as HTMLSelectElement).value) as BlockSize;
		atlas.updateBlock(selectedBlock.id, { height: val });
	}

	function deleteBlock() {
		if (!selectedBlock) return;
		atlas.removeBlock(selectedBlock.id);
		selection.selectedBlockId = null;
	}
</script>

{#if selectedBlock}
	<div class="props">
		<div class="prop-row">
			<span class="prop-label">Material</span>
			<span class="prop-value">{materialName}</span>
		</div>
		<div class="prop-row">
			<span class="prop-label">Position</span>
			<span class="prop-value">{selectedBlock.x}, {selectedBlock.y}</span>
		</div>
		<div class="prop-row">
			<span class="prop-label">Width</span>
			<select value={selectedBlock.width} onchange={setWidth}>
				{#each BLOCK_SIZES as size}
					<option value={size}>{size}</option>
				{/each}
			</select>
		</div>
		<div class="prop-row">
			<span class="prop-label">Height</span>
			<select value={selectedBlock.height} onchange={setHeight}>
				{#each BLOCK_SIZES as size}
					<option value={size}>{size}</option>
				{/each}
			</select>
		</div>
		<button class="delete-btn" onclick={deleteBlock}>
			Delete Block
		</button>
	</div>
{:else}
	<p class="placeholder">Select a block</p>
{/if}

<style>
	.props {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.prop-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		font-size: 12px;
	}

	.prop-label {
		color: #888;
	}

	.prop-value {
		color: #e0e0e0;
		font-family: monospace;
		font-size: 11px;
	}

	select {
		background: #1a1a2e;
		color: #e0e0e0;
		border: 1px solid #333;
		border-radius: 4px;
		padding: 2px 6px;
		font-size: 11px;
		cursor: pointer;
	}

	select:hover {
		border-color: #555;
	}

	.delete-btn {
		margin-top: 8px;
		background: #5a2a2a;
		color: #ff7777;
		border: 1px solid #774444;
		border-radius: 4px;
		padding: 6px;
		cursor: pointer;
		font-size: 12px;
	}

	.delete-btn:hover {
		background: #7a3333;
	}

	.placeholder {
		color: #555;
		font-size: 12px;
		margin: 0;
	}
</style>
