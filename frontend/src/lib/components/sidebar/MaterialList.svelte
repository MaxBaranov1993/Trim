<script lang="ts">
	import { atlas } from '$lib/stores/atlas.svelte.js';
	import type { PBRChannel } from '$lib/engine/types.js';

	const CHANNEL_LABELS: Record<PBRChannel, string> = {
		baseColor: 'BC',
		normal: 'N',
		roughness: 'R',
		metallic: 'M',
		ao: 'AO',
		opacity: 'O',
		emission: 'E'
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

	function onDragStart(e: DragEvent, materialId: string) {
		e.dataTransfer?.setData('text/plain', materialId);
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = 'copy';
		}
	}

	function removeMaterial(e: Event, id: string) {
		e.stopPropagation();
		atlas.removeMaterial(id);
	}

	function clearAll() {
		atlas.clearAll();
	}
</script>

{#if atlas.materials.length > 0}
	<div class="list-actions">
		<button class="clear-btn" onclick={clearAll}>Clear All</button>
	</div>
{/if}

<div class="material-list">
	{#each atlas.materials as material (material.id)}
		<div
			class="material-item"
			draggable="true"
			ondragstart={(e) => onDragStart(e, material.id)}
			role="listitem"
		>
			<div class="material-thumb">
				{#if material.thumbnail}
					<img src={material.thumbnail} alt={material.name} />
				{:else}
					<div class="thumb-placeholder">?</div>
				{/if}
			</div>
			<div class="material-info">
				<div class="material-name" title={material.name}>{material.name}</div>
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
			<button class="remove-btn" onclick={(e) => removeMaterial(e, material.id)} title="Remove material">x</button>
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
		display: flex;
		gap: 8px;
		padding: 6px 8px;
		cursor: grab;
		border-radius: 4px;
		transition: background 0.15s;
	}

	.material-item:hover {
		background: rgba(255, 255, 255, 0.05);
	}

	.material-item:active {
		cursor: grabbing;
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
</style>
