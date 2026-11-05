import {
  ProcessedTrack,
  VisualStyle,
  PaletteColors,
  PaletteType,
  LyricLine,
  LyricWord
} from '../types/lyrics';
import { CachedLineRef, CachedWordRef } from '../engine/AnimationEngine';
import { HarmonicSpring } from '../engine/SpringSolver';
import { Clock } from '../engine/Clock';

export interface StageCallbacks {
  onStyleChange: (style: VisualStyle) => void;
  onPaletteChange: (paletteType: PaletteType) => void;
  onRimToggle: (enabled: boolean) => void;
  onClose: () => void;
}

export class StageView {
  private rootEl: HTMLElement | null = null;
  private rimPrimaryEl: HTMLElement | null = null;
  private cameraEl: HTMLElement | null = null;
  private lyricsContainerEl: HTMLElement | null = null;
  private controlPillEl: HTMLElement | null = null;

  private hideTimeout: number | null = null;
  private clock: Clock = Clock.getInstance();
  private callbacks: StageCallbacks;

  private currentStyle: VisualStyle = 'convex';
  private currentPaletteType: PaletteType = 'album';
  private rimEnabled: boolean = true;
  private syncOffsetDisplayEl: HTMLElement | null = null;
  private cachedLines: CachedLineRef[] = [];

  constructor(callbacks: StageCallbacks) {
    this.callbacks = callbacks;
    this.loadSavedPreferences();
    this.injectGoogleFonts();
  }

  private loadSavedPreferences(): void {
    try {
      const savedStyle = localStorage.getItem('verse_engine_style') as VisualStyle;
      if (savedStyle && ['convex', 'drift', 'editorial', 'semantic'].includes(savedStyle)) {
        this.currentStyle = savedStyle;
      }
      const savedPalette = localStorage.getItem('verse_engine_palette') as PaletteType;
      if (savedPalette && ['album', 'editorial', 'obsidian'].includes(savedPalette)) {
        this.currentPaletteType = savedPalette;
      }
      const savedRim = localStorage.getItem('verse_engine_rim');
      if (savedRim !== null) {
        this.rimEnabled = savedRim === 'true';
      }
    } catch {}
  }

  public getSavedStyle(): VisualStyle {
    return this.currentStyle;
  }

  public getSavedPaletteType(): PaletteType {
    return this.currentPaletteType;
  }

  public getSavedRimEnabled(): boolean {
    return this.rimEnabled;
  }

  private injectGoogleFonts(): void {
    const id = 'verse-engine-fonts';
    if (!document.getElementById(id)) {
      const link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      link.href =
        'https://fonts.googleapis.com/css2?family=Instrument+Serif:ital,wght@0,400;1,400&family=Plus+Jakarta+Sans:wght@600;700;800&family=Syne:wght@700;800&display=swap';
      document.head.appendChild(link);
    }
  }

  public mount(): {
    rootEl: HTMLElement;
    cameraEl: HTMLElement;
    ambientRimEl: HTMLElement;
    lyricsContainerEl: HTMLElement;
  } {
    let root = document.getElementById('verse-engine-stage');
    if (!root) {
      root = document.createElement('div');
      root.id = 'verse-engine-stage';
      document.body.appendChild(root);
    }
    this.rootEl = root;

    this.rootEl.innerHTML = `
      <style>
        #verse-engine-stage {
          position: fixed;
          inset: 0;
          z-index: 99999;
          width: 100vw;
          height: 100vh;
          overflow: hidden;
          background-color: var(--ve-bg, #0A0808);
          font-family: 'Plus Jakarta Sans', 'SpotifyMixUI', 'CircularSp', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          user-select: none;
          transition: background-color 0.4s ease;
          animation: veStageFadeIn 0.3s ease-out forwards;
        }

        /* Clean opacity fade: ZERO permanent blur or transform filters on the root stage */
        @keyframes veStageFadeIn {
          0%   { opacity: 0; }
          100% { opacity: 1; }
        }

        /* Lumn-style 4-edge Ambient Bezel Rim Lighting */
        #ve-ambient-rim {
          position: absolute;
          inset: 0;
          background:
            radial-gradient(ellipse 100% 100% at 50% 100%, var(--ve-rim-primary, rgba(140,20,33,0.65)) 0%, transparent var(--ve-rim-size, 65%)),
            radial-gradient(ellipse 100%  60% at 50%   0%, var(--ve-rim-primary, rgba(140,20,33,0.45)) 0%, transparent var(--ve-rim-size, 60%)),
            radial-gradient(ellipse  60% 100% at  0%  50%, var(--ve-rim-secondary, rgba(92,20,33,0.35)) 0%, transparent 55%),
            radial-gradient(ellipse  60% 100% at 100% 50%, var(--ve-rim-secondary, rgba(92,20,33,0.35)) 0%, transparent 55%);
          pointer-events: none;
          z-index: 5;
          opacity: 0.85;
          transition: opacity 0.3s ease;
        }

        /* Cinematic Atmospheric Viewport Mask: lyrics dissolve into mist at top/bottom */
        .ve-perspective-stage {
          position: absolute;
          inset: 0;
          overflow: hidden;
          pointer-events: auto;
          -webkit-mask-image: linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.6) 12%, black 22%, black 78%, rgba(0,0,0,0.6) 88%, transparent 100%);
          mask-image: linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.6) 12%, black 22%, black 78%, rgba(0,0,0,0.6) 88%, transparent 100%);
          z-index: 10;
        }

        .ve-camera {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
        }

        /* Vertical scrolling kinetic lyrics container (only element with will-change) */
        .ve-lyrics-container {
          position: absolute;
          top: 0;
          left: 8vw;
          width: 84vw;
          max-width: 1400px;
          box-sizing: border-box;
          padding-top: 15vh;
          padding-bottom: 55vh;
          pointer-events: auto;
          will-change: transform;
        }

        /* Line structure: ZERO CSS transitions so JS RAF loop never fights CSS */
        .ve-line {
          position: relative;
          display: flex;
          flex-wrap: wrap;
          align-items: baseline;
          justify-content: flex-start;
          row-gap: 0.35em;
          line-height: 1.36;
          margin: 1.8rem 0;
          cursor: pointer;
        }

        .ve-line:hover {
          opacity: 0.90 !important;
        }

        /* Words: Single-element soft liquid karaoke sweep with full kerning & ligatures */
        .ve-word {
          position: relative;
          display: inline-flex;
          align-items: baseline;
          white-space: nowrap;
          margin-right: 0.32em !important;
          font-size: clamp(2.3rem, 3.8vw, 4.2rem);
          font-weight: 700;
          letter-spacing: -0.015em;
          transform-origin: center baseline;
          background: linear-gradient(
            90deg,
            var(--ve-highlight, #FAF9F6) 0%,
            var(--ve-highlight, #FAF9F6) var(--word-p, 0%),
            var(--ve-text-inactive, rgba(250, 249, 246, 0.28)) calc(var(--word-p, 0%) + 14%),
            var(--ve-text-inactive, rgba(250, 249, 246, 0.28)) 100%
          );
          background-clip: text;
          -webkit-background-clip: text;
          color: transparent;
        }

        /* ── 1. CONVEX / FISHEYE MODE ── */
        .ve-style-convex .ve-line {
          margin: 2.2rem 0 !important;
        }
        .ve-style-convex .ve-word {
          font-size: clamp(2.4rem, 4.0vw, 4.4rem);
          font-weight: 700;
        }

        /* ── 2. DRIFT / SHIP MARQUEE MODE (Continuous un-wrapped kinetic ribbon) ── */
        .ve-style-drift {
          width: max-content !important;
          max-width: none !important;
          left: 0 !important;
          padding: 0 !important;
        }
        .ve-style-drift .ve-line {
          flex-wrap: nowrap !important;
          white-space: nowrap !important;
          width: max-content !important;
          margin: 2.8rem 0 !important;
          padding-left: 36vw !important;
        }
        .ve-style-drift .ve-word {
          font-family: 'Syne', 'Plus Jakarta Sans', sans-serif !important;
          font-size: clamp(3.0rem, 5.2vw, 5.4rem) !important;
          font-weight: 800 !important;
          text-transform: uppercase !important;
          letter-spacing: -0.01em !important;
          margin-right: 0.35em !important;
        }

        /* ── 3. EDITORIAL MODE (Swiss Haute-Couture Typographic Press) ── */
        .ve-style-editorial {
          left: 10vw !important;
          max-width: 1200px !important;
        }
        .ve-style-editorial .ve-line {
          margin: 2.4rem 0 !important;
          position: relative;
        }
        .ve-style-editorial .ve-line-active::after {
          content: '';
          position: absolute;
          bottom: -10px;
          left: 0;
          width: var(--line-progress, 0%);
          height: 2px;
          background: var(--ve-primary);
          opacity: 0.85;
          box-shadow: 0 0 10px var(--ve-primary);
        }
        .ve-style-editorial .ve-word {
          font-size: clamp(2.4rem, 4.2vw, 4.5rem);
          font-weight: 700;
        }
        .ve-style-editorial .ve-word-key,
        .ve-word-adlib {
          font-family: 'Instrument Serif', Georgia, serif !important;
          font-style: italic !important;
          font-size: 1.25em !important;
          font-weight: 400 !important;
          letter-spacing: 0.02em !important;
        }

        /* ── 4. SEMANTIC LIVING PHYSICS MODE ── */
        .ve-style-semantic .ve-line {
          margin: 2.0rem 0;
        }
        .ve-style-semantic .ve-word {
          font-size: clamp(2.4rem, 4.0vw, 4.4rem);
          font-weight: 700;
        }

        /* FRACTURE twin clip-path layers */
        .ve-fracture-top {
          clip-path: polygon(0 0, 100% 0, 100% 48%, 0 55%);
          position: relative;
          display: inline-block;
        }
        .ve-fracture-bottom {
          clip-path: polygon(0 55%, 100% 48%, 100% 100%, 0 100%);
          position: absolute;
          top: 0;
          left: 0;
          display: inline-block;
        }

        /* ECHO ghost clones */
        .ve-echo-clone-1,
        .ve-echo-clone-2 {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          pointer-events: none;
          -webkit-text-stroke: 1.5px var(--ve-primary);
          color: transparent;
          opacity: 0;
        }

        /* Liquid Glass Auto-Hiding Control Pill */
        .ve-control-pill {
          position: fixed;
          bottom: 24px;
          left: 50%;
          transform: translateX(-50%) translateY(0);
          z-index: 100000;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 14px;
          border-radius: 9999px;
          backdrop-filter: blur(24px) saturate(180%);
          -webkit-backdrop-filter: blur(24px) saturate(180%);
          background: rgba(14, 12, 16, 0.72);
          border: 1px solid rgba(255, 255, 255, 0.12);
          box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5), 0 0 1px rgba(255, 255, 255, 0.15);
          color: #FAF9F6;
          font-size: 11px;
          font-weight: 500;
          transition: opacity 0.3s ease, transform 0.3s ease;
          pointer-events: auto;
        }

        .ve-pill-btn {
          background: transparent;
          border: none;
          color: rgba(250, 249, 246, 0.55);
          padding: 4px 8px;
          border-radius: 9999px;
          font-size: 10.5px;
          font-weight: 600;
          letter-spacing: 0.02em;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .ve-pill-btn:hover {
          color: #FAF9F6;
        }

        .ve-pill-btn.active {
          color: var(--ve-primary, #E03E52);
          background: rgba(255, 255, 255, 0.08);
        }

        .ve-pill-divider {
          width: 1px;
          height: 14px;
          background: rgba(255, 255, 255, 0.14);
        }
      </style>

      <div id="ve-ambient-rim"></div>

      <div class="ve-perspective-stage">
        <div class="ve-camera" id="ve-camera">
          <div class="ve-lyrics-container" id="ve-lyrics-container"></div>
        </div>
      </div>

      <div class="ve-control-pill" id="ve-control-pill"></div>
    `;

    this.rimPrimaryEl = document.getElementById('ve-ambient-rim');
    this.cameraEl = document.getElementById('ve-camera');
    this.lyricsContainerEl = document.getElementById('ve-lyrics-container');
    this.controlPillEl = document.getElementById('ve-control-pill');

    this.renderControlPill();
    this.bindActivityListeners();
    this.applyStyleClass(this.currentStyle);

    return {
      rootEl: this.rootEl,
      cameraEl: this.cameraEl!,
      ambientRimEl: this.rimPrimaryEl!,
      lyricsContainerEl: this.lyricsContainerEl!
    };
  }

  private applyStyleClass(style: VisualStyle): void {
    if (!this.lyricsContainerEl) return;
    this.lyricsContainerEl.className = `ve-lyrics-container ve-style-${style}`;
  }

  public applyPalette(palette: PaletteColors): void {
    if (!this.rootEl) return;
    this.rootEl.style.setProperty('--ve-bg', palette.bg);
    this.rootEl.style.setProperty('--ve-primary', palette.primary);
    this.rootEl.style.setProperty('--ve-secondary', palette.secondary);
    this.rootEl.style.setProperty('--ve-highlight', palette.highlight);
    this.rootEl.style.setProperty('--ve-text-inactive', palette.textInactive);

    const rimPrimary = this._deriveRimColor(palette.primary, 0.65);
    const rimSecondary = this._deriveRimColor(palette.secondary, 0.35);
    this.rootEl.style.setProperty('--ve-rim-primary', rimPrimary);
    this.rootEl.style.setProperty('--ve-rim-secondary', rimSecondary);
  }

  private _deriveRimColor(colorStr: string, alpha: number): string {
    const rgbaMatch = colorStr.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (rgbaMatch) {
      return `rgba(${rgbaMatch[1]}, ${rgbaMatch[2]}, ${rgbaMatch[3]}, ${alpha})`;
    }
    const hexMatch = colorStr.match(/^#([0-9a-fA-F]{3,8})$/);
    if (hexMatch) {
      let hex = hexMatch[1];
      if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    return `rgba(140, 20, 33, ${alpha})`;
  }

  /**
   * Builds the DOM tree ONCE for the song.
   * Words are single spans with soft liquid gradient wipes.
   */
  public renderLyrics(track: ProcessedTrack): CachedLineRef[] {
    if (!this.lyricsContainerEl) return [];

    this.lyricsContainerEl.innerHTML = '';
    const cachedLines: CachedLineRef[] = [];

    track.lines.forEach((line) => {
      const lineEl = document.createElement('div');
      lineEl.className = 've-line';
      lineEl.id = line.id;
      lineEl.addEventListener('click', (e) => {
        e.stopPropagation();
        if (typeof Spicetify !== 'undefined' && Spicetify.Player) {
          Spicetify.Player.seek(line.startMs);
        }
      });

      const cachedWords: CachedWordRef[] = [];

      line.words.forEach((word, wIdx) => {
        const wordEl = document.createElement('span');
        wordEl.className = 've-word';
        wordEl.id = word.id;

        if (word.semanticEffect !== 'NONE') {
          wordEl.classList.add('ve-word-key');
        }
        if (word.isAdLib) {
          wordEl.classList.add('ve-word-adlib');
        }

        let shearTopEl: HTMLElement | undefined;
        let shearBottomEl: HTMLElement | undefined;

        if (word.semanticEffect === 'FRACTURE') {
          wordEl.innerHTML = `<span class="ve-fracture-top">${word.text}</span><span class="ve-fracture-bottom">${word.text}</span>`;
          shearTopEl = wordEl.querySelector('.ve-fracture-top') as HTMLElement;
          shearBottomEl = wordEl.querySelector('.ve-fracture-bottom') as HTMLElement;
        } else {
          wordEl.textContent = word.text;
        }

        const echoClones: HTMLElement[] = [];
        if (word.semanticEffect === 'ECHO') {
          for (let ci = 1; ci <= 2; ci++) {
            const clone = document.createElement('span');
            clone.className = `ve-echo-clone-${ci}`;
            clone.textContent = word.cleanText;
            wordEl.appendChild(clone);
            echoClones.push(clone);
          }
        }

        cachedWords.push({
          el: wordEl,
          word,
          lineIndex: line.index,
          wordIndex: wIdx,
          springZ: new HarmonicSpring(0, 140, 22),
          springBlur: new HarmonicSpring(0, 140, 22),
          springScale: new HarmonicSpring(1.0, 150, 24),
          springProgress: new HarmonicSpring(0.0, 200, 22),
          springGravityY: new HarmonicSpring(0, 160, 20),
          shearTopEl,
          shearBottomEl,
          echoClones
        });

        lineEl.appendChild(wordEl);
      });

      this.lyricsContainerEl!.appendChild(lineEl);

      cachedLines.push({
        el: lineEl,
        line,
        words: cachedWords
      });
    });

    this.cachedLines = cachedLines;
    return cachedLines;
  }

  public getCachedLines(): CachedLineRef[] {
    return this.cachedLines;
  }

  private renderControlPill(): void {
    if (!this.controlPillEl) return;

    this.controlPillEl.innerHTML = `
      <!-- STYLES -->
      <div style="display: flex; gap: 3px;">
        <button class="ve-pill-btn ${this.currentStyle === 'convex' ? 'active' : ''}" data-style="convex">Convex</button>
        <button class="ve-pill-btn ${this.currentStyle === 'drift' ? 'active' : ''}" data-style="drift">Drift</button>
        <button class="ve-pill-btn ${this.currentStyle === 'editorial' ? 'active' : ''}" data-style="editorial">Editorial</button>
        <button class="ve-pill-btn ${this.currentStyle === 'semantic' ? 'active' : ''}" data-style="semantic">Semantic</button>
      </div>

      <div class="ve-pill-divider"></div>

      <!-- PALETTES -->
      <div style="display: flex; gap: 3px;">
        <button class="ve-pill-btn ${this.currentPaletteType === 'album' ? 'active' : ''}" data-palette="album">Album Sync</button>
        <button class="ve-pill-btn ${this.currentPaletteType === 'editorial' ? 'active' : ''}" data-palette="editorial">Maroon &amp; Bone</button>
        <button class="ve-pill-btn ${this.currentPaletteType === 'obsidian' ? 'active' : ''}" data-palette="obsidian">Obsidian</button>
      </div>

      <div class="ve-pill-divider"></div>

      <!-- RIM TOGGLE -->
      <button class="ve-pill-btn ${this.rimEnabled ? 'active' : ''}" id="ve-rim-btn">Rim ${this.rimEnabled ? 'On' : 'Off'}</button>

      <div class="ve-pill-divider"></div>

      <!-- SYNC OFFSET -->
      <div style="display: flex; align-items: center; gap: 2px;">
        <button class="ve-pill-btn" id="ve-sync-down">-50ms</button>
        <span id="ve-sync-display" style="font-size: 9.5px; opacity: 0.65; min-width: 28px; text-align: center;">0ms</span>
        <button class="ve-pill-btn" id="ve-sync-up">+50ms</button>
      </div>

      <div class="ve-pill-divider"></div>

      <!-- ESC CLOSE -->
      <button class="ve-pill-btn" id="ve-close-btn" style="color: #FAF9F6; font-weight: 700;">
        ESC
      </button>
    `;

    this.syncOffsetDisplayEl = document.getElementById('ve-sync-display');
    this.updateSyncDisplay();
    this.bindPillEvents();
  }

  private bindPillEvents(): void {
    if (!this.controlPillEl) return;

    this.controlPillEl.querySelectorAll('[data-style]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const style = (btn as HTMLElement).getAttribute('data-style') as VisualStyle;
        if (style && style !== this.currentStyle) {
          this.currentStyle = style;
          try {
            localStorage.setItem('verse_engine_style', style);
          } catch {}
          this.applyStyleClass(style);
          this.callbacks.onStyleChange(style);
          this.renderControlPill();
        }
      });
    });

    this.controlPillEl.querySelectorAll('[data-palette]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const palette = (btn as HTMLElement).getAttribute('data-palette') as PaletteType;
        if (palette) {
          this.currentPaletteType = palette;
          try {
            localStorage.setItem('verse_engine_palette', palette);
          } catch {}
          this.callbacks.onPaletteChange(palette);
          this.renderControlPill();
        }
      });
    });

    document.getElementById('ve-rim-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.rimEnabled = !this.rimEnabled;
      try {
        localStorage.setItem('verse_engine_rim', this.rimEnabled ? 'true' : 'false');
      } catch {}
      this.callbacks.onRimToggle(this.rimEnabled);
      this.renderControlPill();
    });

    document.getElementById('ve-sync-down')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.clock.adjustSyncOffset(-50);
      this.updateSyncDisplay();
    });

    document.getElementById('ve-sync-up')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.clock.adjustSyncOffset(50);
      this.updateSyncDisplay();
    });

    document.getElementById('ve-close-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.callbacks.onClose();
    });
  }

  private updateSyncDisplay(): void {
    if (this.syncOffsetDisplayEl) {
      const offset = this.clock.getSyncOffset();
      this.syncOffsetDisplayEl.textContent = `${offset >= 0 ? '+' : ''}${offset}ms`;
    }
  }

  private bindActivityListeners(): void {
    if (!this.rootEl) return;

    const resetIdleTimer = () => {
      if (!this.rootEl || !this.controlPillEl) return;
      this.rootEl.style.cursor = 'default';
      this.controlPillEl.style.opacity = '1';
      this.controlPillEl.style.transform = 'translateX(-50%) translateY(0)';
      this.controlPillEl.style.pointerEvents = 'auto';

      if (this.hideTimeout !== null) {
        window.clearTimeout(this.hideTimeout);
      }

      this.hideTimeout = window.setTimeout(() => {
        if (!this.rootEl || !this.controlPillEl) return;
        this.rootEl.style.cursor = 'none';
        this.controlPillEl.style.opacity = '0';
        this.controlPillEl.style.transform = 'translateX(-50%) translateY(16px)';
        this.controlPillEl.style.pointerEvents = 'none';
      }, 2000);
    };

    window.addEventListener('mousemove', resetIdleTimer);
    window.addEventListener('keydown', resetIdleTimer);
    resetIdleTimer();
  }

  public unmount(): void {
    if (this.hideTimeout !== null) {
      window.clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }
    if (this.rootEl && this.rootEl.parentElement) {
      this.rootEl.parentElement.removeChild(this.rootEl);
    }
    this.rootEl = null;
    this.rimPrimaryEl = null;
    this.cameraEl = null;
    this.lyricsContainerEl = null;
    this.controlPillEl = null;
  }
}
