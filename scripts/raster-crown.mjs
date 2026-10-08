/** Draw crown.svg to a transparent PNG for the icon sheet. */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';

const svg = readFileSync('art/icon-sources/crown.svg', 'utf8')
  .replace('<svg ', '<svg width="160" height="160" ');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 180, height: 180 }, deviceScaleFactor: 1 });
await page.setContent(`<!doctype html><style>html,body{margin:0;background:transparent}</style>${svg}`);
const buf = await page.locator('svg').screenshot({ omitBackground: true });
writeFileSync('art/icon-sources/crown.png', buf);
await browser.close();
console.log('wrote art/icon-sources/crown.png', buf.length);
