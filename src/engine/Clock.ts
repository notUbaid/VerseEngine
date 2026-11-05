/**
 * Clock.ts
 * 144Hz Drift-Corrected Playback Clock for Spotify Desktop.
 * Resolves Spotify's coarse ~250ms progress polls into butter-smooth
 * sub-millisecond continuous time for 120fps+ kinetic typography.
 */

export class Clock {
  private static instance: Clock | null = null;

  private lastSpotifyMs: number = 0;
  private lastPerfNow: number = performance.now();
  private isPlaying: boolean = false;
  private syncOffsetMs: number = 0;
  private currentInterpolatedMs: number = 0;
  private currentTrackUri: string = '';

  private constructor() {
    this.loadSyncOffset();
    this.syncFromSpotify(true);
    this.bindSpotifyEvents();
  }

  public static getInstance(): Clock {
    if (!Clock.instance) {
      Clock.instance = new Clock();
    }
    return Clock.instance;
  }

  private loadSyncOffset(): void {
    try {
      const stored = localStorage.getItem('verse_engine_sync_offset');
      if (stored !== null) {
        this.syncOffsetMs = parseInt(stored, 10) || 0;
      }
    } catch {
      this.syncOffsetMs = 0;
    }
  }

  public setTrackUri(uri: string): void {
    if (this.currentTrackUri !== uri) {
      this.currentTrackUri = uri;
      this.syncFromSpotify(true);
    }
  }

  public getSyncOffset(): number {
    return this.syncOffsetMs;
  }

  public setSyncOffset(offsetMs: number): void {
    this.syncOffsetMs = offsetMs;
    try {
      localStorage.setItem('verse_engine_sync_offset', offsetMs.toString());
    } catch {
      // Storage unavailable
    }
  }

  public adjustSyncOffset(deltaMs: number): number {
    const updated = this.syncOffsetMs + deltaMs;
    this.setSyncOffset(updated);
    return updated;
  }

  private bindSpotifyEvents(): void {
    if (typeof Spicetify === 'undefined' || !Spicetify.Player) return;

    Spicetify.Player.addEventListener('songchange', () => {
      const data = Spicetify.Player.data;
      if (data?.item?.uri) {
        this.setTrackUri(data.item.uri);
      }
      this.syncFromSpotify(true);
    });

    Spicetify.Player.addEventListener('onplaypause', () => {
      this.syncFromSpotify(true);
    });

    Spicetify.Player.addEventListener('onprogress', () => {
      this.syncFromSpotify(false);
    });
  }

  private getSafeProgress(): number {
    try {
      if (
        typeof Spicetify !== 'undefined' &&
        Spicetify.Player &&
        (Spicetify.Player as any).origin?._state
      ) {
        return Spicetify.Player.getProgress() || 0;
      }
    } catch {}
    return 0;
  }

  private getSafeIsPlaying(): boolean {
    try {
      if (
        typeof Spicetify !== 'undefined' &&
        Spicetify.Player &&
        (Spicetify.Player as any).origin?._state
      ) {
        return Spicetify.Player.isPlaying() || false;
      }
    } catch {}
    return false;
  }

  public syncFromSpotify(hardSnap: boolean = false): void {
    const polledProgress = this.getSafeProgress();
    const playing = this.getSafeIsPlaying();
    const now = performance.now();

    this.isPlaying = playing;

    if (hardSnap || polledProgress !== this.lastSpotifyMs) {
      this.lastSpotifyMs = polledProgress;
      this.lastPerfNow = now;
      this.currentInterpolatedMs = polledProgress;
    }
  }

  /**
   * Called every frame in the AnimationEngine loop
   * 144Hz continuous interpolation between Spotify's polled progress updates.
   */
  public tick(): number {
    const polledProgress = this.getSafeProgress();
    const playing = this.getSafeIsPlaying();
    const now = performance.now();

    this.isPlaying = playing;

    if (this.isPlaying) {
      // Detect if Spotify sent a new progress milestone or user seeked
      const progressDelta = Math.abs(polledProgress - this.lastSpotifyMs);
      if (polledProgress > 0 && (polledProgress !== this.lastSpotifyMs || progressDelta > 2000)) {
        this.lastSpotifyMs = polledProgress;
        this.lastPerfNow = now;
        this.currentInterpolatedMs = polledProgress;
      } else {
        // High-precision RAF interpolation between Spotify ticks
        this.currentInterpolatedMs = this.lastSpotifyMs + (now - this.lastPerfNow);
      }
    } else {
      if (polledProgress > 0) {
        this.lastSpotifyMs = polledProgress;
        this.currentInterpolatedMs = polledProgress;
      }
      this.lastPerfNow = now;
    }

    return Math.max(0, this.currentInterpolatedMs + this.syncOffsetMs);
  }

  public getNow(): number {
    return Math.max(0, this.currentInterpolatedMs + this.syncOffsetMs);
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }
}
