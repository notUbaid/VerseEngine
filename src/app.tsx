import {
  ProcessedTrack,
  VisualStyle,
  PaletteType,
  PaletteColors
} from './types/lyrics';
import { LyricProvider } from './lyrics/LyricProvider';
import { AmbientLight } from './engine/AmbientLight';
import { AnimationEngine } from './engine/AnimationEngine';
import { WebGLPostProcess } from './engine/WebGLPostProcess';
import { StageView } from './ui/StageView';
import { Clock } from './engine/Clock';

// ─── Playbar Button Icon ──────────────────────────────────────────────────────
// Minimal waveform glyph — four vertical bars of ascending height
const VERSE_ICON_SVG = `
<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
  <rect x="2"  y="6"  width="2" height="7" rx="0.5"/>
  <rect x="5"  y="4"  width="2" height="9" rx="0.5"/>
  <rect x="8"  y="2"  width="2" height="11" rx="0.5"/>
  <rect x="11" y="4.5" width="2" height="8.5" rx="0.5"/>
</svg>`;

// ─── VerseEngineApp — Singleton Orchestrator ──────────────────────────────────

class VerseEngineApp {
  private static instance: VerseEngineApp | null = null;

  private isOpen: boolean = false;
  private playbarButton: any = null;
  private topbarButton: any = null;

  private stageView: StageView | null = null;
  private animationEngine: AnimationEngine;
  private webgl: WebGLPostProcess;
  private lyricProvider: LyricProvider;
  private clock: Clock;

  private currentTrack: ProcessedTrack | null = null;
  private currentStyle: VisualStyle = 'convex';
  private currentPaletteType: PaletteType = 'album';
  private currentPalette: PaletteColors | null = null;
  private rimEnabled: boolean = true;

  private constructor() {
    this.bindKeyboardShortcuts();
    this.animationEngine = new AnimationEngine();
    this.webgl           = new WebGLPostProcess();
    this.lyricProvider   = LyricProvider.getInstance();
    this.clock           = Clock.getInstance();
    this.boot();
  }

  public static init(): VerseEngineApp {
    if (!VerseEngineApp.instance) {
      VerseEngineApp.instance = new VerseEngineApp();
    }
    return VerseEngineApp.instance;
  }

  // ── Boot sequence ──────────────────────────────────────────────────────────

  private async boot(): Promise<void> {
    console.log('[VerseEngine] v2.1 — 144Hz kinetic typography engine booting…');
    await this.waitForSpicetify();
    this.injectButtons();
    this.bindTrackChangeListener();
    this.loadCurrentTrack(); // preload without await — stage may not be open yet

    try {
      (Spicetify as any).showNotification?.('VerseEngine Ready (Press Alt+L)');
    } catch {}
  }

  private waitForSpicetify(): Promise<void> {
    return new Promise((resolve) => {
      let attempts = 0;
      const check = () => {
        attempts++;
        if (
          typeof Spicetify !== 'undefined' &&
          Spicetify.Player &&
          (Spicetify.Player as any).origin?._state
        ) {
          resolve();
        } else if (attempts > 60) {
          // Resolve after 6s fallback so nothing hangs indefinitely
          resolve();
        } else {
          setTimeout(check, 100);
        }
      };
      check();
    });
  }

  // ── Button Injections (Playbar + Topbar with Retry) ──────────────────────

  private injectButtons(): void {
    let retries = 0;
    const tryInject = () => {
      if (typeof Spicetify === 'undefined') {
        if (++retries < 20) setTimeout(tryInject, 400);
        return;
      }

      // 1. Bottom Playbar Button
      if (!this.playbarButton && Spicetify.Playbar?.Button) {
        try {
          this.playbarButton = new Spicetify.Playbar.Button(
            'VerseEngine Kinetic Lyrics',
            VERSE_ICON_SVG,
            () => this.toggleStage(),
            false,
            false
          );
          this.playbarButton.register();
          console.log('[VerseEngine] Playbar button registered.');
        } catch (err) {
          console.warn('[VerseEngine] Playbar button error:', err);
        }
      }

      // 2. Top Bar Button
      if (!this.topbarButton && (Spicetify as any).Topbar?.Button) {
        try {
          this.topbarButton = new (Spicetify as any).Topbar.Button(
            'VerseEngine Kinetic Lyrics (Alt+L)',
            VERSE_ICON_SVG,
            () => this.toggleStage(),
            false,
            true
          );
          console.log('[VerseEngine] Topbar button registered.');
        } catch (err) {
          console.warn('[VerseEngine] Topbar button error:', err);
        }
      }

      if ((!this.playbarButton || !this.topbarButton) && ++retries < 20) {
        setTimeout(tryInject, 600);
      }
    };

    tryInject();
  }

  // ── Keyboard Shortcuts ─────────────────────────────────────────────────────

  private bindKeyboardShortcuts(): void {
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape' && this.isOpen) {
        e.preventDefault();
        this.closeStage();
      } else if ((e.altKey && (e.key === 'l' || e.key === 'L')) || e.key === 'F9') {
        e.preventDefault();
        this.toggleStage();
      } else if (e.code === 'Space' && this.isOpen) {
        const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
        if (tag !== 'input' && tag !== 'textarea') {
          e.preventDefault();
          // Passthrough spacebar to Spotify play/pause
          if (typeof Spicetify !== 'undefined' && Spicetify.Player) {
            if (Spicetify.Player.isPlaying()) {
              (Spicetify.Player as any).pause?.();
            } else {
              (Spicetify.Player as any).play?.();
            }
          }
        }
      }
    });
  }

  // ── Track Change ───────────────────────────────────────────────────────────

  private bindTrackChangeListener(): void {
    if (typeof Spicetify === 'undefined' || !Spicetify.Player) return;
    Spicetify.Player.addEventListener('songchange', () => {
      this.loadCurrentTrack();
    });
  }

  private async loadCurrentTrack(): Promise<void> {
    if (typeof Spicetify === 'undefined' || !Spicetify.Player?.data?.item) return;
    const trackItem = Spicetify.Player.data.item;
    if (!trackItem?.uri) return;

    this.clock.setTrackUri(trackItem.uri);

    try {
      const albumArtUrl = trackItem.album?.images?.[0]?.url ?? '';
      const [processedTrack, palette] = await Promise.all([
        this.lyricProvider.getTrackLyrics(trackItem),
        AmbientLight.getPalette(this.currentPaletteType, albumArtUrl)
      ]);

      this.currentTrack   = processedTrack;
      this.currentPalette = palette;

      // If stage is already open, re-render lyrics into it immediately
      if (this.isOpen && this.stageView) {
        this.applyTrackToStage(this.stageView, processedTrack, palette);
      }
    } catch (err) {
      console.error('[VerseEngine] Track load error:', err);
    }
  }

  // ── Open / Close / Toggle ──────────────────────────────────────────────────

  public async toggleStage(): Promise<void> {
    if (this.isOpen) {
      this.closeStage();
    } else {
      await this.openStage();
    }
  }

  public async openStage(): Promise<void> {
    if (this.isOpen) return;
    this.isOpen = true;

    if (this.playbarButton) this.playbarButton.active = true;

    // Create StageView
    this.stageView = new StageView({
      onStyleChange: (style: VisualStyle) => {
        this.currentStyle = style;
        this.animationEngine.setStyle(style);
      },
      onPaletteChange: async (paletteType: PaletteType) => {
        this.currentPaletteType = paletteType;
        const albumArt = Spicetify?.Player?.data?.item?.album?.images?.[0]?.url ?? '';
        const pal = await AmbientLight.getPalette(paletteType, albumArt);
        this.currentPalette = pal;
        this.stageView?.applyPalette(pal);
        this.animationEngine.setPalette(pal);
        this.webgl.setPalette(pal);
      },
      onRimToggle: (enabled: boolean) => {
        this.rimEnabled = enabled;
        this.animationEngine.setRimEnabled(enabled);
      },
      onClose: () => this.closeStage()
    });

    const { rootEl, cameraEl, ambientRimEl, lyricsContainerEl } = this.stageView.mount();

    // Try to mount WebGL post-process overlay
    this.webgl.mount(rootEl);
    this.animationEngine.bindWebgl(this.webgl);

    // If we don't have a track yet, fetch one
    if (!this.currentTrack) {
      await this.loadCurrentTrack();
    }

    if (this.currentTrack && this.currentPalette) {
      this.webgl.setPalette(this.currentPalette);
      this.applyTrackToStage(this.stageView, this.currentTrack, this.currentPalette);

      this.animationEngine.bindElements(
        rootEl,
        cameraEl,
        ambientRimEl,
        lyricsContainerEl,
        this.stageView.getCachedLines()
      );
      requestAnimationFrame(() => {
        this.animationEngine.measureOffsets();
      });
      this.animationEngine.setStyle(this.currentStyle);
      this.animationEngine.setPalette(this.currentPalette);
      this.animationEngine.setRimEnabled(this.rimEnabled);
      this.animationEngine.start();
      this.webgl.start();
    }
  }

  public closeStage(): void {
    if (!this.isOpen) return;
    this.isOpen = false;

    if (this.playbarButton) this.playbarButton.active = false;

    this.animationEngine.stop();
    this.webgl.stop();
    this.webgl.unmount();

    if (this.stageView) {
      this.stageView.unmount();
      this.stageView = null;
    }
  }

  // ── Track-to-Stage Pipeline ────────────────────────────────────────────────

  private applyTrackToStage(stageView: StageView, track: ProcessedTrack, palette: PaletteColors): void {
    stageView.applyPalette(palette);
    stageView.renderLyrics(track);

    this.animationEngine.setPalette(palette);
    this.webgl.setPalette(palette);

    // Re-bind cached lines (newly rendered)
    const stageEl = document.getElementById('verse-engine-stage');
    const camEl   = document.getElementById('ve-camera');
    const rimEl   = document.getElementById('ve-ambient-rim');
    const contEl  = document.getElementById('ve-lyrics-container');

    if (stageEl && camEl && rimEl && contEl) {
      this.animationEngine.bindElements(
        stageEl,
        camEl,
        rimEl,
        contEl,
        stageView.getCachedLines()
      );
      requestAnimationFrame(() => {
        this.animationEngine.measureOffsets();
      });
    }
  }
}

// ── Auto-boot ──────────────────────────────────────────────────────────────────
if (typeof window !== 'undefined') {
  (window as any).VerseEngine = VerseEngineApp.init();
}

export default VerseEngineApp;
