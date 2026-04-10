import type { PBRChannel, MaterialGroup } from './types.js';

const CHANNEL_PATTERNS: Record<PBRChannel, RegExp> = {
	baseColor: /[_\-\s.](base.?color|albedo|diffuse|color|col|diff)$/i,
	normal: /[_\-\s.](normal|nrm|nor|norm|nrml)$/i,
	roughness: /[_\-\s.](rough|roughness|rgh)$/i,
	metallic: /[_\-\s.](metal|metallic|metalness|met|mtl)$/i,
	ao: /[_\-\s.](ao|ambient.?occlusion|occlusion|occ)$/i,
	opacity: /[_\-\s.](opacity|alpha|transparency|transp)$/i,
	emission: /[_\-\s.](emissive|emission|emit|glow)$/i
};

const ALL_SUFFIXES =
	/[_\-\s.](base.?color|albedo|diffuse|color|col|diff|normal|nrm|nor|norm|nrml|rough|roughness|rgh|metal|metallic|metalness|met|mtl|ao|ambient.?occlusion|occlusion|occ|height|displacement|disp|emissive|emission|emit|glow|opacity|alpha|transparency|transp)$/i;

function getBaseName(filename: string): string {
	// Remove extension
	const noExt = filename.replace(/\.(png|jpg|jpeg|tga|tiff|exr|bmp)$/i, '');
	return noExt;
}

function detectChannel(baseName: string): PBRChannel | null {
	for (const [channel, pattern] of Object.entries(CHANNEL_PATTERNS)) {
		if (pattern.test(baseName)) {
			return channel as PBRChannel;
		}
	}
	return null;
}

function getMaterialName(baseName: string): string {
	return baseName.replace(ALL_SUFFIXES, '');
}

export function groupFiles(files: File[]): MaterialGroup[] {
	const imageFiles = files.filter((f) =>
		/\.(png|jpg|jpeg|tga|tiff|bmp)$/i.test(f.name)
	);

	const groups = new Map<string, MaterialGroup>();

	for (const file of imageFiles) {
		const baseName = getBaseName(file.name);
		const channel = detectChannel(baseName);

		if (!channel) continue;

		const materialName = getMaterialName(baseName);

		if (!groups.has(materialName)) {
			groups.set(materialName, {
				id: crypto.randomUUID(),
				name: materialName,
				channels: {}
			});
		}

		const group = groups.get(materialName)!;
		group.channels[channel] = file;
	}

	return Array.from(groups.values()).filter(
		(g) => Object.keys(g.channels).length > 0
	);
}
