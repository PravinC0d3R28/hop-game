import {
  AdditiveBlending,
  BackSide,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshPhongMaterial,
  MeshToonMaterial,
  PlaneGeometry,
  RingGeometry,
  SphereGeometry,
  Vector3,
  DoubleSide,
  type Scene
} from 'three';
import { GAME_CONFIG } from '../config/GameConfig';
import type { WorldId } from '../config/Worlds';
import type { PlatformData } from '../entities/PlatformEntity';
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

/** A planted failure flag: root rides the platform, cloth billboards + waves. */
interface FailureFlag {
  /** Parented to the missed platform's group (follows sway automatically). */
  root: Group;
  /** Cloth assembly — yaw-rotated each frame to face the camera. */
  cloth: Group;
  /** Subdivided pennant mesh; vertices are displaced per frame (poly wave). */
  clothMesh: Mesh;
  /** Resting (x,y) per vertex, used to recompute the wave each frame. */
  baseXY: Float32Array;
  /** Cloth length along +x (for the traveling-wave amplitude ramp). */
  clothLength: number;
  /** Random phase offset so two flags never wave in sync. */
  phase: number;
  /** True once the drop has landed — the cloth only billboards/waves after
   *  this, so the flag falls as a solid object and slams dead-on. */
  landed: boolean;
}

const dustGeo = new SphereGeometry(1, 8, 6);
const dustOutlineGeo = new SphereGeometry(1, 8, 6);
const ringGeo = new RingGeometry(0.2, 0.3, 32);
const burstGeo = new CircleGeometry(0.06, 6);
const lineGeo = new BoxGeometry(0.04, 0.04, 1);
lineGeo.translate(0, 0, 0.5);
const flagChipGeo = new BoxGeometry(0.12, 0.12, 0.04);

const CONFETTI_COLORS = ['#FFD700', '#FF4444', '#44AAFF', '#44FF88', '#FF44AA', '#8844FF', '#FF8800'];

/**
 * Visual effects: jump dust, perfect flash/ring/burst, speed lines, confetti.
 * Faithful ports of the original `Uy`/`Ny`/`Py`/`Fy`/`Oy`/`np`/`ky`.
 */
export class EffectsSystem {
  private particles: Particle[] = [];
  private speedLines: SpeedLine[] = [];
  private speedAccumulator = 0;
  private failureFlags: FailureFlag[] = [];

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

  /** Streak 10 (FR-4): fire burst around the ball — additive flames + embers,
   *  an expanding shockwave ring and a central flash pop. */
  playFireBurst(x: number, y: number, z: number): void {
    // Central flash: a bright sphere that pops and fades fast.
    const flashMat = new MeshBasicMaterial({
      color: 0xfff0d0,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      blending: AdditiveBlending
    });
    const flash = new Mesh(new SphereGeometry(0.22, 12, 10), flashMat);
    flash.position.set(x, y + 0.3, z);
    this.scene.add(flash);
    gsap.to(flash.scale, { x: 2.4, y: 2.4, z: 2.4, duration: 0.32, ease: 'power2.out' });
    gsap.to(flashMat, {
      opacity: 0,
      duration: 0.32,
      ease: 'power2.out',
      onComplete: () => {
        this.scene.remove(flash);
        flashMat.dispose();
        (flash.geometry as SphereGeometry).dispose();
      }
    });

    // Expanding shockwave ring on the platform.
    const ringMat = new MeshBasicMaterial({
      color: 0xff8c20,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      side: DoubleSide,
      blending: AdditiveBlending
    });
    const ring = new Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, GAME_CONFIG.PLATFORM_HEIGHT / 2 + 0.02, z);
    this.scene.add(ring);
    gsap.to(ring.scale, { x: 8, y: 8, z: 1, duration: 0.5, ease: 'power2.out' });
    gsap.to(ringMat, {
      opacity: 0,
      duration: 0.5,
      ease: 'power2.out',
      onComplete: () => {
        this.scene.remove(ring);
        ringMat.dispose();
      }
    });

    // Flame + ember particles: upward-biased, additive so they read as fire.
    const flameColors = [0xfff2d0, 0xffd54d, 0xff8c00, 0xff4d00, 0xe02500];
    for (let i = 0; i < 30; i++) {
      const color = flameColors[Math.floor(Math.random() * flameColors.length)];
      const mat = new MeshBasicMaterial({ color, transparent: true, opacity: 0.95, depthWrite: false, blending: AdditiveBlending });
      const burst = new Mesh(burstGeo, mat);
      const radius = 0.25 + Math.random() * 0.3;
      const phi = Math.random() * Math.PI * 2;
      burst.position.set(x + Math.cos(phi) * radius, y + 0.25 + Math.random() * 0.4, z + Math.sin(phi) * radius);
      const speed = 2 + Math.random() * 2.4;
      const ang = Math.random() * Math.PI * 2;
      this.scene.add(burst);
      this.particles.push({
        mesh: burst,
        vx: Math.cos(ang) * speed * 0.7,
        vy: 1.2 + Math.random() * 2.2,
        vz: Math.sin(ang) * speed * 0.7,
        life: 0.55 + Math.random() * 0.4,
        maxLife: 0.7,
        startSize: 1
      });
    }
  }

  /** Shield consumed: bright ring shatter at the miss point. */
  playShieldBreak(x: number, z: number): void {
    const mat = new MeshBasicMaterial({
      color: 0x88ddff,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      side: DoubleSide
    });
    const ring = new Mesh(ringGeo, mat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, GAME_CONFIG.PLATFORM_HEIGHT / 2 + 0.02, z);
    this.scene.add(ring);
    gsap.to(ring.scale, { x: 8, y: 8, z: 1, duration: 0.35, ease: 'power2.out' });
    gsap.to(mat, {
      opacity: 0,
      duration: 0.35,
      onComplete: () => {
        this.scene.remove(ring);
        mat.dispose();
      }
    });
    for (let i = 0; i < 10; i++) {
      const bm = new MeshBasicMaterial({ color: 0x66ccff, transparent: true, opacity: 0.9, depthWrite: false });
      const burst = new Mesh(burstGeo, bm);
      burst.position.set(x, GAME_CONFIG.PLATFORM_HEIGHT / 2 + 0.1, z);
      const ang = (i / 10) * Math.PI * 2;
      const speed = 2 + Math.random();
      this.scene.add(burst);
      this.particles.push({
        mesh: burst,
        vx: Math.cos(ang) * speed,
        vy: 0.5 + Math.random(),
        vz: Math.sin(ang) * speed,
        life: 0.45,
        maxLife: 0.45,
        startSize: 1
      });
    }
  }

  /** Shield save: a faint glass pane appears where the ball is caught mid-air,
   *  holds just long enough to stand on, then dissolves. */
  playGlassFloor(x: number, z: number): void {
    const geo = new PlaneGeometry(2.4, 2.4);
    const mat = new MeshBasicMaterial({
      color: 0x88ddff,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
      side: DoubleSide
    });
    const pane = new Mesh(geo, mat);
    pane.rotation.x = -Math.PI / 2;
    pane.position.set(x, GAME_CONFIG.PLATFORM_HEIGHT / 2 + 0.005, z);
    this.scene.add(pane);
    gsap.fromTo(
      pane.scale,
      { x: 0.5, y: 0.5 },
      { x: 1.15, y: 1.15, duration: 0.18, ease: 'power2.out', yoyo: true, repeat: 1 }
    );
    gsap.to(mat, {
      opacity: 0,
      duration: 0.45,
      delay: 0.15,
      onComplete: () => {
        this.scene.remove(pane);
        geo.dispose();
        mat.dispose();
      }
    });
  }

  clearParticles(): void {
    for (const p of this.particles) {
      this.scene.remove(p.mesh);
      (p.mesh.material as MeshBasicMaterial).dispose();
      if (p.outlineMat) p.outlineMat.dispose();
    }
    this.particles = [];
  }

  /** Game-over marker: a raw-wood flag drops from the sky and plants into the
   *  missed platform. The flag is parented to the platform's group so it rides
   *  the platform's sway in dusk/void. Colors come from the active world's
   *  palette (FLAG_WORLD_PALETTES) so the flag vibes with the world. The pole
   *  is a tapered wooden stake (1.2x thick on top, 1x at the bottom) that
   *  sinks into the tile; the cloth is a subdivided poly mesh with a lit Phong
   *  material in a FIXED orientation (faces +z, tip at +x) so it never snaps
   *  or jumps. On impact: a crater + mixed debris + dust puff + onImpact.
   *  Stays planted until clearFailureFlags(). */
  playFailureFlag(platform: PlatformData, worldId: WorldId, onImpact?: () => void): void {
    const flag = GAME_CONFIG.FAIL_FLAG;
    // Colors resolve to the active world's palette (falls back to FAIL_FLAG).
    const pal = GAME_CONFIG.FLAG_WORLD_PALETTES[worldId] ?? flag;
    // Platform top surface, in the platform group's local space (the box is
    // centered at the group origin, so the top sits at +PLATFORM_HEIGHT/2).
    const topLocalY = GAME_CONFIG.PLATFORM_HEIGHT / 2;

    const root = new Group();
    // One uniform world-scale for the whole flag: flag.scale (2 = 200% bigger
    // than the base art) × counter-scale of the platform's own baseScale
    // (applied to the platform group's x/z), so the flag never shrinks with
    // the platform it lands on.
    const bs = Math.max(platform.baseScale || 1, 0.1);
    root.scale.set(flag.scale / bs, flag.scale, flag.scale / bs);

    // Raw-wood pole: a tapered stake (square cross-section via 4-seg cylinder)
    // that is 1.2x thick at the top and 1x at the bottom. It is planted INTO
    // the platform tile: the base sits below the top surface (local y<0) and
    // the exposed part rises above it.
    const bottomW = 0.07;
    const topW = bottomW * 1.2;
    const poleTotalH = 1.5;
    const sunkDepth = 0.45; // how far below the tile top the stake goes
    const poleGeo = new CylinderGeometry(topW / 2, bottomW / 2, poleTotalH, 4);
    const pole = new Mesh(poleGeo, new MeshBasicMaterial({ color: flag.woodColor }));
    pole.rotation.y = Math.PI / 4; // align the square faces with the axis
    pole.position.y = -sunkDepth + poleTotalH / 2; // base at y=-sunkDepth
    root.add(pole);

    // Gold finial on the pole top (palette "Highlight").
    const finialGeo = new SphereGeometry(0.055, 10, 8);
    const finial = new Mesh(finialGeo, new MeshBasicMaterial({ color: pal.highlightColor }));
    finial.position.y = poleTotalH - sunkDepth + 0.02; // just above the pole top
    root.add(finial);

    // Cloth assembly: subdivided pennant mesh, flat edge at the pole (x=0),
    // tip flying outward (+x) in a uniform triangle. The cloth has a FIXED
    // orientation — it faces +z (the camera always sits at -z) with the tip at
    // +x, so the pointy end reads on the RIGHT and never flips 180 degrees.
    const cloth = new Group();
    cloth.position.set(0, poleTotalH - sunkDepth - 0.12, 0);
    root.add(cloth);

    // Uniform triangular pennant: straight taper from full height at the pole
    // (x=0) to a point at the tip (x=clothLen). Subdivided into a grid of
    // quads (clothColumns × clothRows) so the Phong lighting can reflect off
    // the moving surface as the vertex wave travels.
    const clothLen = 0.7;
    const h0 = 0.15; // half-height at the pole
    const cols = flag.clothColumns;
    const rows = flag.clothRows;
    const positions: number[] = [];
    const indices: number[] = [];
    const vertsPerCol = rows + 1;
    for (let c = 0; c <= cols; c++) {
      const x = (c / cols) * clothLen;
      const h = h0 * (1 - x / clothLen); // straight taper → triangle
      for (let r = 0; r <= rows; r++) {
        const y = -h + (2 * h * r) / rows;
        positions.push(x, y, 0);
      }
    }
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        const a = c * vertsPerCol + r;
        const b = a + 1;
        const d = (c + 1) * vertsPerCol + r;
        const e = d + 1;
        indices.push(a, d, b, b, d, e);
      }
    }
    const clothGeo = new BufferGeometry();
    clothGeo.setAttribute('position', new Float32BufferAttribute(positions, 3));
    clothGeo.setIndex(indices);
    clothGeo.computeVertexNormals();
    const clothMat = new MeshPhongMaterial({
      color: pal.flagColor,
      side: DoubleSide,
      shininess: flag.clothShininess,
      specular: 0xffffff
    });
    const clothMesh = new Mesh(clothGeo, clothMat);
    cloth.add(clothMesh);

    // Store the resting vertex (x,y) so the per-frame wave can displace z.
    const baseXY = new Float32Array(positions.length);
    for (let i = 0; i < positions.length; i++) baseXY[i] = positions[i];

    // Plant on the platform (rides sway automatically); drop from the sky.
    platform.group.add(root);
    root.position.set(0, topLocalY + flag.dropHeight, 0);
    this.failureFlags.push({
      root,
      cloth,
      clothMesh,
      baseXY,
      clothLength: clothLen,
      phase: Math.random() * Math.PI * 2,
      landed: false
    });

    // Wait for the game-over miss-shake (0.24s of camera shake) to settle
    // before the flag starts to fall — otherwise the flag appears to jitter in
    // the air. Then slam it straight down onto the platform (power2.in, no
    // bounce-back). The cloth stays rigid until impact (landed → waves).
    gsap.delayedCall(flag.dropDelay, () => {
      const f = this.failureFlags.find((x) => x.root === root);
      if (!f) return; // cleared while waiting
      gsap.to(root.position, {
        y: topLocalY,
        duration: flag.dropDuration,
        ease: 'power2.in',
        onComplete: () => {
          f.landed = true; // cloth may now wave
          // Impact point in world space (the platform may still be swaying).
          const world = new Vector3();
          root.getWorldPosition(world);

          const platformColor = (platform.mesh.material as MeshToonMaterial).color.getHex();
          // Debris: world flag color + the platform's own palette color + outline.
          const colors = [pal.flagColor, platformColor, pal.outlineColor];

          // Crater: real debris chips thrown out in a ring around the pole
          // base (a crater rim — not a flat shadow), resting on the tile top.
          // Each chip gets its own geometry so root cleanup can dispose safely
          // (flagChipGeo is a shared module geometry used by flying debris).
          for (let i = 0; i < flag.craterDebrisCount; i++) {
            const ang = (i / flag.craterDebrisCount) * Math.PI * 2 + Math.random() * 0.4;
            const radius = flag.craterRadius * (0.75 + Math.random() * 0.5);
            const chipMat = new MeshBasicMaterial({
              color: colors[Math.floor(Math.random() * colors.length)],
              transparent: true,
              opacity: 0.95,
              depthWrite: false
            });
            const chip = new Mesh(new BoxGeometry(0.12, 0.12, 0.04), chipMat);
            const size = 0.35 + Math.random() * 0.45;
            chip.scale.setScalar(size);
            chip.rotation.x = -Math.PI / 2 + (Math.random() - 0.5) * 0.35;
            chip.rotation.z = Math.random() * Math.PI * 2;
            chip.position.set(Math.cos(ang) * radius, 0.01, Math.sin(ang) * radius);
            root.add(chip);
          }
          for (let i = 0; i < flag.debrisCount; i++) {
            const mat = new MeshBasicMaterial({
              color: colors[Math.floor(Math.random() * colors.length)],
              transparent: true,
              opacity: 0.95,
              depthWrite: false
            });
            const chip = new Mesh(flagChipGeo, mat);
            const size = 0.5 + Math.random() * 0.7;
            chip.scale.setScalar(size);
            chip.position.set(world.x, world.y + 0.05, world.z);
            const ang = Math.random() * Math.PI * 2;
            const speed = 1.5 + Math.random() * 2;
            this.scene.add(chip);
            const life = 0.5 + Math.random() * 0.3;
            this.particles.push({
              mesh: chip,
              vx: Math.cos(ang) * speed,
              vy: 1.5 + Math.random() * 2,
              vz: Math.sin(ang) * speed,
              life,
              maxLife: life,
              startSize: size
            });
          }
          // Small dust puff at the base.
          this.spawnJumpDust(world.x, world.y + 0.02, world.z);
          onImpact?.();
        }
      });
    });
  }

  /** Per-frame flag update: displace the cloth mesh vertices with a traveling
   *  wave. The subdivided polygon mesh + lit Phong material means the changing
   *  normals reflect light as the cloth sways. The cloth is in a FIXED
   *  orientation (faces +z toward the camera, tip at +x) — no billboard, so it
   *  never snaps 180 degrees. The cloth only animates once the flag has landed
   *  — during the drop it stays rigid so the flag slams down as a solid object.
   *  Called from the game loop (no-op when empty). */
  updateFailureFlags(now: number): void {
    if (this.failureFlags.length === 0) return;
    const flag = GAME_CONFIG.FAIL_FLAG;
    const t = now * 0.001;
    for (const f of this.failureFlags) {
      // Still falling: keep the cloth rigid so the drop reads as a clean slam.
      if (!f.landed) continue;
      // Poly wave: displace each vertex's z by a sine that travels along the
      // cloth. Amplitude grows toward the tip (0 at the pole → full at the
      // tip), so the free end flutters most — cloth-like physics.
      const posAttr = f.clothMesh.geometry.attributes.position as BufferAttribute;
      const arr = posAttr.array as Float32Array;
      for (let i = 0; i < f.baseXY.length; i += 3) {
        const x = f.baseXY[i];
        const y = f.baseXY[i + 1];
        const tipT = x / f.clothLength; // 0 at pole → 1 at tip
        arr[i] = x;
        arr[i + 1] = y;
        arr[i + 2] =
          Math.sin(x * flag.waveRipple - t * flag.waveSpeed + f.phase) * flag.waveAmp * tipT;
      }
      posAttr.needsUpdate = true;
      f.clothMesh.geometry.computeVertexNormals();
      // Subtle whole-cloth tilt so it never looks rigid.
      f.cloth.rotation.z = Math.sin(t * flag.waveSpeed * 0.6 + f.phase) * 0.05;
    }
  }

  /** Remove + dispose any planted failure flags (run reset). */
  clearFailureFlags(): void {
    for (const f of this.failureFlags) {
      gsap.killTweensOf(f.root.position);
      if (f.root.parent) f.root.parent.remove(f.root);
      f.root.traverse((obj) => {
        const mesh = obj as Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        if (mesh.material) (mesh.material as MeshBasicMaterial).dispose();
      });
    }
    this.failureFlags = [];
  }

  /** Test/smoke accessor: number of planted failure flags still in the scene. */
  getFailureFlagCount(): number {
    return this.failureFlags.length;
  }

  /** Test/smoke accessor: number of live particles (dust/debris/embers). */
  getParticleCount(): number {
    return this.particles.length;
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
    this.clearFailureFlags();
  }
}
