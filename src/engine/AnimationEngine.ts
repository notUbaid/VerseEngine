/**
 * AnimationEngine.ts — VERSE//ENGINE High-Performance 144Hz RAF Motion Core
 *
 * ARCHITECTURAL INVARIANTS:
 *   1. ZERO React dependencies or setState.
 *   2. Direct DOM mutations on cached refs with dirty checking to prevent layout thrash.
 *   3. Damped harmonic spring physics for all dynamic coordinates.
 *   4. Perspective(900px) on word transforms to prevent Chromium 3D flattening.
 *   5. Smooth word-level liquid karaoke gradient wipes (0% -> 100%).
 *   6. Monotonic camera tracking in Drift mode without line snapping.
 *   7. GPU scaleX() for Editorial melisma to avoid layout reflows.
 */

import {
  ProcessedTrack,
  LyricLine,
  LyricWord,
  VisualStyle,
  PaletteColors
} from '../types/lyrics';
import { Clock } from './Clock';
import { HarmonicSpring, SpringVector2 } from './SpringSolver';
import { WebGLPostProcess } from './WebGLPostProcess';

// ─── Cached Ref Interfaces ────────────────────────────────────────────────────

export interface CachedWordRef {
  el: HTMLElement;
  word: LyricWord;
  lineIndex: number;
  wordIndex: number;
  springZ: HarmonicSpring;         // depth (translateZ)
  springBlur: HarmonicSpring;      // DOF blur
  springScale: HarmonicSpring;     // word-level scale spring
  springProgress: HarmonicSpring;  // fill sweep 0.0 -> 1.0 for --word-p
  springGravityY: HarmonicSpring;  // GRAVITY semantic
  shearTopEl?: HTMLElement;        // FRACTURE top clip-path layer
  shearBottomEl?: HTMLElement;     // FRACTURE bottom clip-path layer
  echoClones?: HTMLElement[];      // ECHO wireframe clone ghosts
  cachedOffsetLeft?: number;
  cachedWidth?: number;

  // Dirty-checking cache
  lastFill?: string;
  lastTransform?: string;
  lastFilter?: string;
  lastOpacity?: string;
}

export interface CachedLineRef {
  el: HTMLElement;
  line: LyricLine;
  words: CachedWordRef[];
  adLibs?: CachedWordRef[];
  cachedOffsetTop?: number;
  cachedOffsetLeft?: number;

  // Dirty-checking cache
  lastTransform?: string;
  lastOpacity?: string;
  lastFilter?: string;
  lastVisibility?: string;
  lastActiveProgress?: string;
}

export class AnimationEngine {
  private clock: Clock;
  private rafId: number | null = null;
  private lastTime: number = performance.now();
  private lastCurrentMs: number = 0;

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

  // Horizontal camera spring for drift marquee ribbon
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
    this.lastCurrentMs = 0;

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
    // Invalidate line and word caches on style change
    this.invalidateRenderCache();

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

  private invalidateRenderCache(): void {
    for (let i = 0; i < this.cachedLines.length; i++) {
      const lineRef = this.cachedLines[i];
      lineRef.lastTransform = undefined;
      lineRef.lastOpacity = undefined;
      lineRef.lastFilter = undefined;
      lineRef.lastVisibility = undefined;
      for (let w = 0; w < lineRef.words.length; w++) {
        const wordRef = lineRef.words[w];
        wordRef.lastFill = undefined;
        wordRef.lastTransform = undefined;
        wordRef.lastFilter = undefined;
        wordRef.lastOpacity = undefined;
      }
    }
  }

  /**
   * PURE 144Hz RAF TICK: Direct DOM mutations on cached refs with dirty checking.
   */
  private tick(dt: number): void {
    if (!this.cachedLines || this.cachedLines.length === 0) return;

    const currentMs = this.clock.tick();

    // ── Seek Detection: backwards jump reset ─────────────────────────────────
    if (this.lastCurrentMs > 0 && currentMs < this.lastCurrentMs - 250) {
      this.handleSeekBackward(currentMs);
    }
    this.lastCurrentMs = currentMs;

    let anyVocalActive = false;
    let targetLineIdx = this.findActiveLineIndex(currentMs);
    let currentActiveWord: CachedWordRef | null = null;

    if (targetLineIdx !== -1) {
      const activeLine = this.cachedLines[targetLineIdx].line;
      if (currentMs >= activeLine.startMs && currentMs <= activeLine.endMs) {
        anyVocalActive = true;
      }
    } else {
      targetLineIdx = 0;
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

    // ── 3. Line-level depth, opacity cascade, and word springs ───────────────
    for (let lIdx = 0; lIdx < this.cachedLines.length; lIdx++) {
      const lineRef = this.cachedLines[lIdx];
      const lineDist = lIdx - targetLineIdx;
      const absDist = Math.abs(lineDist);

      // Visibility culling (cull lines beyond ±6)
      if (absDist > 6) {
        if (lineRef.lastVisibility !== 'hidden') {
          lineRef.el.style.visibility = 'hidden';
          lineRef.lastVisibility = 'hidden';
        }
        continue;
      }
      if (lineRef.lastVisibility !== 'visible') {
        lineRef.el.style.visibility = 'visible';
        lineRef.lastVisibility = 'visible';
      }

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
          if (activeWordIdxInLine === -1 && lineRef.words.length > 0) {
            activeWordIdxInLine = lineRef.words.length - 1;
          }
        }
      }

      // Compute continuous floating-point focal cursor for the active line
      let focalPos = 0;
      if (lineDist === 0 && lineRef.words.length > 0 && activeWordIdxInLine >= 0) {
        const curWordRef = lineRef.words[activeWordIdxInLine];
        const curWord = curWordRef?.word;
        const wordProg = curWord
          ? Math.max(0, Math.min(1, (currentMs - curWord.startMs) / Math.max(1, curWord.durationMs)))
          : 0;
        // Word center is activeWordIdxInLine + 0.5; cursor moves with progress
        focalPos = activeWordIdxInLine + wordProg;
      }

      // Apply line-level styles per visual theme
      this.applyLineStyles(lineRef, lineDist, absDist, currentMs);

      // Check words in this line
      for (let wIdx = 0; wIdx < lineRef.words.length; wIdx++) {
        const wordRef = lineRef.words[wIdx];
        const word = wordRef.word;
        const isWordActive = lineDist === 0 && wIdx === activeWordIdxInLine;
        const isWordPast = currentMs > word.endMs;

        if (isWordActive) {
          currentActiveWord = wordRef;
        }

        // Active line and immediate neighbors get full dynamic kinematic updates
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
        } else {
          // Lines in the distance: settle fill and transforms with dirty checking
          const targetFill = lineDist < 0 ? '100%' : '0%';
          if (wordRef.lastFill !== targetFill) {
            wordRef.el.style.setProperty('--word-p', targetFill);
            wordRef.lastFill = targetFill;
          }
          if (wordRef.lastTransform !== 'none') {
            wordRef.el.style.transform = 'none';
            wordRef.lastTransform = 'none';
          }
          if (wordRef.lastFilter !== 'none') {
            wordRef.el.style.filter = 'none';
            wordRef.lastFilter = 'none';
          }
          if (wordRef.lastOpacity !== '') {
            wordRef.el.style.opacity = '';
            wordRef.lastOpacity = '';
          }
        }
      }
    }

    this.activeWordRef = currentActiveWord;

    // ── 4. Camera Choreography (Drift horizontal pan) ────────────────────────
    this.tickCamera(currentActiveWord, this.cachedLines[targetLineIdx] ?? null, currentMs, dt);

    // ── 5. Ambient Rim Breathing (Lumn-style) ─────────────────────────────────
    this.tickRim(anyVocalActive, dt);
  }

  /**
   * Incremental Active-Line Search: avoid linear scan of all lines every frame.
   */
  private findActiveLineIndex(currentMs: number): number {
    const totalLines = this.cachedLines.length;
    if (totalLines === 0) return 0;

    let idx = this.currentActiveLineIdx;
    if (idx < 0) idx = 0;
    if (idx >= totalLines) idx = totalLines - 1;

    const curLine = this.cachedLines[idx].line;

    // Case 1: still on current line
    if (currentMs >= curLine.startMs && currentMs <= curLine.endMs) {
      return idx;
    }

    // Case 2: moved forward
    if (currentMs > curLine.endMs) {
      while (idx + 1 < totalLines) {
        const nextLine = this.cachedLines[idx + 1].line;
        if (currentMs < nextLine.startMs) {
          // Between lines: stick to line just finished if recent (< 2000ms), otherwise next
          return currentMs - curLine.endMs < 2000 ? idx : idx + 1;
        }
        idx++;
        if (currentMs >= nextLine.startMs && currentMs <= nextLine.endMs) {
          return idx;
        }
      }
      return totalLines - 1;
    }

    // Case 3: moved backward (or seeked backward)
    if (currentMs < curLine.startMs) {
      while (idx > 0) {
        idx--;
        const prevLine = this.cachedLines[idx].line;
        if (currentMs >= prevLine.startMs && currentMs <= prevLine.endMs) {
          return idx;
        }
        if (currentMs > prevLine.endMs) {
          return idx;
        }
      }
      return 0;
    }

    return idx;
  }

  /**
   * Reset future state on backward seek so lyrics don't get stuck filled.
   */
  private handleSeekBackward(currentMs: number): void {
    for (let l = 0; l < this.cachedLines.length; l++) {
      const lineRef = this.cachedLines[l];
      if (lineRef.line.startMs > currentMs) {
        for (let w = 0; w < lineRef.words.length; w++) {
          const wordRef = lineRef.words[w];
          wordRef.springProgress.reset(0, 0);
          wordRef.springScale.reset(1.0, 0);
          wordRef.springZ.reset(0, 0);
          wordRef.springGravityY.reset(0, 0);
          wordRef.el.style.setProperty('--word-p', '0%');
          wordRef.lastFill = '0%';
          if (wordRef.shearTopEl) wordRef.shearTopEl.style.transform = 'none';
          if (wordRef.shearBottomEl) wordRef.shearBottomEl.style.transform = 'none';
        }
      }
    }
  }

  /**
   * Apply styles to a line with dirty checking to prevent layout reflows.
   */
  private applyLineStyles(
    lineRef: CachedLineRef,
    lineDist: number,
    absDist: number,
    currentMs: number
  ): void {
    let transform = '';
    let opacity = '';
    let filter = '';

    if (this.currentStyle === 'convex') {
      if (lineDist === 0) {
        transform = 'translateZ(40px) scale(1.04)';
        opacity = '1.0';
        filter = 'none';
      } else {
        const curveDeg = lineDist < 0 ? -16 : 16;
        const targetZ = -65 - absDist * 35;
        const targetScale = Math.max(0.78, 0.96 - absDist * 0.07);
        transform = `translateZ(${targetZ}px) rotateX(${curveDeg}deg) scale(${targetScale.toFixed(3)})`;
        opacity = Math.max(0.04, 0.36 / absDist).toFixed(2);
        filter = `blur(${Math.min(10, absDist * 1.8).toFixed(1)}px)`;
      }
    } else if (this.currentStyle === 'drift') {
      if (lineDist === 0) {
        opacity = '1.0';
        filter = 'none';
      } else {
        transform = `translateZ(-50px) rotateY(-5deg) scale(0.92)`;
        opacity = Math.max(0.04, 0.28 / absDist).toFixed(2);
        filter = `blur(${Math.min(10, absDist * 2.0).toFixed(1)}px)`;
      }
    } else if (this.currentStyle === 'editorial') {
      if (lineDist === 0) {
        lineRef.el.classList.add('ve-line-active');
        transform = 'translateZ(20px) scale(1.02)';
        opacity = '1.0';
        filter = 'none';
        const dur = Math.max(1, lineRef.line.endMs - lineRef.line.startMs);
        const prog = Math.max(0, Math.min(100, ((currentMs - lineRef.line.startMs) / dur) * 100));
        const progStr = `${prog.toFixed(1)}%`;
        if (lineRef.lastActiveProgress !== progStr) {
          lineRef.el.style.setProperty('--line-progress', progStr);
          lineRef.lastActiveProgress = progStr;
        }
      } else {
        lineRef.el.classList.remove('ve-line-active');
        transform = 'translateZ(0px) scale(1.0)';
        opacity = Math.max(0.03, 0.32 / absDist).toFixed(2);
        filter = `blur(${Math.min(8, absDist * 1.5).toFixed(1)}px)`;
      }
    } else {
      // semantic
      if (lineDist === 0) {
        transform = 'translateZ(35px) scale(1.04)';
        opacity = '1.0';
        filter = 'none';
      } else {
        transform = 'translateZ(-30px) scale(0.95)';
        opacity = Math.max(0.04, 0.30 / absDist).toFixed(2);
        filter = `blur(${Math.min(10, absDist * 2.0).toFixed(1)}px)`;
      }
    }

    if (this.currentStyle !== 'drift' || lineDist !== 0) {
      if (lineRef.lastTransform !== transform) {
        lineRef.el.style.transform = transform;
        lineRef.lastTransform = transform;
      }
    }
    if (lineRef.lastOpacity !== opacity) {
      lineRef.el.style.opacity = opacity;
      lineRef.lastOpacity = opacity;
    }
    if (lineRef.lastFilter !== filter) {
      lineRef.el.style.filter = filter;
      lineRef.lastFilter = filter;
    }
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

    // Calculate word-level liquid fill progress
    let targetProgress = 0.0;
    if (isWordPast) {
      targetProgress = 1.0;
    } else if (isWordActive) {
      const elapsed = currentMs - word.startMs;
      targetProgress = Math.max(0, Math.min(1.0, elapsed / Math.max(1, word.durationMs)));
    } else if (lineDist < 0) {
      targetProgress = 1.0;
    } else {
      targetProgress = 0.0;
    }

    wordRef.springProgress.setTarget(targetProgress);
    const curProgress = wordRef.springProgress.step(dt);
    const fillPercentStr = `${Math.round(curProgress * 100)}%`;

    if (wordRef.lastFill !== fillPercentStr) {
      wordRef.el.style.setProperty('--word-p', fillPercentStr);
      wordRef.lastFill = fillPercentStr;
    }

    let transform = '';
    let filter = '';
    let opacity = '';

    switch (this.currentStyle) {
      case 'convex': {
        if (lineDist === 0) {
          // Distance from word center (wordIdxInLine + 0.5) to focal point
          const dist = (wordIdxInLine + 0.5) - focalPos;
          const absDist = Math.abs(dist);

          // Gaussian optical magnification curve
          const targetScale = 1.0 + 0.32 * Math.exp(-dist * dist * 0.45);
          const targetZ = 90 * Math.exp(-dist * dist * 0.4) - 30;
          const rotateY = Math.max(-32, Math.min(32, dist * 14));
          const blur = Math.max(0, (absDist - 0.7) * 2.4);
          opacity = Math.max(0.24, 1.0 - absDist * 0.20).toFixed(2);

          // Perspective(900px) INSIDE transform prevents Chromium 3D flattening
          transform = `perspective(900px) translateZ(${targetZ.toFixed(1)}px) scale(${targetScale.toFixed(3)}) rotateY(${rotateY.toFixed(1)}deg)`;

          // Continuous organic bloom without sudden pop
          const bloomIntensity = Math.exp(-dist * dist * 2.2);
          if (bloomIntensity > 0.08) {
            filter = `drop-shadow(0 0 ${(bloomIntensity * 18).toFixed(1)}px var(--ve-primary))`;
          } else if (blur > 0.1) {
            filter = `blur(${blur.toFixed(1)}px)`;
          } else {
            filter = 'none';
          }
        } else {
          transform = 'perspective(900px) translateZ(0px) scale(1.0)';
          filter = 'none';
          opacity = '';
        }
        break;
      }

      case 'drift': {
        if (isWordActive) {
          wordRef.springScale.setTarget(1.15);
          wordRef.springZ.setTarget(40);
        } else {
          wordRef.springScale.setTarget(1.0);
          wordRef.springZ.setTarget(0);
        }
        const curScale = wordRef.springScale.step(dt);
        const curZ = wordRef.springZ.step(dt);
        transform = `translateZ(${curZ.toFixed(1)}px) scale(${curScale.toFixed(3)})`;
        filter = isWordActive
          ? 'drop-shadow(0 0 20px var(--ve-primary)) drop-shadow(0 0 45px var(--ve-secondary))'
          : 'none';
        opacity = isWordActive ? '1.0' : isWordPast ? '0.85' : '0.35';
        break;
      }

      case 'editorial': {
        opacity = isWordActive ? '1.0' : isWordPast ? '0.78' : '0.24';
        if (word.isMelisma && isWordActive) {
          // Melisma stretch: Use GPU scaleX instead of reflowing letter-spacing!
          const melismaScaleX = 1.0 + Math.min(0.20, curProgress * 0.20);
          transform = `translateY(-3px) scale(${melismaScaleX.toFixed(3)}, 1.05)`;
        } else if (isWordActive) {
          transform = 'translateY(-3px) scale(1.04)';
        } else {
          transform = 'translateY(0) scale(1.0)';
        }
        filter = 'none';
        break;
      }

      case 'semantic': {
        let extraTransform = '';
        let extraFilter = '';

        if (word.semanticEffect === 'GRAVITY') {
          wordRef.springGravityY.setTarget(isWordActive ? 32 : 0);
          const curSinkY = wordRef.springGravityY.step(dt);
          const curTilt = (curSinkY / 32) * 5;
          extraTransform = ` translateY(${curSinkY.toFixed(1)}px) rotate(${curTilt.toFixed(1)}deg)`;
        } else if (word.semanticEffect === 'PULSE') {
          if (isWordActive) {
            extraFilter = 'drop-shadow(0 0 20px var(--ve-primary)) drop-shadow(0 0 45px var(--ve-secondary))';
            extraTransform = ' scale(1.20)';
          }
        } else if (word.semanticEffect === 'FRACTURE') {
          if (curProgress > 0.35) {
            const shear = ((curProgress - 0.35) / 0.65) * 5;
            if (wordRef.shearTopEl) wordRef.shearTopEl.style.transform = `translate(${shear.toFixed(1)}px, -1px)`;
            if (wordRef.shearBottomEl) wordRef.shearBottomEl.style.transform = `translate(-${shear.toFixed(1)}px, 1px)`;
          } else {
            if (wordRef.shearTopEl) wordRef.shearTopEl.style.transform = 'none';
            if (wordRef.shearBottomEl) wordRef.shearBottomEl.style.transform = 'none';
          }
        } else if (word.semanticEffect === 'FADE') {
          if (curProgress > 0.2) {
            const smokeProgress = (curProgress - 0.2) / 0.8;
            extraFilter = `blur(${(smokeProgress * 6).toFixed(1)}px)`;
            extraTransform = ` translateY(-${(smokeProgress * 12).toFixed(1)}px)`;
          }
        } else if (isWordActive) {
          extraTransform = ' translateY(-5px) scale(1.08)';
        }

        if (word.semanticEffect === 'ECHO' && wordRef.echoClones && wordRef.echoClones.length >= 2) {
          if (isWordActive) {
            const cycle = (performance.now() % 800) / 800;
            const c1Scale = 1.0 + cycle * 0.30;
            const c1Opacity = 0.6 * (1 - cycle);
            const c2Scale = 1.0 + cycle * 0.60;
            const c2Opacity = 0.3 * (1 - cycle);
            wordRef.echoClones[0].style.transform = `scale(${c1Scale.toFixed(3)})`;
            wordRef.echoClones[0].style.opacity = c1Opacity.toFixed(2);
            wordRef.echoClones[1].style.transform = `scale(${c2Scale.toFixed(3)})`;
            wordRef.echoClones[1].style.opacity = c2Opacity.toFixed(2);
          } else {
            wordRef.echoClones[0].style.opacity = '0';
            wordRef.echoClones[1].style.opacity = '0';
          }
        }

        transform = extraTransform || 'none';
        filter = extraFilter;
        opacity = isWordActive ? '1.0' : isWordPast ? '0.70' : '0.25';
        break;
      }
    }

    if (wordRef.lastTransform !== transform) {
      wordRef.el.style.transform = transform;
      wordRef.lastTransform = transform;
    }
    if (wordRef.lastFilter !== filter) {
      wordRef.el.style.filter = filter;
      wordRef.lastFilter = filter;
    }
    if (wordRef.lastOpacity !== opacity) {
      wordRef.el.style.opacity = opacity;
      wordRef.lastOpacity = opacity;
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
      // Continuous horizontal tracking without line snapping:
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
}
