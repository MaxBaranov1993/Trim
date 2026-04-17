<script lang="ts">
	import { groupFiles } from '$lib/engine/grouper.js';
	import { atlas } from '$lib/stores/atlas.svelte.js';
	import { generateThumbnails } from '$lib/engine/thumbnails.js';

	let isDragOver = $state(false);
	let isProcessing = $state(false);

	let fileInput = $state<HTMLInputElement>(null!);

	async function handleFiles(files: File[]) {
		if (files.length === 0) return;

		isProcessing = true;
		try {
			const groups = groupFiles(files);
			const withThumbs = await generateThumbnails(groups);
			for (const mat of withThumbs) {
				atlas.addMaterial(mat);
			}
		} finally {
			isProcessing = false;
		}
	}

	function onInputChange(e: Event) {
		const input = e.target as HTMLInputElement;
		if (input.files) {
			handleFiles(Array.from(input.files));
		}
	}

	function onDrop(e: DragEvent) {
		e.preventDefault();
		isDragOver = false;

		if (e.dataTransfer?.files) {
			handleFiles(Array.from(e.dataTransfer.files));
		}
	}

	function onDragOver(e: DragEvent) {
		e.preventDefault();
		isDragOver = true;
	}

	function onDragLeave() {
		isDragOver = false;
	}

	function createMaterial() {
		const name = `Material ${atlas.materials.length + 1}`;
		atlas.addEmptyMaterial(name);
	}
</script>

<div
	class="import-panel"
	class:drag-over={isDragOver}
	ondrop={onDrop}
	ondragover={onDragOver}
	ondragleave={onDragLeave}
	role="button"
	tabindex="0"
>
	{#if isProcessing}
		<div class="processing">Processing textures...</div>
	{:else}
		<input
			bind:this={fileInput}
			type="file"
			webkitdirectory
			multiple
			onchange={onInputChange}
			class="hidden-input"
		/>
		<button class="new-btn" onclick={createMaterial}>+ New Material</button>
		<button class="import-btn" onclick={() => fileInput.click()}>
			Import Folder
		</button>
		<p class="drop-hint">or drag & drop files here</p>
	{/if}
</div>

<style>
	.import-panel {
		padding: 0 12px 12px;
		text-align: center;
		border: 2px dashed transparent;
		border-radius: var(--radius);
		transition: border-color 0.2s, background 0.2s;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.drag-over {
		border-color: var(--accent);
		background: var(--accent-soft);
	}

	.hidden-input {
		display: none;
	}

	.new-btn {
		background: var(--accent);
		color: #fff;
		border: none;
		border-radius: var(--radius);
		padding: 7px 20px;
		cursor: pointer;
		font-size: 12px;
		font-weight: 500;
		width: 100%;
		font-family: inherit;
		transition: background 0.12s;
	}

	.new-btn:hover {
		background: var(--accent-hover);
	}

	.import-btn {
		background: var(--bg-button);
		color: var(--text);
		border: 1px solid transparent;
		border-radius: var(--radius);
		padding: 7px 20px;
		cursor: pointer;
		font-size: 12px;
		font-weight: 500;
		width: 100%;
		font-family: inherit;
		transition: background 0.12s;
	}

	.import-btn:hover {
		background: var(--bg-button-hover);
	}

	.drop-hint {
		color: var(--text-dim);
		font-size: 11px;
		margin: 4px 0 0;
	}

	.processing {
		color: var(--accent);
		font-size: 12px;
		padding: 8px 0;
	}
</style>
