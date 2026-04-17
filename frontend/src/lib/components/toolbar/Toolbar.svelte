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
		<button
			class="toolbar-btn overlap-btn"
			class:active={atlas.allowOverlap}
			onclick={() => (atlas.allowOverlap = !atlas.allowOverlap)}
			title="Allow blocks to overlap (manual placement only — auto-pack stays non-overlapping). Use [ and ] to send back / bring to front."
		>
			Overlap: {atlas.allowOverlap ? 'On' : 'Off'}
		</button>
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
		gap: 14px;
		padding: 0 12px;
		background: var(--bg-panel);
		border-bottom: 1px solid var(--border);
		color: var(--text);
		font-size: 12px;
		height: 44px;
		flex-shrink: 0;
	}

	.toolbar-label {
		font-weight: 600;
		font-size: 13px;
		color: var(--text);
		letter-spacing: 0.1px;
	}

	.toolbar-section {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.toolbar-right {
		margin-left: auto;
	}

	.size-label {
		display: flex;
		align-items: center;
		gap: 4px;
		color: var(--text-muted);
		font-size: 11px;
	}

	.size-separator {
		color: var(--text-dim);
	}

	select {
		background: var(--bg-input);
		color: var(--text);
		border: 1px solid transparent;
		border-radius: var(--radius);
		padding: 4px 8px;
		font-size: 11px;
		cursor: pointer;
		outline: none;
		transition: border-color 0.12s, background 0.12s;
	}

	select:hover {
		background: var(--bg-input-hover);
	}

	select:focus {
		border-color: var(--accent);
	}

	.channel-tabs {
		gap: 2px;
		padding: 2px;
		background: var(--bg-panel-alt);
		border-radius: var(--radius);
		border: 1px solid var(--border);
	}

	.channel-tab {
		background: transparent;
		color: var(--text-muted);
		border: 1px solid transparent;
		border-radius: 3px;
		padding: 4px 10px;
		cursor: pointer;
		font-size: 11px;
		font-weight: 500;
		transition:
			background 0.12s,
			color 0.12s;
	}

	.channel-tab:hover {
		background: rgba(255, 255, 255, 0.04);
		color: var(--text);
	}

	.channel-tab.active {
		background: var(--accent);
		color: #fff;
		border-color: var(--accent);
	}

	.toolbar-btn {
		background: var(--bg-button);
		color: var(--text);
		border: 1px solid transparent;
		border-radius: var(--radius);
		padding: 5px 12px;
		cursor: pointer;
		font-size: 11px;
		font-weight: 500;
		transition: background 0.12s;
	}

	.toolbar-btn:hover {
		background: var(--bg-button-hover);
	}

	.export-btn {
		background: var(--accent);
		color: #fff;
	}

	.export-btn:hover {
		background: var(--accent-hover);
	}

	.pack-btn {
		background: var(--bg-button);
		color: var(--text);
	}

	.pack-btn:hover {
		background: var(--bg-button-hover);
	}

	.overlap-btn.active {
		background: var(--accent);
		color: #fff;
	}

	.pad-input {
		width: 48px;
		background: var(--bg-input);
		color: var(--text);
		border: 1px solid transparent;
		border-radius: var(--radius);
		padding: 4px 6px;
		font-size: 11px;
		text-align: center;
		outline: none;
		transition: border-color 0.12s, background 0.12s;
	}

	.pad-input:hover {
		background: var(--bg-input-hover);
	}

	.pad-input:focus {
		border-color: var(--accent);
	}
</style>
