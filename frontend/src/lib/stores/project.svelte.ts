import { atlas } from './atlas.svelte.js';
import type { AtlasBlock, CanvasSize, MaterialGroup } from '$lib/engine/types.js';

export interface ProjectFile {
	version: 1;
	canvasWidth: CanvasSize;
	canvasHeight: CanvasSize;
	blocks: AtlasBlock[];
	materialNames: Record<string, string>; // materialId -> name
}

let hasUnsavedChanges = $state(false);
let projectName = $state('untitled');

export const project = {
	get hasUnsavedChanges() {
		return hasUnsavedChanges;
	},
	get projectName() {
		return projectName;
	},
	set projectName(v: string) {
		projectName = v;
	},

	markDirty() {
		hasUnsavedChanges = true;
	},

	serialize(): ProjectFile {
		const materialNames: Record<string, string> = {};
		for (const m of atlas.materials) {
			materialNames[m.id] = m.name;
		}
		return {
			version: 1,
			canvasWidth: atlas.canvasWidth,
			canvasHeight: atlas.canvasHeight,
			blocks: atlas.blocks.map((b) => ({ ...b })),
			materialNames
		};
	},

	saveToFile() {
		const data = this.serialize();
		const json = JSON.stringify(data, null, 2);
		const blob = new Blob([json], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `${projectName}.trimm.json`;
		a.click();
		URL.revokeObjectURL(url);
		hasUnsavedChanges = false;
	},

	async loadFromFile(): Promise<ProjectFile | null> {
		return new Promise((resolve) => {
			const input = document.createElement('input');
			input.type = 'file';
			input.accept = '.json';
			input.onchange = async () => {
				const file = input.files?.[0];
				if (!file) return resolve(null);

				try {
					const text = await file.text();
					const data = JSON.parse(text) as ProjectFile;
					if (data.version !== 1) {
						throw new Error('Unsupported project version');
					}
					projectName = file.name.replace(/\.trimm\.json$/i, '').replace(/\.json$/i, '');
					hasUnsavedChanges = false;
					resolve(data);
				} catch (e) {
					console.error('Failed to load project:', e);
					resolve(null);
				}
			};
			input.click();
		});
	},

	// --- localStorage auto-save ---

	saveToLocalStorage() {
		try {
			const data = this.serialize();
			localStorage.setItem('trimm-autosave', JSON.stringify(data));
			localStorage.setItem('trimm-autosave-time', new Date().toISOString());
		} catch {
			// localStorage full or unavailable
		}
	},

	loadFromLocalStorage(): ProjectFile | null {
		try {
			const raw = localStorage.getItem('trimm-autosave');
			if (!raw) return null;
			const data = JSON.parse(raw) as ProjectFile;
			if (data.version !== 1) return null;
			return data;
		} catch {
			return null;
		}
	},

	getAutoSaveTime(): string | null {
		return localStorage.getItem('trimm-autosave-time');
	},

	clearAutoSave() {
		localStorage.removeItem('trimm-autosave');
		localStorage.removeItem('trimm-autosave-time');
	}
};
