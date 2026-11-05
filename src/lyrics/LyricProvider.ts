import {
  ProcessedTrack,
  LyricLine,
  LyricWord,
  LyricChar,
  SemanticEffect
} from '../types/lyrics';
import { matchSemanticEffect, sanitizeWord } from '../engine/SemanticPhysics';

const VOWEL_REGEX = /[aeiouyAEIOUY\u0904-\u0914\u0960-\u0963]/; // Includes common Devanagari vowel signs
const PUNCTUATION_END_REGEX = /[.,!?;:…'"]$/;

export function isGarbageLyricLine(text: string): boolean {
  if (!text) return true;
  const trimmed = text.trim();
  if (trimmed.length === 0) return true;
  // Filter out pure timestamps: "00:00", "00:16", "01:23.45", "[00:16]"
  if (/^\[?\d{1,2}:\d{2}(?:\.\d{1,3})?\]?$/.test(trimmed)) return true;
  // Filter out pure audio cues, musical notes, dashes: "♪", "♫", "---", "..."
  if (/^[♪♫♬\s\-_–—•·.…\*\#\(\)\[\]]+$/.test(trimmed)) return true;
  // Filter out instrumental / intro / outro marker words
  if (/^(\(|\[)?(instrumental|intro|outro|break|solo|music)(\)|\])?$/i.test(trimmed)) return true;
  return false;
}

export class LyricProvider {
  private static instance: LyricProvider | null = null;
  private cache = new Map<string, ProcessedTrack>();
  private activeRequestId = 0;

  private wordSegmenter: Intl.Segmenter | null = null;
  private graphemeSegmenter: Intl.Segmenter | null = null;

  private constructor() {
    if (typeof Intl !== 'undefined' && (Intl as any).Segmenter) {
      this.wordSegmenter = new Intl.Segmenter(undefined, { granularity: 'word' });
      this.graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    }
  }

  public static getInstance(): LyricProvider {
    if (!LyricProvider.instance) {
      LyricProvider.instance = new LyricProvider();
    }
    return LyricProvider.instance;
  }

  /**
   * Helper to convert spotify:image:<id> to https://i.scdn.co/image/<id>
   */
  public static resolveImageUrl(url: string | undefined): string {
    if (!url) return '';
    if (url.startsWith('spotify:image:')) {
      return `https://i.scdn.co/image/${url.replace('spotify:image:', '')}`;
    }
    return url;
  }

  public async getTrackLyrics(track: Spicetify.PlayerTrack): Promise<ProcessedTrack> {
    const uri = track.uri;
    if (this.cache.has(uri)) {
      return this.cache.get(uri)!;
    }

    const requestId = ++this.activeRequestId;
    const title = track.name || '';
    const artist = track.artists?.[0]?.name || '';
    const album = track.album?.name || '';
    const rawArt = track.album?.images?.[0]?.url || (track.metadata as any)?.image_url || '';
    const albumArtUrl = LyricProvider.resolveImageUrl(rawArt);
    const durationMs = track.duration?.milliseconds || 180000;
    const trackId = this.getTrackId(uri);

    let rawLines: Array<{ timeMs: number; text: string }> | null = null;
    let wordSyncedLines: LyricLine[] | null = null;

    // 1. Try Source A: Spotify Internal Color-Lyrics (with syncType verification)
    try {
      const spotifyLyrics = await this.fetchSpotifyLyrics(trackId);
      if (spotifyLyrics && spotifyLyrics.length > 0) {
        rawLines = spotifyLyrics;
      }
    } catch (err) {
      console.warn('[VerseEngine] Spotify color-lyrics fetch failed:', err);
    }

    // 2. Try Source B: LRCLIB API (millions of synced songs)
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
      } catch (err) {
        console.warn('[VerseEngine] LRCLIB fetch failed:', err);
      }
    }

    // Abort if a newer track request was initiated
    if (requestId !== this.activeRequestId) {
      throw new Error('Superseded by newer track request');
    }

    // 3. Synthesize full AST
    let lines: LyricLine[] = [];
    let isFallback = false;

    if (wordSyncedLines && wordSyncedLines.length > 0) {
      lines = wordSyncedLines;
    } else if (rawLines && rawLines.length > 0) {
      lines = this.synthesizeLines(rawLines);
    } else {
      isFallback = true;
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

    // Only cache genuine lyrics, never poison cache with network failures or empty fallbacks
    if (!isFallback && lines.length > 0) {
      this.cache.set(uri, processed);
    }

    return processed;
  }

  private getTrackId(uri: string): string {
    const parts = uri.split(':');
    return parts[parts.length - 1] || '';
  }

  private async fetchSpotifyLyrics(trackId: string): Promise<Array<{ timeMs: number; text: string }> | null> {
    if (!trackId || typeof Spicetify === 'undefined' || !Spicetify.CosmosAsync) return null;

    const url = `https://spclient.wg.spotify.com/color-lyrics/v2/track/${trackId}?format=json&vocalRemoval=false&market=from_token`;
    const res = await Spicetify.CosmosAsync.get(url);

    // Verify lyrics exist and are actually synced (avoid landing all unsynced lines at 0ms)
    if (res?.lyrics?.lines && Array.isArray(res.lyrics.lines)) {
      if (res.lyrics.syncType === 'UNSYNCED') {
        console.log('[VerseEngine] Spotify lyrics are UNSYNCED, deferring to LRCLIB');
        return null;
      }

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
      const headers = { 'Lrclib-Client': 'VerseEngine/2.0.0 (Spicetify Extension)' };
      let res = await fetch(getUrl, { headers });

      let data: any = null;
      if (res.ok) {
        data = await res.json();
      } else {
        // Fallback to /api/search with duration check
        const searchUrl = `https://lrclib.net/api/search?track_name=${encodeURIComponent(title)}&artist_name=${encodeURIComponent(artist)}`;
        const searchRes = await fetch(searchUrl, { headers });
        if (searchRes.ok) {
          const results = await searchRes.json();
          if (Array.isArray(results) && results.length > 0) {
            // Find best matching track with syncedLyrics and duration within +/- 4s
            data = results.find(
              (r: any) => r.syncedLyrics && Math.abs((r.duration || durationSec) - durationSec) <= 4
            ) || results[0];
          }
        }
      }

      if (!data || !data.syncedLyrics) return null;

      const text: string = data.syncedLyrics;
      if (text.includes('<') && text.includes('>')) {
        const wordLines = this.parseEnhancedLrc(text);
        if (wordLines.length > 0) return { wordLines };
      }

      const lineLyrics = this.parseStandardLrc(text);
      if (lineLyrics.length > 0) return { lineLyrics };
    } catch {
      // LRCLIB unavailable
    }

    return null;
  }

  /**
   * Parses standard LRC, correctly handling:
   * 1. Multiple timestamps per line: "[00:10.00][00:25.00]Repeated line"
   * 2. Timestamps without fractions: "[01:15]Line text"
   */
  public parseStandardLrc(lrc: string): Array<{ timeMs: number; text: string }> {
    const lines: Array<{ timeMs: number; text: string }> = [];
    const timeTagRegex = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g;

    for (const raw of lrc.split('\n')) {
      const trimmed = raw.trim();
      if (!trimmed) continue;

      const timestamps: number[] = [];
      let match: RegExpExecArray | null;
      let lastIndex = 0;

      while ((match = timeTagRegex.exec(trimmed)) !== null) {
        const min = parseInt(match[1], 10);
        const sec = parseInt(match[2], 10);
        const fracStr = match[3] || '0';
        const ms = fracStr.length === 2 ? parseInt(fracStr, 10) * 10 : parseInt(fracStr.padEnd(3, '0').slice(0, 3), 10);
        timestamps.push(min * 60000 + sec * 1000 + ms);
        lastIndex = timeTagRegex.lastIndex;
      }

      if (timestamps.length > 0) {
        const text = trimmed.slice(lastIndex).trim();
        if (text && !isGarbageLyricLine(text)) {
          for (const timeMs of timestamps) {
            lines.push({ timeMs, text });
          }
        }
      }
    }

    return lines.sort((a, b) => a.timeMs - b.timeMs);
  }

  /**
   * Parses Enhanced LRC with word-level timestamps <mm:ss.xx>
   * Computes accurate word duration: nextWord.startMs - thisWord.startMs
   */
  public parseEnhancedLrc(lrc: string): LyricLine[] {
    const lines: LyricLine[] = [];
    const lineTagRegex = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\](.*)/;
    const wordTagRegex = /<(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?>([^<]+)/g;

    const rows = lrc.split('\n');
    let lIdx = 0;

    for (const row of rows) {
      const match = lineTagRegex.exec(row);
      if (!match) continue;

      const min = parseInt(match[1], 10);
      const sec = parseInt(match[2], 10);
      const frac = match[3] || '0';
      const lineStartMs = min * 60000 + sec * 1000 + (frac.length === 2 ? parseInt(frac, 10) * 10 : parseInt(frac.padEnd(3, '0').slice(0, 3), 10));
      const rest = match[4];

      interface RawWordToken {
        text: string;
        startMs: number;
      }
      const rawTokens: RawWordToken[] = [];
      let wordMatch: RegExpExecArray | null;

      while ((wordMatch = wordTagRegex.exec(rest)) !== null) {
        const wMin = parseInt(wordMatch[1], 10);
        const wSec = parseInt(wordMatch[2], 10);
        const wFrac = wordMatch[3] || '0';
        const wStart = wMin * 60000 + wSec * 1000 + (wFrac.length === 2 ? parseInt(wFrac, 10) * 10 : parseInt(wFrac.padEnd(3, '0').slice(0, 3), 10));
        const token = wordMatch[4].trim();
        if (token) {
          rawTokens.push({ text: token, startMs: wStart });
        }
      }

      if (rawTokens.length === 0) continue;

      const words: LyricWord[] = [];
      const lineEndMs = rawTokens[rawTokens.length - 1].startMs + 1800;

      for (let w = 0; w < rawTokens.length; w++) {
        const cur = rawTokens[w];
        const next = w < rawTokens.length - 1 ? rawTokens[w + 1] : null;
        // Accurate duration: next start minus this start (not gap before word!)
        const wDuration = next
          ? Math.max(80, next.startMs - cur.startMs)
          : Math.max(80, lineEndMs - cur.startMs);

        const clean = sanitizeWord(cur.text);
        const isAdLib = /^\(.*\)$|^\[.*\]$/.test(cur.text.trim());
        const semanticEffect = matchSemanticEffect(cur.text);
        const isMelisma = wDuration >= 600 && clean.length >= 2;
        const chars = this.subdivideGraphemes(cur.text, cur.startMs, wDuration);

        words.push({
          id: `enh_w_${lIdx}_${w}`,
          text: cur.text,
          cleanText: clean,
          startMs: cur.startMs,
          endMs: cur.startMs + wDuration,
          durationMs: wDuration,
          isMelisma,
          isAdLib,
          semanticEffect,
          chars
        });
      }

      lines.push({
        id: `enh_l_${lIdx}`,
        index: lIdx,
        startMs: lineStartMs,
        endMs: lineEndMs,
        words,
        adLibs: []
      });
      lIdx++;
    }

    return lines;
  }

  /**
   * The Phonetic Word & Letter Timing Synthesizer
   * Segments international text (Devanagari, CJK, Latin) and applies vowel weighting
   */
  public synthesizeLines(rawLines: Array<{ timeMs: number; text: string }>): LyricLine[] {
    const lines: LyricLine[] = [];

    for (let i = 0; i < rawLines.length; i++) {
      const cur = rawLines[i];
      const next = i < rawLines.length - 1 ? rawLines[i + 1] : null;
      const text = cur.text.trim();
      const charCount = text.length;

      // Safe vocal window budgeting (never negative!)
      const timeToNext = next ? next.timeMs - cur.timeMs : 3000;
      const vocalDuration = Math.max(
        400,
        next
          ? Math.min(Math.max(400, timeToNext - 80), Math.max(1400, charCount * 65))
          : Math.max(1600, charCount * 65)
      );

      const lineStartMs = cur.timeMs;
      const lineEndMs = lineStartMs + vocalDuration;

      // Tokenize words using Intl.Segmenter or regex fallback
      const rawTokens = this.tokenizeWords(text);
      if (rawTokens.length === 0) continue;

      const words: LyricWord[] = [];
      let semanticCountInLine = 0;

      // Phonetic duration weights
      const weights = rawTokens.map(token => {
        const graphemes = this.splitGraphemes(token);
        let weight = 0;
        for (const g of graphemes) {
          if (VOWEL_REGEX.test(g)) {
            weight += 1.6;
          } else {
            weight += 1.0;
          }
        }
        if (PUNCTUATION_END_REGEX.test(token)) {
          weight += 1.4;
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
        if (wEnd <= wStart) wEnd = wStart + 80;
        const wDuration = wEnd - wStart;

        const clean = sanitizeWord(token);
        // Only parenthesized expressions are ad-libs (never plain words like "yeah" or "hey")
        const isAdLib = /^\(.*\)$|^\[.*\]$/.test(token.trim());

        // Cap semantic effects to at most 1-2 per line to prevent visual clutter
        let semanticEffect: SemanticEffect = 'NONE';
        if (semanticCountInLine < 1) {
          semanticEffect = matchSemanticEffect(token);
          if (semanticEffect !== 'NONE') {
            semanticCountInLine++;
          }
        }

        const isMelisma = wDuration >= 600 && clean.length >= 2;
        const chars = this.subdivideGraphemes(token, wStart, wDuration);

        words.push({
          id: `syn_w_${i}_${wIdx}`,
          text: token,
          cleanText: clean,
          startMs: wStart,
          endMs: wEnd,
          durationMs: wDuration,
          isMelisma,
          isAdLib,
          semanticEffect,
          chars
        });

        cursorMs = wEnd;
      });

      lines.push({
        id: `syn_l_${i}`,
        index: i,
        startMs: lineStartMs,
        endMs: lineEndMs,
        words,
        adLibs: []
      });
    }

    return lines;
  }

  /**
   * Tokenize words: Preserves parenthesized ad-libs (e.g. "(yeah)"),
   * supports space-separated languages (Latin, Indic, Cyrillic, etc.),
   * and segments un-spaced CJK scripts using Intl.Segmenter.
   */
  private tokenizeWords(text: string): string[] {
    const trimmed = text.trim();
    if (!trimmed) return [];

    const CJK_REGEX = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;

    // If text contains whitespace, split by whitespace and only segment CJK sub-tokens
    if (/\s+/.test(trimmed)) {
      const tokens = trimmed.split(/\s+/).filter(Boolean);
      const result: string[] = [];
      for (const tok of tokens) {
        if (CJK_REGEX.test(tok) && this.wordSegmenter) {
          const segments = [...this.wordSegmenter.segment(tok)]
            .map(s => s.segment.trim())
            .filter(Boolean);
          result.push(...(segments.length > 0 ? segments : [tok]));
        } else {
          result.push(tok);
        }
      }
      return result;
    }

    // Text has no whitespace (e.g. unspaced CJK sentence)
    if (CJK_REGEX.test(trimmed) && this.wordSegmenter) {
      const segments = [...this.wordSegmenter.segment(trimmed)]
        .map(s => s.segment.trim())
        .filter(Boolean);
      if (segments.length > 0) return segments;
    }

    return [trimmed];
  }

  /**
   * Split string into grapheme clusters preserving complex conjuncts (e.g. Hindi प्यार -> [प्या, र])
   */
  private splitGraphemes(str: string): string[] {
    if (this.graphemeSegmenter) {
      return [...this.graphemeSegmenter.segment(str)].map(s => s.segment);
    }
    return Array.from(str);
  }

  private subdivideGraphemes(wordText: string, wordStartMs: number, wordDurationMs: number): LyricChar[] {
    const graphemes = this.splitGraphemes(wordText);
    if (graphemes.length === 0) return [];

    const weights = graphemes.map(g => (VOWEL_REGEX.test(g) ? 1.6 : 1.0));
    const total = weights.reduce((a, b) => a + b, 0) || 1;

    let cursor = wordStartMs;
    return graphemes.map((char, cIdx) => {
      const dur = Math.max(30, Math.round((weights[cIdx] / total) * wordDurationMs));
      const charObj: LyricChar = {
        char,
        indexInWord: cIdx,
        startMs: cursor,
        endMs: cursor + dur,
        durationMs: dur
      };
      cursor += dur;
      return charObj;
    });
  }

  private generateFallbackLines(title: string, artist: string, durationMs: number): LyricLine[] {
    const midPoint = Math.floor(durationMs * 0.45);
    return [
      {
        id: 'inst_1',
        index: 0,
        startMs: 0,
        endMs: midPoint,
        words: [
          {
            id: 'iw_1',
            text: title || 'Instrumental',
            cleanText: sanitizeWord(title) || 'instrumental',
            startMs: 0,
            endMs: midPoint,
            durationMs: midPoint,
            isMelisma: false,
            isAdLib: false,
            semanticEffect: 'NONE',
            chars: []
          }
        ],
        adLibs: []
      },
      {
        id: 'inst_2',
        index: 1,
        startMs: midPoint,
        endMs: durationMs,
        words: [
          {
            id: 'iw_2',
            text: artist || 'Enjoy the music',
            cleanText: sanitizeWord(artist) || 'enjoy the music',
            startMs: midPoint,
            endMs: durationMs,
            durationMs: durationMs - midPoint,
            isMelisma: false,
            isAdLib: false,
            semanticEffect: 'NONE',
            chars: []
          }
        ],
        adLibs: []
      }
    ];
  }
}
