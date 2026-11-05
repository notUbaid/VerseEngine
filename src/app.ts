/**
 * app.ts — VERSE//ENGINE Main Extension Orchestrator
 *
 * Integrates:
 *   - Spicetify Player APIs & Events
 *   - Unified Master RAF Loop (Single Clock Sample per Frame)
 *   - Film-Grade Dynamic OKLCH Palette Crossfader
 *   - Apple Music-Grade WebGL Texture Atmosphere
 *   - Harmonic Spring Physics Animation Core
 *   - Multi-Tier Lyric Provider (Spotify Canvas/Synced -> LRCLIB Fallback)
 *   - Dev Telemetry HUD (Shift + D)
 */

import {
  ProcessedTrack,
  VisualStyle,
  PaletteType,
  PaletteColors
} from './types/lyrics';
import { LyricProvider } from './lyrics/LyricProvider';
import { AmbientLight, PaletteCrossfader } from './engine/AmbientLight';
import { AnimationEngine } from './engine/AnimationEngine';
import { WebGLPostProcess } from './engine/WebGLPostProcess';
import { StageView } from './ui/StageView';
import { Clock } from './engine/Clock';

// Minimal waveform icon glyph — 4 ascending film tracks
const VERSE_ICON_SVG = `
<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
  <rect x="2"  y="6"  width="2" height="7" rx="0.5"/>
  <rect x="5"  y="4"  width="2" height="9" rx="0.5"/>
  <rect x="8"  y="2"  width="2" height="11" rx="0.5"/>
  <rect x="11" y="4.5" width="2" height="8.5" rx="0.5"/>
</svg>`;

export class VerseEngineApp {
  private static instance: VerseEngineApp | null = null;

  private isOpen: boolean = false;
  private playbarButton: any = null;
  private topbarButton: any = null;

  private stageView: StageView | null = null;
  private animationEngine: AnimationEngine;
  private webgl: WebGLPostProcess;
  private lyricProvider: LyricProvider;
  private clock: Clock;
  private crossfader: PaletteCrossfader | null = null;

  private currentTrack: ProcessedTrack | null = null;
  private currentStyle: VisualStyle = 'convex';
  private currentPaletteType: PaletteType = 'album';
  private currentPalette: PaletteColors | null = null;
  private rimEnabled: boolean = true;
  private boundKeyDownListener: ((e: KeyboardEvent) => void) | null = null;
  private boundVisibilityListener: (() => void) | null = null;

  private constructor() {
    this.animationEngine = new AnimationEngine();
    this.webgl           = new WebGLPostProcess();
    this.lyricProvider   = LyricProvider.getInstance();
    this.clock           = Clock.getInstance();
    this.bindKeyboardShortcuts();
    this.bindLifecycleEvents();
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
    console.log('[VerseEngine] v2.0.0 — Film-grade kinetic typography engine booting…');
    await this.waitForSpicetify();
    this.injectButtons();
    this.bindTrackChangeListener();
    this.loadCurrentTrack();

    try {
      (Spicetify as any).showNotification?.('VerseEngine Ready (Press Alt+L or Shift+D for HUD)');
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
        } else if (attempts > 50) {
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
        if (++retries < 15) setTimeout(tryInject, 400);
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

      if (!this.playbarButton && ++retries < 15) {
        setTimeout(tryInject, 600);
      }
    };

    tryInject();
  }

  // ── Keyboard Shortcuts & Lifecycle Events ──────────────────────────────────

  private bindKeyboardShortcuts(): void {
    if (this.boundKeyDownListener) {
      window.removeEventListener('keydown', this.boundKeyDownListener);
    }

    this.boundKeyDownListener = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && this.isOpen) {
        e.preventDefault();
        this.closeStage();
      } else if ((e.altKey && (e.key === 'l' || e.key === 'L')) || e.key === 'F9') {
        e.preventDefault();
        this.toggleStage();
      } else if (e.shiftKey && (e.key === 'D' || e.key === 'd')) {
        // Toggle Dev Telemetry HUD
        e.preventDefault();
        this.stageView?.toggleHud();
      } else if (e.code === 'Space' && this.isOpen) {
        const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
        if (tag !== 'input' && tag !== 'textarea') {
          e.preventDefault();
          if (typeof Spicetify !== 'undefined' && Spicetify.Player) {
            if (typeof (Spicetify.Player as any).togglePlay === 'function') {
              (Spicetify.Player as any).togglePlay();
            } else if (Spicetify.Player.isPlaying()) {
              (Spicetify.Player as any).pause?.();
            } else {
              (Spicetify.Player as any).play?.();
            }
          }
        }
      }
    };

    window.addEventListener('keydown', this.boundKeyDownListener);
  }

  private bindLifecycleEvents(): void {
    if (this.boundVisibilityListener) {
      document.removeEventListener('visibilitychange', this.boundVisibilityListener);
    }

    this.boundVisibilityListener = () => {
      if (document.hidden) {
        if (this.isOpen) {
          this.animationEngine.stop();
        }
      } else {
        if (this.isOpen) {
          this.animationEngine.start();
        }
      }
    };

    document.addEventListener('visibilitychange', this.boundVisibilityListener);
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

    await this.clock.setTrackUri(trackItem.uri);

    try {
      const albumArtUrl = trackItem.album?.images?.[0]?.url ?? '';
      const [processedTrack, palette] = await Promise.all([
        this.lyricProvider.getTrackLyrics(trackItem),
        AmbientLight.getPalette(this.currentPaletteType, albumArtUrl)
      ]);

      this.currentTrack = processedTrack;

      if (!this.crossfader) {
        this.crossfader = new PaletteCrossfader(palette);
      } else {
        this.crossfader.setTarget(palette);
      }

      this.currentPalette = palette;

      // Load artwork texture into WebGL optical engine
      if (this.webgl) {
        await this.webgl.loadAlbumTexture(albumArtUrl);
      }

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
        if (this.crossfader) {
          this.crossfader.setTarget(pal);
        }
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

    this.currentStyle = this.stageView.getSavedStyle();
    this.currentPaletteType = this.stageView.getSavedPaletteType();
    this.rimEnabled = this.stageView.getSavedRimEnabled();

    const { rootEl, cameraEl, ambientRimEl, lyricsContainerEl } = this.stageView.mount();

    // Mount WebGL post-process overlay
    this.webgl.mount(rootEl);
    this.animationEngine.bindWebgl(this.webgl);
    this.animationEngine.bindStageView(this.stageView);

    if (!this.currentTrack) {
      await this.loadCurrentTrack();
    }

    if (this.currentTrack && this.currentPalette) {
      if (this.currentTrack.albumArtUrl) {
        await this.webgl.loadAlbumTexture(this.currentTrack.albumArtUrl);
      }
      this.webgl.setPalette(this.currentPalette);
      this.applyTrackToStage(this.stageView, this.currentTrack, this.currentPalette);

      this.animationEngine.bindElements(
        rootEl,
        cameraEl,
        ambientRimEl,
        lyricsContainerEl,
        this.stageView.getCachedLines(),
        this.currentTrack
      );
      requestAnimationFrame(() => {
        this.animationEngine.measureOffsets();
      });
      this.animationEngine.setStyle(this.currentStyle);
      this.animationEngine.setPalette(this.currentPalette);
      this.animationEngine.setRimEnabled(this.rimEnabled);
      this.animationEngine.start();
    }
  }

  public closeStage(): void {
    if (!this.isOpen) return;
    this.isOpen = false;

    if (this.playbarButton) this.playbarButton.active = false;

    this.animationEngine.stop();
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
        stageView.getCachedLines(),
        track
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
