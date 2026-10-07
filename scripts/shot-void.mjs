/**
 * Dev-only: open Deep Void, press play, and save frames as the run moves.
 * Uses the Chrome already installed on the machine.
 *
 *   node scripts/shot-void.mjs
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const outDir = path.join(os.tmpdir(), 'hop-void-shots');
await mkdir(outDir, { recursive: true });

const save = {
  tutorialDone: true,
  totalScore: 20000,
  selectedWorld: 'void',
  revealedWorlds: ['sunrise', 'dusk', 'void'],
  missionsUnlockSeen: true,
  missionsSpotlightSeen: true,
  shieldCardSeen: true,
  firstDuskCalloutSeen: true,
  worldSpotlightSeen: ['dusk', 'void'],
  runsPlayed: 0
};

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (err) => errors.push(String(err)));
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text());
});

await page.addInitScript((data) => {
  localStorage.setItem('hop_dev_player_data', JSON.stringify(data));
}, save);

await page.goto('http://localhost:3000/?world=void', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.gameDebug && document.getElementById('play-btn'), null, { timeout: 15000 });
const splash = page.locator('#splash-screen');
if (await splash.count()) {
  await splash.click({ timeout: 2000 }).catch(() => {});
  await page.waitForTimeout(700);
}

async function arm(target) {
  await target.evaluate(() => {
    window.gameDebug.unlockAllWorlds();
    window.gameDebug.forceWorld('void');
    window.gameDebug.straightLane(true);
    window.gameDebug.noSway(true);
    window.gameDebug.toggleInvincible();
  });
}

async function waitZ(target, z) {
  const started = Date.now();
  let last = -1;
  while (Date.now() - started < 60000) {
    last = await target.evaluate(() => window.gameDebug.ballPos().z);
    if (last >= z) return last;
    await target.waitForTimeout(100);
  }
  throw new Error(`ball stuck at z=${last}, wanted ${z}`);
}

async function shotAt(target, z, name) {
  const actual = await waitZ(target, z);
  await target.screenshot({ path: path.join(outDir, name) });
  return actual;
}

await arm(page);
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(outDir, '01-menu.png') });

await page.locator('#play-btn').click();
const desktop = {
  station: await shotAt(page, 20, '02-station.png'),
  beforeGate: await shotAt(page, 96, '03-before-gate.png'),
  gate: await shotAt(page, 114, '04-gate.png'),
  planet: await shotAt(page, 156, '05-planet.png'),
  nextPlanet: await shotAt(page, 396, '06-next-planet.png'),
  orbit: await shotAt(page, 284, '07-orbit.png')
};

const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
phone.on('pageerror', (err) => errors.push(String(err)));
await phone.addInitScript((data) => {
  localStorage.setItem('hop_dev_player_data', JSON.stringify(data));
}, save);
await phone.goto('http://localhost:3000/?world=void', { waitUntil: 'domcontentloaded' });
await phone.waitForFunction(() => window.gameDebug && document.getElementById('play-btn'), null, { timeout: 15000 });
const phoneSplash = phone.locator('#splash-screen');
if (await phoneSplash.count()) {
  await phoneSplash.click({ timeout: 2000 }).catch(() => {});
  await phone.waitForTimeout(700);
}
await arm(phone);
await phone.locator('#play-btn').click();
const phoneShots = {
  station: await shotAt(phone, 20, 'phone-station.png'),
  gate: await shotAt(phone, 114, 'phone-gate.png'),
  planet: await shotAt(phone, 410, 'phone-planet.png'),
  orbit: await shotAt(phone, 298, 'phone-orbit.png')
};

const title = await page.locator('#world-title').textContent().catch(() => '');
console.log(JSON.stringify({ outDir, title, desktop, phoneShots, errors }, null, 2));
await browser.close();
