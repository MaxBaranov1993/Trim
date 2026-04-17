<script lang="ts">
	import { atlas } from '$lib/stores/atlas.svelte.js';
	import { selection } from '$lib/stores/selection.svelte.js';
	import { history } from '$lib/stores/history.svelte.js';
	import { project } from '$lib/stores/project.svelte.js';
	import { BLOCK_SIZES, type BlockSize, type TextureTransform } from '$lib/engine/types.js';

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

	function fitTextureToBox() {
		if (!selectedBlock || !selectedBlock.textureTransform) return;
		const t = selectedBlock.textureTransform;
		if (t.nativeWidth <= 0 || t.nativeHeight <= 0) return;
		const scale = Math.min(
			selectedBlock.width / t.nativeWidth,
			selectedBlock.height / t.nativeHeight
		);
		const newTransform: TextureTransform = {
			...t,
			scale,
			rotation: 0,
			offsetX: (selectedBlock.width - t.nativeWidth * scale) / 2,
			offsetY: (selectedBlock.height - t.nativeHeight * scale) / 2
		};
		history.push();
		atlas.updateBlock(selectedBlock.id, { textureTransform: newTransform });
		project.markDirty();
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
		<button
			class="fit-btn"
			onclick={fitTextureToBox}
			disabled={!selectedBlock.textureTransform}
			title="Scale texture to fit inside the box (preserves aspect ratio)"
		>
			Fit texture
		</button>
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
		gap: 6px;
	}

	.prop-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		font-size: 11px;
		min-height: 24px;
	}

	.prop-label {
		color: var(--text-muted);
	}

	.prop-value {
		color: var(--text);
		font-family: 'SF Mono', 'Roboto Mono', Menlo, Consolas, monospace;
		font-size: 11px;
	}

	select {
		background: var(--bg-input);
		color: var(--text);
		border: 1px solid transparent;
		border-radius: var(--radius);
		padding: 3px 8px;
		font-size: 11px;
		cursor: pointer;
		outline: none;
		font-family: inherit;
		transition: background 0.12s, border-color 0.12s;
	}

	select:hover {
		background: var(--bg-input-hover);
	}

	select:focus {
		border-color: var(--accent);
	}

	.fit-btn {
		margin-top: 12px;
		background: transparent;
		color: var(--text);
		border: 1px solid var(--border-strong);
		border-radius: var(--radius);
		padding: 6px;
		cursor: pointer;
		font-size: 11px;
		font-family: inherit;
		transition: background 0.12s, border-color 0.12s, color 0.12s;
	}

	.fit-btn:hover:not(:disabled) {
		background: rgba(13, 153, 255, 0.12);
		border-color: var(--accent);
		color: var(--accent);
	}

	.fit-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.delete-btn {
		margin-top: 4px;
		background: transparent;
		color: var(--danger);
		border: 1px solid var(--border-strong);
		border-radius: var(--radius);
		padding: 6px;
		cursor: pointer;
		font-size: 11px;
		font-family: inherit;
		transition: background 0.12s, border-color 0.12s;
	}

	.delete-btn:hover {
		background: rgba(229, 72, 77, 0.12);
		border-color: var(--danger);
	}

	.placeholder {
		color: var(--text-dim);
		font-size: 12px;
		margin: 0;
	}
</style>
