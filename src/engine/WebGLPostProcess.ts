/**
 * WebGLPostProcess.ts — VERSE//ENGINE Ethereal Liquid Aurora Mesh Background
 *
 * Implements Apple Music & Verci-grade out-of-focus ambient aurora:
 *   1. Monotonic CPU phase accumulation (ZERO jumping/teleporting on vocal swells)
 *   2. Soft Gaussian color orbs orbiting on smooth Lissajous curves
 *   3. Editorial mode light-theme bypass (warm cream #FAF9F6 never obscured)
 *   4. Native resolution 35mm dither to eliminate 8-bit gradient banding
 *   5. Full lifecycle handling (context loss, resize, visibility changes)
 */

import { PaletteColors } from '../types/lyrics';

const VERT_SRC = `#version 300 es
precision highp float;

in vec2 a_position;
out vec2 v_uv;

void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

const FRAG_SRC = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform float u_time;             // Monotonic accumulated phase from CPU
uniform float u_vocalIntensity;
uniform vec2  u_resolution;
uniform vec3  u_color1;           // Album primary (vibrant)
uniform vec3  u_color2;           // Album secondary (contrasting tone)
uniform vec3  u_color3;           // Highlight accent
uniform vec3  u_color4;           // Deep base atmospheric tone

// Fine 35mm film grain dither to eliminate color banding
float dither(vec2 uv) {
  return fract(sin(dot(uv, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec2 uv = v_uv;
  // Center-normalized coordinates [-1, 1], aspect-ratio corrected
  vec2 p = (gl_FragCoord.xy * 2.0 - u_resolution) / min(u_resolution.x, u_resolution.y);

  float t = u_time;

  // 4 large, soft, luminous color orbs orbiting on smooth Lissajous curves
  vec2 c1 = vec2(sin(t * 0.70) * 0.55, cos(t * 0.50) * 0.45);
  vec2 c2 = vec2(cos(t * 0.60 + 1.8) * 0.65, sin(t * 0.80 + 0.5) * 0.50);
  vec2 c3 = vec2(sin(t * 0.45 + 3.2) * 0.50, cos(t * 0.70 + 2.1) * 0.60);
  vec2 c4 = vec2(cos(t * 0.55 + 4.5) * 0.60, sin(t * 0.65 + 3.8) * 0.45);

  // Gentle wave distortion (very low frequency: wavelength is screen-sized)
  vec2 pWarp = p + vec2(
    sin(p.y * 1.2 + t * 0.5) * 0.10,
    cos(p.x * 1.2 + t * 0.4) * 0.10
  );

  // Soft Gaussian falloffs (massive radii: sigma ~ 0.8 to 1.2)
  float d1 = length(pWarp - c1);
  float d2 = length(pWarp - c2);
  float d3 = length(pWarp - c3);
  float d4 = length(pWarp - c4);

  float w1 = exp(-d1 * d1 * 1.1);
  float w2 = exp(-d2 * d2 * 1.2);
  float w3 = exp(-d3 * d3 * 1.4);
  float w4 = exp(-d4 * d4 * 1.0);

  // Deep atmospheric base from album palette
  vec3 base = u_color4;

  // Add warm, soft, out-of-focus luminous pools of color
  vec3 col = base;
  col += u_color1 * (w1 * 0.52 + u_vocalIntensity * 0.14);
  col += u_color2 * (w2 * 0.42);
  col += u_color3 * (w3 * 0.22);
  col += u_color1 * (w4 * 0.34);

  // Natural vignette to draw focus to center lyrics
  vec2 center = uv - 0.5;
  float vig = clamp(1.0 - dot(center, center) * 1.15, 0.0, 1.0);
  col *= (0.75 + 0.25 * vig);

  // Native resolution 35mm film grain dither
  col += (dither(gl_FragCoord.xy) - 0.5) * 0.018;

  fragColor = vec4(col, 1.0);
}`;

export class WebGLPostProcess {
  private canvas: HTMLCanvasElement | null = null;
  private gl: WebGL2RenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private rafId: number | null = null;
  private lastTime: number = performance.now();
  private phase: number = 0; // Monotonic accumulated phase

  // Uniform locations
  private u_time: WebGLUniformLocation | null = null;
  private u_vocalIntensity: WebGLUniformLocation | null = null;
  private u_resolution: WebGLUniformLocation | null = null;
  private u_color1: WebGLUniformLocation | null = null;
  private u_color2: WebGLUniformLocation | null = null;
  private u_color3: WebGLUniformLocation | null = null;
  private u_color4: WebGLUniformLocation | null = null;

  private vocalIntensity: number = 0;
  private targetVocalIntensity: number = 0;
  private supported: boolean = false;
  private currentPalette: PaletteColors | null = null;

  // Cached color vectors [r, g, b] in 0..1
  private c1: [number, number, number] = [0.35, 0.08, 0.12];
  private c2: [number, number, number] = [0.65, 0.15, 0.22];
  private c3: [number, number, number] = [0.95, 0.35, 0.42];
  private c4: [number, number, number] = [0.06, 0.04, 0.05];

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

    // Prepend so canvas sits behind all text layers
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
        console.warn('[VerseEngine] WebGL2 not available, falling back to CSS.');
        return false;
      }

      this.canvas.addEventListener('webglcontextlost', (e) => {
        e.preventDefault();
        this.stop();
        console.warn('[VerseEngine] WebGL context lost.');
      });

      this.canvas.addEventListener('webglcontextrestored', () => {
        console.log('[VerseEngine] WebGL context restored.');
        this.initShaders();
        this.start();
      });

      this.initShaders();
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
    this.stop();
    window.removeEventListener('resize', this.onResize);

    if (this.gl && this.program) {
      this.gl.deleteProgram(this.program);
    }
    if (this.canvas?.parentElement) {
      this.canvas.parentElement.removeChild(this.canvas);
    }
    this.canvas = null;
    this.gl = null;
    this.program = null;
  }

  private onResize = (): void => {
    this.resize();
  };

  private resize(): void {
    if (!this.canvas || !this.gl) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2.0);
    const w = Math.floor(window.innerWidth * dpr);
    const h = Math.floor(window.innerHeight * dpr);

    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.gl.viewport(0, 0, w, h);
    }
  }

  private initShaders(): void {
    const gl = this.gl!;

    const vertShader = this.compileShader(gl.VERTEX_SHADER, VERT_SRC);
    const fragShader = this.compileShader(gl.FRAGMENT_SHADER, FRAG_SRC);

    const prog = gl.createProgram()!;
    gl.attachShader(prog, vertShader);
    gl.attachShader(prog, fragShader);
    gl.linkProgram(prog);

    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error(`Shader program link failed: ${gl.getProgramInfoLog(prog)}`);
    }

    this.program = prog;

    this.u_time           = gl.getUniformLocation(prog, 'u_time');
    this.u_vocalIntensity = gl.getUniformLocation(prog, 'u_vocalIntensity');
    this.u_resolution     = gl.getUniformLocation(prog, 'u_resolution');
    this.u_color1         = gl.getUniformLocation(prog, 'u_color1');
    this.u_color2         = gl.getUniformLocation(prog, 'u_color2');
    this.u_color3         = gl.getUniformLocation(prog, 'u_color3');
    this.u_color4         = gl.getUniformLocation(prog, 'u_color4');

    const quadVertices = new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
      -1,  1,
       1, -1,
       1,  1
    ]);

    this.vao = gl.createVertexArray()!;
    gl.bindVertexArray(this.vao);

    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, quadVertices, gl.STATIC_DRAW);

    const aPos = gl.getAttribLocation(prog, 'a_position');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    gl.bindVertexArray(null);
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

  public setPalette(palette: PaletteColors): void {
    this.currentPalette = palette;

    // For light palettes (Editorial bone & maroon), hide the dark WebGL canvas
    if (this.canvas) {
      this.canvas.style.opacity = palette.isDark ? '0.95' : '0.0';
    }

    const parseRgb = (c: string): [number, number, number] => {
      const rgb = c.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
      if (rgb) {
        return [parseInt(rgb[1], 10) / 255, parseInt(rgb[2], 10) / 255, parseInt(rgb[3], 10) / 255];
      }
      const hex = c.match(/^#([0-9a-fA-F]{3,8})$/);
      if (hex) {
        let h = hex[1];
        if (h.length === 3) h = h.split('').map(x => x + x).join('');
        return [
          parseInt(h.substring(0, 2), 16) / 255,
          parseInt(h.substring(2, 4), 16) / 255,
          parseInt(h.substring(4, 6), 16) / 255
        ];
      }
      return [0.2, 0.05, 0.08];
    };

    this.c1 = parseRgb(palette.primary);
    this.c2 = parseRgb(palette.secondary);
    this.c3 = parseRgb(palette.highlight);
    this.c4 = parseRgb(palette.bg);
  }

  public updateVocalIntensity(intensity: number): void {
    this.targetVocalIntensity = Math.max(0, Math.min(1, intensity));
  }

  public start(): void {
    if (!this.supported || this.rafId !== null) return;
    this.lastTime = performance.now();

    const render = (now: number) => {
      if (!this.gl || !this.program || !this.canvas) return;

      const rawDt = (now - this.lastTime) / 1000;
      const dt = Math.max(0.001, Math.min(rawDt, 0.05));
      this.lastTime = now;

      // Skip GPU draw if canvas is hidden in light mode
      if (this.currentPalette && !this.currentPalette.isDark) {
        this.rafId = requestAnimationFrame(render);
        return;
      }

      // Smooth vocal energy transition
      this.vocalIntensity += (this.targetVocalIntensity - this.vocalIntensity) * 0.08;

      // MONOTONIC PHASE ACCUMULATION: avoids any jumping when vocal intensity changes
      this.phase += dt * (0.12 + this.vocalIntensity * 0.06);

      const gl = this.gl;
      gl.useProgram(this.program);

      gl.uniform1f(this.u_time, this.phase);
      gl.uniform1f(this.u_vocalIntensity, this.vocalIntensity);
      gl.uniform2f(this.u_resolution, this.canvas.width, this.canvas.height);

      gl.uniform3f(this.u_color1, this.c1[0], this.c1[1], this.c1[2]);
      gl.uniform3f(this.u_color2, this.c2[0], this.c2[1], this.c2[2]);
      gl.uniform3f(this.u_color3, this.c3[0], this.c3[1], this.c3[2]);
      gl.uniform3f(this.u_color4, this.c4[0], this.c4[1], this.c4[2]);

      gl.bindVertexArray(this.vao);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.bindVertexArray(null);

      this.rafId = requestAnimationFrame(render);
    };

    this.rafId = requestAnimationFrame(render);
  }

  public stop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }
}
