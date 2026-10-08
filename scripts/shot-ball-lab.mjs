import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const skinArg = process.argv[2] || 'paper-core';
const frame = process.argv[3] === 'frame';
const all = [
  'rings',
  'court-line',
  'confetti-plus',
  'lantern',
  'marble',
  'night-glass',
  'prism-swirl',
  'hopper',
  'crinkle',
  'star-play'
];
const skins = skinArg === 'all' ? all : [skinArg];
const outDir = path.resolve('docs/shots/balls');
await mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({
  viewport: frame ? { width: 760, height: 780 } : { width: 1560, height: 860 },
  deviceScaleFactor: 1
});
const errors = [];
page.on('pageerror', (err) => errors.push(String(err)));
const query = frame ? '&frame=1' : '';
for (const skin of skins) {
  await page.goto(`http://localhost:3000/ball-lab.html?skin=${encodeURIComponent(skin)}${query}`, {
    waitUntil: 'networkidle'
  });
  await page.waitForTimeout(250);
  const file = path.join(outDir, frame ? `${skin}-frame.png` : `${skin}.png`);
  await page.screenshot({ path: file });
  console.log(file);
}
console.log(JSON.stringify({ errors }, null, 2));
await browser.close();
