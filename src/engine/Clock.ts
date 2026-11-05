/**
 * Clock.ts — VERSE//ENGINE High-Precision Interpolated Playback Clock
 *
 * Resolves Spotify's asynchronous progress polls into a continuous,
 * monotonic 144Hz playback clock:
 *   1. Hard-snap threshold (>= 60ms) for seeks, skips, and track changes
 *   2. Exponential drift smoothing for minor timing micro-variations
 *   3. Safe fallback when Spotify APIs are uninitialized
 *   4. Persistent latency offset tuning (+/- 50ms)
 */

export class Clock {
  private static instance: Clock | null = null;

  private lastSpotifyMs: number = 0;
  private lastPerfNow: number = performance.now();
  private isPlaying: boolean = false;
  private syncOffsetMs: number = 0;
  private currentInterpolatedMs: number = 0;
  private currentTrackUri: string = '';
  private boundEvents: boolean = false;

  private constructor() {
    this.loadSyncOffset();
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
    } catch {}
  }

  public adjustSyncOffset(deltaMs: number): number {
    const updated = this.syncOffsetMs + deltaMs;
    this.setSyncOffset(updated);
    return updated;
  }

  public bindSpotifyEvents(): void {
    if (this.boundEvents || typeof Spicetify === 'undefined' || !Spicetify.Player) return;

    try {
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

      this.boundEvents = true;
    } catch {}
  }

  private getSafeProgress(): number {
    try {
      if (typeof Spicetify !== 'undefined' && Spicetify.Player) {
        return Spicetify.Player.getProgress() || 0;
      }
    } catch {}
    return 0;
  }

  private getSafeIsPlaying(): boolean {
    try {
      if (typeof Spicetify !== 'undefined' && Spicetify.Player) {
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

    if (hardSnap) {
      this.lastSpotifyMs = polledProgress;
      this.lastPerfNow = now;
      this.currentInterpolatedMs = polledProgress;
      return;
    }

    if (this.isPlaying) {
      const elapsedSinceSample = now - this.lastPerfNow;
      const estimatedMs = this.lastSpotifyMs + elapsedSinceSample;
      const delta = polledProgress - estimatedMs;

      // Hard-snap on seek (> 60ms jump)
      if (Math.abs(delta) >= 60) {
        this.lastSpotifyMs = polledProgress;
        this.lastPerfNow = now;
        this.currentInterpolatedMs = polledProgress;
      } else if (Math.abs(delta) > 3) {
        // Exponential drift correction (absorbs 20% of drift smoothly)
        this.lastSpotifyMs += delta * 0.20;
        this.lastPerfNow = now;
      }
    } else {
      this.lastSpotifyMs = polledProgress;
      this.lastPerfNow = now;
      this.currentInterpolatedMs = polledProgress;
    }
  }

  /**
   * Called every frame in the AnimationEngine 144Hz loop
   */
  public tick(): number {
    const now = performance.now();
    const playing = this.getSafeIsPlaying();
    this.isPlaying = playing;

    if (this.isPlaying) {
      const elapsed = now - this.lastPerfNow;
      this.currentInterpolatedMs = this.lastSpotifyMs + elapsed;
    } else {
      const polled = this.getSafeProgress();
      if (polled > 0) {
        this.lastSpotifyMs = polled;
        this.currentInterpolatedMs = polled;
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
