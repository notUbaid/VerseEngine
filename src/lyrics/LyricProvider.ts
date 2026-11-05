import {
  ProcessedTrack,
  LyricLine,
  LyricWord,
  LyricChar,
  SemanticEffect
} from '../types/lyrics';
import { matchSemanticEffect, sanitizeWord } from '../engine/SemanticPhysics';

const VOWEL_REGEX = /[aeiouyAEIOUY]/;
const PUNCTUATION_END_REGEX = /[.,!?;:…'"]$/;

export function isGarbageLyricLine(text: string): boolean {
  if (!text) return true;
  const trimmed = text.trim();
  if (trimmed.length === 0) return true;
  // Filter out pure timestamps: "00:00", "00:16", "01:23.45", "[00:16.20]"
  if (/^\[?\d{1,2}:\d{2}(\.\d{1,3})?\]?$/.test(trimmed)) return true;
  // Filter out pure audio cues, musical notes, dashes: "♪", "♫", "---", "..."
  if (/^[♪♫♬\s\-_–—•·.…\*\#\(\)]+$/.test(trimmed)) return true;
  // Filter out instrumental / intro / outro marker words
  if (/^(\(|\[)?(instrumental|intro|outro|break|solo|music)(\)|\])?$/i.test(trimmed)) return true;
  return false;
}

export class LyricProvider {
  private static instance: LyricProvider | null = null;
  private cache = new Map<string, ProcessedTrack>();

  private constructor() {}

  public static getInstance(): LyricProvider {
    if (!LyricProvider.instance) {
      LyricProvider.instance = new LyricProvider();
    }
    return LyricProvider.instance;
  }

  public async getTrackLyrics(track: Spicetify.PlayerTrack): Promise<ProcessedTrack> {
    const uri = track.uri;
    if (this.cache.has(uri)) {
      return this.cache.get(uri)!;
    }

    const title = track.name || '';
    const artist = track.artists?.[0]?.name || '';
    const album = track.album?.name || '';
    const albumArtUrl = track.album?.images?.[0]?.url || '';
    const durationMs = track.duration?.milliseconds || 180000;
    const trackId = this.getTrackId(uri);

    // 1. Try Source A: Spotify Internal Color-Lyrics
    let rawLines: Array<{ timeMs: number; text: string }> | null = null;
    let wordSyncedLines: LyricLine[] | null = null;

    try {
      const spotifyLyrics = await this.fetchSpotifyLyrics(trackId);
      if (spotifyLyrics && spotifyLyrics.length > 0) {
        rawLines = spotifyLyrics;
      }
    } catch {
      // Fallback to LRCLIB
    }

    // 2. Try Source B: LRCLIB API
    if (!rawLines && !wordSyncedLines) {
      try {
        const lrclibResult = await this.fetchLrclib(title, artist, album, durationMs);
        if (lrclibResult) {
          if (lrclibResult.wordLines && lrclibResult.wordLines.length > 0) {
            wordSyncedLines = lrclibResult.wordLines;
          } else if (lrclibResult.lineLyrics && lrclibResult.lineLyrics.length > 0) {
            rawLines = lrclibResult.lineLyrics;
          }
        }
      } catch {
        // Fallback
      }
    }

    // 3. Synthesize full LyricLine -> LyricWord -> LyricChar AST
    let lines: LyricLine[] = [];
    if (wordSyncedLines && wordSyncedLines.length > 0) {
      lines = wordSyncedLines;
    } else if (rawLines && rawLines.length > 0) {
      lines = this.synthesizeLines(rawLines);
    } else {
      // Fallback for instrumental or tracks without lyrics
      lines = this.generateFallbackLines(title, artist, durationMs);
    }

    const processed: ProcessedTrack = {
      uri,
      title,
      artist,
      album,
      albumArtUrl,
      durationMs,
      lines
    };

    this.cache.set(uri, processed);
    return processed;
  }

  private getTrackId(uri: string): string {
    const parts = uri.split(':');
    return parts[parts.length - 1] || '';
  }

  private async fetchSpotifyLyrics(trackId: string): Promise<Array<{ timeMs: number; text: string }> | null> {
    if (!trackId || typeof Spicetify === 'undefined' || !Spicetify.CosmosAsync) return null;

    const url = `https://spclient.wg.spotify.com/color-lyrics/v2/track/${trackId}?format=json&vocalRemoval=false`;
    const res = await Spicetify.CosmosAsync.get(url);

    if (res?.lyrics?.lines && Array.isArray(res.lyrics.lines)) {
      return res.lyrics.lines
        .filter((l: any) => l.words && !isGarbageLyricLine(l.words))
        .map((l: any) => ({
          timeMs: parseInt(l.startTimeMs, 10) || 0,
          text: l.words.trim()
        }));
    }

    return null;
  }

  private async fetchLrclib(
    title: string,
    artist: string,
    album: string,
    durationMs: number
  ): Promise<{ wordLines?: LyricLine[]; lineLyrics?: Array<{ timeMs: number; text: string }> } | null> {
    const durationSec = Math.round(durationMs / 1000);
    const getUrl = `https://lrclib.net/api/get?track_name=${encodeURIComponent(title)}&artist_name=${encodeURIComponent(artist)}&album_name=${encodeURIComponent(album)}&duration=${durationSec}`;

    try {
      let res = await fetch(getUrl, {
        headers: { 'User-Agent': 'VerseEngine/2.0.0 (Spicetify Extension)' }
      });

      let data: any = null;
      if (res.ok) {
        data = await res.json();
      } else {
        // Fallback to /api/search
        const searchUrl = `https://lrclib.net/api/search?track_name=${encodeURIComponent(title)}&artist_name=${encodeURIComponent(artist)}`;
        const searchRes = await fetch(searchUrl, {
          headers: { 'User-Agent': 'VerseEngine/2.0.0 (Spicetify Extension)' }
        });
        if (searchRes.ok) {
          const results = await searchRes.json();
          if (Array.isArray(results) && results.length > 0) {
            data = results[0];
          }
        }
      }

      if (!data) return null;

      if (data.syncedLyrics) {
        const text: string = data.syncedLyrics;
        if (text.includes('<') && text.includes('>')) {
          const wordLines = this.parseEnhancedLrc(text);
          if (wordLines.length > 0) {
            return { wordLines };
          }
        }

        const lineLyrics = this.parseStandardLrc(text);
        if (lineLyrics.length > 0) {
          return { lineLyrics };
        }
      }
    } catch {
      // LRCLIB failed
    }

    return null;
  }

  private parseStandardLrc(lrc: string): Array<{ timeMs: number; text: string }> {
    const lines: Array<{ timeMs: number; text: string }> = [];
    const regex = /\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/;

    for (const raw of lrc.split('\n')) {
      const match = regex.exec(raw);
      if (match) {
        const min = parseInt(match[1], 10);
        const sec = parseInt(match[2], 10);
        const fracStr = match[3];
        const ms = fracStr.length === 2 ? parseInt(fracStr, 10) * 10 : parseInt(fracStr, 10);
        const timeMs = min * 60000 + sec * 1000 + ms;
        const text = match[4].trim();
        if (text && !isGarbageLyricLine(text)) {
          lines.push({ timeMs, text });
        }
      }
    }

    return lines.sort((a, b) => a.timeMs - b.timeMs);
  }

  private parseEnhancedLrc(lrc: string): LyricLine[] {
    const lines: LyricLine[] = [];
    const lineRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/;
    const wordRegex = /<(\d{2}):(\d{2})\.(\d{2,3})>([^<]+)/g;

    const rows = lrc.split('\n');
    let lIdx = 0;

    for (const row of rows) {
      const match = lineRegex.exec(row);
      if (!match) continue;

      const min = parseInt(match[1], 10);
      const sec = parseInt(match[2], 10);
      const frac = match[3];
      const lineStartMs = min * 60000 + sec * 1000 + (frac.length === 2 ? parseInt(frac, 10) * 10 : parseInt(frac, 10));
      const rest = match[4];

      const words: LyricWord[] = [];
      const adLibs: LyricWord[] = [];
      let wordMatch: RegExpExecArray | null;
      let lastEnd = lineStartMs;

      while ((wordMatch = wordRegex.exec(rest)) !== null) {
        const wMin = parseInt(wordMatch[1], 10);
        const wSec = parseInt(wordMatch[2], 10);
        const wFrac = wordMatch[3];
        const wStart = wMin * 60000 + wSec * 1000 + (wFrac.length === 2 ? parseInt(wFrac, 10) * 10 : parseInt(wFrac, 10));
        const token = wordMatch[4].trim();

        if (token) {
          const wDuration = Math.max(80, wStart - lastEnd);
          const clean = sanitizeWord(token);
          const isAdLib = this.isParentheticalAdLib(token);
          const semanticEffect = matchSemanticEffect(token);
          const isMelisma = wDuration >= 600 && clean.length >= 2;
          const chars = this.subdivideChars(token, wStart, wDuration);

          const wObj: LyricWord = {
            id: `enh_w_${lIdx}_${words.length + adLibs.length}`,
            text: token,
            cleanText: clean,
            startMs: wStart,
            endMs: wStart + wDuration,
            durationMs: wDuration,
            isMelisma,
            isAdLib,
            semanticEffect,
            chars
          };

          words.push(wObj);
          if (isAdLib) adLibs.push(wObj);

          lastEnd = wStart + wDuration;
        }
      }

      const lineEndMs = lastEnd > lineStartMs ? lastEnd + 400 : lineStartMs + 2500;

      if (words.length > 0) {
        lines.push({
          id: `enh_l_${lIdx}`,
          index: lIdx,
          startMs: lineStartMs,
          endMs: lineEndMs,
          words,
          adLibs
        });
        lIdx++;
      }
    }

    return lines;
  }

  /**
   * The Phonetic Word & Letter Timing Synthesizer
   */
  private synthesizeLines(rawLines: Array<{ timeMs: number; text: string }>): LyricLine[] {
    const lines: LyricLine[] = [];

    for (let i = 0; i < rawLines.length; i++) {
      const cur = rawLines[i];
      const next = i < rawLines.length - 1 ? rawLines[i + 1] : null;
      const text = cur.text.trim();
      const charCount = text.length;

      // Active vocal window
      const vocalDuration = next
        ? Math.min(next.timeMs - cur.timeMs - 100, Math.max(1600, charCount * 68))
        : Math.max(1600, charCount * 68);

      const lineStartMs = cur.timeMs;
      const lineEndMs = lineStartMs + vocalDuration;

      // Tokenize words
      const rawTokens = text.split(/\s+/).filter(Boolean);
      const words: LyricWord[] = [];
      const adLibs: LyricWord[] = [];

      // Phonetic duration weights
      const weights = rawTokens.map(token => {
        const chars = Array.from(token);
        let weight = 0;
        for (const c of chars) {
          if (VOWEL_REGEX.test(c)) {
            weight += 1.6;
          } else {
            weight += 1.0;
          }
        }
        if (PUNCTUATION_END_REGEX.test(token)) {
          weight += 1.8;
        }
        return Math.max(1.0, weight);
      });

      const totalWeight = weights.reduce((sum, w) => sum + w, 0) || 1;
      let cursorMs = lineStartMs;

      rawTokens.forEach((token, wIdx) => {
        const wWeight = weights[wIdx];
        const rawDuration = Math.round((wWeight / totalWeight) * vocalDuration);
        const wStart = cursorMs;
        let wEnd = wIdx === rawTokens.length - 1 ? lineEndMs : wStart + rawDuration;
        if (wEnd <= wStart) wEnd = wStart + 100;
        const wDuration = wEnd - wStart;

        const clean = sanitizeWord(token);
        const isAdLib = this.isParentheticalAdLib(token);
        const semanticEffect = matchSemanticEffect(token);
        const isMelisma = wDuration >= 600 && clean.length >= 2;
        const chars = this.subdivideChars(token, wStart, wDuration);

        const wordObj: LyricWord = {
          id: `w_${i}_${wIdx}`,
          text: token,
          cleanText: clean,
          startMs: wStart,
          endMs: wEnd,
          durationMs: wDuration,
          isMelisma,
          isAdLib,
          semanticEffect,
          chars
        };

        words.push(wordObj);
        if (isAdLib) {
          adLibs.push(wordObj);
        }

        // Add 140ms breath pause after punctuation
        const breathPause = PUNCTUATION_END_REGEX.test(token) ? 140 : 0;
        cursorMs = wEnd + breathPause;
      });

      lines.push({
        id: `l_${i}`,
        index: i,
        startMs: lineStartMs,
        endMs: Math.max(lineEndMs, cursorMs),
        words,
        adLibs
      });
    }

    return lines;
  }

  private subdivideChars(wordText: string, wordStartMs: number, wordDurationMs: number): LyricChar[] {
    const chars = Array.from(wordText);
    const weights = chars.map(c => {
      if (VOWEL_REGEX.test(c)) return 1.6;
      if (/[.,!?;:…'"]/.test(c)) return 0.4;
      return 1.0;
    });

    const totalWeight = weights.reduce((sum, w) => sum + w, 0) || 1;
    const result: LyricChar[] = [];
    let curStart = wordStartMs;

    chars.forEach((char, index) => {
      const cDuration = Math.max(12, Math.round((weights[index] / totalWeight) * wordDurationMs));
      const cEnd = index === chars.length - 1 ? wordStartMs + wordDurationMs : curStart + cDuration;

      result.push({
        char,
        indexInWord: index,
        startMs: curStart,
        endMs: cEnd,
        durationMs: Math.max(10, cEnd - curStart)
      });

      curStart = cEnd;
    });

    return result;
  }

  private isParentheticalAdLib(token: string): boolean {
    const t = token.trim();
    if (t.startsWith('(') || t.endsWith(')') || t.startsWith('[') || t.endsWith(']')) {
      return true;
    }
    const clean = sanitizeWord(t);
    return ['yeah', 'yea', 'ooh', 'oooh', 'ahh', 'ahhh', 'woah', 'whoa', 'hey', 'uh'].includes(clean);
  }

  private generateFallbackLines(title: string, artist: string, durationMs: number): LyricLine[] {
    const demo = [
      { timeMs: Math.round(durationMs * 0.1), text: title },
      { timeMs: Math.round(durationMs * 0.35), text: artist },
      { timeMs: Math.round(durationMs * 0.65), text: 'Instrumental' }
    ];
    return this.synthesizeLines(demo);
  }
}
