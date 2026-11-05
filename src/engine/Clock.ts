/**
 * Clock.ts — VERSE//ENGINE High-Precision Slew Clock and Beat Synchronizer
 *
 * Implements:
 *   1. Slew timekeeper that runs at real time and bleeds off error without micro-stuttering.
 *   2. Hard-snap strictly on true user seeks (> 150ms discrepancy).
 *   3. Anticipation lookahead (+150ms) so visual kinematics organically lead audio.
 *   4. Spicetify audio analysis integration with graceful heuristic fallback.
 *   5. Real-time global energy metric (0..1) and decaying beat pulse impulse.
 */

import { AudioBeatInfo } from '../types/lyrics';

export class Clock {
  private static instance: Clock | null = null;

  // Slew timekeeper state
  private renderMs: number = 0;
  private lastPerfTime: number = performance.now();
  private isPlaying: boolean = false;
  private syncOffsetMs: number = 0;
  private currentTrackUri: string = '';
  private boundEvents: boolean = false;

  // Anticipation lookahead: visuals lead the audio by 150ms for crisp, film-like anticipation
  public static readonly LOOKAHEAD_MS: number = 150;

  // Beat & Energy analysis
  private audioData: Spicetify.AudioAnalysis | null = null;
  private beats: Spicetify.TatumItem[] = [];
  private bars: Spicetify.TatumItem[] = [];
  private currentBeatIndex: number = 0;
  private beatPulse: number = 0;
  private isDownbeat: boolean = false;
  private globalEnergy: number = 0.25;

  // Synthetic fallback pulse
  private fallbackBpm: number = 120;
  private lastSyntheticBeatMs: number = 0;

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

  public async setTrackUri(uri: string): Promise<void> {
    if (this.currentTrackUri !== uri) {
      this.currentTrackUri = uri;
      this.audioData = null;
      this.beats = [];
      this.bars = [];
      this.currentBeatIndex = 0;
      this.beatPulse = 0;
      this.globalEnergy = 0.25;

      const polled = this.getSafeProgress();
      this.renderMs = polled + Clock.LOOKAHEAD_MS;
      this.lastPerfTime = performance.now();

      await this.fetchAudioAnalysis();
    }
  }

  private async fetchAudioAnalysis(): Promise<void> {
    try {
      if (typeof Spicetify !== 'undefined' && typeof Spicetify.getAudioData === 'function') {
        const analysis = await Spicetify.getAudioData();
        if (analysis && Array.isArray(analysis.beats)) {
          this.audioData = analysis;
          this.beats = analysis.beats;
          this.bars = analysis.bars || [];
          if (analysis.track?.tempo) {
            this.fallbackBpm = analysis.track.tempo;
          }
          return;
        }
      }
    } catch {
      // Audio analysis endpoint unavailable or 403; graceful fallback active
    }
    this.audioData = null;
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
      });

      Spicetify.Player.addEventListener('onplaypause', () => {
        this.isPlaying = this.getSafeIsPlaying();
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

  /**
   * Continuous Slew Tick: Advances renderMs in real time and slews towards audioMs
   * @param dt delta time in seconds
   * @returns adjusted playback renderMs for visual choreography
   */
  public tick(dt: number): number {
    const now = performance.now();
    this.isPlaying = this.getSafeIsPlaying();
    const rawAudioMs = this.getSafeProgress();
    const targetAudioMs = rawAudioMs + Clock.LOOKAHEAD_MS + this.syncOffsetMs;

    // Error between audio time and visual time
    const err = targetAudioMs - this.renderMs;

    if (!this.isPlaying) {
      // When paused, snap strictly to targetAudioMs (zero pause drift or jitter)
      this.renderMs = targetAudioMs;
    } else if (Math.abs(err) > 150) {
      // Real seek occurred (> 150ms jump) -> snap immediately
      this.renderMs = targetAudioMs;
    } else {
      // Slew clock: run in real time and bleed off error smoothly
      const forwardDelta = dt * 1000;
      const slewRate = Math.min(1.0, dt * 6);
      this.renderMs += forwardDelta + err * slewRate;
    }

    this.lastPerfTime = now;

    // Update beat synchronization and energy
    this.updateBeatsAndEnergy(this.renderMs - Clock.LOOKAHEAD_MS, dt);

    return Math.max(0, this.renderMs);
  }

  /**
   * Calculate beat downbeats and global dynamic energy (0..1)
   */
  private updateBeatsAndEnergy(audioMs: number, dt: number): void {
    // Decay previous beat pulse
    this.beatPulse = Math.max(0, this.beatPulse - dt * 4.5);
    this.isDownbeat = false;

    if (this.beats.length > 0) {
      const audioSec = audioMs / 1000;
      // Find current beat
      while (
        this.currentBeatIndex < this.beats.length - 1 &&
        this.beats[this.currentBeatIndex + 1].start <= audioSec
      ) {
        this.currentBeatIndex++;
        this.beatPulse = 1.0; // Trigger new beat impulse

        // Check if this beat is a bar downbeat
        const beatStart = this.beats[this.currentBeatIndex].start;
        for (let b = 0; b < this.bars.length; b++) {
          if (Math.abs(this.bars[b].start - beatStart) < 0.04) {
            this.isDownbeat = true;
            break;
          }
        }
      }

      // Compute energy from section loudness if available
      if (this.audioData?.sections) {
        for (const sec of this.audioData.sections) {
          if (audioSec >= sec.start && audioSec <= sec.start + sec.duration) {
            // Loudness typically -30dB (quiet) to -3dB (chorus)
            const normLoudness = Math.max(0, Math.min(1, (sec.loudness + 26) / 22));
            const targetEnergy = 0.20 + normLoudness * 0.65;
            this.globalEnergy += (targetEnergy - this.globalEnergy) * Math.min(1, dt * 2);
            return;
          }
        }
      }
    } else {
      // Synthetic beat fallback using BPM
      const beatIntervalMs = (60 / this.fallbackBpm) * 1000;
      if (audioMs - this.lastSyntheticBeatMs >= beatIntervalMs) {
        this.lastSyntheticBeatMs = audioMs;
        this.beatPulse = 1.0;
        this.currentBeatIndex++;
        if (this.currentBeatIndex % 4 === 0) {
          this.isDownbeat = true;
        }
      }
    }
  }

  public setVocalActivityEnergy(isActive: boolean, dt: number): void {
    if (this.audioData) return; // If real audio data exists, rely on it
    const target = isActive ? 0.75 : 0.22;
    this.globalEnergy += (target - this.globalEnergy) * Math.min(1, dt * 3);
  }

  public getEnergy(): number {
    return Math.max(0.1, Math.min(1.0, this.globalEnergy));
  }

  public getBeatPulse(): number {
    return this.beatPulse;
  }

  public getIsDownbeat(): boolean {
    return this.isDownbeat;
  }

  public getRenderMs(): number {
    return Math.max(0, this.renderMs);
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }
}
