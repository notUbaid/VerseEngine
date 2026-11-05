/**
 * AnimationEngine.ts — VERSE//ENGINE High-Performance 144Hz RAF Motion Core
 *
 * IRON LAWS:
 *   1. ZERO React `setState` or `useState` inside this file.
 *   2. All per-frame mutations happen via direct HTMLElement transforms and CSS variables.
 *   3. Continuous active-line vertical tracking via damped harmonic spring solver.
 *   4. Continuous floating-point focal tracking for Verci Fisheye and Ship drift camera.
 *   5. Sub-pixel letter-by-letter liquid gradient sweep with organic physics.
 */

import {
  ProcessedTrack,
  LyricLine,
  LyricWord,
  LyricChar,
  VisualStyle,
  PaletteColors
} from '../types/lyrics';
import { Clock } from './Clock';
import { HarmonicSpring, SpringVector2 } from './SpringSolver';
import { WebGLPostProcess } from './WebGLPostProcess';

// ─── Cached Ref Interfaces ────────────────────────────────────────────────────

export interface CachedCharRef {
  el: HTMLElement;
  char: LyricChar;
  springY: HarmonicSpring;         // vertical offset spring (-4px -> 0px)
  springScale: HarmonicSpring;     // scale spring (1.0 -> 1.08 -> 1.0)
  springProgress: HarmonicSpring;  // fill sweep 0.0 -> 1.0 for gradient --char-p
  springGlow: HarmonicSpring;      // bloom intensity 0.0 -> 1.0 for --char-glow
  shearTopEl?: HTMLElement;        // FRACTURE top clip-path layer
  shearBottomEl?: HTMLElement;     // FRACTURE bottom clip-path layer
}

export interface CachedWordRef {
  el: HTMLElement;
  word: LyricWord;
  lineIndex: number;
  wordIndex: number;
  chars: CachedCharRef[];
  springZ: HarmonicSpring;         // depth (translateZ)
  springBlur: HarmonicSpring;      // DOF blur
  springScale: HarmonicSpring;     // word-level scale spring
  springGravityY: HarmonicSpring;  // GRAVITY semantic
  echoClones?: HTMLElement[];      // ECHO wireframe clone ghosts
  cachedOffsetLeft?: number;
  cachedWidth?: number;
}

export interface CachedLineRef {
  el: HTMLElement;
  line: LyricLine;
  words: CachedWordRef[];
  adLibs: CachedWordRef[];
  cachedOffsetTop?: number;
  cachedOffsetLeft?: number;
}

export class AnimationEngine {
  private clock: Clock;
  private rafId: number | null = null;
  private lastTime: number = performance.now();

  // Bound DOM refs (cached, never queried inside tick)
  private stageEl: HTMLElement | null = null;
  private cameraEl: HTMLElement | null = null;
  private ambientRimEl: HTMLElement | null = null;
  private lyricsContainerEl: HTMLElement | null = null;
  private webgl: WebGLPostProcess | null = null;

  private cachedLines: CachedLineRef[] = [];
  private activeWordRef: CachedWordRef | null = null;
  private currentActiveLineIdx: number = 0;
  private isInitialPositionSet: boolean = false;

  // Vertical stage spring for butter-smooth active line centering
  private stageYSpring: HarmonicSpring = new HarmonicSpring(0, 110, 19);

  // Horizontal camera spring for drift wall style
  private cameraSpring: SpringVector2 = new SpringVector2(0, 0, 95, 18);

  // Ambient Rim Breathing
  private rimOpacitySpring: HarmonicSpring = new HarmonicSpring(0.45, 60, 14);
  private rimRadiusSpring: HarmonicSpring = new HarmonicSpring(110, 55, 12);

  private currentStyle: VisualStyle = 'convex';
  private currentPalette: PaletteColors | null = null;
  private rimEnabled: boolean = true;

  constructor() {
    this.clock = Clock.getInstance();
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', () => this.measureOffsets());
    }
  }

  public bindWebgl(webgl: WebGLPostProcess): void {
    this.webgl = webgl;
  }

  public bindElements(
    stageEl: HTMLElement,
    cameraEl: HTMLElement,
    ambientRimEl: HTMLElement,
    lyricsContainerEl: HTMLElement,
    cachedLines: CachedLineRef[]
  ): void {
    this.stageEl = stageEl;
    this.cameraEl = cameraEl;
    this.ambientRimEl = ambientRimEl;
    this.lyricsContainerEl = lyricsContainerEl;
    this.cachedLines = cachedLines;
    this.activeWordRef = null;
    this.currentActiveLineIdx = 0;
    this.isInitialPositionSet = false;

    this.measureOffsets();

    // Reset springs
    this.stageYSpring.reset(0, 0);
    this.cameraSpring.reset(0, 0);
  }

  public measureOffsets(): void {
    if (!this.cachedLines) return;
    for (let i = 0; i < this.cachedLines.length; i++) {
      const lineRef = this.cachedLines[i];
      lineRef.cachedOffsetTop = lineRef.el.offsetTop;
      lineRef.cachedOffsetLeft = lineRef.el.offsetLeft;
      for (let w = 0; w < lineRef.words.length; w++) {
        const wordRef = lineRef.words[w];
        wordRef.cachedOffsetLeft = wordRef.el.offsetLeft;
        wordRef.cachedWidth = wordRef.el.offsetWidth;
      }
    }
  }

  public setStyle(style: VisualStyle): void {
    this.currentStyle = style;
    this.cameraSpring.reset(0, 0);
    this.stageYSpring.reset(0, 0);
    this.isInitialPositionSet = false;
    if (this.lyricsContainerEl) {
      this.lyricsContainerEl.className = `ve-lyrics-container ve-style-${style}`;
    }
    if (typeof window !== 'undefined') {
      requestAnimationFrame(() => {
        this.measureOffsets();
      });
    }
  }

  public setPalette(palette: PaletteColors): void {
    this.currentPalette = palette;
    if (this.webgl) {
      this.webgl.setPalette(palette);
    }
  }

  public setRimEnabled(enabled: boolean): void {
    this.rimEnabled = enabled;
    if (this.ambientRimEl) {
      this.ambientRimEl.style.display = enabled ? 'block' : 'none';
    }
  }

  public start(): void {
    if (this.rafId !== null) return;
    this.lastTime = performance.now();

    const loop = (time: number) => {
      const rawDt = (time - this.lastTime) / 1000;
      const dt = Math.max(0.001, Math.min(rawDt, 0.05)); // clamp 1ms–50ms
      this.lastTime = time;
      this.tick(dt);
      this.rafId = requestAnimationFrame(loop);
    };

    this.rafId = requestAnimationFrame(loop);
  }

  public stop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  /**
   * PURE 144Hz RAF TICK: Direct DOM mutations on cached refs.
   */
  private tick(dt: number): void {
    if (!this.cachedLines || this.cachedLines.length === 0) return;

    const currentMs = this.clock.tick();
    let anyVocalActive = false;
    let targetLineIdx = -1;
    let currentActiveWord: CachedWordRef | null = null;

    // ── 1. Find the currently active or upcoming line ─────────────────────────
    for (let lIdx = 0; lIdx < this.cachedLines.length; lIdx++) {
      const line = this.cachedLines[lIdx].line;
      if (currentMs >= line.startMs && currentMs <= line.endMs) {
        targetLineIdx = lIdx;
        anyVocalActive = true;
        break;
      }
    }

    // If between lines, find upcoming or recent line
    if (targetLineIdx === -1) {
      for (let lIdx = 0; lIdx < this.cachedLines.length; lIdx++) {
        const line = this.cachedLines[lIdx].line;
        if (line.startMs > currentMs) {
          targetLineIdx = Math.max(0, lIdx > 0 && currentMs - this.cachedLines[lIdx - 1].line.endMs < 2500 ? lIdx - 1 : lIdx);
          break;
        }
      }
      if (targetLineIdx === -1) {
        targetLineIdx = this.cachedLines.length - 1;
      }
    }

    this.currentActiveLineIdx = targetLineIdx;

    // Drive liquid WebGL shader with vocal activity
    if (this.webgl) {
      this.webgl.updateVocalIntensity(anyVocalActive ? 0.85 : 0.15);
    }

    // ── 2. Active line vertical centering spring ──────────────────────────────
    if (this.lyricsContainerEl && this.cachedLines[targetLineIdx]) {
      const activeLineRef = this.cachedLines[targetLineIdx];
      const offsetTop = activeLineRef.cachedOffsetTop ?? activeLineRef.el.offsetTop;
      const targetStageY = -offsetTop + window.innerHeight * 0.40;

      if (!this.isInitialPositionSet) {
        this.stageYSpring.reset(targetStageY, 0);
        this.isInitialPositionSet = true;
      } else {
        this.stageYSpring.setTarget(targetStageY);
      }

      const curStageY = this.stageYSpring.step(dt);
      this.lyricsContainerEl.style.transform = `translate3d(0, ${curStageY.toFixed(1)}px, 0)`;
    }

    // ── 3. Line-level depth, opacity cascade, and word/char springs ───────────
    for (let lIdx = 0; lIdx < this.cachedLines.length; lIdx++) {
      const lineRef = this.cachedLines[lIdx];
      const lineDist = lIdx - targetLineIdx;
      const absDist = Math.abs(lineDist);

      // Visibility culling (cull lines beyond ±5)
      if (absDist > 5) {
        lineRef.el.style.visibility = 'hidden';
        continue;
      }
      lineRef.el.style.visibility = 'visible';

      // Find active word in this line if lineDist === 0
      let activeWordIdxInLine = -1;
      if (lineDist === 0) {
        for (let w = 0; w < lineRef.words.length; w++) {
          const word = lineRef.words[w].word;
          if (currentMs >= word.startMs && currentMs <= word.endMs) {
            activeWordIdxInLine = w;
            break;
          }
        }
        if (activeWordIdxInLine === -1) {
          for (let w = 0; w < lineRef.words.length; w++) {
            if (lineRef.words[w].word.startMs > currentMs) {
              activeWordIdxInLine = Math.max(0, w - 1);
              break;
            }
          }
          if (activeWordIdxInLine === -1) {
            activeWordIdxInLine = lineRef.words.length - 1;
          }
        }
      }

      // Compute continuous floating-point focal cursor for the active line
      let focalPos = 0;
      if (lineDist === 0 && lineRef.words.length > 0) {
        const curWordRef = lineRef.words[activeWordIdxInLine];
        const curWord = curWordRef?.word;
        const wordProg = curWord
          ? Math.max(0, Math.min(1, (currentMs - curWord.startMs) / Math.max(1, curWord.durationMs)))
          : 0;
        focalPos = activeWordIdxInLine + wordProg;
      }

      // Line distance cascade styling per theme
      if (this.currentStyle === 'convex') {
        if (lineDist === 0) {
          lineRef.el.style.transform = 'translateZ(40px) scale(1.04)';
          lineRef.el.style.opacity = '1.0';
          lineRef.el.style.filter = 'none';
        } else {
          const curveDeg = lineDist < 0 ? -18 : 18;
          const targetZ = -70 - absDist * 40;
          lineRef.el.style.transform = `translateZ(${targetZ}px) rotateX(${curveDeg}deg) scale(${Math.max(0.75, 0.95 - absDist * 0.08)})`;
          lineRef.el.style.opacity = `${Math.max(0.04, 0.35 / absDist).toFixed(2)}`;
          lineRef.el.style.filter = `blur(${absDist * 1.8}px)`;
        }
      } else if (this.currentStyle === 'drift') {
        if (lineDist === 0) {
          // In drift mode, active line tracks horizontally in tickCamera()
          lineRef.el.style.opacity = '1.0';
          lineRef.el.style.filter = 'none';
        } else {
          lineRef.el.style.transform = `translateZ(-50px) rotateY(-5deg) scale(0.92)`;
          lineRef.el.style.opacity = `${Math.max(0.04, 0.28 / absDist).toFixed(2)}`;
          lineRef.el.style.filter = `blur(${absDist * 2}px)`;
        }
      } else if (this.currentStyle === 'editorial') {
        if (lineDist === 0) {
          lineRef.el.classList.add('ve-line-active');
          lineRef.el.style.transform = 'translateZ(20px) scale(1.02)';
          lineRef.el.style.opacity = '1.0';
          lineRef.el.style.filter = 'none';
          const dur = Math.max(1, lineRef.line.endMs - lineRef.line.startMs);
          const prog = Math.max(0, Math.min(100, ((currentMs - lineRef.line.startMs) / dur) * 100));
          lineRef.el.style.setProperty('--line-progress', `${prog.toFixed(1)}%`);
        } else {
          lineRef.el.classList.remove('ve-line-active');
          lineRef.el.style.transform = 'translateZ(0px) scale(1.0)';
          lineRef.el.style.opacity = `${Math.max(0.03, 0.32 / absDist).toFixed(2)}`;
          lineRef.el.style.filter = `blur(${absDist * 1.5}px)`;
        }
      } else {
        // semantic
        if (lineDist === 0) {
          lineRef.el.style.transform = 'translateZ(35px) scale(1.04)';
          lineRef.el.style.opacity = '1.0';
          lineRef.el.style.filter = 'none';
        } else {
          lineRef.el.style.transform = 'translateZ(-30px) scale(0.95)';
          lineRef.el.style.opacity = `${Math.max(0.04, 0.30 / absDist).toFixed(2)}`;
          lineRef.el.style.filter = `blur(${absDist * 2}px)`;
        }
      }

      // Check words in this line
      for (let wIdx = 0; wIdx < lineRef.words.length; wIdx++) {
        const wordRef = lineRef.words[wIdx];
        const word = wordRef.word;
        const isWordActive = lineDist === 0 && wIdx === activeWordIdxInLine;
        const isWordPast = currentMs > word.endMs;

        if (isWordActive) {
          currentActiveWord = wordRef;
        }

        if (absDist <= 1) {
          this.updateWordKinematics(
            wordRef,
            wIdx,
            focalPos,
            activeWordIdxInLine,
            lineDist,
            currentMs,
            isWordActive,
            isWordPast,
            dt
          );

          // Update characters
          for (let cIdx = 0; cIdx < wordRef.chars.length; cIdx++) {
            this.updateCharSprings(wordRef.chars[cIdx], word, currentMs, isWordActive, isWordPast, dt);
          }
        } else {
          // Lines in the distance: settle fill immediately
          const targetFill = lineDist < 0 ? '100%' : '0%';
          wordRef.el.style.setProperty('--char-p', targetFill);
        }
      }

      // Update ad-libs
      for (let aIdx = 0; aIdx < lineRef.adLibs.length; aIdx++) {
        const adLibRef = lineRef.adLibs[aIdx];
        const isAdLibActive = currentMs >= adLibRef.word.startMs && currentMs <= adLibRef.word.endMs;
        const isAdLibPast = currentMs > adLibRef.word.endMs;
        this.updateAdLibKinematics(adLibRef, isAdLibActive, isAdLibPast, dt);
      }
    }

    this.activeWordRef = currentActiveWord;

    // ── 4. Camera Choreography (Drift style horizontal pan) ────────────────────
    this.tickCamera(currentActiveWord, this.cachedLines[targetLineIdx] ?? null, currentMs, dt);

    // ── 5. Ambient Rim Breathing (Lumn-style) ─────────────────────────────────
    this.tickRim(anyVocalActive, dt);
  }

  // ── Word-Level Kinematics ──────────────────────────────────────────────────

  private updateWordKinematics(
    wordRef: CachedWordRef,
    wordIdxInLine: number,
    focalPos: number,
    activeWordIdxInLine: number,
    lineDist: number,
    currentMs: number,
    isWordActive: boolean,
    isWordPast: boolean,
    dt: number
  ): void {
    const word = wordRef.word;

    switch (this.currentStyle) {
      case 'convex': {
        if (lineDist === 0) {
          // Continuous floating-point distance from optical focal point
          const dist = wordIdxInLine - focalPos;
          const absDist = Math.abs(dist);

          // Gaussian optical magnification curve
          const targetScale = 1.0 + 0.35 * Math.exp(-dist * dist * 0.45);
          const targetZ = 95 * Math.exp(-dist * dist * 0.4) - 35;
          const rotateY = Math.max(-36, Math.min(36, dist * 16));
          const blur = Math.max(0, (absDist - 0.45) * 2.2);
          const opacity = Math.max(0.24, 1.0 - absDist * 0.22);

          wordRef.el.style.transform = `translateZ(${targetZ.toFixed(1)}px) scale(${targetScale.toFixed(3)}) rotateY(${rotateY.toFixed(1)}deg)`;
          wordRef.el.style.filter = blur > 0.1 ? `blur(${blur.toFixed(1)}px)` : (absDist < 0.4 ? 'drop-shadow(0 0 16px var(--ve-primary))' : 'none');
          wordRef.el.style.opacity = opacity.toFixed(2);
        } else {
          wordRef.el.style.transform = 'translateZ(0px) scale(1.0)';
          wordRef.el.style.filter = 'none';
          wordRef.el.style.opacity = '';
        }
        break;
      }

      case 'drift': {
        if (isWordActive) {
          wordRef.springScale.setTarget(1.18);
          wordRef.springZ.setTarget(45);
        } else {
          wordRef.springScale.setTarget(1.0);
          wordRef.springZ.setTarget(0);
        }
        const curScale = wordRef.springScale.step(dt);
        const curZ = wordRef.springZ.step(dt);
        wordRef.el.style.transform = `translateZ(${curZ.toFixed(1)}px) scale(${curScale.toFixed(3)})`;
        wordRef.el.style.filter = isWordActive ? 'drop-shadow(0 0 20px var(--ve-primary)) drop-shadow(0 0 45px var(--ve-secondary))' : 'none';
        wordRef.el.style.opacity = isWordActive ? '1.0' : isWordPast ? '0.85' : '0.35';
        break;
      }

      case 'editorial': {
        wordRef.el.style.opacity = isWordActive ? '1.0' : isWordPast ? '0.78' : '0.24';
        if (word.isMelisma && isWordActive) {
          const timeDeltaMs = currentMs - word.startMs;
          const melismaProgress = Math.min(1.0, Math.max(0, timeDeltaMs / word.durationMs));
          const extraSpacing = (melismaProgress * 0.22).toFixed(3);
          wordRef.el.style.letterSpacing = `${extraSpacing}em`;
          wordRef.el.style.transform = `translateY(-4px) scale(1.06)`;
        } else if (isWordActive) {
          wordRef.el.style.transform = 'translateY(-3px) scale(1.05)';
          wordRef.el.style.letterSpacing = '';
        } else {
          wordRef.el.style.transform = 'translateY(0) scale(1.0)';
          wordRef.el.style.letterSpacing = '';
        }
        wordRef.el.style.filter = 'none';
        break;
      }

      case 'semantic': {
        let extraTransform = '';
        let extraFilter = '';

        if (word.semanticEffect === 'GRAVITY') {
          wordRef.springGravityY.setTarget(isWordActive ? 36 : 0);
          const curSinkY = wordRef.springGravityY.step(dt);
          const curTilt = (curSinkY / 36) * 6;
          extraTransform = ` translateY(${curSinkY.toFixed(1)}px) rotate(${curTilt.toFixed(1)}deg)`;
        } else if (word.semanticEffect === 'PULSE') {
          if (isWordActive) {
            extraFilter = 'drop-shadow(0 0 20px var(--ve-primary)) drop-shadow(0 0 50px var(--ve-secondary))';
            extraTransform = ' scale(1.22)';
          }
        } else if (isWordActive) {
          extraTransform = ' translateY(-6px) scale(1.10)';
        }

        if (word.semanticEffect === 'ECHO' && wordRef.echoClones && wordRef.echoClones.length >= 2) {
          if (isWordActive) {
            const progress = (performance.now() % 750) / 750;
            const c1Scale = 1.0 + progress * 0.30;
            const c1Opacity = 0.6 * (1 - progress);
            const c2Scale = 1.0 + progress * 0.60;
            const c2Opacity = 0.3 * (1 - progress);
            wordRef.echoClones[0].style.transform = `scale(${c1Scale.toFixed(3)})`;
            wordRef.echoClones[0].style.opacity = c1Opacity.toFixed(2);
            wordRef.echoClones[1].style.transform = `scale(${c2Scale.toFixed(3)})`;
            wordRef.echoClones[1].style.opacity = c2Opacity.toFixed(2);
          } else {
            wordRef.echoClones[0].style.opacity = '0';
            wordRef.echoClones[1].style.opacity = '0';
          }
        }

        wordRef.el.style.transform = extraTransform || 'none';
        wordRef.el.style.filter = extraFilter;
        wordRef.el.style.opacity = isWordActive ? '1.0' : isWordPast ? '0.70' : '0.25';
        break;
      }
    }
  }

  // ── Character-Level Spring Solver ──────────────────────────────────────────

  private updateCharSprings(
    charRef: CachedCharRef,
    word: LyricWord,
    currentMs: number,
    isWordActive: boolean,
    isWordPast: boolean,
    dt: number
  ): void {
    const char = charRef.char;
    const isCharActive = currentMs >= char.startMs && currentMs <= char.endMs;
    const isCharPast   = currentMs > char.endMs;

    const charProgress = isCharPast ? 1.0
      : isCharActive
        ? Math.max(0, Math.min(1, (currentMs - char.startMs) / Math.max(1, char.durationMs)))
        : 0.0;

    // Target spring values
    const targetY        = isCharActive ? -4   : 0;
    const targetScale    = isCharActive ? 1.08 : 1.0;
    const targetProgress = charProgress;
    const targetGlow     = isCharActive ? 1.0  : 0.0;

    charRef.springY.setTarget(targetY);
    charRef.springScale.setTarget(targetScale);
    charRef.springProgress.setTarget(targetProgress);
    charRef.springGlow.setTarget(targetGlow);

    const curY     = charRef.springY.step(dt);
    const curScale = charRef.springScale.step(dt);
    const curFill  = charRef.springProgress.step(dt);
    const curGlow  = charRef.springGlow.step(dt);

    // Apply sub-pixel liquid sweep gradient
    const fillPercent = Math.round(curFill * 100);
    charRef.el.style.setProperty('--char-p', `${fillPercent}%`);
    charRef.el.style.setProperty('--char-glow', curGlow.toFixed(3));

    let extraTransform = '';
    let extraFilter = '';

    if (this.currentStyle === 'semantic' && (isCharActive || isCharPast)) {
      switch (word.semanticEffect) {
        case 'FRACTURE':
          if (curFill > 0.4) {
            const shear = ((curFill - 0.4) / 0.6) * 4;
            if (charRef.shearTopEl) charRef.shearTopEl.style.transform = `translate(${shear.toFixed(1)}px, -1px)`;
            if (charRef.shearBottomEl) charRef.shearBottomEl.style.transform = `translate(-${shear.toFixed(1)}px, 1px)`;
          }
          break;

        case 'FADE':
          if (curFill > 0.2) {
            const smokeProgress = (curFill - 0.2) / 0.8;
            extraFilter = `blur(${(smokeProgress * 6).toFixed(1)}px)`;
            extraTransform = ` translateY(-${(smokeProgress * 12).toFixed(1)}px)`;
          }
          break;

        case 'PULSE':
          if (isCharActive) {
            extraFilter = `drop-shadow(0 0 ${(curGlow * 12).toFixed(1)}px var(--ve-primary))`;
          }
          break;
      }
    }

    charRef.el.style.transform = `translateY(${curY.toFixed(1)}px) scale(${curScale.toFixed(3)})${extraTransform}`;
    if (extraFilter) {
      charRef.el.style.filter = extraFilter;
    } else if (charRef.el.style.filter) {
      charRef.el.style.filter = '';
    }
  }

  // ── Camera Choreography ────────────────────────────────────────────────────

  private tickCamera(
    activeWord: CachedWordRef | null,
    activeLineRef: CachedLineRef | null,
    currentMs: number,
    dt: number
  ): void {
    if (!this.cameraEl || !this.lyricsContainerEl) return;

    if (this.currentStyle === 'drift' && activeWord && activeLineRef) {
      // Invariant horizontal tracking of the active word across the marquee ribbon
      const wordLeft = activeWord.cachedOffsetLeft ?? activeWord.el.offsetLeft;
      const wordWidth = activeWord.cachedWidth ?? activeWord.el.offsetWidth;
      const wordProg = Math.max(0, Math.min(1, (currentMs - activeWord.word.startMs) / Math.max(1, activeWord.word.durationMs)));
      const wordCenterX = wordLeft + wordWidth * wordProg;

      // Target translateX moves the line so wordCenterX sits at 0 (aligned with padding-left: 36vw)
      const targetCamX = -wordCenterX;

      this.cameraSpring.setTarget(targetCamX, 0);
      const camPos = this.cameraSpring.step(dt);
      activeLineRef.el.style.transform = `translateX(${camPos.x.toFixed(1)}px) translateZ(35px) rotateY(-5deg) scale(1.03)`;
    } else if (this.currentStyle !== 'drift') {
      this.cameraSpring.reset(0, 0);
      this.cameraEl.style.transform = 'translate3d(0, 0, 0)';
    }
  }

  // ── Rim Breathing ──────────────────────────────────────────────────────────

  private tickRim(anyVocalActive: boolean, dt: number): void {
    if (!this.ambientRimEl || !this.rimEnabled) return;

    const targetOpacity = anyVocalActive ? 0.90 : 0.45;
    this.rimOpacitySpring.setTarget(targetOpacity);
    const curOpacity = this.rimOpacitySpring.step(dt);
    this.ambientRimEl.style.opacity = curOpacity.toFixed(3);

    const targetRadius = anyVocalActive ? 180 : 110;
    this.rimRadiusSpring.setTarget(targetRadius);
    const curRadius = this.rimRadiusSpring.step(dt);
    this.ambientRimEl.style.setProperty('--ve-rim-size', `${curRadius.toFixed(0)}px`);
  }

  // ── Ad-Lib Kinematics ──────────────────────────────────────────────────────

  private updateAdLibKinematics(
    adLibRef: CachedWordRef,
    isAdLibActive: boolean,
    isAdLibPast: boolean,
    dt: number
  ): void {
    adLibRef.springZ.setTarget(isAdLibActive ? -40 : -80);
    adLibRef.springBlur.setTarget(isAdLibActive ? 0.8 : 2.0);

    const curZ    = adLibRef.springZ.step(dt);
    const curBlur = adLibRef.springBlur.step(dt);
    const opacity = isAdLibActive ? '0.75' : isAdLibPast ? '0.35' : '0.16';

    adLibRef.el.style.opacity = opacity;
    adLibRef.el.style.transform = `translateZ(${curZ.toFixed(1)}px)`;
    adLibRef.el.style.filter = `blur(${curBlur.toFixed(1)}px)`;
  }
}
