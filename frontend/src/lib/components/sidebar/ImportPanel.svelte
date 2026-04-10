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
			atlas.setMaterials(withThumbs);
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
	}

	.drag-over {
		border-color: #8be9fd;
		background: rgba(139, 233, 253, 0.05);
	}

	.hidden-input {
		display: none;
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
		margin: 8px 0 0;
	}

	.processing {
		color: #8be9fd;
		font-size: 12px;
		padding: 8px 0;
	}
</style>
