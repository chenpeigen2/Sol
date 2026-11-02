import sharp from 'sharp';
import { mkdir, writeFile, access } from 'node:fs/promises';

// Solar System Scope, CC BY 4.0. See public/textures/ATTRIBUTION.md.
const assets = [
  ['8k_earth_daymap.jpg', 'earth', 4096],
  ['8k_earth_nightmap.jpg', 'earth-night', 4096],
  ['2k_earth_clouds.jpg', 'earth-clouds', 2048],
  ['2k_moon.jpg', 'moon', 2048],
  ['2k_mars.jpg', 'mars', 2048],
  ['2k_jupiter.jpg', 'jupiter', 2048],
  ['2k_saturn.jpg', 'saturn', 2048],
  ['2k_mercury.jpg', 'mercury', 2048],
  ['2k_venus_atmosphere.jpg', 'venus', 2048],
  ['2k_uranus.jpg', 'uranus', 2048],
  ['2k_neptune.jpg', 'neptune', 2048],
  ['2k_sun.jpg', 'sun', 2048],
];
await mkdir('public/textures', { recursive: true });
let next = 0;
async function worker() {
  while (next < assets.length) {
    const [source, name, width] = assets[next++];
    try { await access(`public/textures/${name}.webp`); continue; } catch { /* build missing assets */ }
    let last;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetch(`https://www.solarsystemscope.com/textures/download/${source}`, { signal: AbortSignal.timeout(120000) });
        if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) throw new Error(`${response.status}: ${response.headers.get('content-type')}`);
        const bytes = Buffer.from(await response.arrayBuffer());
        const image = sharp(bytes);
        const metadata = await image.metadata();
        if (metadata.width < width) throw new Error(`source resolution too small: ${metadata.width}`);
        const out = await image.resize({ width, withoutEnlargement: true }).webp({ quality: 91, effort: 5 }).toBuffer();
        await writeFile(`public/textures/${name}.webp`, out);
        console.log(`${name}: ${metadata.width} -> ${width}px, ${(out.length / 1024).toFixed(0)} KiB`);
        last = null;
        break;
      } catch (e) { last = e; console.log('retry', name, e.message); }
    }
    if (last) throw last;
  }
}
await Promise.all([worker(), worker(), worker()]);
