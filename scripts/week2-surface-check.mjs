/**
 * Week 2 surface check. Current worlds are the reference.
 * Uses hop_dev_player_data only. Writes stills and a JSON report.
 *
 *   node scripts/week2-surface-check.mjs
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const outDir = path.resolve('docs/shots/week2-check');
await mkdir(outDir, { recursive: true });

const unlocked = {
  tutorialDone: true,
  totalScore: 20000,
  selectedWorld: 'sunrise',
  revealedWorlds: ['sunrise', 'dusk', 'void'],
  missionsUnlockSeen: true,
  missionsSpotlightSeen: true,
  shieldCardSeen: true,
  firstDuskCalloutSeen: true,
  worldSpotlightSeen: ['dusk', 'void'],
  runsPlayed: 5,
  bestPerWorld: [10, 10, 10]
};

const lockedSave = {
  ...unlocked,
  totalScore: 400,
  selectedWorld: 'sunrise',
  revealedWorlds: ['sunrise'],
  bestPerWorld: [0, 0, 0],
  worldSpotlightSeen: ['dusk', 'void']
};

const spotlightSave = {
  ...unlocked,
  selectedWorld: 'void',
  totalScore: 20000,
  missionsUnlockSeen: false,
  missionsSpotlightSeen: false,
  runsPlayed: 3
};

const views = [
  { name: 'landscape', width: 1280, height: 720 },
  { name: 'portrait', width: 390, height: 844 }
];

const report = { errors: [], steps: [] };

function note(step, data) {
  report.steps.push({ step, ...data });
  console.log(step, JSON.stringify(data));
}

async function boot(page, save) {
  const errors = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  await page.addInitScript((data) => {
    localStorage.setItem('hop_dev_player_data', JSON.stringify(data));
  }, save);
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.gameDebug && document.getElementById('play-btn'), null, { timeout: 20000 });
  const splash = page.locator('#splash-screen');
  if (await splash.count()) {
    await splash.click({ timeout: 2000 }).catch(() => {});
  }
  await page.waitForTimeout(900);
  return errors;
}

async function probe(page) {
  return page.evaluate(() => {
    const box = (id) => {
      const el = document.getElementById(id);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      const onScreen = r.width > 8 && r.height > 8 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth;
      return {
        text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 90),
        display: s.display,
        opacity: s.opacity,
        color: s.color,
        w: Math.round(r.width),
        h: Math.round(r.height),
        x: Math.round(r.left),
        y: Math.round(r.top),
        onScreen
      };
    };
    const look = window.gameDebug.lookInfo();
    return {
      title: box('world-title'),
      play: box('play-btn'),
      prev: box('world-prev'),
      next: box('world-next'),
      score: box('score'),
      go: box('gameover-screen'),
      goScore: box('go-score'),
      goWorld: box('go-world'),
      lock: box('lock-overlay'),
      spotlight: box('spotlight-overlay'),
      start: box('start-screen'),
      coins: window.gameDebug.coins(),
      world: look.world,
      layers: look.layers,
      vw: innerWidth,
      vh: innerHeight
    };
  });
}

async function shot(page, name) {
  const file = path.join(outDir, name);
  await page.screenshot({ path: file });
  return name;
}

async function waitTitle(page, text) {
  await page.waitForFunction((t) => (document.getElementById('world-title')?.textContent || '').includes(t), text, { timeout: 8000 });
  await page.waitForTimeout(1100);
}

const browser = await chromium.launch({ channel: 'chrome', headless: true });

try {
  for (const view of views) {
    const context = await browser.newContext({ viewport: { width: view.width, height: view.height } });
    const page = await context.newPage();
    const errors = await boot(page, unlocked);
    report.errors.push({ view: view.name, phase: 'menu', errors });

    const order = [
      { title: 'SUNRISE', file: `${view.name}-sunrise-menu.png` },
      { click: '#world-next', title: 'DUSK', file: `${view.name}-dusk-menu.png` },
      { click: '#world-next', title: 'VOID', file: `${view.name}-void-menu.png` },
      { click: '#world-prev', title: 'DUSK', file: `${view.name}-dusk-return.png` },
      { click: '#world-prev', title: 'SUNRISE', file: `${view.name}-sunrise-return.png` }
    ];

    for (const step of order) {
      if (step.click) {
        await page.locator(step.click).click();
        await waitTitle(page, step.title);
      }
      await page.waitForFunction(() => {
        const el = document.getElementById('play-btn');
        return el && parseFloat(getComputedStyle(el).opacity) > 0.85;
      }, null, { timeout: 8000 }).catch(() => {});
      const info = await probe(page);
      const file = await shot(page, step.file);
      note(`${view.name} ${step.file}`, { file, world: info.world, coins: info.coins, title: info.title, play: info.play, prev: info.prev, next: info.next, score: info.score, layers: info.layers });
    }

    await context.close();
  }

  for (const view of views) {
    const context = await browser.newContext({ viewport: { width: view.width, height: view.height } });
    const page = await context.newPage();
    const errors = await boot(page, lockedSave);
    report.errors.push({ view: view.name, phase: 'lock', errors });
    await page.locator('#world-next').waitFor({ state: 'visible', timeout: 8000 });
    await page.locator('#world-next').click();
    await page.waitForFunction(() => getComputedStyle(document.getElementById('lock-overlay')).display !== 'none', null, { timeout: 8000 });
    await page.waitForTimeout(500);
    let info = await probe(page);
    let file = await shot(page, `${view.name}-lock.png`);
    note(`${view.name} lock`, { file, world: info.world, lock: info.lock, title: info.title, play: info.play });
    await page.locator('#lock-close').click();
    await page.waitForTimeout(600);
    info = await probe(page);
    file = await shot(page, `${view.name}-lock-closed.png`);
    note(`${view.name} lock closed`, { file, world: info.world, lock: info.lock, title: info.title });
    await context.close();
  }

  for (const view of views) {
    const context = await browser.newContext({ viewport: { width: view.width, height: view.height } });
    const page = await context.newPage();
    const errors = await boot(page, spotlightSave);
    report.errors.push({ view: view.name, phase: 'spotlight', errors });
    await page.waitForTimeout(1800);
    const info = await probe(page);
    const file = await shot(page, `${view.name}-void-spotlight.png`);
    note(`${view.name} spotlight`, { file, world: info.world, spotlight: info.spotlight, play: info.play, title: info.title });
    await context.close();
  }

  for (const view of views) {
    for (const world of ['sunrise', 'dusk', 'void']) {
      const context = await browser.newContext({ viewport: { width: view.width, height: view.height } });
      const page = await context.newPage();
      const errors = await boot(page, { ...unlocked, selectedWorld: world });
      report.errors.push({ view: view.name, phase: `run-${world}`, errors });
      await page.evaluate((id) => window.gameDebug.forceWorld(id), world);
      await page.waitForTimeout(700);
      await page.evaluate(() => {
        window.gameDebug.straightLane(true);
        window.gameDebug.noSway(true);
      });
      await page.waitForTimeout(400);
      await page.locator('#play-btn').click({ force: true });
      await page.waitForFunction(() => getComputedStyle(document.getElementById('score')).display !== 'none', null, { timeout: 8000 });
      await page.waitForTimeout(700);
      let info = await probe(page);
      let file = await shot(page, `${view.name}-${world}-run.png`);
      note(`${view.name} ${world} run`, { file, world: info.world, score: info.score, play: info.play, start: info.start, coins: info.coins });

      const vp = page.viewportSize();
      const y = Math.round(vp.height * 0.62);
      await page.mouse.move(Math.round(vp.width / 2), y);
      await page.mouse.down();
      await page.mouse.move(12, y, { steps: 6 });
      let failed = false;
      const started = Date.now();
      while (Date.now() - started < 14000) {
        const open = await page.evaluate(() => getComputedStyle(document.getElementById('gameover-screen')).display);
        if (open !== 'none') { failed = true; break; }
        await page.waitForTimeout(200);
      }
      await page.mouse.up();
      info = await probe(page);
      file = await shot(page, `${view.name}-${world}-gameover.png`);
      note(`${view.name} ${world} gameover`, { file, failed, world: info.world, go: info.go, goScore: info.goScore, goWorld: info.goWorld });

      if (view.name === 'landscape' && world === 'dusk' && failed) {
        await page.locator('#go-continue-btn').click();
        await page.waitForTimeout(1200);
        info = await probe(page);
        file = await shot(page, `${view.name}-dusk-playagain.png`);
        note('landscape dusk play again', { file, world: info.world, start: info.start, go: info.go, score: info.score });
      } else if (failed) {
        await page.locator('#go-home-btn').click();
        await page.waitForFunction(() => getComputedStyle(document.getElementById('start-screen')).display !== 'none', null, { timeout: 8000 });
        await page.waitForTimeout(800);
        info = await probe(page);
        file = await shot(page, `${view.name}-${world}-home.png`);
        note(`${view.name} ${world} home`, { file, world: info.world, title: info.title, go: info.go, coins: info.coins, layers: info.layers });
      }
      await context.close();
    }
  }
} finally {
  await browser.close();
  await writeFile(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
}
