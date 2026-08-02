import {
  BackSide,
  BoxGeometry,
  CircleGeometry,
  Mesh,
  MeshBasicMaterial,
  RingGeometry,
  SphereGeometry,
  Vector3,
  DoubleSide,
  type Scene
} from 'three';
import { GAME_CONFIG } from '../config/GameConfig';
import { gsap } from 'gsap';

interface Particle {
  mesh: Mesh;
  outlineMat?: MeshBasicMaterial;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  startSize: number;
}

interface SpeedLine {
  mesh: Mesh;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  startAlpha: number;
}

const dustGeo = new SphereGeometry(1, 8, 6);
const dustOutlineGeo = new SphereGeometry(1, 8, 6);
const ringGeo = new RingGeometry(0.2, 0.3, 32);
const burstGeo = new CircleGeometry(0.06, 6);
const lineGeo = new BoxGeometry(0.04, 0.04, 1);
lineGeo.translate(0, 0, 0.5);

const CONFETTI_COLORS = ['#FFD700', '#FF4444', '#44AAFF', '#44FF88', '#FF44AA', '#8844FF', '#FF8800'];

/**
 * Visual effects: jump dust, perfect flash/ring/burst, speed lines, confetti.
 * Faithful ports of the original `Uy`/`Ny`/`Py`/`Fy`/`Oy`/`np`/`ky`.
 */
export class EffectsSystem {
  private particles: Particle[] = [];
  private speedLines: SpeedLine[] = [];
  private speedAccumulator = 0;

  constructor(
    private scene: Scene,
    private confettiContainer: HTMLElement
  ) {}

  /** Original `Uy`: 5-6 dust particles with outlines around the ball. */
  spawnJumpDust(x: number, y: number, z: number): void {
    const count = 5 + Math.floor(Math.random() * 2);
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
      const radius = 0.15 + Math.random() * 0.1;
      const mat = new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false });
      const mesh = new Mesh(dustGeo, mat);
      const size = 0.08 + Math.random() * 0.06;
      mesh.scale.setScalar(size);
      mesh.position.set(x + Math.cos(angle) * radius, y, z + Math.sin(angle) * radius);

      const outlineMat = new MeshBasicMaterial({ color: 0x111111, side: BackSide, transparent: true, opacity: 0.9, depthWrite: false });
      const outline = new Mesh(dustOutlineGeo, outlineMat);
      outline.scale.setScalar(1.25);
      mesh.add(outline);

      this.scene.add(mesh);
      const speed = 0.8 + Math.random() * 0.6;
      this.particles.push({
        mesh,
        outlineMat,
        vx: Math.cos(angle) * speed,
        vy: 0.3 + Math.random() * 0.4,
        vz: Math.sin(angle) * speed,
        life: 0.3 + Math.random() * 0.1,
        maxLife: 0,
        startSize: size
      });
      this.particles[this.particles.length - 1].maxLife =
        this.particles[this.particles.length - 1].life;
    }
  }

  /** Original `Ny`: update/expire dust particles. */
  updateParticles(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        (p.mesh.material as MeshBasicMaterial).dispose();
        if (p.outlineMat) p.outlineMat.dispose();
        this.particles.splice(i, 1);
        continue;
      }
      const n = 1 - p.life / p.maxLife;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.z += p.vz * dt;
      p.mesh.position.y += p.vy * dt;
      p.vy -= dt * 1.5;
      const grow = n < 0.3 ? n / 0.3 : 1;
      const fade = n > 0.5 ? 1 - (n - 0.5) / 0.5 : 1;
      const size = p.startSize * (1 + grow * 1.2) * fade;
      p.mesh.scale.setScalar(Math.max(size, 0.001));
      const alpha = Math.max(0, 1 - n * n) * 0.9;
      (p.mesh.material as MeshBasicMaterial).opacity = alpha;
      if (p.outlineMat) p.outlineMat.opacity = alpha;
    }
  }

  /**
   * Original `Py`: perfect hit — diamond pulse, expanding ring, burst (streak>=3),
   * full-screen gold flash overlay, score elastic.
   */
  playPerfectEffect(ballX: number, ballY: number, ballZ: number, streak: number, scoreEl: HTMLElement): void {
    const mat = new MeshBasicMaterial({ color: 0xffd700, transparent: true, opacity: 0.8, depthWrite: false, side: DoubleSide });
    const ring = new Mesh(ringGeo, mat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(ballX, GAME_CONFIG.PLATFORM_HEIGHT / 2 + 0.02, ballZ);
    this.scene.add(ring);

    gsap.to(ring.scale, { x: 6 + streak * 0.5, y: 6 + streak * 0.5, z: 1, duration: 0.5, ease: 'power2.out' });
    gsap.to(mat, {
      opacity: 0,
      duration: 0.5,
      ease: 'power2.out',
      onComplete: () => {
        this.scene.remove(ring);
        mat.dispose();
      }
    });

    // Full-screen gold flash
    const flash = document.createElement('div');
    flash.style.cssText = `position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(255, 215, 0, ${Math.min(0.15 + streak * 0.03, 0.35)});
      pointer-events: none; z-index: 20;`;
    document.getElementById('ui-overlay')?.appendChild(flash);
    gsap.to(flash, { opacity: 0, duration: 0.3, onComplete: () => flash.remove() });

    // Score elastic
    gsap.fromTo(scoreEl, { scale: 1.4 }, { scale: 1, duration: 0.3, ease: 'elastic.out(1, 0.4)' });

    if (streak >= 3) {
      for (let i = 0; i < 8; i++) {
        const bm = new MeshBasicMaterial({ color: 0xffd700, transparent: true, opacity: 0.9, depthWrite: false });
        const burst = new Mesh(burstGeo, bm);
        burst.position.set(ballX, GAME_CONFIG.PLATFORM_HEIGHT / 2 + 0.1, ballZ);
        const ang = (i / 8) * Math.PI * 2;
        const speed = 1.5 + Math.random();
        this.scene.add(burst);
        this.particles.push({
          mesh: burst,
          vx: Math.cos(ang) * speed,
          vy: 0,
          vz: Math.sin(ang) * speed,
          life: 0.4,
          maxLife: 0.4,
          startSize: 1
        });
      }
    }
  }

  /** Original `ep`: speed-line intensity 0..1 based on score. */
  getSpeedIntensity(score: number): number {
    return Math.max(0, Math.min(1, (score - GAME_CONFIG.SPEED_LINES_START_SCORE) / 70));
  }

  /** Original `Fy`: spawn one speed line. */
  private spawnSpeedLine(score: number, ballX: number, ballY: number, ballZ: number): void {
    const intensity = this.getSpeedIntensity(score);
    if (intensity <= 0 || this.speedLines.length >= GAME_CONFIG.SPEED_LINES_MAX_COUNT) return;

    const angle = Math.random() * Math.PI * 2;
    const o1 = 1 + Math.random() * 0.5;
    const o2 = 3 + Math.random() * 2;
    const off = o1 + Math.random() * (o2 - o1);
    const lineLen = 8 + Math.random() * 12;
    const px = ballX + Math.cos(angle) * off * 0.6;
    const py = ballY + Math.sin(angle) * off * 0.5 + 1;
    const pz = ballZ + lineLen;
    const dx = Math.cos(angle) * off * 0.15;
    const dy = Math.sin(angle) * off * 0.1 - 0.3;
    const dz = -1;
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const scaleZ = 3 + intensity * 6 + Math.random() * 3;
    const alpha = (0.12 + intensity * 0.3) * (0.5 + Math.random() * 0.5);

    const mat = new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: alpha, depthWrite: false });
    const mesh = new Mesh(lineGeo, mat);
    mesh.position.set(px, py, pz);
    const target = new Vector3(px + dx / len, py + dy / len, pz + dz / len);
    mesh.lookAt(target);
    mesh.scale.set(1, 1, scaleZ);
    this.scene.add(mesh);

    const vel = 15 + intensity * 25 + Math.random() * 10;
    this.speedLines.push({
      mesh,
      vx: (dx / len) * vel,
      vy: (dy / len) * vel,
      vz: (dz / len) * vel,
      life: GAME_CONFIG.SPEED_LINES_LIFETIME + Math.random() * 0.15,
      maxLife: 0,
      startAlpha: alpha
    });
    this.speedLines[this.speedLines.length - 1].maxLife =
      this.speedLines[this.speedLines.length - 1].life;
  }

  /** Original `Oy`: update spawner + existing speed lines. */
  updateSpeedLines(dt: number, score: number, ballX: number, ballY: number, ballZ: number, started: boolean, failed: boolean): void {
    const intensity = this.getSpeedIntensity(score);
    if (intensity > 0 && started && !failed) {
      const interval = GAME_CONFIG.SPEED_LINES_SPAWN_RATE / Math.max(0.1, intensity);
      this.speedAccumulator -= dt;
      if (this.speedAccumulator <= 0) {
        this.speedAccumulator = interval;
        const count = 1 + Math.floor(intensity * 3);
        for (let i = 0; i < count; i++) this.spawnSpeedLine(score, ballX, ballY, ballZ);
      }
    }
    for (let i = this.speedLines.length - 1; i >= 0; i--) {
      const s = this.speedLines[i];
      s.life -= dt;
      if (s.life <= 0) {
        this.scene.remove(s.mesh);
        (s.mesh.material as MeshBasicMaterial).dispose();
        this.speedLines.splice(i, 1);
        continue;
      }
      const n = 1 - s.life / s.maxLife;
      s.mesh.position.x += s.vx * dt;
      s.mesh.position.y += s.vy * dt;
      s.mesh.position.z += s.vz * dt;
      const fade = n < 0.1 ? n / 0.1 : (1 - n) / 0.9;
      (s.mesh.material as MeshBasicMaterial).opacity = s.startAlpha * fade;
    }
  }

  /** Original `np`: clear all speed lines. */
  clearSpeedLines(): void {
    for (const s of this.speedLines) {
      this.scene.remove(s.mesh);
      (s.mesh.material as MeshBasicMaterial).dispose();
    }
    this.speedLines = [];
  }

  clearParticles(): void {
    for (const p of this.particles) {
      this.scene.remove(p.mesh);
      (p.mesh.material as MeshBasicMaterial).dispose();
      if (p.outlineMat) p.outlineMat.dispose();
    }
    this.particles = [];
  }

  /** Original `ky`: confetti celebration (new best). */
  showConfetti(): void {
    if (!this.confettiContainer) return;
    this.confettiContainer.innerHTML = '';
    const count = 60;
    for (let i = 0; i < count; i++) {
      const piece = document.createElement('div');
      piece.className = 'confetti-piece';
      const color = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
      piece.style.background = color;
      piece.style.left = `${Math.random() * 100}%`;
      piece.style.width = `${6 + Math.random() * 8}px`;
      piece.style.height = `${6 + Math.random() * 8}px`;
      piece.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
      this.confettiContainer.appendChild(piece);
      const xOffset = (Math.random() - 0.5) * 120;
      const duration = 1.2 + Math.random() * 1.5;
      const delay = Math.random() * 0.6;
      const rotation = Math.random() * 720 - 360;
      gsap.fromTo(
        piece,
        { y: -20, x: 0, rotation: 0, opacity: 1 },
        {
          y: window.innerHeight + 20,
          x: xOffset,
          rotation,
          opacity: 0,
          duration,
          delay,
          ease: 'power1.in',
          onComplete: () => piece.remove()
        }
      );
    }
  }

  dispose(): void {
    this.clearParticles();
    this.clearSpeedLines();
  }
}
