import {
  MeshToonMaterial,
  CanvasTexture,
  Color,
  Vector3,
  NearestFilter,
  RepeatWrapping,
  ShaderMaterial,
  type IUniform
} from 'three';
import { GAME_CONFIG } from '../config/GameConfig';

/**
 * Faithful port of the original halftone-toon material setup.
 *
 * Original: MeshToonMaterial + onBeforeCompile patch injecting tri-planar
 * halftone dots and an NdotL shadow mask at #include <dithering_fragment>.
 * Shared uniforms object (Cn) means one call updates every material.
 */

// Shared uniforms — mirrors `Cn` in the original.
export interface HalftoneUniforms {
  uHalftone: IUniform;
  uDotsScale: IUniform;
  uDotsStrength: IUniform;
  uDotsShadowMin: IUniform;
  uDotsShadowMax: IUniform;
  uLightDir: IUniform;
}

function createHalftoneTexture(): CanvasTexture {
  // mirrors kM(r=4, t=14): 128x128 black, white dots radius 4 on 14px grid
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = '#ffffff';
  const r = 4;
  const t = 14;
  for (let y = t / 2; y < 128; y += t) {
    for (let x = t / 2; x < 128; x += t) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const tex = new CanvasTexture(canvas);
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  return tex;
}

function createGradientMap(): CanvasTexture {
  // mirrors VM(): 4x1 toon ramp #404040 #909090 #d0d0d0 #ffffff
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 1;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#404040';
  ctx.fillRect(0, 0, 1, 1);
  ctx.fillStyle = '#909090';
  ctx.fillRect(1, 0, 1, 1);
  ctx.fillStyle = '#d0d0d0';
  ctx.fillRect(2, 0, 1, 1);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(3, 0, 1, 1);
  const tex = new CanvasTexture(canvas);
  tex.minFilter = NearestFilter;
  tex.magFilter = NearestFilter;
  return tex;
}

export class MaterialFactory {
  private static halftoneTex: CanvasTexture;
  private static gradientMap: CanvasTexture;
  private static uniforms: HalftoneUniforms;

  static init(): void {
    this.halftoneTex = createHalftoneTexture();
    this.gradientMap = createGradientMap();
    this.uniforms = {
      uHalftone: { value: this.halftoneTex },
      uDotsScale: { value: GAME_CONFIG.DOTS_SCALE },
      uDotsStrength: { value: GAME_CONFIG.DOTS_STRENGTH },
      uDotsShadowMin: { value: GAME_CONFIG.DOTS_SHADOW_MIN },
      uDotsShadowMax: { value: GAME_CONFIG.DOTS_SHADOW_MAX },
      uLightDir: { value: new Vector3(3, 10, 8).normalize() }
    };
  }

  /** Mirror HM(r): refresh uniform values (optionally from a light position). */
  static updateLightDirection(light?: { position: Vector3 }): void {
    const u = this.uniforms;
    u.uDotsScale.value = GAME_CONFIG.DOTS_SCALE;
    u.uDotsStrength.value = GAME_CONFIG.DOTS_STRENGTH;
    u.uDotsShadowMin.value = GAME_CONFIG.DOTS_SHADOW_MIN;
    u.uDotsShadowMax.value = GAME_CONFIG.DOTS_SHADOW_MAX;
    if (light) u.uLightDir.value.copy(light.position).normalize();
  }

  /** Mirror Fd(color, opts): halftone-toon MeshToonMaterial. */
  static createMaterial(color: number | Color, opts: Record<string, unknown> = {}): MeshToonMaterial {
    const mat = new MeshToonMaterial({ color: new Color(color), gradientMap: this.gradientMap, ...opts });
    mat.customProgramCacheKey = () => 'halftone-toon';
    mat.onBeforeCompile = (shader: ShaderMaterial) => {
      shader.uniforms.uHalftone = this.uniforms.uHalftone;
      shader.uniforms.uDotsScale = this.uniforms.uDotsScale;
      shader.uniforms.uDotsStrength = this.uniforms.uDotsStrength;
      shader.uniforms.uDotsShadowMin = this.uniforms.uDotsShadowMin;
      shader.uniforms.uDotsShadowMax = this.uniforms.uDotsShadowMax;
      shader.uniforms.uLightDir = this.uniforms.uLightDir;

      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        `#include <common>
        varying vec3 vWorldPos;
        varying vec3 vWorldNormal;`
      );

      shader.vertexShader = shader.vertexShader.replace(
        '#include <fog_vertex>',
        `#include <fog_vertex>
        vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * objectNormal);`
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        `#include <common>
        uniform sampler2D uHalftone;
        uniform float uDotsScale;
        uniform float uDotsStrength;
        uniform float uDotsShadowMin;
        uniform float uDotsShadowMax;
        uniform vec3 uLightDir;
        varying vec3 vWorldPos;
        varying vec3 vWorldNormal;`
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <dithering_fragment>',
        `
        // Tri-planar blending weights from world normal
        vec3 blend = abs(vWorldNormal);
        blend = blend / (blend.x + blend.y + blend.z + 0.001);

        // Sample halftone from each projection plane
        float dotsXZ = texture2D(uHalftone, vWorldPos.xz * uDotsScale).r;
        float dotsXY = texture2D(uHalftone, vWorldPos.xy * uDotsScale).r;
        float dotsYZ = texture2D(uHalftone, vWorldPos.yz * uDotsScale).r;

        // Blend based on which face we're on
        float dots = dotsXZ * blend.y + dotsXY * blend.z + dotsYZ * blend.x;

        // Color-independent shadow detection using NdotL
        float NdotL = dot(normalize(vWorldNormal), uLightDir);
        float shadowMask = smoothstep(uDotsShadowMax, uDotsShadowMin, NdotL * 0.5 + 0.5);

        // Subtle dark dots in shadow areas only
        if (shadowMask > 0.01) {
          gl_FragColor.rgb = mix(
            gl_FragColor.rgb,
            gl_FragColor.rgb * 0.55,
            dots * shadowMask * uDotsStrength
          );
        }
        #include <dithering_fragment>`
      );
    };
    return mat;
  }

  static dispose(): void {
    this.halftoneTex?.dispose();
    this.gradientMap?.dispose();
  }
}
