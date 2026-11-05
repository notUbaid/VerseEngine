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
  onToggleHud?: () => void;
}

export class StageView {
  private rootEl: HTMLElement | null = null;
  private rimPrimaryEl: HTMLElement | null = null;
  private cameraEl: HTMLElement | null = null;
  private lyricsContainerEl: HTMLElement | null = null;
  private controlPillEl: HTMLElement | null = null;
  private titleCardEl: HTMLElement | null = null;
  private interludeEl: HTMLElement | null = null;
  private devHudEl: HTMLElement | null = null;

  private hideTimeout: number | null = null;
  private clock: Clock = Clock.getInstance();
  private callbacks: StageCallbacks;

  private currentStyle: VisualStyle = 'convex';
  private currentPaletteType: PaletteType = 'album';
  private rimEnabled: boolean = true;
  private isHudVisible: boolean = false;
  private syncOffsetDisplayEl: HTMLElement | null = null;
  private cachedLines: CachedLineRef[] = [];

  constructor(callbacks: StageCallbacks) {
    this.callbacks = callbacks;
    this.loadSavedPreferences();
    this.injectFontCascades();
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

  private injectFontCascades(): void {
    const id = 'verse-engine-fonts';
    if (!document.getElementById(id)) {
      const link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      link.href =
        'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800&family=Instrument+Serif:ital@0;1&family=Plus+Jakarta+Sans:wght@600;700;800&family=Syne:wght@700;800&display=swap';
      document.head.appendChild(link);
    }
  }

  public mount(): {
    rootEl: HTMLElement;
    cameraEl: HTMLElement;
    ambientRimEl: HTMLElement;
    lyricsContainerEl: HTMLElement;
    titleCardEl: HTMLElement;
    interludeEl: HTMLElement;
    devHudEl: HTMLElement;
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
          font-family: 'Bricolage Grotesque', 'Plus Jakarta Sans', 'Inter Tight', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-feature-settings: "kern" 1, "liga" 1;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          user-select: none;
          transition: background-color 0.4s ease;
          animation: veStageFadeIn 0.3s ease-out forwards;
        }

        @keyframes veStageFadeIn {
          0%   { opacity: 0; }
          100% { opacity: 1; }
        }

        /* ── LAYER 1: ATMOSPHERE (Lumn-Style 4-Edge Peripheral Rim Glow) ── */
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

        /* ── LAYER 2: TEXT (The Hero Viewport & Atmosphere Mask) ── */
        .ve-perspective-stage {
          position: absolute;
          inset: 0;
          overflow: hidden;
          pointer-events: auto;
          -webkit-mask-image: linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.6) 10%, black 20%, black 80%, rgba(0,0,0,0.6) 90%, transparent 100%);
          mask-image: linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.6) 10%, black 20%, black 80%, rgba(0,0,0,0.6) 90%, transparent 100%);
          z-index: 10;
        }

        .ve-camera {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
        }

        .ve-lyrics-container {
          position: absolute;
          top: 0;
          left: 10vw;
          width: 80vw;
          max-width: 1440px;
          box-sizing: border-box;
          padding-top: 20vh;
          padding-bottom: 55vh;
          pointer-events: auto;
        }

        /* Line structure: compositor-only transforms, strictly contained */
        .ve-line {
          position: relative;
          display: flex;
          flex-wrap: wrap;
          align-items: baseline;
          justify-content: flex-start;
          row-gap: 0.25em;
          line-height: 1.08;
          margin: 3.2rem 0;
          cursor: pointer;
          contain: layout paint;
          text-wrap: balance;
          transform-origin: center center;
        }

        .ve-line:hover {
          opacity: 0.95 !important;
        }

        /* Single blurred glow layer behind the active line */
        .ve-line-glow {
          position: absolute;
          inset: -12px -20px;
          border-radius: 24px;
          background: radial-gradient(ellipse at center, var(--ve-primary) 0%, transparent 75%);
          opacity: 0;
          filter: blur(28px);
          pointer-events: none;
          z-index: -1;
          transition: opacity 0.3s ease;
        }

        .ve-line.is-active .ve-line-glow {
          opacity: 0.28;
        }

        /* ── HERO WORD TYPOGRAPHY ── */
        .ve-word {
          position: relative;
          display: inline-flex;
          align-items: baseline;
          white-space: nowrap;
          margin-right: 0.32em !important;
          font-size: clamp(3.6rem, 6.2vw, 6.8rem);
          font-weight: 700;
          letter-spacing: -0.03em;
          transform-origin: center baseline;
          color: var(--ve-text-inactive, rgba(250, 249, 246, 0.28));
          transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        /* Active word soft-edge wipe */
        .ve-word.is-active {
          background: linear-gradient(
            90deg,
            var(--ve-highlight, #FAF9F6) calc(var(--p, 0%) - 14%),
            var(--ve-text-inactive, rgba(250, 249, 246, 0.28)) var(--p, 0%)
          );
          background-clip: text;
          -webkit-background-clip: text;
          color: transparent;
          transform: translateY(-3px) scale(1.04);
        }

        /* Past settled words: static class with zero continuous gradient write */
        .ve-word.ve-word-past {
          color: var(--ve-highlight, #FAF9F6) !important;
          background: none !important;
          -webkit-background-clip: initial !important;
          opacity: 0.95;
          transform: translateY(0) scale(1.0);
        }

        /* Future words: static class */
        .ve-word.ve-word-future {
          color: var(--ve-text-inactive, rgba(250, 249, 246, 0.28)) !important;
          background: none !important;
          -webkit-background-clip: initial !important;
          transform: translateY(0) scale(1.0);
        }

        /* ── 1. CONVEX / OPTICAL DOME MODE (The Refined Hero Default) ── */
        .ve-style-convex .ve-line {
          margin: 3.4rem 0 !important;
        }

        /* ── 2. DRIFT MARQUEE MODE (Unwrapped Horizontal Ribbon) ── */
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
          margin: 3.6rem 0 !important;
          padding-left: 36vw !important;
        }
        .ve-style-drift .ve-word {
          font-family: 'Syne', sans-serif !important;
          font-size: clamp(4.0rem, 7.2vw, 7.8rem) !important;
          font-weight: 800 !important;
          text-transform: uppercase !important;
          letter-spacing: -0.02em !important;
        }

        /* ── 3. EDITORIAL MODE (Swiss Print Press) ── */
        .ve-style-editorial {
          left: 12vw !important;
          max-width: 1200px !important;
        }
        .ve-style-editorial .ve-line {
          margin: 3.2rem 0 !important;
        }
        .ve-style-editorial .ve-line.is-active::after {
          content: '';
          position: absolute;
          bottom: -12px;
          left: 0;
          width: var(--line-progress, 0%);
          height: 2px;
          background: var(--ve-primary);
          opacity: 0.85;
          box-shadow: 0 0 10px var(--ve-primary);
        }
        .ve-style-editorial .ve-word-key,
        .ve-word-adlib {
          font-family: 'Instrument Serif', Georgia, serif !important;
          font-style: italic !important;
          font-size: 1.18em !important;
          font-weight: 400 !important;
          letter-spacing: 0.01em !important;
        }

        /* ── 4. SEMANTIC LIVING PHYSICS ── */
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

        /* ── FILM TITLE CARD INTRO & OUTRO ── */
        #ve-title-card {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          z-index: 20;
          pointer-events: none;
          opacity: 0;
          transition: opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1);
        }
        #ve-title-card.is-visible {
          opacity: 1;
        }
        .ve-title-art {
          width: 140px;
          height: 140px;
          border-radius: 16px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6), 0 0 40px var(--ve-primary);
          margin-bottom: 2rem;
          object-fit: cover;
        }
        .ve-title-heading {
          font-size: clamp(2.8rem, 5.0vw, 5.2rem);
          font-weight: 800;
          letter-spacing: -0.035em;
          color: var(--ve-highlight, #FAF9F6);
          text-align: center;
          line-height: 1.1;
          margin: 0;
        }
        .ve-title-artist {
          font-family: 'Instrument Serif', Georgia, serif;
          font-style: italic;
          font-size: clamp(1.8rem, 2.8vw, 3.0rem);
          color: var(--ve-accent, #E03E52);
          margin-top: 0.6rem;
          opacity: 0.90;
        }

        /* ── INSTRUMENTAL INTERLUDE (Breathing Dots) ── */
        #ve-interlude {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          z-index: 15;
          pointer-events: none;
          opacity: 0;
          transition: opacity 0.6s ease;
        }
        #ve-interlude.is-visible {
          opacity: 1;
        }
        .ve-interlude-dots {
          display: flex;
          gap: 16px;
        }
        .ve-interlude-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: var(--ve-highlight, #FAF9F6);
          opacity: 0.4;
          animation: veDotPulse 1.8s infinite ease-in-out;
        }
        .ve-interlude-dot:nth-child(2) { animation-delay: 0.3s; }
        .ve-interlude-dot:nth-child(3) { animation-delay: 0.6s; }

        @keyframes veDotPulse {
          0%, 100% { opacity: 0.25; transform: scale(0.9); }
          50%      { opacity: 0.95; transform: scale(1.3); box-shadow: 0 0 16px var(--ve-primary); }
        }

        /* ── DEV TELEMETRY HUD (Shift + D) ── */
        #ve-dev-hud {
          position: fixed;
          top: 24px;
          right: 28px;
          z-index: 100001;
          background: rgba(14, 12, 16, 0.85);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 12px;
          padding: 10px 14px;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 11px;
          color: #FAF9F6;
          display: none;
          pointer-events: none;
        }
        #ve-dev-hud.is-visible {
          display: block;
        }

        /* ── LIQUID GLASS CONTROL ICON DOCK ── */
        .ve-control-dock {
          position: fixed;
          bottom: 24px;
          left: 50%;
          transform: translateX(-50%) translateY(0);
          z-index: 100000;
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 10px;
          border-radius: 9999px;
          backdrop-filter: blur(24px) saturate(180%);
          -webkit-backdrop-filter: blur(24px) saturate(180%);
          background: rgba(14, 12, 16, 0.76);
          border: 1px solid rgba(255, 255, 255, 0.12);
          box-shadow: 0 12px 36px rgba(0, 0, 0, 0.55), 0 0 1px rgba(255, 255, 255, 0.20);
          color: #FAF9F6;
          transition: opacity 0.3s ease, transform 0.3s ease;
          pointer-events: auto;
        }

        .ve-dock-btn {
          background: transparent;
          border: none;
          color: rgba(250, 249, 246, 0.60);
          padding: 6px 10px;
          border-radius: 9999px;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.02em;
          cursor: pointer;
          transition: all 0.15s ease;
          display: flex;
          align-items: center;
          gap: 5px;
        }
        .ve-dock-btn:hover {
          color: #FAF9F6;
          background: rgba(255, 255, 255, 0.08);
        }
        .ve-dock-btn.active {
          color: var(--ve-primary, #E03E52);
          background: rgba(255, 255, 255, 0.12);
        }
        .ve-dock-divider {
          width: 1px;
          height: 16px;
          background: rgba(255, 255, 255, 0.14);
          margin: 0 2px;
        }
      </style>

      <div id="ve-ambient-rim"></div>

      <div class="ve-perspective-stage">
        <div class="ve-camera" id="ve-camera">
          <div class="ve-lyrics-container" id="ve-lyrics-container"></div>
        </div>
      </div>

      <div id="ve-title-card">
        <img class="ve-title-art" id="ve-title-art" src="" alt="Album Art" />
        <h1 class="ve-title-heading" id="ve-title-heading">Song Title</h1>
        <div class="ve-title-artist" id="ve-title-artist">Artist</div>
      </div>

      <div id="ve-interlude">
        <div class="ve-interlude-dots">
          <div class="ve-interlude-dot"></div>
          <div class="ve-interlude-dot"></div>
          <div class="ve-interlude-dot"></div>
        </div>
      </div>

      <div id="ve-dev-hud">
        <div>FPS: <span id="hud-fps">0</span> | 1% Low: <span id="hud-low">0</span></div>
        <div>Frame: <span id="hud-frame">0.0</span>ms | Energy: <span id="hud-energy">0.0</span></div>
        <div>Beat: <span id="hud-beat">0.0</span> | Layers: <span id="hud-layers">0</span></div>
      </div>

      <div class="ve-control-dock" id="ve-control-dock"></div>
    `;

    this.rimPrimaryEl = document.getElementById('ve-ambient-rim');
    this.cameraEl = document.getElementById('ve-camera');
    this.lyricsContainerEl = document.getElementById('ve-lyrics-container');
    this.titleCardEl = document.getElementById('ve-title-card');
    this.interludeEl = document.getElementById('ve-interlude');
    this.devHudEl = document.getElementById('ve-dev-hud');
    this.controlPillEl = document.getElementById('ve-control-dock');

    this.renderControlDock();
    this.bindActivityListeners();
    this.applyStyleClass(this.currentStyle);

    return {
      rootEl: this.rootEl,
      cameraEl: this.cameraEl!,
      ambientRimEl: this.rimPrimaryEl!,
      lyricsContainerEl: this.lyricsContainerEl!,
      titleCardEl: this.titleCardEl!,
      interludeEl: this.interludeEl!,
      devHudEl: this.devHudEl!
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
    this.rootEl.style.setProperty('--ve-accent', palette.accent);
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
   * Builds the DOM tree once for the song.
   * Words are single spans with soft liquid gradient wipes.
   * One duplicate glow element per line.
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

      // Duplicate blurred glow layer behind the line
      const lineGlow = document.createElement('div');
      lineGlow.className = 've-line-glow';
      lineGlow.setAttribute('aria-hidden', 'true');
      lineEl.appendChild(lineGlow);

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

        // Curly apostrophe normalization
        const formattedText = word.text.replace(/'/g, '’');

        let shearTopEl: HTMLElement | undefined;
        let shearBottomEl: HTMLElement | undefined;

        if (word.semanticEffect === 'FRACTURE') {
          wordEl.innerHTML = `<span class="ve-fracture-top">${formattedText}</span><span class="ve-fracture-bottom">${formattedText}</span>`;
          shearTopEl = wordEl.querySelector('.ve-fracture-top') as HTMLElement;
          shearBottomEl = wordEl.querySelector('.ve-fracture-bottom') as HTMLElement;
        } else {
          wordEl.textContent = formattedText;
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
          springScale: new HarmonicSpring(1.0, 190, 22),
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

  public showTitleCard(title: string, artist: string, artUrl: string): void {
    if (!this.titleCardEl) return;
    const h = document.getElementById('ve-title-heading');
    const a = document.getElementById('ve-title-artist');
    const img = document.getElementById('ve-title-art') as HTMLImageElement;
    if (h) h.textContent = title;
    if (a) a.textContent = artist;
    if (img && artUrl) img.src = artUrl;
    this.titleCardEl.classList.add('is-visible');
  }

  public hideTitleCard(): void {
    if (this.titleCardEl) {
      this.titleCardEl.classList.remove('is-visible');
    }
  }

  public setInterludeVisible(visible: boolean): void {
    if (this.interludeEl) {
      if (visible) this.interludeEl.classList.add('is-visible');
      else this.interludeEl.classList.remove('is-visible');
    }
  }

  public toggleHud(): void {
    this.isHudVisible = !this.isHudVisible;
    if (this.devHudEl) {
      if (this.isHudVisible) this.devHudEl.classList.add('is-visible');
      else this.devHudEl.classList.remove('is-visible');
    }
  }

  public updateHud(fps: number, low1Percent: number, frameMs: number, energy: number, beat: number, layers: number): void {
    if (!this.isHudVisible) return;
    const f = document.getElementById('hud-fps');
    const l = document.getElementById('hud-low');
    const m = document.getElementById('hud-frame');
    const e = document.getElementById('hud-energy');
    const b = document.getElementById('hud-beat');
    const ly = document.getElementById('hud-layers');
    if (f) f.textContent = Math.round(fps).toString();
    if (l) l.textContent = Math.round(low1Percent).toString();
    if (m) m.textContent = frameMs.toFixed(1);
    if (e) e.textContent = energy.toFixed(2);
    if (b) b.textContent = beat.toFixed(2);
    if (ly) ly.textContent = layers.toString();
  }

  public getCachedLines(): CachedLineRef[] {
    return this.cachedLines;
  }

  private renderControlDock(): void {
    if (!this.controlPillEl) return;

    this.controlPillEl.innerHTML = `
      <button class="ve-dock-btn ${this.currentStyle === 'convex' ? 'active' : ''}" data-style="convex" title="Optical Dome (Hero Look)">Convex</button>
      <button class="ve-dock-btn ${this.currentStyle === 'drift' ? 'active' : ''}" data-style="drift" title="Unwrapped Ribbon">Drift</button>
      <button class="ve-dock-btn ${this.currentStyle === 'editorial' ? 'active' : ''}" data-style="editorial" title="Swiss Print Press">Editorial</button>
      <button class="ve-dock-btn ${this.currentStyle === 'semantic' ? 'active' : ''}" data-style="semantic" title="Living Typo-Physics">Semantic</button>

      <div class="ve-dock-divider"></div>

      <button class="ve-dock-btn ${this.currentPaletteType === 'album' ? 'active' : ''}" data-palette="album" title="OKLCH Album Art Sync">Album</button>
      <button class="ve-dock-btn ${this.currentPaletteType === 'editorial' ? 'active' : ''}" data-palette="editorial" title="Bone & Maroon Press">Editorial</button>
      <button class="ve-dock-btn ${this.currentPaletteType === 'obsidian' ? 'active' : ''}" data-palette="obsidian" title="Pure Dark OLED">Obsidian</button>

      <div class="ve-dock-divider"></div>

      <button class="ve-dock-btn ${this.rimEnabled ? 'active' : ''}" id="ve-dock-rim-btn" title="Peripheral Bezel Bleed">${this.rimEnabled ? 'Rim On' : 'Rim Off'}</button>

      <div class="ve-dock-divider"></div>

      <button class="ve-dock-btn" id="ve-dock-sync-down" title="Retard sync 50ms">-50ms</button>
      <span style="font-size: 10px; opacity: 0.6;" id="ve-dock-sync-val">${this.clock.getSyncOffset()}ms</span>
      <button class="ve-dock-btn" id="ve-dock-sync-up" title="Advance sync 50ms">+50ms</button>

      <div class="ve-dock-divider"></div>

      <button class="ve-dock-btn" id="ve-dock-close" title="Exit Fullscreen (Esc)">✕</button>
    `;

    this.syncOffsetDisplayEl = document.getElementById('ve-dock-sync-val');

    this.controlPillEl.querySelectorAll('[data-style]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const style = (e.currentTarget as HTMLElement).getAttribute('data-style') as VisualStyle;
        this.currentStyle = style;
        try { localStorage.setItem('verse_engine_style', style); } catch {}
        this.applyStyleClass(style);
        this.renderControlDock();
        this.callbacks.onStyleChange(style);
      });
    });

    this.controlPillEl.querySelectorAll('[data-palette]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const palette = (e.currentTarget as HTMLElement).getAttribute('data-palette') as PaletteType;
        this.currentPaletteType = palette;
        try { localStorage.setItem('verse_engine_palette', palette); } catch {}
        this.renderControlDock();
        this.callbacks.onPaletteChange(palette);
      });
    });

    const rimBtn = document.getElementById('ve-dock-rim-btn');
    rimBtn?.addEventListener('click', () => {
      this.rimEnabled = !this.rimEnabled;
      try { localStorage.setItem('verse_engine_rim', String(this.rimEnabled)); } catch {}
      this.renderControlDock();
      this.callbacks.onRimToggle(this.rimEnabled);
    });

    document.getElementById('ve-dock-sync-down')?.addEventListener('click', () => {
      const val = this.clock.adjustSyncOffset(-50);
      if (this.syncOffsetDisplayEl) this.syncOffsetDisplayEl.textContent = `${val}ms`;
    });

    document.getElementById('ve-dock-sync-up')?.addEventListener('click', () => {
      const val = this.clock.adjustSyncOffset(50);
      if (this.syncOffsetDisplayEl) this.syncOffsetDisplayEl.textContent = `${val}ms`;
    });

    document.getElementById('ve-dock-close')?.addEventListener('click', () => {
      this.callbacks.onClose();
    });
  }

  private bindActivityListeners(): void {
    const showPill = () => {
      if (this.controlPillEl) {
        this.controlPillEl.style.opacity = '1';
        this.controlPillEl.style.transform = 'translateX(-50%) translateY(0)';
      }
      if (this.rootEl) {
        this.rootEl.style.cursor = 'default';
      }

      if (this.hideTimeout !== null) {
        window.clearTimeout(this.hideTimeout);
      }

      // Auto-hide after 2s of idle
      this.hideTimeout = window.setTimeout(() => {
        if (this.controlPillEl) {
          this.controlPillEl.style.opacity = '0';
          this.controlPillEl.style.transform = 'translateX(-50%) translateY(14px)';
        }
        if (this.rootEl) {
          this.rootEl.style.cursor = 'none';
        }
      }, 2000);
    };

    window.addEventListener('mousemove', showPill);
    window.addEventListener('mousedown', showPill);
    showPill();
  }

  public unmount(): void {
    if (this.hideTimeout !== null) {
      window.clearTimeout(this.hideTimeout);
    }
    if (this.rootEl?.parentElement) {
      this.rootEl.parentElement.removeChild(this.rootEl);
    }
    this.rootEl = null;
  }
}
