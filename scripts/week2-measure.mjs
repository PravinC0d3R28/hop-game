/**
 * Week 2 measure pass. Attract-demo frame time and draw calls.
 * Uses hop_dev_player_data only. Does not change art.
 *
 *   node scripts/week2-measure.mjs
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const outDir = path.resolve('docs/shots/week2-measure');
await mkdir(outDir, { recursive: true });

const save = {
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

const views = [
  { name: 'landscape', width: 1280, height: 800, dpr: 1.25 },
  { name: 'portrait', width: 390, height: 844, dpr: 3 }
];

const worlds = ['sunrise', 'dusk', 'void'];
const report = { gpu: null, errors: [], failed: [], samples: [], dpr: [], offline: null };

function stats(times, draws) {
  const ts = times.slice().sort((a, b) => a - b);
  const ds = draws.slice();
  const sum = (a) => a.reduce((s, n) => s + n, 0);
  const p99 = ts[Math.min(ts.length - 1, Math.ceil(0.99 * ts.length) - 1)];
  return {
    frames: ts.length,
    avgFps: +(1000 / (sum(ts) / ts.length)).toFixed(1),
    p99Ms: +p99.toFixed(1),
    worstMs: +Math.max(...ts).toFixed(1),
    avgDraws: +(sum(ds) / ds.length).toFixed(1),
    maxDraws: Math.max(...ds),
    instanced: 0
  };
}

function hook() {
  const state = { calls: 0, instanced: 0, frames: [], times: [], inst: [] };
  const wrap = (proto, name, key) => {
    const orig = proto && proto[name];
    if (!orig || orig.__hop) return;
    function next(...args) {
      state[key] += 1;
      return orig.apply(this, args);
    }
    next.__hop = true;
    proto[name] = next;
  };
  for (const proto of [self.WebGL2RenderingContext?.prototype, self.WebGLRenderingContext?.prototype]) {
    wrap(proto, 'drawElements', 'calls');
    wrap(proto, 'drawArrays', 'calls');
    wrap(proto, 'drawElementsInstanced', 'instanced');
    wrap(proto, 'drawArraysInstanced', 'instanced');
  }
  let last = 0;
  const tick = (t) => {
    if (last) {
      state.frames.push(state.calls);
      state.inst.push(state.instanced);
      state.times.push(t - last);
    }
    state.calls = 0;
    state.instanced = 0;
    last = t;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  self.__hopPerf = {
    frames: state.frames,
    times: state.times,
    inst: state.inst,
    reset() {
      state.frames.length = 0;
      state.times.length = 0;
      state.inst.length = 0;
    }
  };
}

async function boot(page) {
  const errors = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('response', (res) => {
    if (res.status() >= 400) report.failed.push({ url: res.url(), status: res.status() });
  });
  await page.addInitScript(saveData => {
    localStorage.setItem('hop_dev_player_data', JSON.stringify(saveData));
  }, save);
  await page.addInitScript(hook);
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.gameDebug && document.querySelector('canvas'), null, { timeout: 20000 });
  const splash = page.locator('#splash-screen');
  if (await splash.count()) await splash.click({ timeout: 2000 }).catch(() => {});
  await page.waitForTimeout(1600);
  return errors;
}

async function sample(page, ms) {
  await page.evaluate(() => window.__hopPerf.reset());
  await page.waitForTimeout(ms);
  return page.evaluate(() => {
    const frames = window.__hopPerf.frames.slice(8);
    const times = window.__hopPerf.times.slice(8);
    const inst = window.__hopPerf.inst.slice(8);
    const canvas = document.querySelector('canvas');
    const sum = (a) => a.reduce((s, n) => s + n, 0);
    return {
      times,
      frames,
      instAvg: inst.length ? +(sum(inst) / inst.length).toFixed(2) : 0,
      dpr: devicePixelRatio,
      canvasW: canvas.width,
      canvasH: canvas.height,
      cssW: canvas.clientWidth,
      cssH: canvas.clientHeight,
      ratio: +(canvas.width / canvas.clientWidth).toFixed(3)
    };
  });
}

const browser = await chromium.launch({ channel: 'chrome', headless: true });

for (const view of views) {
  const context = await browser.newContext({
    viewport: { width: view.width, height: view.height },
    deviceScaleFactor: view.dpr
  });
  const page = await context.newPage();
  const errors = await boot(page);
  report.errors.push(...errors.map((e) => `${view.name}: ${e}`));

  if (!report.gpu) {
    report.gpu = await page.evaluate(() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      return {
        renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown',
        vendor: ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : 'unknown'
      };
    });
  }

  for (const world of worlds) {
    await page.evaluate((id) => window.gameDebug.forceWorld(id), world);
    await page.waitForTimeout(1800);
    const raw = await sample(page, 4000);
    const row = stats(raw.times, raw.frames);
    row.instanced = raw.instAvg;
    row.view = view.name;
    row.world = world;
    row.dpr = raw.dpr;
    row.ratio = raw.ratio;
    row.canvas = `${raw.canvasW}x${raw.canvasH}`;
    report.samples.push(row);
    report.dpr.push({ view: view.name, world, dpr: raw.dpr, ratio: raw.ratio, canvas: row.canvas });
    console.log(view.name, world, JSON.stringify(row));

    await page.evaluate(() => {
      const el = document.getElementById('start-screen');
      if (el) el.style.visibility = 'hidden';
    });
    await page.screenshot({ path: path.join(outDir, `${view.name}-${world}-path.png`) });
    await page.evaluate(() => {
      const el = document.getElementById('start-screen');
      if (el) el.style.visibility = '';
    });
  }

  if (view.name === 'landscape') {
    const before = await page.evaluate(() => window.__hopPerf.frames.length);
    await context.setOffline(true);
    await page.waitForTimeout(2000);
    const after = await page.evaluate(() => ({
      frames: window.__hopPerf.frames.length,
      onLine: navigator.onLine
    }));
    report.offline = { before, after: after.frames, grew: after.frames > before, onLine: after.onLine };
    console.log('offline', JSON.stringify(report.offline));
    await context.setOffline(false);
  }

  await context.close();
}

await browser.close();
await writeFile(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
console.log('wrote', path.join(outDir, 'report.json'));
