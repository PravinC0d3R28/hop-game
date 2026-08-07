/**
 * Screen-space fire overlay for the "ON FIRE" perfect-streak reward.
 *
 * Replaces the old static corner glow with a living, additive-blended fire
 * band along the bottom edge (rising flames + ember sparks), a pulsing heat
 * vignette, and a burst flash/ring when the streak is (re)hit. Drawn on its
 * own 2D canvas with pre-rendered radial sprites — zero dependencies, fits the
 * tiny-footprint philosophy (no particle engine needed for a screen effect).
 *
 * The overlay owns a rAF loop that runs only while the fire is up (or fading),
 * so returning players who never reach a 10-streak pay nothing.
 */

interface FireParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  kind: 'flame' | 'ember';
  sway: number;
  swayAmp: number;
}

function makeSprite(inner: string, outer: string): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d');
  if (!g) return c;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, inner);
  grad.addColorStop(1, outer);
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return c;
}

const MAX_PARTICLES = 220;

export class FireOverlay {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private particles: FireParticle[] = [];
  private raf = 0;
  private last = 0;
  private active = false;
  /** 0..1 — eased toward the active state so the fire fades in/out. */
  private intensity = 0;
  /** 0..1 burst flash, decays over a few frames. */
  private flash = 0;
  private pulse = 0;
  private W = 0;
  private H = 0;

  private flameWhite = makeSprite('rgba(255,248,225,0.9)', 'rgba(255,180,60,0)');
  private flameOrange = makeSprite('rgba(255,170,50,0.85)', 'rgba(255,90,20,0)');
  private flameRed = makeSprite('rgba(240,70,20,0.8)', 'rgba(130,20,10,0)');
  private emberSprite = makeSprite('rgba(255,235,170,0.95)', 'rgba(255,180,60,0)');

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'fire-overlay';
    document.getElementById('ui-overlay')?.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d') as CanvasRenderingContext2D;
    this.resize();
    window.addEventListener('resize', this.resize);
  }

  private resize = (): void => {
    const overlay = document.getElementById('ui-overlay');
    const w = overlay ? overlay.clientWidth : window.innerWidth;
    const h = overlay ? overlay.clientHeight : window.innerHeight;
    this.W = w;
    this.H = h;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.max(1, Math.round(w * dpr));
    this.canvas.height = Math.max(1, Math.round(h * dpr));
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  /** Turn the streak fire on/off (fades intensity in/out). */
  setFire(on: boolean): void {
    this.active = on;
    if (on && !this.raf) {
      this.last = performance.now();
      this.raf = requestAnimationFrame(this.tick);
    }
  }

  /** Dramatic burst when the 10-streak fires: full-screen flash + ember spray. */
  burst(): void {
    this.flash = 1;
    for (let i = 0; i < 46; i++) {
      this.spawn(this.W * (0.12 + Math.random() * 0.76), this.H + 8, 'ember', 1.5 + Math.random() * 1.5);
    }
  }

  private spawn(x: number, y: number, kind: 'flame' | 'ember', speedMul = 1): void {
    if (this.particles.length >= MAX_PARTICLES) this.particles.shift();
    const life = kind === 'flame' ? 1.1 + Math.random() * 1.3 : 1.5 + Math.random() * 1.8;
    this.particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 16 * speedMul,
      vy: -(46 + Math.random() * 66) * speedMul,
      life,
      maxLife: life,
      size: kind === 'flame' ? 10 + Math.random() * 18 : 2 + Math.random() * 3.5,
      kind,
      sway: Math.random() * Math.PI * 2,
      swayAmp: 10 + Math.random() * 20
    });
  }

  private tick = (now: number): void => {
    const dt = Math.min((now - this.last) / 1000, 0.05);
    this.last = now;
    if (!document.body.classList.contains('game-paused')) {
      this.pulse += dt;
      this.intensity += ((this.active ? 1 : 0) - this.intensity) * Math.min(1, dt * 3);
      this.flash = Math.max(0, this.flash - dt * 1.8);

      if (this.active) {
        const count = Math.round(2 + this.intensity * 4);
        for (let i = 0; i < count; i++) {
          this.spawn(Math.random() * this.W, this.H + 6 + Math.random() * 30, 'flame');
        }
        if (this.intensity > 0.55 && Math.random() < 0.4) {
          this.spawn(Math.random() * this.W, this.H + 8, 'ember');
        }
      }

      for (const p of this.particles) {
        p.life -= dt;
        p.sway += dt * 2.2;
        p.x += (p.vx + Math.sin(p.sway) * p.swayAmp) * dt;
        p.y += p.vy * dt;
      }
      this.particles = this.particles.filter((p) => p.life > 0);

      this.draw();
    }

    if (this.intensity > 0.01 || this.active || this.flash > 0.01) {
      this.raf = requestAnimationFrame(this.tick);
    } else {
      this.raf = 0;
      this.ctx.clearRect(0, 0, this.W, this.H);
    }
  };

  private draw(): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.W, this.H);
    ctx.globalCompositeOperation = 'lighter';

    // Pulsing heat vignette (single gradient per frame).
    if (this.intensity > 0.01) {
      const breathe = 0.1 + Math.sin(this.pulse * 2.2) * 0.04;
      const cx = this.W / 2;
      const cy = this.H * 0.6;
      const glow = ctx.createRadialGradient(cx, cy, Math.min(this.W, this.H) * 0.22, cx, cy, Math.max(this.W, this.H) * 0.75);
      glow.addColorStop(0, 'rgba(255,90,20,0)');
      glow.addColorStop(1, `rgba(255,90,20,${(0.3 + breathe) * this.intensity})`);
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, this.W, this.H);
    }

    // Flames + embers (additive).
    for (const p of this.particles) {
      const t = p.life / p.maxLife;
      if (t <= 0) continue;
      ctx.globalAlpha = Math.min(1, t) * 0.9 * this.intensity;
      let sprite: HTMLCanvasElement;
      if (p.kind === 'flame') {
        sprite = t > 0.66 ? this.flameWhite : t > 0.33 ? this.flameOrange : this.flameRed;
      } else {
        sprite = this.emberSprite;
      }
      const s = p.size * (p.kind === 'flame' ? 0.7 + t * 0.9 : 0.5 + t * 0.7);
      ctx.drawImage(sprite, p.x - s / 2, p.y - s / 2, s, s);
    }

    // Burst flash + expanding shockwave ring.
    if (this.flash > 0.01) {
      ctx.globalAlpha = 1;
      ctx.fillStyle = `rgba(255,170,70,${this.flash * 0.16})`;
      ctx.fillRect(0, 0, this.W, this.H);
      const rr = (1 - this.flash) * Math.max(this.W, this.H);
      ctx.strokeStyle = `rgba(255,120,30,${this.flash})`;
      ctx.lineWidth = 3 + this.flash * 6;
      ctx.beginPath();
      ctx.arc(this.W / 2, this.H * 0.62, rr, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  dispose(): void {
    window.removeEventListener('resize', this.resize);
    if (this.raf) cancelAnimationFrame(this.raf);
    this.canvas.remove();
  }
}
