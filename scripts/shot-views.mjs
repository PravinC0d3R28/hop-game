import { chromium } from 'playwright';
import path from 'node:path';

const id = process.argv[2];
const out = path.resolve('docs/ART/WORLD 3/lab', `${id}-views.png`);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const errors = [];
page.on('pageerror', (err) => errors.push(String(err)));
await page.goto(`http://localhost:3000/void-lab.html?id=${id}`, { waitUntil: 'networkidle' });
await page.waitForSelector('figure.card');
const names = await page.locator('figcaption').allTextContents();
await page.screenshot({ path: out, fullPage: true });
const gameCard = page.locator('figure.card', { hasText: 'game' }).locator('img');
const hero = await (await gameCard.count() ? gameCard : page.locator('figure.card img').first()).getAttribute('src');
const heroPath = path.resolve('docs/ART/WORLD 3/lab', `${id}.png`);
await import('node:fs/promises').then((fs) =>
  fs.writeFile(heroPath, Buffer.from((hero || '').replace(/^data:image\/png;base64,/, ''), 'base64'))
);
console.log(JSON.stringify({ out, heroPath, names, errors }));
await browser.close();
