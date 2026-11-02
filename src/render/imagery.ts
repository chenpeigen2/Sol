import * as THREE from 'three';

export const IMAGERY_IDS = ['earth', 'moon', 'mars', 'jupiter', 'saturn', 'mercury', 'venus', 'uranus', 'neptune', 'sun'] as const;
export type ImageryId = typeof IMAGERY_IDS[number];

/** Locally bundled CC BY 4.0 imagery. A missing asset leaves the procedural fallback intact. */
export async function loadSurfaceImage(renderer: THREE.WebGLRenderer, name: string, color = true) {
  const texture = await new THREE.TextureLoader().loadAsync(`${import.meta.env.BASE_URL}textures/${name}.webp`);
  texture.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.anisotropy = Math.min(16, renderer.capabilities.getMaxAnisotropy());
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  return texture;
}
