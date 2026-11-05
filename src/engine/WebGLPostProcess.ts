/**
 * WebGLPostProcess.ts — VERSE//ENGINE Film-Grade Optical Atmosphere
 *
 * Implements Apple Music & 35mm Film Title Sequence Atmosphere:
 *   1. Album art dynamic texture drawn 3x at varying scales with smooth rotation & noise
 *   2. 1.4x saturation boost, heavy blur, and cinematic vignette
 *   3. 250 soft bokeh & dust particles across 3 depth planes reacting to global energy
 *   4. Full-resolution 24fps film grain dither
 *   5. Edge-only chromatic aberration that spikes on chorus slams
 *   6. Anamorphic horizontal specular streak on the active word
 *   7. Zero independent RAF loops — driven synchronously by the master AnimationEngine loop
 */

import { PaletteColors } from '../types/lyrics';
import { AmbientLight } from './AmbientLight';

const VERT_SRC = `#version 300 es
precision highp float;

in vec2 a_position;
out vec2 v_uv;

uniform float u_lensBreath; // 1.00 .. 1.015 lens breathing on downbeats

void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position * u_lensBreath, 0.0, 1.0);
}
`;

const FRAG_SRC = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform sampler2D u_artTexture;
uniform sampler2D u_prevArtTexture;
uniform float     u_artCrossfade;      // 0..1 transition between track artworks
uniform float     u_hasArt;            // 1.0 if texture is loaded, 0.0 fallback

uniform float     u_time;              // Continuous phase
uniform float     u_grainTime;         // 24fps stepped time for grain
uniform float     u_energy;            // Global energy 0..1
uniform float     u_beatPulse;         // 0..1 beat impulse
uniform float     u_chromaticSpike;    // Spikes on chorus slam / impact
uniform float     u_streakIntensity;   // Anamorphic horizontal flare
uniform vec2      u_streakCenter;      // Screen UV of active word
uniform vec2      u_resolution;

uniform vec3      u_colorDominant;     // Atmospheric mood
uniform vec3      u_colorAccent;       // High-chroma accents
uniform vec3      u_colorShadow;       // Deep velvety background
uniform vec3      u_colorHighlight;    // Specular glow

// Saturation adjustment
vec3 adjustSaturation(vec3 color, float saturation) {
  float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
  return mix(vec3(luma), color, saturation);
}

// 24fps full-resolution grain
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec2 uv = v_uv;
  vec2 center = uv - vec2(0.5);
  float distToCenter = length(center);

  // 1. Edge-only chromatic aberration (spiking on chorus slam)
  float caAmount = (0.0018 + u_chromaticSpike * 0.008) * pow(distToCenter * 1.5, 2.2);
  vec2 caDir = distToCenter > 0.001 ? normalize(center) * caAmount : vec2(0.0);

  // 2. 3-Scale dynamic rotating album art atmosphere
  float t = u_time * 0.12;

  // Scale 1: 1.1x slow sway
  vec2 uv1 = uv + vec2(sin(t * 0.6) * 0.06, cos(t * 0.4) * 0.05);
  uv1 = (uv1 - 0.5) * 0.85 + 0.5;

  // Scale 2: 1.8x slow rotation
  float ang2 = t * 0.25;
  mat2 rot2 = mat2(cos(ang2), -sin(ang2), sin(ang2), cos(ang2));
  vec2 uv2 = rot2 * (uv - 0.5) * 1.6 + 0.5;

  // Scale 3: 2.6x translation
  vec2 uv3 = (uv - 0.5) * 2.4 + 0.5 + vec2(cos(t * 0.35) * 0.08, sin(t * 0.5) * 0.08);

  vec3 texSample = vec3(0.0);

  if (u_hasArt > 0.5) {
    // Current artwork with chromatic separation
    vec3 c1 = vec3(
      texture(u_artTexture, uv1 + caDir).r,
      texture(u_artTexture, uv1).g,
      texture(u_artTexture, uv1 - caDir).b
    );
    vec3 c2 = texture(u_artTexture, uv2).rgb;
    vec3 c3 = texture(u_artTexture, uv3).rgb;
    vec3 artBlended = c1 * 0.45 + c2 * 0.35 + c3 * 0.20;

    // Previous artwork for smooth crossfade
    if (u_artCrossfade < 1.0) {
      vec3 p1 = texture(u_prevArtTexture, uv1).rgb;
      vec3 p2 = texture(u_prevArtTexture, uv2).rgb;
      vec3 prevBlended = p1 * 0.55 + p2 * 0.45;
      artBlended = mix(prevBlended, artBlended, u_artCrossfade);
    }

    texSample = artBlended;
  } else {
    // Procedural fallback: Soft Lissajous color orbs
    vec2 orb1 = vec2(sin(t * 0.8) * 0.35 + 0.5, cos(t * 0.6) * 0.30 + 0.5);
    vec2 orb2 = vec2(cos(t * 0.7) * 0.40 + 0.5, sin(t * 0.9) * 0.35 + 0.5);
    float d1 = length(uv - orb1);
    float d2 = length(uv - orb2);
    texSample = u_colorDominant * exp(-d1 * d1 * 4.0) + u_colorAccent * exp(-d2 * d2 * 5.0);
  }

  // Saturated color grade (1.4x saturation)
  vec3 graded = adjustSaturation(texSample, 1.40);

  // Blend with rich shadow base: guarantees readability of text
  vec3 finalColor = mix(u_colorShadow, graded, 0.48 + u_energy * 0.18);
  finalColor += u_colorDominant * (0.12 + u_beatPulse * 0.06);

  // 3. Anamorphic Horizontal Specular Flare on active word
  if (u_streakIntensity > 0.01) {
    float dy = abs(uv.y - u_streakCenter.y);
    float dx = abs(uv.x - u_streakCenter.x);
    float streakY = exp(-dy * dy * 1800.0);       // Ultra-narrow vertical line
    float streakX = exp(-dx * dx * 4.0);          // Wide horizontal wings
    vec3 flareColor = mix(u_colorHighlight, u_colorAccent, 0.35);
    finalColor += flareColor * streakY * streakX * u_streakIntensity * 0.75;
  }

  // 4. Cinematic Vignette (depth focus)
  float vignette = clamp(1.0 - distToCenter * 1.15, 0.0, 1.0);
  finalColor *= mix(0.72, 1.0, vignette);

  // 5. 24fps Film Grain (full-resolution)
  vec2 grainCoord = gl_FragCoord.xy + vec2(u_grainTime * 123.45);
  float grain = (hash(grainCoord) - 0.5) * 0.022;
  finalColor += vec3(grain);

  fragColor = vec4(clamp(finalColor, 0.0, 1.0), 1.0);
}
`;

// Point particles shader for dust & bokeh
const PARTICLE_VERT = `#version 300 es
precision highp float;

in vec3 a_particle; // x, y, depth (z = 0.2..1.0)
in float a_size;
in float a_alpha;

uniform vec2 u_resolution;
uniform float u_energy;
uniform float u_beatPulse;

out float v_alpha;
out float v_depth;

void main() {
  vec2 ndc = (a_particle.xy / u_resolution) * 2.0 - 1.0;
  ndc.y = -ndc.y; // Flip Y
  gl_Position = vec4(ndc, 0.0, 1.0);

  float sizeScale = 1.0 + u_beatPulse * 0.35 + u_energy * 0.20;
  gl_PointSize = a_size * sizeScale * (a_particle.z * 1.5 + 0.5);
  v_alpha = a_alpha * (0.45 + u_energy * 0.55);
  v_depth = a_particle.z;
}
`;

const PARTICLE_FRAG = `#version 300 es
precision highp float;

in float v_alpha;
in float v_depth;
out vec4 fragColor;

uniform vec3 u_particleColor;

void main() {
  vec2 coord = gl_PointCoord - vec2(0.5);
  float dist = length(coord);
  if (dist > 0.5) discard;

  // Soft bokeh gaussian falloff
  float falloff = exp(-dist * dist * 9.0);
  fragColor = vec4(u_particleColor, v_alpha * falloff * (v_depth * 0.6 + 0.4));
}
`;

interface Particle {
  x: number;
  y: number;
  z: number; // 0.2, 0.6, 1.0 depth
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  baseAlpha: number;
}

export class WebGLPostProcess {
  private canvas: HTMLCanvasElement | null = null;
  private gl: WebGL2RenderingContext | null = null;

  // Main quad program
  private program: WebGLProgram | null = null;
  private vao: WebGLVertexArrayObject | null = null;

  // Particle program
  private particleProgram: WebGLProgram | null = null;
  private particleVao: WebGLVertexArrayObject | null = null;
  private particleBuffer: WebGLBuffer | null = null;
  private particles: Particle[] = [];
  private readonly MAX_PARTICLES: number = 240;

  // Artwork textures
  private currentArtTexture: WebGLTexture | null = null;
  private prevArtTexture: WebGLTexture | null = null;
  private artCrossfade: number = 1.0;
  private hasArt: boolean = false;
  private currentArtUrl: string = '';

  // Uniform locations
  private u_artTexture: WebGLUniformLocation | null = null;
  private u_prevArtTexture: WebGLUniformLocation | null = null;
  private u_artCrossfade: WebGLUniformLocation | null = null;
  private u_hasArt: WebGLUniformLocation | null = null;
  private u_time: WebGLUniformLocation | null = null;
  private u_grainTime: WebGLUniformLocation | null = null;
  private u_energy: WebGLUniformLocation | null = null;
  private u_beatPulse: WebGLUniformLocation | null = null;
  private u_chromaticSpike: WebGLUniformLocation | null = null;
  private u_streakIntensity: WebGLUniformLocation | null = null;
  private u_streakCenter: WebGLUniformLocation | null = null;
  private u_resolution: WebGLUniformLocation | null = null;
  private u_lensBreath: WebGLUniformLocation | null = null;
  private u_colorDominant: WebGLUniformLocation | null = null;
  private u_colorAccent: WebGLUniformLocation | null = null;
  private u_colorShadow: WebGLUniformLocation | null = null;
  private u_colorHighlight: WebGLUniformLocation | null = null;

  private u_partRes: WebGLUniformLocation | null = null;
  private u_partEnergy: WebGLUniformLocation | null = null;
  private u_partBeatPulse: WebGLUniformLocation | null = null;
  private u_particleColor: WebGLUniformLocation | null = null;

  // Dynamic parameters
  private phase: number = 0;
  private chromaticSpike: number = 0;
  private streakIntensity: number = 0;
  private streakCenter: [number, number] = [0.5, 0.5];
  private lensBreath: number = 1.0;
  private currentPalette: PaletteColors | null = null;
  private supported: boolean = false;

  // Quality governor
  private qualityDpr: number = 1.5;
  private activeParticleCount: number = 240;

  public mount(containerEl: HTMLElement): boolean {
    this.canvas = document.createElement('canvas');
    this.canvas.id = 've-bg-canvas';
    this.canvas.style.cssText = `
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 1;
      opacity: 0.95;
      transition: opacity 0.4s ease;
    `;

    if (containerEl.firstChild) {
      containerEl.insertBefore(this.canvas, containerEl.firstChild);
    } else {
      containerEl.appendChild(this.canvas);
    }

    try {
      this.gl = this.canvas.getContext('webgl2', {
        alpha: false,
        depth: false,
        stencil: false,
        antialias: false,
        powerPreference: 'high-performance'
      });

      if (!this.gl) {
        console.warn('[VerseEngine] WebGL2 not available; relying on pure CSS mode.');
        return false;
      }

      this.canvas.addEventListener('webglcontextlost', (e) => {
        e.preventDefault();
        console.warn('[VerseEngine] WebGL context lost.');
      });

      this.canvas.addEventListener('webglcontextrestored', () => {
        console.log('[VerseEngine] WebGL context restored.');
        this.initShaders();
        this.initParticles();
      });

      this.initShaders();
      this.initParticles();
      this.resize();
      window.addEventListener('resize', this.onResize);
      this.supported = true;
      return true;
    } catch (err) {
      console.warn('[VerseEngine] WebGL init failed:', err);
      return false;
    }
  }

  public unmount(): void {
    window.removeEventListener('resize', this.onResize);
    if (this.gl) {
      if (this.program) this.gl.deleteProgram(this.program);
      if (this.particleProgram) this.gl.deleteProgram(this.particleProgram);
      if (this.currentArtTexture) this.gl.deleteTexture(this.currentArtTexture);
      if (this.prevArtTexture) this.gl.deleteTexture(this.prevArtTexture);
    }
    if (this.canvas?.parentElement) {
      this.canvas.parentElement.removeChild(this.canvas);
    }
    this.canvas = null;
    this.gl = null;
  }

  private onResize = (): void => {
    this.resize();
  };

  public resize(): void {
    if (!this.canvas || !this.gl) return;
    const dpr = Math.min(window.devicePixelRatio || 1, this.qualityDpr);
    const w = Math.floor(window.innerWidth * dpr);
    const h = Math.floor(window.innerHeight * dpr);

    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.gl.viewport(0, 0, w, h);
    }
  }

  public setQualityGovernor(dprLimit: number, particleCount: number): void {
    this.qualityDpr = dprLimit;
    this.activeParticleCount = Math.min(this.MAX_PARTICLES, Math.max(0, particleCount));
    this.resize();
  }

  private initShaders(): void {
    const gl = this.gl!;

    // 1. Fullscreen Quad Shader
    const vertShader = this.compileShader(gl.VERTEX_SHADER, VERT_SRC);
    const fragShader = this.compileShader(gl.FRAGMENT_SHADER, FRAG_SRC);
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vertShader);
    gl.attachShader(prog, fragShader);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error(`Main shader link failed: ${gl.getProgramInfoLog(prog)}`);
    }
    this.program = prog;

    this.u_artTexture       = gl.getUniformLocation(prog, 'u_artTexture');
    this.u_prevArtTexture   = gl.getUniformLocation(prog, 'u_prevArtTexture');
    this.u_artCrossfade     = gl.getUniformLocation(prog, 'u_artCrossfade');
    this.u_hasArt           = gl.getUniformLocation(prog, 'u_hasArt');
    this.u_time             = gl.getUniformLocation(prog, 'u_time');
    this.u_grainTime        = gl.getUniformLocation(prog, 'u_grainTime');
    this.u_energy           = gl.getUniformLocation(prog, 'u_energy');
    this.u_beatPulse        = gl.getUniformLocation(prog, 'u_beatPulse');
    this.u_chromaticSpike   = gl.getUniformLocation(prog, 'u_chromaticSpike');
    this.u_streakIntensity  = gl.getUniformLocation(prog, 'u_streakIntensity');
    this.u_streakCenter     = gl.getUniformLocation(prog, 'u_streakCenter');
    this.u_resolution       = gl.getUniformLocation(prog, 'u_resolution');
    this.u_lensBreath       = gl.getUniformLocation(prog, 'u_lensBreath');
    this.u_colorDominant    = gl.getUniformLocation(prog, 'u_colorDominant');
    this.u_colorAccent      = gl.getUniformLocation(prog, 'u_colorAccent');
    this.u_colorShadow      = gl.getUniformLocation(prog, 'u_colorShadow');
    this.u_colorHighlight   = gl.getUniformLocation(prog, 'u_colorHighlight');

    const quadVertices = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);
    this.vao = gl.createVertexArray()!;
    gl.bindVertexArray(this.vao);
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, quadVertices, gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, 'a_position');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    // 2. Particle Shader
    const pVert = this.compileShader(gl.VERTEX_SHADER, PARTICLE_VERT);
    const pFrag = this.compileShader(gl.FRAGMENT_SHADER, PARTICLE_FRAG);
    const pProg = gl.createProgram()!;
    gl.attachShader(pProg, pVert);
    gl.attachShader(pProg, pFrag);
    gl.linkProgram(pProg);
    if (!gl.getProgramParameter(pProg, gl.LINK_STATUS)) {
      throw new Error(`Particle shader link failed: ${gl.getProgramInfoLog(pProg)}`);
    }
    this.particleProgram = pProg;

    this.u_partRes       = gl.getUniformLocation(pProg, 'u_resolution');
    this.u_partEnergy    = gl.getUniformLocation(pProg, 'u_energy');
    this.u_partBeatPulse = gl.getUniformLocation(pProg, 'u_beatPulse');
    this.u_particleColor = gl.getUniformLocation(pProg, 'u_particleColor');

    this.particleVao = gl.createVertexArray()!;
    gl.bindVertexArray(this.particleVao);
    this.particleBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.particleBuffer);

    // Stride: 5 floats per particle (x, y, z, size, alpha)
    const stride = 5 * Float32Array.BYTES_PER_ELEMENT;
    const aParticle = gl.getAttribLocation(pProg, 'a_particle');
    const aSize = gl.getAttribLocation(pProg, 'a_size');
    const aAlpha = gl.getAttribLocation(pProg, 'a_alpha');

    gl.enableVertexAttribArray(aParticle);
    gl.vertexAttribPointer(aParticle, 3, gl.FLOAT, false, stride, 0);

    gl.enableVertexAttribArray(aSize);
    gl.vertexAttribPointer(aSize, 1, gl.FLOAT, false, stride, 3 * Float32Array.BYTES_PER_ELEMENT);

    gl.enableVertexAttribArray(aAlpha);
    gl.vertexAttribPointer(aAlpha, 1, gl.FLOAT, false, stride, 4 * Float32Array.BYTES_PER_ELEMENT);

    gl.bindVertexArray(null);
  }

  private initParticles(): void {
    this.particles = [];
    const w = window.innerWidth || 1920;
    const h = window.innerHeight || 1080;

    for (let i = 0; i < this.MAX_PARTICLES; i++) {
      // 3 Depth planes: 0.2 (distant dust), 0.6 (mid-ground bokeh), 1.0 (foreground orb)
      const depthTier = i % 3 === 0 ? 1.0 : i % 3 === 1 ? 0.6 : 0.2;
      const baseSize = depthTier === 1.0 ? 16 + Math.random() * 24 : depthTier === 0.6 ? 8 + Math.random() * 12 : 3 + Math.random() * 4;

      this.particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        z: depthTier,
        vx: (Math.random() - 0.5) * (depthTier * 22 + 8),
        vy: -Math.random() * (depthTier * 18 + 6), // Upward ambient float
        size: baseSize,
        alpha: Math.random() * 0.4 + 0.1,
        baseAlpha: Math.random() * 0.35 + 0.15
      });
    }
  }

  private compileShader(type: number, src: string): WebGLShader {
    const gl = this.gl!;
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const err = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(`Shader compilation error: ${err}`);
    }
    return shader;
  }

  /**
   * Loads album artwork into a WebGL texture with smooth crossfade
   */
  public async loadAlbumTexture(rawUrl: string): Promise<void> {
    const url = AmbientLight.resolveImageUrl(rawUrl);
    if (!url || url === this.currentArtUrl || !this.gl) return;

    this.currentArtUrl = url;

    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        if (!this.gl) return resolve();
        const gl = this.gl;

        // Shift previous texture to prevArtTexture slot for 1.2s crossfade
        if (this.prevArtTexture) {
          gl.deleteTexture(this.prevArtTexture);
        }
        this.prevArtTexture = this.currentArtTexture;
        this.artCrossfade = 0.0;

        const tex = gl.createTexture()!;
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

        this.currentArtTexture = tex;
        this.hasArt = true;
        resolve();
      };
      img.onerror = () => {
        this.hasArt = false;
        resolve();
      };
      img.src = url;
    });
  }

  public setPalette(palette: PaletteColors): void {
    this.currentPalette = palette;
    if (this.canvas) {
      this.canvas.style.opacity = palette.isDark ? '0.95' : '0.0';
    }
  }

  public triggerChorusSlam(): void {
    this.chromaticSpike = 1.0;
  }

  public triggerParticleBurst(): void {
    // Scatter particles outward radially from screen center
    const cx = (this.canvas?.width || 1920) * 0.5;
    const cy = (this.canvas?.height || 1080) * 0.5;
    for (const p of this.particles) {
      const dx = p.x - cx;
      const dy = p.y - cy;
      const len = Math.max(1, Math.sqrt(dx * dx + dy * dy));
      p.vx += (dx / len) * (180 + Math.random() * 120);
      p.vy += (dy / len) * (180 + Math.random() * 120);
      p.alpha = Math.min(1.0, p.baseAlpha * 2.5);
    }
  }

  public setSpecularStreak(intensity: number, screenUvX: number, screenUvY: number): void {
    this.streakIntensity = Math.max(0, Math.min(1.0, intensity));
    this.streakCenter = [screenUvX, screenUvY];
  }

  /**
   * MASTER SHARED RAF TICK: Called directly by AnimationEngine in the unified frame loop.
   */
  public render(
    dt: number,
    energy: number,
    beatPulse: number,
    isDownbeat: boolean
  ): void {
    if (!this.gl || !this.program || !this.canvas || !this.supported) return;

    // Skip drawing if light theme is active
    if (this.currentPalette && !this.currentPalette.isDark) {
      return;
    }

    const gl = this.gl;
    this.phase += dt * (0.8 + energy * 0.6);
    this.chromaticSpike = Math.max(0, this.chromaticSpike - dt * 2.8);
    this.streakIntensity = Math.max(0, this.streakIntensity - dt * 2.5);

    // Subtle lens breathing on bar downbeats (1.00 .. 1.015)
    const targetLens = isDownbeat ? 1.014 : 1.000;
    this.lensBreath += (targetLens - this.lensBreath) * Math.min(1.0, dt * 8);

    if (this.artCrossfade < 1.0) {
      this.artCrossfade = Math.min(1.0, this.artCrossfade + dt / 1.2);
    }

    // ── 1. Render Fullscreen Atmosphere Quad ──────────────────────────────────
    gl.useProgram(this.program);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.currentArtTexture);
    gl.uniform1i(this.u_artTexture, 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.prevArtTexture);
    gl.uniform1i(this.u_prevArtTexture, 1);

    gl.uniform1f(this.u_artCrossfade, this.artCrossfade);
    gl.uniform1f(this.u_hasArt, this.hasArt ? 1.0 : 0.0);

    gl.uniform1f(this.u_time, this.phase);
    // 24fps stepped grain
    gl.uniform1f(this.u_grainTime, Math.floor(this.phase * 24.0) / 24.0);
    gl.uniform1f(this.u_energy, energy);
    gl.uniform1f(this.u_beatPulse, beatPulse);
    gl.uniform1f(this.u_chromaticSpike, this.chromaticSpike);
    gl.uniform1f(this.u_streakIntensity, this.streakIntensity);
    gl.uniform2f(this.u_streakCenter, this.streakCenter[0], this.streakCenter[1]);
    gl.uniform2f(this.u_resolution, this.canvas.width, this.canvas.height);
    gl.uniform1f(this.u_lensBreath, this.lensBreath);

    const pal = this.currentPalette;
    const dom = pal?.rgbDominant || [0.45, 0.12, 0.18];
    const acc = pal?.rgbAccent || [0.85, 0.22, 0.30];
    const sha = pal?.rgbShadow || [0.06, 0.04, 0.05];
    const hig = pal?.rgbHighlight || [0.98, 0.98, 0.96];

    gl.uniform3f(this.u_colorDominant, dom[0], dom[1], dom[2]);
    gl.uniform3f(this.u_colorAccent, acc[0], acc[1], acc[2]);
    gl.uniform3f(this.u_colorShadow, sha[0], sha[1], sha[2]);
    gl.uniform3f(this.u_colorHighlight, hig[0], hig[1], hig[2]);

    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.bindVertexArray(null);

    // ── 2. Render Soft Bokeh & Dust Particles ─────────────────────────────────
    if (this.activeParticleCount > 0 && this.particleProgram && this.particleVao) {
      this.updateAndDrawParticles(dt, energy, beatPulse, acc);
    }
  }

  private updateAndDrawParticles(
    dt: number,
    energy: number,
    beatPulse: number,
    colorAccent: [number, number, number]
  ): void {
    const gl = this.gl!;
    const w = this.canvas!.width;
    const h = this.canvas!.height;
    const count = this.activeParticleCount;

    const data = new Float32Array(count * 5);

    for (let i = 0; i < count; i++) {
      const p = this.particles[i];

      // Update particle physics with velocity damping
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Damp burst velocity back to ambient float
      p.vx *= Math.pow(0.92, dt * 60);
      p.vy = p.vy * Math.pow(0.92, dt * 60) - (p.z * 16 + 8) * (1 - Math.pow(0.92, dt * 60));
      p.alpha += (p.baseAlpha - p.alpha) * Math.min(1.0, dt * 2);

      // Screen wrap
      if (p.x < -40) p.x = w + 40;
      if (p.x > w + 40) p.x = -40;
      if (p.y < -40) p.y = h + 40;
      if (p.y > h + 40) p.y = -40;

      const idx = i * 5;
      data[idx]     = p.x;
      data[idx + 1] = p.y;
      data[idx + 2] = p.z;
      data[idx + 3] = p.size;
      data[idx + 4] = p.alpha;
    }

    gl.useProgram(this.particleProgram);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE); // Additive luminous bokeh glow

    gl.uniform2f(this.u_partRes, w, h);
    gl.uniform1f(this.u_partEnergy, energy);
    gl.uniform1f(this.u_partBeatPulse, beatPulse);
    gl.uniform3f(this.u_particleColor, colorAccent[0], colorAccent[1], colorAccent[2]);

    gl.bindVertexArray(this.particleVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.particleBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);

    gl.drawArrays(gl.POINTS, 0, count);

    gl.disable(gl.BLEND);
    gl.bindVertexArray(null);
  }
}
