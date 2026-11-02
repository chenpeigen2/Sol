import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge' });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  let unblock;
  const blocked = new Promise(resolve => { unblock = resolve; });
  await page.route('**/src/main.ts*', async route => { await blocked; await route.continue(); });
  await page.goto(process.env.SOL_URL || 'http://127.0.0.1:5173/', { waitUntil: 'commit' });
  await page.waitForSelector('#loading', { state: 'attached' });
  await page.waitForTimeout(200);
  await mkdir('test-results', { recursive: true });
  await page.screenshot({ path: 'test-results/startup-before-script.png' });
  const early = await page.evaluate(() => {
    const loading = document.getElementById('loading');
    const r = loading.getBoundingClientRect();
    return {
      cover: r.x === 0 && r.y === 0 && r.width >= innerWidth && r.height >= innerHeight,
      hudVisible: getComputedStyle(document.getElementById('timebar')).visibility !== 'hidden' && getComputedStyle(document.getElementById('timebar')).opacity !== '0',
      tableVisible: document.getElementById('panel').getBoundingClientRect().height > 0,
    };
  });
  console.log('before module:', early);
  unblock();
  assert.equal(early.cover, true, 'before JS/CSS arrive, loading screen must cover the viewport; no raw controls/table flash');
  assert.equal(early.hudVisible, false, 'startup controls must stay hidden');
  assert.equal(early.tableVisible, false, 'hidden information panel must never flash');
  await page.waitForFunction(() => !!window.sol);
  await page.evaluate(() => window.sol.debugFocus('earth'));
  await page.waitForFunction(() => getComputedStyle(document.getElementById('timebar')).visibility === 'visible');
  await page.click('#quickbar button[data-id="earth"]');
  assert.equal(await page.locator('#panel').isVisible(), true, 'normal interaction must still show info panel');
  console.log('PASS: no raw UI flash before modules; normal UI remains functional.');
} finally { await browser.close(); }
