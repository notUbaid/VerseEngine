/**
 * AnimationEngine.ts — VERSE//ENGINE Master Film-Grade Motion Core
 *
 * UNIFIED ARCHITECTURE:
 *   1. Single master RAF loop driving both DOM typography and WebGL post-process synchronously.
 *   2. Fixed-step physics accumulator at 1/240s for deterministic, refresh-independent kinematics.
 *   3. Four tempos of motion: Ambient (10-30s), Line (450-700ms), Word (120-300ms), Accent (400-900ms).
 *   4. Anticipation kinematics: next line rises 180ms before vocal onset with 25ms word stagger.
 *   5. Strict compositor-only per-frame properties (transform & opacity) with layer budgeting.
 *   6. Depth-of-field blur restricted strictly to +/-1 immediate line neighbors.
 *   7. Dynamic cinematic moments: Title Card Intro, Chorus Slam, Specular Streak, Interlude, Outro.
 *   8. Automatic Quality Governor and Dev Telemetry HUD (Shift+D).
 */

import {
  ProcessedTrack,
  LyricLine,
  LyricWord,
  VisualStyle,
  PaletteColors
} from '../types/lyrics';
import { Clock } from './Clock';
import { HarmonicSpring, SpringVector2, FixedStepAccumulator } from './SpringSolver';
import { WebGLPostProcess } from './WebGLPostProcess';
import { StageView } from '../ui/StageView';

// ─── Cached Ref Interfaces ────────────────────────────────────────────────────

export interface CachedWordRef {
  el: HTMLElement;
  word: LyricWord;
  lineIndex: number;
  wordIndex: number;
  springZ: HarmonicSpring;         // depth (translateZ)
  springBlur: HarmonicSpring;      // DOF blur
  springScale: HarmonicSpring;     // word-level scale spring
  springProgress: HarmonicSpring;  // fill sweep 0.0 -> 1.0
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
  isMarkedPast?: boolean;
  isMarkedFuture?: boolean;
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
  isPromotedLayer?: boolean;
}

export class AnimationEngine {
  private clock: Clock;
  private rafId: number | null = null;
  private lastTime: number = performance.now();
  private lastCurrentMs: number = 0;

  // Fixed 1/240s physics accumulator
  private physicsAccumulator: FixedStepAccumulator = new FixedStepAccumulator();

  // Bound DOM refs (cached, never queried inside tick)
  private stageEl: HTMLElement | null = null;
  private cameraEl: HTMLElement | null = null;
  private ambientRimEl: HTMLElement | null = null;
  private lyricsContainerEl: HTMLElement | null = null;
  private webgl: WebGLPostProcess | null = null;
  private stageView: StageView | null = null;

  private cachedLines: CachedLineRef[] = [];
  private currentTrack: ProcessedTrack | null = null;
  private activeWordRef: CachedWordRef | null = null;
  private currentActiveLineIdx: number = 0;
  private isInitialPositionSet: boolean = false;

  // Vertical stage spring for butter-smooth active line centering
  private stageYSpring: HarmonicSpring = HarmonicSpring.fromPreset('heavy', 0);

  // Horizontal camera spring for drift marquee ribbon
  private cameraSpring: SpringVector2 = SpringVector2.fromPreset('heavy', 0, 0);

  // Ambient Rim Breathing
  private rimOpacitySpring: HarmonicSpring = HarmonicSpring.fromPreset('soft', 0.45);
  private rimRadiusSpring: HarmonicSpring = HarmonicSpring.fromPreset('soft', 110);

  // Ambient 10-30s Camera Noise Drift
  private cameraDriftTime: number = 0;

  // Cinematic Moment tracking
  private lastChorusSlamMs: number = 0;
  private lastAccentMs: number = 0;

  private currentStyle: VisualStyle = 'convex';
  private currentPalette: PaletteColors | null = null;
  private rimEnabled: boolean = true;

  // Telemetry & Quality Governor
  private frameTimes: number[] = [];
  private frameCount: number = 0;
  private governorLevel: number = 0; // 0 = High (1.5x DPR, 240 particles), 1 = Med, 2 = Low
  private governorCheckTimer: number = 0;

  constructor() {
    this.clock = Clock.getInstance();
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', () => this.measureOffsets());
    }
  }

  public bindWebgl(webgl: WebGLPostProcess): void {
    this.webgl = webgl;
  }

  public bindStageView(stageView: StageView): void {
    this.stageView = stageView;
  }

  public bindElements(
    stageEl: HTMLElement,
    cameraEl: HTMLElement,
    ambientRimEl: HTMLElement,
    lyricsContainerEl: HTMLElement,
    cachedLines: CachedLineRef[],
    track?: ProcessedTrack
  ): void {
    this.stageEl = stageEl;
    this.cameraEl = cameraEl;
    this.ambientRimEl = ambientRimEl;
    this.lyricsContainerEl = lyricsContainerEl;
    this.cachedLines = cachedLines;
    if (track) this.currentTrack = track;

    this.activeWordRef = null;
    this.currentActiveLineIdx = 0;
    this.isInitialPositionSet = false;
    this.lastCurrentMs = 0;
    this.lastChorusSlamMs = 0;
    this.lastAccentMs = 0;
    this.cameraDriftTime = 0;

    this.measureOffsets();

    // Reset springs
    this.stageYSpring.reset(0, 0);
    this.cameraSpring.reset(0, 0);
    this.physicsAccumulator.reset();
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
      lineRef.isPromotedLayer = undefined;
      for (let w = 0; w < lineRef.words.length; w++) {
        const wordRef = lineRef.words[w];
        wordRef.lastFill = undefined;
        wordRef.lastTransform = undefined;
        wordRef.lastFilter = undefined;
        wordRef.lastOpacity = undefined;
        wordRef.isMarkedPast = undefined;
        wordRef.isMarkedFuture = undefined;
      }
    }
  }

  /**
   * UNIFIED MASTER RAF TICK (Synchronously orchestrates Clock, Physics, DOM, WebGL, Telemetry)
   */
  private tick(dt: number): void {
    const frameStart = performance.now();
    if (!this.cachedLines || this.cachedLines.length === 0) return;

    // 1. Tick Clock with continuous slewing
    const currentMs = this.clock.tick(dt);
    const energy = this.clock.getEnergy();
    const beatPulse = this.clock.getBeatPulse();
    const isDownbeat = this.clock.getIsDownbeat();

    // 2. Handle Seek Backward Reset
    if (this.lastCurrentMs > 0 && currentMs < this.lastCurrentMs - 250) {
      this.handleSeekBackward(currentMs);
    }
    this.lastCurrentMs = currentMs;

    // 3. Find Active Line Index (with anticipation lookahead)
    let targetLineIdx = this.findActiveLineIndex(currentMs);
    let anyVocalActive = false;
    let currentActiveWord: CachedWordRef | null = null;

    if (targetLineIdx !== -1 && this.cachedLines[targetLineIdx]) {
      const activeLine = this.cachedLines[targetLineIdx].line;
      if (currentMs >= activeLine.startMs - 180 && currentMs <= activeLine.endMs) {
        anyVocalActive = true;
      }
    } else {
      targetLineIdx = 0;
    }

    this.currentActiveLineIdx = targetLineIdx;
    this.clock.setVocalActivityEnergy(anyVocalActive, dt);

    // 4. Fixed 1/240s Physics Step for springs
    this.physicsAccumulator.update(dt, (fixedDt) => {
      this.stepAllSprings(fixedDt, targetLineIdx, currentMs);
    });

    // 5. Film Moments: Title Card, Interlude, Chorus Slam
    this.handleFilmMoments(currentMs, targetLineIdx, energy, beatPulse);

    // 6. Active Line Vertical Centering
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

      const curStageY = this.stageYSpring.position;

      // Ambient 10-30s noise camera breathing
      this.cameraDriftTime += dt * (0.20 + energy * 0.15);
      const driftX = Math.sin(this.cameraDriftTime * 0.7) * 4.5;
      const driftY = Math.cos(this.cameraDriftTime * 0.5) * 3.5;
      const driftRot = Math.sin(this.cameraDriftTime * 0.4) * 0.25;

      this.lyricsContainerEl.style.transform = `translate3d(${driftX.toFixed(1)}px, ${(curStageY + driftY).toFixed(1)}px, 0) rotate(${driftRot.toFixed(2)}deg)`;
    }

    // 7. Line & Word Kinematic Transformations (Compositor-only)
    currentActiveWord = this.renderLinesAndWords(targetLineIdx, currentMs, dt);
    this.activeWordRef = currentActiveWord;

    // 8. Horizontal Camera Choreography (Drift Mode)
    this.tickCamera(currentActiveWord, this.cachedLines[targetLineIdx] ?? null, currentMs, dt);

    // 9. Ambient Peripheral Rim Breathing
    this.tickRim(anyVocalActive, dt);

    // 10. Specular Streak Positioning (Rare Cinematic Burst: <= once per ~8s)
    if (currentActiveWord && this.webgl && this.currentStyle === 'convex') {
      const shouldTrigger =
        (currentMs - this.lastAccentMs > 8000) &&
        (currentActiveWord.word.isMelisma || (energy >= 0.75 && beatPulse >= 0.8) || (energy > 0.65 && isDownbeat));

      if (shouldTrigger) {
        this.lastAccentMs = currentMs;
        const wEl = currentActiveWord.el;
        const rect = wEl.getBoundingClientRect();
        const screenX = (rect.left + rect.width * 0.5) / (window.innerWidth || 1920);
        const screenY = (rect.top + rect.height * 0.5) / (window.innerHeight || 1080);
        this.webgl.setSpecularStreak(0.85, screenX, screenY);
      }
    }

    // 11. Synchronous WebGL Render (Unified Loop)
    if (this.webgl) {
      this.webgl.render(dt, energy, beatPulse, isDownbeat);
    }

    // 12. Quality Governor & Telemetry HUD
    const frameEnd = performance.now();
    this.updateTelemetry(frameEnd - frameStart, dt, energy, beatPulse);
  }

  private stepAllSprings(fixedDt: number, targetLineIdx: number, currentMs: number): void {
    this.stageYSpring.step(fixedDt);
    this.cameraSpring.step(fixedDt);
    this.rimOpacitySpring.step(fixedDt);
    this.rimRadiusSpring.step(fixedDt);

    // Step springs strictly on active line and immediate +/-1 neighbors
    for (let l = Math.max(0, targetLineIdx - 1); l <= Math.min(this.cachedLines.length - 1, targetLineIdx + 1); l++) {
      const lineRef = this.cachedLines[l];
      for (let w = 0; w < lineRef.words.length; w++) {
        const wordRef = lineRef.words[w];
        wordRef.springProgress.step(fixedDt);
        wordRef.springScale.step(fixedDt);
        wordRef.springZ.step(fixedDt);
        wordRef.springGravityY.step(fixedDt);
      }
    }
  }

  private renderLinesAndWords(
    targetLineIdx: number,
    currentMs: number,
    dt: number
  ): CachedWordRef | null {
    let activeWord: CachedWordRef | null = null;

    for (let lIdx = 0; lIdx < this.cachedLines.length; lIdx++) {
      const lineRef = this.cachedLines[lIdx];
      const lineDist = lIdx - targetLineIdx;
      const absDist = Math.abs(lineDist);

      // Visibility culling beyond +/- 5 lines
      if (absDist > 5) {
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

      // Promote active line and +/- 1 neighbors to isolated compositor layer
      const shouldPromote = absDist <= 1;
      if (lineRef.isPromotedLayer !== shouldPromote) {
        lineRef.el.style.willChange = shouldPromote ? 'transform, opacity' : 'auto';
        lineRef.isPromotedLayer = shouldPromote;
      }

      // Find active word in line
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
        focalPos = activeWordIdxInLine + 0.5 + wordProg * 0.5;
      }

      // Apply line-level styles (DOF blur ONLY on immediate +/-1 neighbors)
      this.applyLineStyles(lineRef, lineDist, absDist, currentMs);

      // Update words
      for (let wIdx = 0; wIdx < lineRef.words.length; wIdx++) {
        const wordRef = lineRef.words[wIdx];
        const word = wordRef.word;
        const isWordActive = lineDist === 0 && wIdx === activeWordIdxInLine;
        const isWordPast = currentMs > word.endMs;

        if (isWordActive) {
          activeWord = wordRef;
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
        } else {
          // Lines in the distance: mark settled classes without per-frame background writes
          if (lineDist < 0) {
            if (!wordRef.isMarkedPast) {
              wordRef.el.className = 've-word ve-word-past';
              wordRef.isMarkedPast = true;
              wordRef.isMarkedFuture = false;
            }
          } else {
            if (!wordRef.isMarkedFuture) {
              wordRef.el.className = 've-word ve-word-future';
              wordRef.isMarkedFuture = true;
              wordRef.isMarkedPast = false;
            }
          }
        }
      }
    }

    return activeWord;
  }

  private handleFilmMoments(currentMs: number, targetLineIdx: number, energy: number, beatPulse: number): void {
    if (!this.cachedLines || this.cachedLines.length === 0 || !this.stageView) return;
    if (this.stageView.isTitleCardSticky) return; // Keep loading/empty/error states intact

    const firstLine = this.cachedLines[0].line;
    const lastLine = this.cachedLines[this.cachedLines.length - 1].line;

    // 1. Title Card Intro: display before first line starts
    if (currentMs < firstLine.startMs - 500) {
      if (this.currentTrack) {
        this.stageView.showTitleCard(this.currentTrack.title, this.currentTrack.artist, this.currentTrack.albumArtUrl);
      }
    } else {
      this.stageView.hideTitleCard();
    }

    // 2. Outro: return title card when song concludes
    if (currentMs > lastLine.endMs + 1500) {
      if (this.currentTrack) {
        this.stageView.showTitleCard(this.currentTrack.title, this.currentTrack.artist, this.currentTrack.albumArtUrl);
      }
    }

    // 3. Instrumental Interlude: gaps > 4000ms between lines
    const curLine = this.cachedLines[targetLineIdx]?.line;
    const nextLine = this.cachedLines[targetLineIdx + 1]?.line;
    if (curLine && nextLine && (nextLine.startMs - curLine.endMs) > 4000) {
      if (currentMs > curLine.endMs + 800 && currentMs < nextLine.startMs - 600) {
        this.stageView.setInterludeVisible(true);
      } else {
        this.stageView.setInterludeVisible(false);
      }
    } else {
      this.stageView.setInterludeVisible(false);
    }

    // 4. Chorus Slam: energy spike (E >= 0.78) or loudness spike triggers camera push & chromatic spike
    const now = performance.now();
    if (energy >= 0.78 && beatPulse >= 0.85 && (now - this.lastChorusSlamMs) > 8000) {
      this.lastChorusSlamMs = now;
      if (this.webgl) {
        this.webgl.triggerChorusSlam();
        this.webgl.triggerParticleBurst();
      }
    }
  }

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
        lineRef.el.classList.add('is-active');
        transform = 'translateZ(45px) scale(1.04)';
        opacity = '1.0';
        filter = 'none';
      } else {
        lineRef.el.classList.remove('is-active');
        const curveDeg = lineDist < 0 ? -16 : 16;
        const targetZ = -65 - absDist * 35;
        const targetScale = Math.max(0.76, 0.96 - absDist * 0.08);
        transform = `translateZ(${targetZ}px) rotateX(${curveDeg}deg) scale(${targetScale.toFixed(3)})`;
        opacity = Math.max(0.04, 0.36 / absDist).toFixed(2);
        // Depth-of-field blur applied ONLY to immediate +/-1 lines
        filter = absDist === 1 ? 'blur(2.2px)' : 'none';
      }
    } else if (this.currentStyle === 'drift') {
      if (lineDist === 0) {
        lineRef.el.classList.add('is-active');
        opacity = '1.0';
        filter = 'none';
      } else {
        lineRef.el.classList.remove('is-active');
        transform = `translateZ(-50px) rotateY(-5deg) scale(0.92)`;
        opacity = Math.max(0.04, 0.28 / absDist).toFixed(2);
        filter = absDist === 1 ? 'blur(2.5px)' : 'none';
      }
    } else if (this.currentStyle === 'editorial') {
      if (lineDist === 0) {
        lineRef.el.classList.add('is-active');
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
        lineRef.el.classList.remove('is-active');
        transform = 'translateZ(0px) scale(1.0)';
        opacity = Math.max(0.03, 0.32 / absDist).toFixed(2);
        filter = absDist === 1 ? 'blur(1.8px)' : 'none';
      }
    } else {
      // semantic
      if (lineDist === 0) {
        lineRef.el.classList.add('is-active');
        transform = 'translateZ(35px) scale(1.04)';
        opacity = '1.0';
        filter = 'none';
      } else {
        lineRef.el.classList.remove('is-active');
        transform = 'translateZ(-30px) scale(0.95)';
        opacity = Math.max(0.04, 0.30 / absDist).toFixed(2);
        filter = absDist === 1 ? 'blur(2.0px)' : 'none';
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

    // Anticipation stagger: 25ms offset per word
    const wordStartWithStagger = word.startMs - (lineDist === 1 ? (180 - wordIdxInLine * 25) : 0);

    // Target fill progress
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
    const curProgress = wordRef.springProgress.position;

    // Word reveal styling
    if (isWordActive) {
      wordRef.el.className = 've-word is-active';
      const fillStr = `${(curProgress * 114).toFixed(1)}%`;
      if (wordRef.lastFill !== fillStr) {
        wordRef.el.style.setProperty('--p', fillStr);
        wordRef.lastFill = fillStr;
      }
    } else if (isWordPast || lineDist < 0) {
      if (!wordRef.isMarkedPast) {
        wordRef.el.className = 've-word ve-word-past';
        wordRef.isMarkedPast = true;
        wordRef.isMarkedFuture = false;
      }
    } else {
      if (!wordRef.isMarkedFuture) {
        wordRef.el.className = 've-word ve-word-future';
        wordRef.isMarkedFuture = true;
        wordRef.isMarkedPast = false;
      }
    }

    let transform = '';
    let filter = '';
    let opacity = '';

    switch (this.currentStyle) {
      case 'convex': {
        if (lineDist === 0) {
          const dist = (wordIdxInLine + 0.5) - focalPos;
          const absDist = Math.abs(dist);

          const targetScale = isWordActive ? 1.05 : 1.0 + 0.28 * Math.exp(-dist * dist * 0.45);
          const targetZ = 85 * Math.exp(-dist * dist * 0.4) - 25;
          const rotateY = Math.max(-28, Math.min(28, dist * 12));
          opacity = Math.max(0.24, 1.0 - absDist * 0.20).toFixed(2);

          // Perspective(900px) INSIDE transform prevents Chromium 3D flattening
          transform = `perspective(900px) translateZ(${targetZ.toFixed(1)}px) scale(${targetScale.toFixed(3)}) rotateY(${rotateY.toFixed(1)}deg)`;
          filter = 'none';
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
          wordRef.springZ.setTarget(35);
        } else {
          wordRef.springScale.setTarget(1.0);
          wordRef.springZ.setTarget(0);
        }
        transform = `translateZ(${wordRef.springZ.position.toFixed(1)}px) scale(${wordRef.springScale.position.toFixed(3)})`;
        filter = 'none';
        opacity = isWordActive ? '1.0' : isWordPast ? '0.85' : '0.35';
        break;
      }

      case 'editorial': {
        opacity = isWordActive ? '1.0' : isWordPast ? '0.78' : '0.24';
        if (word.isMelisma && isWordActive) {
          // Melisma stretch: GPU scaleX without reflowing layout
          const melismaScaleX = 1.0 + Math.min(0.18, curProgress * 0.18);
          transform = `translateY(-3px) scale(${melismaScaleX.toFixed(3)}, 1.04)`;
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

        if (word.semanticEffect === 'GRAVITY') {
          wordRef.springGravityY.setTarget(isWordActive ? 28 : 0);
          const curSinkY = wordRef.springGravityY.position;
          const curTilt = (curSinkY / 28) * 4;
          extraTransform = ` translateY(${curSinkY.toFixed(1)}px) rotate(${curTilt.toFixed(1)}deg)`;
        } else if (word.semanticEffect === 'PULSE') {
          if (isWordActive) {
            extraTransform = ' scale(1.16)';
          }
        } else if (word.semanticEffect === 'FRACTURE') {
          if (curProgress > 0.35) {
            const shear = ((curProgress - 0.35) / 0.65) * 4;
            if (wordRef.shearTopEl) wordRef.shearTopEl.style.transform = `translate(${shear.toFixed(1)}px, -1px)`;
            if (wordRef.shearBottomEl) wordRef.shearBottomEl.style.transform = `translate(-${shear.toFixed(1)}px, 1px)`;
          } else {
            if (wordRef.shearTopEl) wordRef.shearTopEl.style.transform = 'none';
            if (wordRef.shearBottomEl) wordRef.shearBottomEl.style.transform = 'none';
          }
        }

        transform = extraTransform || (isWordActive ? 'translateY(-3px) scale(1.04)' : 'none');
        filter = 'none';
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

  private tickCamera(
    activeWord: CachedWordRef | null,
    activeLineRef: CachedLineRef | null,
    currentMs: number,
    dt: number
  ): void {
    if (!this.cameraEl || !this.lyricsContainerEl) return;

    if (this.currentStyle === 'drift' && activeWord && activeLineRef) {
      const wordLeft = activeWord.cachedOffsetLeft ?? activeWord.el.offsetLeft;
      const wordWidth = activeWord.cachedWidth ?? activeWord.el.offsetWidth;
      const wordProg = Math.max(0, Math.min(1, (currentMs - activeWord.word.startMs) / Math.max(1, activeWord.word.durationMs)));
      const wordCenterX = wordLeft + wordWidth * wordProg;

      const targetCamX = -wordCenterX;
      this.cameraSpring.setTarget(targetCamX, 0);
      const camX = this.cameraSpring.x.position;
      activeLineRef.el.style.transform = `translateX(${camX.toFixed(1)}px) translateZ(35px) rotateY(-5deg) scale(1.02)`;
    } else if (this.currentStyle !== 'drift') {
      this.cameraSpring.reset(0, 0);
      this.cameraEl.style.transform = 'translate3d(0, 0, 0)';
    }
  }

  private tickRim(anyVocalActive: boolean, dt: number): void {
    if (!this.ambientRimEl || !this.rimEnabled) return;

    const targetOpacity = anyVocalActive ? 0.90 : 0.45;
    this.rimOpacitySpring.setTarget(targetOpacity);
    const curOpacity = this.rimOpacitySpring.position;
    this.ambientRimEl.style.opacity = curOpacity.toFixed(3);

    const targetRadius = anyVocalActive ? 180 : 110;
    this.rimRadiusSpring.setTarget(targetRadius);
    const curRadius = this.rimRadiusSpring.position;
    this.ambientRimEl.style.setProperty('--ve-rim-size', `${curRadius.toFixed(0)}px`);
  }

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
          wordRef.el.className = 've-word ve-word-future';
          wordRef.isMarkedFuture = true;
          wordRef.isMarkedPast = false;
          if (wordRef.shearTopEl) wordRef.shearTopEl.style.transform = 'none';
          if (wordRef.shearBottomEl) wordRef.shearBottomEl.style.transform = 'none';
        }
      }
    }
  }

  private findActiveLineIndex(currentMs: number): number {
    const totalLines = this.cachedLines.length;
    if (totalLines === 0) return 0;

    let idx = this.currentActiveLineIdx;
    if (idx < 0) idx = 0;
    if (idx >= totalLines) idx = totalLines - 1;

    const curLine = this.cachedLines[idx].line;

    if (currentMs >= curLine.startMs - 180 && currentMs <= curLine.endMs) {
      return idx;
    }

    if (currentMs > curLine.endMs) {
      while (idx + 1 < totalLines) {
        const nextLine = this.cachedLines[idx + 1].line;
        if (currentMs < nextLine.startMs - 180) {
          return currentMs - curLine.endMs < 2000 ? idx : idx + 1;
        }
        idx++;
        if (currentMs >= nextLine.startMs - 180 && currentMs <= nextLine.endMs) {
          return idx;
        }
      }
      return totalLines - 1;
    }

    if (currentMs < curLine.startMs - 180) {
      while (idx > 0) {
        idx--;
        const prevLine = this.cachedLines[idx].line;
        if (currentMs >= prevLine.startMs - 180 && currentMs <= prevLine.endMs) {
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

  private updateTelemetry(frameDurationMs: number, dt: number, energy: number, beatPulse: number): void {
    this.frameTimes.push(frameDurationMs);
    if (this.frameTimes.length > 60) this.frameTimes.shift();

    this.frameCount++;
    this.governorCheckTimer += dt;

    // Quality Governor check every 1.5 seconds
    if (this.governorCheckTimer > 1.5) {
      this.governorCheckTimer = 0;
      const sorted = [...this.frameTimes].sort((a, b) => a - b);
      const p95 = sorted[Math.floor(sorted.length * 0.95)] || 16.6;

      if (p95 > 22.0 && this.governorLevel < 2) {
        this.governorLevel++;
        if (this.webgl) {
          const dpr = this.governorLevel === 1 ? 1.25 : 1.0;
          const partCount = this.governorLevel === 1 ? 120 : 0;
          this.webgl.setQualityGovernor(dpr, partCount);
        }
      } else if (p95 < 13.0 && this.governorLevel > 0) {
        this.governorLevel--;
        if (this.webgl) {
          const dpr = this.governorLevel === 0 ? 1.5 : 1.25;
          const partCount = this.governorLevel === 0 ? 240 : 120;
          this.webgl.setQualityGovernor(dpr, partCount);
        }
      }
    }

    // Update HUD every 10 frames
    if (this.frameCount % 10 === 0 && this.stageView) {
      const avgDuration = this.frameTimes.reduce((a, b) => a + b, 0) / (this.frameTimes.length || 1);
      const fps = Math.min(144, 1000 / Math.max(1, avgDuration));
      const sorted = [...this.frameTimes].sort((a, b) => a - b);
      const low1PercentIdx = Math.max(0, Math.floor(sorted.length * 0.05));
      const low1Percent = Math.min(144, 1000 / Math.max(1, sorted[sorted.length - 1 - low1PercentIdx]));
      const activeLayers = this.cachedLines.filter(l => l.isPromotedLayer).length;

      this.stageView.updateHud(fps, low1Percent, avgDuration, energy, beatPulse, activeLayers);
    }
  }
}
