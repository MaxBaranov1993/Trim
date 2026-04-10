<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import CanvasView from '$lib/components/canvas/CanvasView.svelte';
	import Toolbar from '$lib/components/toolbar/Toolbar.svelte';
	import ImportPanel from '$lib/components/sidebar/ImportPanel.svelte';
	import MaterialList from '$lib/components/sidebar/MaterialList.svelte';
	import PropertiesPanel from '$lib/components/sidebar/PropertiesPanel.svelte';
	import ExportPanel from '$lib/components/sidebar/ExportPanel.svelte';
	import Toast from '$lib/components/Toast.svelte';
	import { atlas } from '$lib/stores/atlas.svelte.js';
	import { history } from '$lib/stores/history.svelte.js';
	import { project } from '$lib/stores/project.svelte.js';
	import { initWasm, wasmGreet } from '$lib/engine/wasm-bridge.js';
	import { autoPackMaterials } from '$lib/engine/autopacker.js';
	import { exportAtlas, downloadAsZip } from '$lib/engine/exporter.js';
	import { toast } from '$lib/stores/toast.svelte.js';
	import type { CanvasSize } from '$lib/engine/types.js';

	let wasmStatus = $state('Loading WASM...');
	let showRecovery = $state(false);
	let recoveryTime = $state('');
	let canvasView: ReturnType<typeof CanvasView> | undefined;
	let autoSaveTimer: ReturnType<typeof setInterval> | null = null;

	onMount(async () => {
		try {
			await initWasm();
			wasmStatus = wasmGreet();
		} catch (e) {
			wasmStatus = `WASM error: ${e}`;
		}

		// Check for auto-save recovery
		const saved = project.loadFromLocalStorage();
		if (saved && saved.blocks.length > 0) {
			const time = project.getAutoSaveTime();
			if (time) {
				recoveryTime = new Date(time).toLocaleString();
				showRecovery = true;
			}
		}

		// Auto-save every 30 seconds
		autoSaveTimer = setInterval(() => {
			if (atlas.blocks.length > 0) {
				project.saveToLocalStorage();
			}
		}, 30000);

		window.addEventListener('keydown', handleKeydown);
	});

	onDestroy(() => {
		window.removeEventListener('keydown', handleKeydown);
		if (autoSaveTimer) clearInterval(autoSaveTimer);
	});

	function handleKeydown(e: KeyboardEvent) {
		const ctrl = e.ctrlKey || e.metaKey;

		// Ctrl+Z — Undo
		if (ctrl && e.key === 'z' && !e.shiftKey) {
			e.preventDefault();
			history.undo();
			canvasView?.syncFromStore();
			return;
		}

		// Ctrl+Shift+Z or Ctrl+Y — Redo
		if ((ctrl && e.key === 'z' && e.shiftKey) || (ctrl && e.key === 'y')) {
			e.preventDefault();
			history.redo();
			canvasView?.syncFromStore();
			return;
		}

		// Ctrl+S — Save
		if (ctrl && e.key === 's') {
			e.preventDefault();
			project.saveToFile();
			return;
		}

		// Ctrl+O — Load
		if (ctrl && e.key === 'o') {
			e.preventDefault();
			handleLoadProject();
			return;
		}

		// Delete / Backspace
		if (e.key === 'Delete' || e.key === 'Backspace') {
			canvasView?.deleteSelected();
			return;
		}

		// Arrow keys — nudge
		const gridStep = 64;
		if (e.key === 'ArrowLeft') {
			e.preventDefault();
			canvasView?.nudgeSelected(-1, 0, gridStep);
		} else if (e.key === 'ArrowRight') {
			e.preventDefault();
			canvasView?.nudgeSelected(1, 0, gridStep);
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			canvasView?.nudgeSelected(0, -1, gridStep);
		} else if (e.key === 'ArrowDown') {
			e.preventDefault();
			canvasView?.nudgeSelected(0, 1, gridStep);
		}
	}

	function handleFitToView() {
		canvasView?.fitToView();
	}

	async function handleExport() {
		if (atlas.blocks.length === 0) {
			toast.info('No blocks to export');
			return;
		}
		try {
			const results = await exportAtlas();
			await downloadAsZip(results);
			toast.success(`Exported ${results.length} channel(s) as ZIP`);
		} catch (e) {
			toast.error(`Export failed: ${e}`);
		}
	}

	async function handleAutoPack() {
		if (atlas.materials.length === 0) {
			toast.info('No materials to pack');
			return;
		}
		history.push();
		const result = autoPackMaterials(atlas.padding, true);
		await canvasView?.syncFromStore();
		if (result) {
			if (result.unplaced > 0) {
				toast.error(`Packed ${result.placed}, ${result.unplaced} didn't fit`);
			} else {
				toast.success(`Packed ${result.placed} material(s)`);
			}
		}
	}

	async function handleLoadProject() {
		const data = await project.loadFromFile();
		if (!data) return;

		atlas.canvasWidth = data.canvasWidth as CanvasSize;
		atlas.canvasHeight = data.canvasHeight as CanvasSize;

		// Restore blocks — materials won't have files, but block positions are preserved
		// User needs to re-import textures after loading
		const blocksWithMaterials = data.blocks.map((b) => ({ ...b }));

		// Create placeholder materials from saved names
		const existingIds = new Set(atlas.materials.map((m) => m.id));
		for (const [id, name] of Object.entries(data.materialNames)) {
			if (!existingIds.has(id)) {
				atlas.addMaterial({ id, name, channels: {} });
			}
		}

		// Set blocks
		for (const block of atlas.blocks) {
			atlas.removeBlock(block.id);
		}
		for (const block of blocksWithMaterials) {
			atlas.addBlock(block);
		}

		history.clear();
		await canvasView?.syncFromStore();
	}

	async function handleRecoveryRestore() {
		const data = project.loadFromLocalStorage();
		if (!data) return;

		atlas.canvasWidth = data.canvasWidth as CanvasSize;
		atlas.canvasHeight = data.canvasHeight as CanvasSize;

		const existingIds = new Set(atlas.materials.map((m) => m.id));
		for (const [id, name] of Object.entries(data.materialNames)) {
			if (!existingIds.has(id)) {
				atlas.addMaterial({ id, name, channels: {} });
			}
		}

		for (const block of data.blocks) {
			atlas.addBlock(block);
		}

		showRecovery = false;
		await canvasView?.syncFromStore();
	}

	function handleRecoveryDismiss() {
		showRecovery = false;
		project.clearAutoSave();
	}
</script>

<svelte:head>
	<title>Trim Atlas Builder{project.hasUnsavedChanges ? ' *' : ''}</title>
</svelte:head>

<div class="app">
	<Toolbar onFitToView={handleFitToView} onAutoPack={handleAutoPack} onExport={handleExport} />

	{#if showRecovery}
		<div class="recovery-bar">
			<span>Recovered auto-save from {recoveryTime}</span>
			<button class="recovery-btn restore" onclick={handleRecoveryRestore}>Restore</button>
			<button class="recovery-btn dismiss" onclick={handleRecoveryDismiss}>Dismiss</button>
		</div>
	{/if}

	<div class="workspace">
		<div class="sidebar-left">
			<div class="panel">
				<div class="panel-header">Import</div>
				<ImportPanel />
			</div>
			<div class="panel materials-panel">
				<div class="panel-header">
					Materials
					{#if atlas.materials.length > 0}
						<span class="count">({atlas.materials.length})</span>
					{/if}
				</div>
				<div class="panel-body">
					{#if atlas.materials.length === 0}
						<p class="placeholder">No materials imported</p>
					{:else}
						<MaterialList />
					{/if}
				</div>
			</div>
		</div>
		<div class="canvas-area">
			<CanvasView bind:this={canvasView} />
		</div>
		<div class="sidebar-right">
			<div class="panel">
				<div class="panel-header">Properties</div>
				<div class="panel-body">
					<PropertiesPanel />
				</div>
			</div>
			<div class="panel">
				<div class="panel-header">Export</div>
				<ExportPanel />
			</div>
			<div class="panel">
				<div class="panel-header">Shortcuts</div>
				<div class="panel-body shortcuts-list">
					<div class="shortcut"><kbd>Ctrl+S</kbd> Save</div>
					<div class="shortcut"><kbd>Ctrl+O</kbd> Open</div>
					<div class="shortcut"><kbd>Ctrl+Z</kbd> Undo</div>
					<div class="shortcut"><kbd>Ctrl+Shift+Z</kbd> Redo</div>
					<div class="shortcut"><kbd>Delete</kbd> Remove block</div>
					<div class="shortcut"><kbd>Arrows</kbd> Nudge block</div>
					<div class="shortcut"><kbd>Shift+Drag</kbd> Pan</div>
					<div class="shortcut"><kbd>Scroll</kbd> Zoom</div>
				</div>
			</div>
			<div class="panel">
				<div class="panel-header">Info</div>
				<div class="panel-body">
					<p class="wasm-status">{wasmStatus}</p>
				</div>
			</div>
		</div>
	</div>
</div>

<Toast />

<style>
	:global(body) {
		margin: 0;
		padding: 0;
		background: #0f0f23;
		font-family:
			-apple-system,
			BlinkMacSystemFont,
			'Segoe UI',
			sans-serif;
		overflow: hidden;
	}

	.app {
		display: flex;
		flex-direction: column;
		height: 100vh;
		width: 100vw;
	}

	.workspace {
		display: flex;
		flex: 1;
		overflow: hidden;
	}

	.sidebar-left,
	.sidebar-right {
		width: 240px;
		background: #16213e;
		border-right: 1px solid #2a2a4a;
		display: flex;
		flex-direction: column;
		flex-shrink: 0;
		overflow-y: auto;
	}

	.sidebar-right {
		border-right: none;
		border-left: 1px solid #2a2a4a;
	}

	.canvas-area {
		flex: 1;
		display: flex;
		overflow: hidden;
		position: relative;
	}

	.panel {
		border-bottom: 1px solid #2a2a4a;
	}

	.panel-header {
		padding: 8px 12px;
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: #8be9fd;
		background: #1a1a30;
	}

	.panel-body {
		padding: 12px;
	}

	.placeholder {
		color: #555;
		font-size: 12px;
		margin: 0;
	}

	.wasm-status {
		color: #50fa7b;
		font-size: 11px;
		font-family: monospace;
		margin: 0;
	}

	.materials-panel {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-height: 0;
	}

	.materials-panel .panel-body {
		flex: 1;
		overflow-y: auto;
	}

	.count {
		font-weight: 400;
		color: #666;
	}

	.recovery-bar {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 8px 16px;
		background: #2a3a1a;
		border-bottom: 1px solid #4a5a2a;
		color: #c0d080;
		font-size: 12px;
	}

	.recovery-btn {
		padding: 4px 12px;
		border-radius: 4px;
		border: 1px solid;
		cursor: pointer;
		font-size: 11px;
	}

	.recovery-btn.restore {
		background: #3a5a2a;
		border-color: #5a7a3a;
		color: #c0f080;
	}

	.recovery-btn.restore:hover {
		background: #4a6a3a;
	}

	.recovery-btn.dismiss {
		background: transparent;
		border-color: #555;
		color: #888;
	}

	.recovery-btn.dismiss:hover {
		background: rgba(255, 255, 255, 0.05);
	}

	.shortcuts-list {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.shortcut {
		font-size: 11px;
		color: #888;
	}

	.shortcut :global(kbd) {
		display: inline-block;
		background: #1a1a2e;
		border: 1px solid #333;
		border-radius: 3px;
		padding: 1px 5px;
		font-size: 10px;
		font-family: monospace;
		color: #aaa;
		margin-right: 4px;
	}
</style>
