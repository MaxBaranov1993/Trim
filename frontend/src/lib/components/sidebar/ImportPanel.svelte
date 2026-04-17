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
		padding: 12px;
		text-align: center;
		border: 2px dashed transparent;
		border-radius: 4px;
		transition: border-color 0.2s;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.drag-over {
		border-color: #8be9fd;
		background: rgba(139, 233, 253, 0.05);
	}

	.hidden-input {
		display: none;
	}

	.new-btn {
		background: #2a5a3a;
		color: #e0e0e0;
		border: 1px solid #3a7a4e;
		border-radius: 6px;
		padding: 8px 20px;
		cursor: pointer;
		font-size: 13px;
		width: 100%;
	}

	.new-btn:hover {
		background: #3a7a4e;
	}

	.import-btn {
		background: #2a4a6e;
		color: #e0e0e0;
		border: 1px solid #3a5a8e;
		border-radius: 6px;
		padding: 8px 20px;
		cursor: pointer;
		font-size: 13px;
		width: 100%;
	}

	.import-btn:hover {
		background: #3a5a8e;
	}

	.drop-hint {
		color: #555;
		font-size: 11px;
		margin: 4px 0 0;
	}

	.processing {
		color: #8be9fd;
		font-size: 12px;
		padding: 8px 0;
	}
</style>
