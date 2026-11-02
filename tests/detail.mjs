import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import sharp from 'sharp';

await mkdir('test-results', { recursive: true });
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge' });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(process.env.SOL_URL || 'http://127.0.0.1:5173/');
  await page.waitForFunction(() => !!window.sol);
  // New imagery must be completely decoded, not just queued for download.
  await page.waitForFunction(() => !window.sol.system.imageryReady || window.sol.system.imageryReady === 'ready', { timeout: 60000 });
  await page.waitForFunction(() => !document.body.classList.contains('booting'));
  await page.waitForTimeout(1000);
  const textureWidths = await page.evaluate(() => Object.fromEntries(['earth', 'moon', 'mars', 'jupiter', 'saturn'].map(id => {
    const map = window.sol.system.nodes.get(id).material.uniforms.uMap.value;
    return [id, map.image?.width || map.source?.data?.width || 0];
  })));
  console.log('texture widths:', textureWidths);
  assert.ok(textureWidths.moon >= 2048, 'moon needs actual surface detail, not a 256px fallback');
  assert.ok(textureWidths.earth >= 4096, 'Earth requires 4K geographic imagery');
  for (const id of ['earth', 'moon', 'mars', 'jupiter', 'saturn']) {
    await page.evaluate(id => {
      window.sol.debugFocus(id);
      window.sol.playing = false;
      window.sol.rig.release();
    }, id);
    await page.waitForTimeout(400);
    await page.screenshot({ path: `test-results/detail-${id}.png` });
    const capture = await page.locator('#scene canvas').screenshot();
    const stats = await sharp(capture).extract({ left: 590, top: 320, width: 260, height: 260 }).stats();
    assert.ok(stats.channels.slice(0, 3).some(c => c.stdev > 4), `${id} scene is blank / missing texture`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.sol.select('saturn', true));
  await page.waitForTimeout(4200);
  await page.screenshot({ path: 'test-results/detail-mobile.png' });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  const fallback = await browser.newPage({ viewport: { width: 800, height: 600 } });
  await fallback.route('**/textures/moon.webp', route => route.abort());
  await fallback.goto(process.env.SOL_URL || 'http://127.0.0.1:5173/');
  await fallback.waitForFunction(() => !!window.sol);
  assert.equal(await fallback.evaluate(() => window.sol.system.imageryReady), 'fallback');
  await fallback.close();
  assert.deepEqual(errors, []);
  console.log('PASS: decoded HD surfaces, nonblank canvas pixel variance, desktop / mobile; no errors.');
} finally { await browser.close(); }
