import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const ids = [
  'wide-shelf', 'wide-wedge', 'wide-broken', 'wide-barge',
  'jag-heap', 'jag-fang', 'jag-twist', 'jag-low',
  'seam-rift', 'seam-cross', 'seam-shelf',
  'crown-planted', 'crown-gap', 'crown-twin', 'crown-lean',
  'shaft-tall', 'shaft-slim', 'shaft-broad', 'shaft-lean',
  'cluster-three', 'cluster-step', 'cluster-fan',
  'marked-hook', 'marked-peak', 'marked-arc',
  'planet-wide', 'planet-twin', 'planet-heavy', 'planet-three',
  'orbit-rock', 'orbit-shaft', 'orbit-pebble',
  'gate-break-right', 'gate-wide-top', 'gate-three', 'gate-heavy'
];

const outDir = path.join(os.tmpdir(), 'hop-void-lab');
await mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
const errors = [];
page.on('pageerror', (err) => errors.push(String(err)));
for (const id of ids) {
  await page.goto(`http://localhost:3000/void-lab.html?id=${id}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(outDir, `${id}.png`) });
}
console.log(JSON.stringify({ outDir, count: ids.length, errors }, null, 2));
await browser.close();
