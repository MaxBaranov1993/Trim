<script lang="ts">
	import { atlas } from '$lib/stores/atlas.svelte.js';
	import { CANVAS_SIZES, type CanvasSize, type PBRChannel } from '$lib/engine/types.js';

	interface Props {
		onFitToView?: () => void;
		onExport?: () => void;
		onAutoPack?: () => void;
	}

	let { onFitToView, onExport, onAutoPack }: Props = $props();

	const CHANNELS: { key: PBRChannel; label: string; color: string }[] = [
		{ key: 'baseColor', label: 'Base Color', color: '#ff79c6' },
		{ key: 'normal', label: 'Normal', color: '#8be9fd' },
		{ key: 'roughness', label: 'Roughness', color: '#50fa7b' },
		{ key: 'metallic', label: 'Metallic', color: '#f1fa8c' },
		{ key: 'ao', label: 'AO', color: '#bd93f9' },
		{ key: 'opacity', label: 'Opacity', color: '#cccccc' },
		{ key: 'emission', label: 'Emission', color: '#ff5555' }
	];

	function setWidth(e: Event) {
		const val = Number((e.target as HTMLSelectElement).value) as CanvasSize;
		atlas.canvasWidth = val;
	}

	function setHeight(e: Event) {
		const val = Number((e.target as HTMLSelectElement).value) as CanvasSize;
		atlas.canvasHeight = val;
	}
</script>

<div class="toolbar">
	<div class="toolbar-section">
		<span class="toolbar-label">Trim Atlas</span>
	</div>

	<div class="toolbar-section">
		<label class="size-label">
			W:
			<select value={atlas.canvasWidth} onchange={setWidth}>
				{#each CANVAS_SIZES as size}
					<option value={size}>{size}</option>
				{/each}
			</select>
		</label>
		<span class="size-separator">x</span>
		<label class="size-label">
			H:
			<select value={atlas.canvasHeight} onchange={setHeight}>
				{#each CANVAS_SIZES as size}
					<option value={size}>{size}</option>
				{/each}
			</select>
		</label>
	</div>

	<div class="toolbar-section channel-tabs">
		{#each CHANNELS as ch}
			<button
				class="channel-tab"
				class:active={atlas.activeChannel === ch.key}
				style="--ch-color: {ch.color}"
				onclick={() => (atlas.activeChannel = ch.key)}
			>
				{ch.label}
			</button>
		{/each}
	</div>

	<div class="toolbar-section">
		<label class="size-label">
			Pad:
			<input
				type="number"
				class="pad-input"
				min="0"
				max="64"
				step="1"
				value={atlas.padding}
				onchange={(e) => (atlas.padding = Number((e.target as HTMLInputElement).value))}
			/>
		</label>
	</div>

	<div class="toolbar-section toolbar-right">
		<button class="toolbar-btn pack-btn" onclick={onAutoPack} title="Auto-pack all materials">
			Auto Pack
		</button>
		<button class="toolbar-btn" onclick={onFitToView} title="Fit to view">Fit</button>
		<button class="toolbar-btn export-btn" onclick={onExport} title="Export atlas PNGs">
			Export
		</button>
	</div>
</div>

<style>
	.toolbar {
		display: flex;
		align-items: center;
		gap: 16px;
		padding: 8px 16px;
		background: #16213e;
		border-bottom: 1px solid #2a2a4a;
		color: #e0e0e0;
		font-size: 13px;
		height: 44px;
		flex-shrink: 0;
	}

	.toolbar-label {
		font-weight: 600;
		font-size: 14px;
		color: #8be9fd;
	}

	.toolbar-section {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.toolbar-right {
		margin-left: auto;
	}

	.size-label {
		display: flex;
		align-items: center;
		gap: 4px;
		color: #aaa;
	}

	.size-separator {
		color: #666;
	}

	select {
		background: #1a1a2e;
		color: #e0e0e0;
		border: 1px solid #333;
		border-radius: 4px;
		padding: 4px 8px;
		font-size: 12px;
		cursor: pointer;
	}

	select:hover {
		border-color: #555;
	}

	.channel-tabs {
		gap: 2px;
	}

	.channel-tab {
		background: transparent;
		color: #888;
		border: 1px solid transparent;
		border-radius: 4px;
		padding: 4px 10px;
		cursor: pointer;
		font-size: 11px;
		font-weight: 500;
		transition:
			background 0.15s,
			color 0.15s;
	}

	.channel-tab:hover {
		background: rgba(255, 255, 255, 0.05);
		color: #bbb;
	}

	.channel-tab.active {
		background: color-mix(in srgb, var(--ch-color) 15%, transparent);
		color: var(--ch-color);
		border-color: color-mix(in srgb, var(--ch-color) 30%, transparent);
	}

	.toolbar-btn {
		background: #2a2a4a;
		color: #e0e0e0;
		border: 1px solid #444;
		border-radius: 4px;
		padding: 4px 12px;
		cursor: pointer;
		font-size: 12px;
	}

	.toolbar-btn:hover {
		background: #3a3a5a;
	}

	.export-btn {
		background: #2a4a3a;
		border-color: #3a6a4a;
	}

	.export-btn:hover {
		background: #3a6a4a;
	}

	.pack-btn {
		background: #3a2a5a;
		border-color: #5a4a7a;
	}

	.pack-btn:hover {
		background: #5a4a7a;
	}

	.pad-input {
		width: 48px;
		background: #1a1a2e;
		color: #e0e0e0;
		border: 1px solid #333;
		border-radius: 4px;
		padding: 4px 6px;
		font-size: 12px;
		text-align: center;
	}

	.pad-input:hover {
		border-color: #555;
	}

	.pad-input:focus {
		outline: none;
		border-color: #8be9fd;
	}
</style>
