<script lang="ts">
	import { atlas } from '$lib/stores/atlas.svelte.js';
	import { exportAtlas, downloadAsZip, downloadBlob, type ExportResult } from '$lib/engine/exporter.js';

	let isExporting = $state(false);
	let progress = $state('');
	let lastResults = $state<ExportResult[]>([]);

	async function handleExport() {
		if (atlas.blocks.length === 0) return;

		isExporting = true;
		progress = 'Starting export...';
		lastResults = [];

		try {
			const results = await exportAtlas((channel, index, total) => {
				progress = `Compositing ${channel} (${index + 1}/${total})...`;
			});

			lastResults = results;
			progress = `Done! ${results.length} channel(s) exported.`;

			await downloadAsZip(results);
		} catch (e) {
			progress = `Error: ${e}`;
		} finally {
			isExporting = false;
		}
	}

	function downloadSingle(result: ExportResult) {
		downloadBlob(result.data, result.filename);
	}
</script>

<div class="export-panel">
	<button
		class="export-btn"
		onclick={handleExport}
		disabled={isExporting || atlas.blocks.length === 0}
	>
		{#if isExporting}
			Exporting...
		{:else}
			Export All Channels
		{/if}
	</button>

	{#if progress}
		<p class="progress">{progress}</p>
	{/if}

	{#if lastResults.length > 0}
		<div class="results">
			{#each lastResults as result}
				<button class="result-item" onclick={() => downloadSingle(result)}>
					{result.filename}
					<span class="size">{(result.data.length / 1024).toFixed(0)} KB</span>
				</button>
			{/each}
		</div>
	{/if}
</div>

<style>
	.export-panel {
		padding: 12px;
	}

	.export-btn {
		width: 100%;
		padding: 8px;
		background: #2a4a3a;
		color: #e0e0e0;
		border: 1px solid #3a6a4a;
		border-radius: 6px;
		cursor: pointer;
		font-size: 13px;
	}

	.export-btn:hover:not(:disabled) {
		background: #3a6a4a;
	}

	.export-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.progress {
		font-size: 11px;
		color: #8be9fd;
		margin: 8px 0 0;
	}

	.results {
		display: flex;
		flex-direction: column;
		gap: 4px;
		margin-top: 8px;
	}

	.result-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 4px 8px;
		background: #1a2a3e;
		border: 1px solid #2a3a5a;
		border-radius: 4px;
		color: #e0e0e0;
		font-size: 11px;
		cursor: pointer;
	}

	.result-item:hover {
		background: #2a3a5a;
	}

	.size {
		color: #666;
		font-size: 10px;
	}
</style>
