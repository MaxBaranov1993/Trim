<script lang="ts">
	import { atlas } from '$lib/stores/atlas.svelte.js';
	import type { PBRChannel } from '$lib/engine/types.js';
	import { generateSingleThumbnail } from '$lib/engine/thumbnails.js';

	const CHANNEL_ORDER: PBRChannel[] = [
		'baseColor',
		'normal',
		'roughness',
		'metallic',
		'ao',
		'opacity',
		'emission'
	];

	const CHANNEL_LABELS: Record<PBRChannel, string> = {
		baseColor: 'BC',
		normal: 'N',
		roughness: 'R',
		metallic: 'M',
		ao: 'AO',
		opacity: 'O',
		emission: 'E'
	};

	const CHANNEL_FULL_LABELS: Record<PBRChannel, string> = {
		baseColor: 'Base Color',
		normal: 'Normal',
		roughness: 'Roughness',
		metallic: 'Metallic',
		ao: 'AO',
		opacity: 'Opacity',
		emission: 'Emission'
	};

	const CHANNEL_COLORS: Record<PBRChannel, string> = {
		baseColor: '#ff79c6',
		normal: '#8be9fd',
		roughness: '#50fa7b',
		metallic: '#f1fa8c',
		ao: '#bd93f9',
		opacity: '#cccccc',
		emission: '#ff5555'
	};

	let expandedIds = $state(new Set<string>());
	let editingId = $state<string | null>(null);
	let editingName = $state('');

	function toggleExpand(id: string) {
		if (expandedIds.has(id)) {
			expandedIds.delete(id);
		} else {
			expandedIds.add(id);
		}
		expandedIds = new Set(expandedIds);
	}

	function onDragStart(e: DragEvent, materialId: string) {
		e.dataTransfer?.setData('text/plain', materialId);
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = 'copy';
		}
	}

	function removeMaterial(e: Event, id: string) {
		e.stopPropagation();
		atlas.removeMaterial(id);
		expandedIds.delete(id);
		expandedIds = new Set(expandedIds);
	}

	function clearAll() {
		atlas.clearAll();
		expandedIds = new Set();
	}

	function startRename(e: Event, id: string, currentName: string) {
		e.stopPropagation();
		editingId = id;
		editingName = currentName;
	}

	function commitRename() {
		if (editingId && editingName.trim()) {
			atlas.renameMaterial(editingId, editingName.trim());
		}
		editingId = null;
		editingName = '';
	}

	function onRenameKey(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			(e.target as HTMLInputElement).blur();
		} else if (e.key === 'Escape') {
			editingId = null;
			editingName = '';
		}
	}

	async function pickFile(materialId: string, channel: PBRChannel) {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = 'image/*';
		input.onchange = async () => {
			const file = input.files?.[0];
			if (!file) return;

			atlas.setMaterialChannel(materialId, channel, file);

			const mat = atlas.materials.find((m) => m.id === materialId);
			const shouldRegenThumb =
				channel === 'baseColor' || (!mat?.thumbnail);
			if (shouldRegenThumb) {
				const thumb = await generateSingleThumbnail(file);
				if (thumb) {
					atlas.setMaterialThumbnail(materialId, thumb);
				}
			}
		};
		input.click();
	}

	function clearSlot(e: Event, materialId: string, channel: PBRChannel) {
		e.stopPropagation();
		atlas.setMaterialChannel(materialId, channel, null);
	}
</script>

{#if atlas.materials.length > 0}
	<div class="list-actions">
		<button class="clear-btn" onclick={clearAll}>Clear All</button>
	</div>
{/if}

<div class="material-list">
	{#each atlas.materials as material (material.id)}
		<div class="material-item">
			<div
				class="material-header"
				draggable={editingId !== material.id}
				ondragstart={(e) => onDragStart(e, material.id)}
				onclick={() => toggleExpand(material.id)}
				role="button"
				tabindex="0"
				onkeydown={(e) => e.key === 'Enter' && toggleExpand(material.id)}
			>
				<span class="chevron" class:open={expandedIds.has(material.id)}>▶</span>
				<div class="material-thumb">
					{#if material.thumbnail}
						<img src={material.thumbnail} alt={material.name} />
					{:else}
						<div class="thumb-placeholder">?</div>
					{/if}
				</div>
				<div class="material-info">
					{#if editingId === material.id}
						<input
							class="name-input"
							bind:value={editingName}
							onblur={commitRename}
							onkeydown={onRenameKey}
							onclick={(e) => e.stopPropagation()}
							autofocus
						/>
					{:else}
						<div
							class="material-name"
							title={material.name}
							ondblclick={(e) => startRename(e, material.id, material.name)}
							role="textbox"
							tabindex="0"
						>
							{material.name}
						</div>
					{/if}
					<div class="channel-badges">
						{#each Object.keys(material.channels) as ch}
							{@const channel = ch as PBRChannel}
							<span
								class="badge"
								style="background: {CHANNEL_COLORS[channel]}20; color: {CHANNEL_COLORS[channel]}"
							>
								{CHANNEL_LABELS[channel]}
							</span>
						{/each}
					</div>
				</div>
				<button
					class="remove-btn"
					onclick={(e) => removeMaterial(e, material.id)}
					title="Remove material"
				>x</button>
			</div>

			{#if expandedIds.has(material.id)}
				<div class="channels-panel">
					{#each CHANNEL_ORDER as channel}
						{@const file = material.channels[channel]}
						<div class="channel-row">
							<span
								class="channel-dot"
								style="background: {CHANNEL_COLORS[channel]}"
							></span>
							<span class="channel-label">{CHANNEL_FULL_LABELS[channel]}</span>
							<span class="channel-file" title={file?.name ?? ''}>
								{file?.name ?? '—'}
							</span>
							<button
								class="upload-btn"
								onclick={(e) => {
									e.stopPropagation();
									pickFile(material.id, channel);
								}}
							>{file ? 'Replace' : 'Upload'}</button>
							{#if file}
								<button
									class="slot-x"
									onclick={(e) => clearSlot(e, material.id, channel)}
									title="Clear slot"
								>×</button>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/each}
</div>

<style>
	.material-list {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.material-item {
		border-radius: 4px;
	}

	.material-header {
		display: flex;
		gap: 8px;
		align-items: center;
		padding: 6px 8px;
		cursor: grab;
		border-radius: 4px;
		transition: background 0.15s;
	}

	.material-header:hover {
		background: rgba(255, 255, 255, 0.05);
	}

	.material-header:active {
		cursor: grabbing;
	}

	.chevron {
		font-size: 8px;
		color: #666;
		transition: transform 0.15s;
		flex-shrink: 0;
	}

	.chevron.open {
		transform: rotate(90deg);
	}

	.material-thumb {
		width: 40px;
		height: 40px;
		border-radius: 4px;
		overflow: hidden;
		flex-shrink: 0;
		background: #1a1a2e;
	}

	.material-thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.thumb-placeholder {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #555;
		font-size: 14px;
	}

	.material-info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 4px;
	}

	.material-name {
		font-size: 12px;
		color: #e0e0e0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		cursor: text;
	}

	.name-input {
		background: #1a1a2e;
		color: #e0e0e0;
		border: 1px solid #3a5a8e;
		border-radius: 3px;
		padding: 2px 6px;
		font-size: 12px;
		width: 100%;
		box-sizing: border-box;
	}

	.channel-badges {
		display: flex;
		gap: 3px;
		flex-wrap: wrap;
	}

	.badge {
		font-size: 9px;
		font-weight: 600;
		padding: 1px 4px;
		border-radius: 3px;
	}

	.remove-btn {
		background: transparent;
		border: none;
		color: #555;
		cursor: pointer;
		font-size: 14px;
		padding: 0 4px;
		line-height: 1;
		flex-shrink: 0;
		align-self: center;
		border-radius: 3px;
	}

	.remove-btn:hover {
		color: #ff5555;
		background: rgba(255, 85, 85, 0.1);
	}

	.list-actions {
		display: flex;
		justify-content: flex-end;
		padding: 4px 8px;
	}

	.clear-btn {
		background: transparent;
		border: 1px solid #333;
		color: #888;
		font-size: 10px;
		padding: 2px 8px;
		border-radius: 3px;
		cursor: pointer;
	}

	.clear-btn:hover {
		color: #ff5555;
		border-color: #ff5555;
	}

	.channels-panel {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 4px 8px 8px 28px;
		background: rgba(0, 0, 0, 0.15);
		border-radius: 0 0 4px 4px;
	}

	.channel-row {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 11px;
	}

	.channel-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.channel-label {
		color: #c0c0c0;
		width: 74px;
		flex-shrink: 0;
	}

	.channel-file {
		flex: 1;
		min-width: 0;
		color: #888;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		font-family: monospace;
		font-size: 10px;
	}

	.upload-btn {
		background: #2a4a6e;
		color: #cfe0f5;
		border: 1px solid #3a5a8e;
		border-radius: 3px;
		padding: 2px 8px;
		font-size: 10px;
		cursor: pointer;
		flex-shrink: 0;
	}

	.upload-btn:hover {
		background: #3a5a8e;
	}

	.slot-x {
		background: transparent;
		border: none;
		color: #777;
		cursor: pointer;
		font-size: 14px;
		padding: 0 3px;
		line-height: 1;
		flex-shrink: 0;
	}

	.slot-x:hover {
		color: #ff5555;
	}
</style>
