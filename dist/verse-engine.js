"use strict";
var VerseEngineBundle = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/app.ts
  var app_exports = {};
  __export(app_exports, {
    VerseEngineApp: () => VerseEngineApp,
    default: () => app_default
  });

  // src/engine/SemanticPhysics.ts
  var SEMANTIC_STEMS = {
    NONE: [],
    GRAVITY: [
      "sink",
      "sinking",
      "sinks",
      "sank",
      "sunk",
      "heavy",
      "heavier",
      "heavily",
      "heaviest",
      "drown",
      "drowning",
      "drowned",
      "drowns",
      "fall",
      "falling",
      "falls",
      "fell",
      "fallen",
      "descend",
      "descent",
      "collapse",
      "tumble",
      "gravity",
      "burden",
      "plunge",
      "anchor",
      "submerge",
      "underneath",
      "abyss"
    ],
    FRACTURE: [
      "shatter",
      "shattered",
      "shattering",
      "split",
      "splitting",
      "splits",
      "crash",
      "crashing",
      "crashed",
      "crashes",
      "crack",
      "cracked",
      "cracking",
      "cracks",
      "snap",
      "snapped",
      "slice",
      "sliced",
      "sever",
      "severed",
      "shard",
      "shards",
      "bleed",
      "bled",
      "splinter",
      "rupture"
    ],
    FADE: [
      "ghost",
      "ghostly",
      "ghosts",
      "smoke",
      "smoky",
      "smoking",
      "blur",
      "blurred",
      "blurry",
      "vanish",
      "vanished",
      "vanishing",
      "dust",
      "mist",
      "haze",
      "vapor",
      "disappear",
      "evaporate",
      "dissolve"
    ],
    ECHO: [
      "echo",
      "echoing",
      "echoes",
      "echoed",
      "scream",
      "screaming",
      "screamed",
      "screams",
      "shout",
      "shouting",
      "howl",
      "resound",
      "reverberate",
      "whisper"
    ],
    PULSE: [
      "heartbeat",
      "pulse",
      "pulsing",
      "burn",
      "burning",
      "burned",
      "burnt",
      "burns",
      "flame",
      "flames",
      "blaze",
      "ignite",
      "sparks",
      "fever",
      "sun",
      "sunlight",
      "shine",
      "shining",
      "glow",
      "glowing"
    ]
  };
  var STEM_MAP = /* @__PURE__ */ new Map();
  for (const [effect, stems] of Object.entries(SEMANTIC_STEMS)) {
    for (const stem of stems) {
      STEM_MAP.set(stem.toLowerCase(), effect);
    }
  }
  function sanitizeWord(word) {
    if (!word) return "";
    return word.toLowerCase().replace(/[^\p{L}\p{M}\p{N}]/gu, "").trim();
  }
  function matchSemanticEffect(rawWord) {
    const clean = sanitizeWord(rawWord);
    if (!clean || clean.length < 3) return "NONE";
    const exact = STEM_MAP.get(clean);
    if (exact) return exact;
    const stems = [
      clean.replace(/(ing|ed|es|s|ly|er|est)$/, ""),
      clean.replace(/(ting|ping|ning|ring)$/, "")
    ];
    for (const stem of stems) {
      if (stem.length >= 3) {
        const match = STEM_MAP.get(stem);
        if (match) return match;
      }
    }
    return "NONE";
  }

  // src/lyrics/LyricProvider.ts
  var VOWEL_REGEX = /[aeiouyAEIOUY\u0904-\u0914\u0960-\u0963]/;
  var PUNCTUATION_END_REGEX = /[.,!?;:…'"]$/;
  function isGarbageLyricLine(text) {
    if (!text) return true;
    const trimmed = text.trim();
    if (trimmed.length === 0) return true;
    if (/^\[?\d{1,2}:\d{2}(?:\.\d{1,3})?\]?$/.test(trimmed)) return true;
    if (/^[♪♫♬\s\-_–—•·.…\*\#\(\)\[\]]+$/.test(trimmed)) return true;
    if (/^(\(|\[)?(instrumental|intro|outro|break|solo|music)(\)|\])?$/i.test(trimmed)) return true;
    return false;
  }
  var LyricProvider = class _LyricProvider {
    static instance = null;
    cache = /* @__PURE__ */ new Map();
    activeRequestId = 0;
    wordSegmenter = null;
    graphemeSegmenter = null;
    constructor() {
      if (typeof Intl !== "undefined" && Intl.Segmenter) {
        this.wordSegmenter = new Intl.Segmenter(void 0, { granularity: "word" });
        this.graphemeSegmenter = new Intl.Segmenter(void 0, { granularity: "grapheme" });
      }
    }
    static getInstance() {
      if (!_LyricProvider.instance) {
        _LyricProvider.instance = new _LyricProvider();
      }
      return _LyricProvider.instance;
    }
    /**
     * Helper to convert spotify:image:<id> to https://i.scdn.co/image/<id>
     */
    static resolveImageUrl(url) {
      if (!url) return "";
      if (url.startsWith("spotify:image:")) {
        return `https://i.scdn.co/image/${url.replace("spotify:image:", "")}`;
      }
      return url;
    }
    async getTrackLyrics(track) {
      const uri = track.uri;
      if (this.cache.has(uri)) {
        return this.cache.get(uri);
      }
      const requestId = ++this.activeRequestId;
      const title = track.name || "";
      const artist = track.artists?.[0]?.name || "";
      const album = track.album?.name || "";
      const rawArt = track.album?.images?.[0]?.url || track.metadata?.image_url || "";
      const albumArtUrl = _LyricProvider.resolveImageUrl(rawArt);
      const durationMs = track.duration?.milliseconds || 18e4;
      const trackId = this.getTrackId(uri);
      let rawLines = null;
      let wordSyncedLines = null;
      try {
        const spotifyLyrics = await this.fetchSpotifyLyrics(trackId);
        if (spotifyLyrics && spotifyLyrics.length > 0) {
          rawLines = spotifyLyrics;
        }
      } catch (err) {
        console.warn("[VerseEngine] Spotify color-lyrics fetch failed:", err);
      }
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
          console.warn("[VerseEngine] LRCLIB fetch failed:", err);
        }
      }
      if (requestId !== this.activeRequestId) {
        throw new Error("Superseded by newer track request");
      }
      let lines = [];
      let isFallback = false;
      if (wordSyncedLines && wordSyncedLines.length > 0) {
        lines = wordSyncedLines;
      } else if (rawLines && rawLines.length > 0) {
        lines = this.synthesizeLines(rawLines);
      } else {
        isFallback = true;
        lines = this.generateFallbackLines(title, artist, durationMs);
      }
      const processed = {
        uri,
        title,
        artist,
        album,
        albumArtUrl,
        durationMs,
        lines
      };
      if (!isFallback && lines.length > 0) {
        this.cache.set(uri, processed);
      }
      return processed;
    }
    getTrackId(uri) {
      const parts = uri.split(":");
      return parts[parts.length - 1] || "";
    }
    async fetchSpotifyLyrics(trackId) {
      if (!trackId || typeof Spicetify === "undefined" || !Spicetify.CosmosAsync) return null;
      const url = `https://spclient.wg.spotify.com/color-lyrics/v2/track/${trackId}?format=json&vocalRemoval=false&market=from_token`;
      const res = await Spicetify.CosmosAsync.get(url);
      if (res?.lyrics?.lines && Array.isArray(res.lyrics.lines)) {
        if (res.lyrics.syncType === "UNSYNCED") {
          console.log("[VerseEngine] Spotify lyrics are UNSYNCED, deferring to LRCLIB");
          return null;
        }
        return res.lyrics.lines.filter((l) => l.words && !isGarbageLyricLine(l.words)).map((l) => ({
          timeMs: parseInt(l.startTimeMs, 10) || 0,
          text: l.words.trim()
        }));
      }
      return null;
    }
    async fetchLrclib(title, artist, album, durationMs) {
      const durationSec = Math.round(durationMs / 1e3);
      const getUrl = `https://lrclib.net/api/get?track_name=${encodeURIComponent(title)}&artist_name=${encodeURIComponent(artist)}&album_name=${encodeURIComponent(album)}&duration=${durationSec}`;
      try {
        const headers = { "Lrclib-Client": "VerseEngine/2.0.0 (Spicetify Extension)" };
        let res = await fetch(getUrl, { headers });
        let data = null;
        if (res.ok) {
          data = await res.json();
        } else {
          const searchUrl = `https://lrclib.net/api/search?track_name=${encodeURIComponent(title)}&artist_name=${encodeURIComponent(artist)}`;
          const searchRes = await fetch(searchUrl, { headers });
          if (searchRes.ok) {
            const results = await searchRes.json();
            if (Array.isArray(results) && results.length > 0) {
              data = results.find(
                (r) => r.syncedLyrics && Math.abs((r.duration || durationSec) - durationSec) <= 4
              ) || results[0];
            }
          }
        }
        if (!data || !data.syncedLyrics) return null;
        const text = data.syncedLyrics;
        if (text.includes("<") && text.includes(">")) {
          const wordLines = this.parseEnhancedLrc(text);
          if (wordLines.length > 0) return { wordLines };
        }
        const lineLyrics = this.parseStandardLrc(text);
        if (lineLyrics.length > 0) return { lineLyrics };
      } catch {
      }
      return null;
    }
    /**
     * Parses standard LRC, correctly handling:
     * 1. Multiple timestamps per line: "[00:10.00][00:25.00]Repeated line"
     * 2. Timestamps without fractions: "[01:15]Line text"
     */
    parseStandardLrc(lrc) {
      const lines = [];
      const timeTagRegex = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g;
      for (const raw of lrc.split("\n")) {
        const trimmed = raw.trim();
        if (!trimmed) continue;
        const timestamps = [];
        let match;
        let lastIndex = 0;
        while ((match = timeTagRegex.exec(trimmed)) !== null) {
          const min = parseInt(match[1], 10);
          const sec = parseInt(match[2], 10);
          const fracStr = match[3] || "0";
          const ms = fracStr.length === 2 ? parseInt(fracStr, 10) * 10 : parseInt(fracStr.padEnd(3, "0").slice(0, 3), 10);
          timestamps.push(min * 6e4 + sec * 1e3 + ms);
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
    parseEnhancedLrc(lrc) {
      const lines = [];
      const lineTagRegex = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\](.*)/;
      const wordTagRegex = /<(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?>([^<]+)/g;
      const rows = lrc.split("\n");
      let lIdx = 0;
      for (const row of rows) {
        const match = lineTagRegex.exec(row);
        if (!match) continue;
        const min = parseInt(match[1], 10);
        const sec = parseInt(match[2], 10);
        const frac = match[3] || "0";
        const lineStartMs = min * 6e4 + sec * 1e3 + (frac.length === 2 ? parseInt(frac, 10) * 10 : parseInt(frac.padEnd(3, "0").slice(0, 3), 10));
        const rest = match[4];
        const rawTokens = [];
        let wordMatch;
        while ((wordMatch = wordTagRegex.exec(rest)) !== null) {
          const wMin = parseInt(wordMatch[1], 10);
          const wSec = parseInt(wordMatch[2], 10);
          const wFrac = wordMatch[3] || "0";
          const wStart = wMin * 6e4 + wSec * 1e3 + (wFrac.length === 2 ? parseInt(wFrac, 10) * 10 : parseInt(wFrac.padEnd(3, "0").slice(0, 3), 10));
          const token = wordMatch[4].trim();
          if (token) {
            rawTokens.push({ text: token, startMs: wStart });
          }
        }
        if (rawTokens.length === 0) continue;
        const words = [];
        const lineEndMs = rawTokens[rawTokens.length - 1].startMs + 1800;
        for (let w = 0; w < rawTokens.length; w++) {
          const cur = rawTokens[w];
          const next = w < rawTokens.length - 1 ? rawTokens[w + 1] : null;
          const wDuration = next ? Math.max(80, next.startMs - cur.startMs) : Math.max(80, lineEndMs - cur.startMs);
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
    synthesizeLines(rawLines) {
      const lines = [];
      for (let i = 0; i < rawLines.length; i++) {
        const cur = rawLines[i];
        const next = i < rawLines.length - 1 ? rawLines[i + 1] : null;
        const text = cur.text.trim();
        const charCount = text.length;
        const timeToNext = next ? next.timeMs - cur.timeMs : 3e3;
        const vocalDuration = Math.max(
          400,
          next ? Math.min(Math.max(400, timeToNext - 80), Math.max(1400, charCount * 65)) : Math.max(1600, charCount * 65)
        );
        const lineStartMs = cur.timeMs;
        const lineEndMs = lineStartMs + vocalDuration;
        const rawTokens = this.tokenizeWords(text);
        if (rawTokens.length === 0) continue;
        const words = [];
        let semanticCountInLine = 0;
        const weights = rawTokens.map((token) => {
          const graphemes = this.splitGraphemes(token);
          let weight = 0;
          for (const g of graphemes) {
            if (VOWEL_REGEX.test(g)) {
              weight += 1.6;
            } else {
              weight += 1;
            }
          }
          if (PUNCTUATION_END_REGEX.test(token)) {
            weight += 1.4;
          }
          return Math.max(1, weight);
        });
        const totalWeight = weights.reduce((sum, w) => sum + w, 0) || 1;
        let cursorMs = lineStartMs;
        rawTokens.forEach((token, wIdx) => {
          const wWeight = weights[wIdx];
          const rawDuration = Math.round(wWeight / totalWeight * vocalDuration);
          const wStart = cursorMs;
          let wEnd = wIdx === rawTokens.length - 1 ? lineEndMs : wStart + rawDuration;
          if (wEnd <= wStart) wEnd = wStart + 80;
          const wDuration = wEnd - wStart;
          const clean = sanitizeWord(token);
          const isAdLib = /^\(.*\)$|^\[.*\]$/.test(token.trim());
          let semanticEffect = "NONE";
          if (semanticCountInLine < 1) {
            semanticEffect = matchSemanticEffect(token);
            if (semanticEffect !== "NONE") {
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
    tokenizeWords(text) {
      const trimmed = text.trim();
      if (!trimmed) return [];
      const CJK_REGEX = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;
      if (/\s+/.test(trimmed)) {
        const tokens = trimmed.split(/\s+/).filter(Boolean);
        const result = [];
        for (const tok of tokens) {
          if (CJK_REGEX.test(tok) && this.wordSegmenter) {
            const segments = [...this.wordSegmenter.segment(tok)].map((s) => s.segment.trim()).filter(Boolean);
            result.push(...segments.length > 0 ? segments : [tok]);
          } else {
            result.push(tok);
          }
        }
        return result;
      }
      if (CJK_REGEX.test(trimmed) && this.wordSegmenter) {
        const segments = [...this.wordSegmenter.segment(trimmed)].map((s) => s.segment.trim()).filter(Boolean);
        if (segments.length > 0) return segments;
      }
      return [trimmed];
    }
    /**
     * Split string into grapheme clusters preserving complex conjuncts (e.g. Hindi प्यार -> [प्या, र])
     */
    splitGraphemes(str) {
      if (this.graphemeSegmenter) {
        return [...this.graphemeSegmenter.segment(str)].map((s) => s.segment);
      }
      return Array.from(str);
    }
    subdivideGraphemes(wordText, wordStartMs, wordDurationMs) {
      const graphemes = this.splitGraphemes(wordText);
      if (graphemes.length === 0) return [];
      const weights = graphemes.map((g) => VOWEL_REGEX.test(g) ? 1.6 : 1);
      const total = weights.reduce((a, b) => a + b, 0) || 1;
      let cursor = wordStartMs;
      return graphemes.map((char, cIdx) => {
        const dur = Math.max(30, Math.round(weights[cIdx] / total * wordDurationMs));
        const charObj = {
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
    generateFallbackLines(title, artist, durationMs) {
      const midPoint = Math.floor(durationMs * 0.45);
      return [
        {
          id: "inst_1",
          index: 0,
          startMs: 0,
          endMs: midPoint,
          words: [
            {
              id: "iw_1",
              text: title || "Instrumental",
              cleanText: sanitizeWord(title) || "instrumental",
              startMs: 0,
              endMs: midPoint,
              durationMs: midPoint,
              isMelisma: false,
              isAdLib: false,
              semanticEffect: "NONE",
              chars: []
            }
          ],
          adLibs: []
        },
        {
          id: "inst_2",
          index: 1,
          startMs: midPoint,
          endMs: durationMs,
          words: [
            {
              id: "iw_2",
              text: artist || "Enjoy the music",
              cleanText: sanitizeWord(artist) || "enjoy the music",
              startMs: midPoint,
              endMs: durationMs,
              durationMs: durationMs - midPoint,
              isMelisma: false,
              isAdLib: false,
              semanticEffect: "NONE",
              chars: []
            }
          ],
          adLibs: []
        }
      ];
    }
  };

  // src/engine/AmbientLight.ts
  var AmbientLight = class _AmbientLight {
    static cachedPalettes = /* @__PURE__ */ new Map();
    static getEditorialPalette() {
      return {
        type: "editorial",
        primary: "#5C1421",
        // Rich Oxblood Maroon
        secondary: "#8C1D2E",
        // Deep Crimson
        highlight: "#180407",
        // High-contrast ink
        bg: "#FAF9F6",
        // Warm Bone Cream
        textInactive: "rgba(92, 20, 33, 0.28)",
        isDark: false
      };
    }
    static getObsidianPalette() {
      return {
        type: "obsidian",
        primary: "#FAF9F6",
        secondary: "#8C1D2E",
        highlight: "#FAF9F6",
        bg: "#0A0808",
        textInactive: "rgba(250, 249, 246, 0.28)",
        isDark: true
      };
    }
    static resolveImageUrl(url) {
      if (!url) return "";
      if (url.startsWith("spotify:image:")) {
        return `https://i.scdn.co/image/${url.replace("spotify:image:", "")}`;
      }
      return url;
    }
    static async extractAlbumPalette(rawUrl) {
      const imageUrl = _AmbientLight.resolveImageUrl(rawUrl);
      if (!imageUrl) {
        return this.getObsidianPalette();
      }
      if (this.cachedPalettes.has(imageUrl)) {
        return this.cachedPalettes.get(imageUrl);
      }
      return new Promise((resolve) => {
        if (typeof Spicetify !== "undefined" && Spicetify.colorExtractor) {
          try {
            const colors = Spicetify.colorExtractor(imageUrl);
            if (colors && colors.VIBRANT) {
              const pal = {
                type: "album",
                primary: colors.VIBRANT,
                secondary: colors.DARK_VIBRANT || colors.LIGHT_VIBRANT || "#8C1D2E",
                highlight: "#FAF9F6",
                bg: colors.DARK_MUTED || "#0A0808",
                textInactive: "rgba(250, 249, 246, 0.28)",
                isDark: true
              };
              this.cachedPalettes.set(imageUrl, pal);
              resolve(pal);
              return;
            }
          } catch {
          }
        }
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.onload = () => {
          try {
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");
            if (!ctx) {
              resolve(this.getObsidianPalette());
              return;
            }
            const size = 48;
            canvas.width = size;
            canvas.height = size;
            ctx.drawImage(img, 0, 0, size, size);
            const data = ctx.getImageData(0, 0, size, size).data;
            const bucketMap = /* @__PURE__ */ new Map();
            for (let i = 0; i < data.length; i += 4) {
              const r = data[i];
              const g = data[i + 1];
              const b = data[i + 2];
              const qr = Math.floor(r / 24) * 24;
              const qg = Math.floor(g / 24) * 24;
              const qb = Math.floor(b / 24) * 24;
              const key = qr << 16 | qg << 8 | qb;
              const existing = bucketMap.get(key);
              if (existing) {
                existing.count++;
              } else {
                const max = Math.max(r, g, b);
                const min = Math.min(r, g, b);
                const sat = max === 0 ? 0 : (max - min) / max;
                const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
                bucketMap.set(key, { r, g, b, count: 1, sat, lum });
              }
            }
            const buckets = Array.from(bucketMap.values());
            const candidateColors = buckets.filter(
              (b) => b.sat > 0.16 && b.lum > 0.12 && b.lum < 0.88
            );
            if (candidateColors.length === 0) {
              resolve(this.getObsidianPalette());
              return;
            }
            candidateColors.sort((a, b) => {
              const scoreA = Math.pow(a.count, 0.6) * Math.pow(a.sat, 1.2) * (1 - Math.abs(a.lum - 0.55));
              const scoreB = Math.pow(b.count, 0.6) * Math.pow(b.sat, 1.2) * (1 - Math.abs(b.lum - 0.55));
              return scoreB - scoreA;
            });
            const primaryBucket = candidateColors[0];
            let secondaryBucket = candidateColors[Math.min(1, candidateColors.length - 1)];
            for (let i = 1; i < candidateColors.length; i++) {
              const b = candidateColors[i];
              const colorDist = Math.abs(b.r - primaryBucket.r) + Math.abs(b.g - primaryBucket.g) + Math.abs(b.b - primaryBucket.b);
              if (colorDist > 75) {
                secondaryBucket = b;
                break;
              }
            }
            const primary = `rgb(${primaryBucket.r}, ${primaryBucket.g}, ${primaryBucket.b})`;
            const secondary = `rgb(${secondaryBucket.r}, ${secondaryBucket.g}, ${secondaryBucket.b})`;
            const highlight = "#FAF9F6";
            const bgR = Math.min(26, Math.max(8, Math.round(primaryBucket.r * 0.14 + 6)));
            const bgG = Math.min(24, Math.max(7, Math.round(primaryBucket.g * 0.14 + 5)));
            const bgB = Math.min(30, Math.max(9, Math.round(primaryBucket.b * 0.16 + 7)));
            const bg = `rgb(${bgR}, ${bgG}, ${bgB})`;
            const palette = {
              type: "album",
              primary,
              secondary,
              highlight,
              bg,
              textInactive: "rgba(250, 249, 246, 0.32)",
              isDark: true
            };
            this.cachedPalettes.set(imageUrl, palette);
            resolve(palette);
          } catch {
            resolve(this.getObsidianPalette());
          }
        };
        img.onerror = () => {
          resolve(this.getObsidianPalette());
        };
        img.src = imageUrl;
      });
    }
    static async getPalette(type, albumArtUrl) {
      if (type === "editorial") return this.getEditorialPalette();
      if (type === "obsidian") return this.getObsidianPalette();
      return this.extractAlbumPalette(albumArtUrl || "");
    }
  };

  // src/engine/Clock.ts
  var Clock = class _Clock {
    static instance = null;
    lastSpotifyMs = 0;
    lastPerfNow = performance.now();
    isPlaying = false;
    syncOffsetMs = 0;
    currentInterpolatedMs = 0;
    currentTrackUri = "";
    boundEvents = false;
    constructor() {
      this.loadSyncOffset();
      this.bindSpotifyEvents();
    }
    static getInstance() {
      if (!_Clock.instance) {
        _Clock.instance = new _Clock();
      }
      return _Clock.instance;
    }
    loadSyncOffset() {
      try {
        const stored = localStorage.getItem("verse_engine_sync_offset");
        if (stored !== null) {
          this.syncOffsetMs = parseInt(stored, 10) || 0;
        }
      } catch {
        this.syncOffsetMs = 0;
      }
    }
    setTrackUri(uri) {
      if (this.currentTrackUri !== uri) {
        this.currentTrackUri = uri;
        this.syncFromSpotify(true);
      }
    }
    getSyncOffset() {
      return this.syncOffsetMs;
    }
    setSyncOffset(offsetMs) {
      this.syncOffsetMs = offsetMs;
      try {
        localStorage.setItem("verse_engine_sync_offset", offsetMs.toString());
      } catch {
      }
    }
    adjustSyncOffset(deltaMs) {
      const updated = this.syncOffsetMs + deltaMs;
      this.setSyncOffset(updated);
      return updated;
    }
    bindSpotifyEvents() {
      if (this.boundEvents || typeof Spicetify === "undefined" || !Spicetify.Player) return;
      try {
        Spicetify.Player.addEventListener("songchange", () => {
          const data = Spicetify.Player.data;
          if (data?.item?.uri) {
            this.setTrackUri(data.item.uri);
          }
          this.syncFromSpotify(true);
        });
        Spicetify.Player.addEventListener("onplaypause", () => {
          this.syncFromSpotify(true);
        });
        Spicetify.Player.addEventListener("onprogress", () => {
          this.syncFromSpotify(false);
        });
        this.boundEvents = true;
      } catch {
      }
    }
    getSafeProgress() {
      try {
        if (typeof Spicetify !== "undefined" && Spicetify.Player) {
          return Spicetify.Player.getProgress() || 0;
        }
      } catch {
      }
      return 0;
    }
    getSafeIsPlaying() {
      try {
        if (typeof Spicetify !== "undefined" && Spicetify.Player) {
          return Spicetify.Player.isPlaying() || false;
        }
      } catch {
      }
      return false;
    }
    syncFromSpotify(hardSnap = false) {
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
        if (Math.abs(delta) >= 60) {
          this.lastSpotifyMs = polledProgress;
          this.lastPerfNow = now;
          this.currentInterpolatedMs = polledProgress;
        } else if (Math.abs(delta) > 3) {
          this.lastSpotifyMs += delta * 0.2;
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
    tick() {
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
    getNow() {
      return Math.max(0, this.currentInterpolatedMs + this.syncOffsetMs);
    }
    getIsPlaying() {
      return this.isPlaying;
    }
  };

  // src/engine/SpringSolver.ts
  var HarmonicSpring = class {
    position;
    velocity;
    target;
    stiffness;
    damping;
    mass;
    constructor(initialPosition = 0, stiffness = 180, damping = 22, mass = 1) {
      this.position = initialPosition;
      this.velocity = 0;
      this.target = initialPosition;
      this.stiffness = stiffness;
      this.damping = damping;
      this.mass = mass;
    }
    setTarget(target) {
      this.target = target;
    }
    reset(position, velocity = 0) {
      this.position = position;
      this.velocity = velocity;
      this.target = position;
    }
    /**
     * Semi-implicit Euler integration step
     * @param dt delta time in seconds (clamped to prevent explosion on tab blur)
     */
    step(dt) {
      const clampedDt = Math.min(dt, 0.033);
      const springForce = -this.stiffness * (this.position - this.target);
      const dampingForce = -this.damping * this.velocity;
      const acceleration = (springForce + dampingForce) / this.mass;
      this.velocity += acceleration * clampedDt;
      this.position += this.velocity * clampedDt;
      if (Math.abs(this.velocity) < 1e-4 && Math.abs(this.position - this.target) < 1e-4) {
        this.position = this.target;
        this.velocity = 0;
      }
      return this.position;
    }
    isSettled() {
      return Math.abs(this.velocity) < 1e-4 && Math.abs(this.position - this.target) < 1e-4;
    }
  };
  var SpringVector2 = class {
    x;
    y;
    constructor(initX = 0, initY = 0, stiffness = 120, damping = 22) {
      this.x = new HarmonicSpring(initX, stiffness, damping);
      this.y = new HarmonicSpring(initY, stiffness, damping);
    }
    setTarget(targetX, targetY) {
      this.x.setTarget(targetX);
      this.y.setTarget(targetY);
    }
    step(dt) {
      return {
        x: this.x.step(dt),
        y: this.y.step(dt)
      };
    }
    reset(x, y) {
      this.x.reset(x);
      this.y.reset(y);
    }
  };

  // src/engine/AnimationEngine.ts
  var AnimationEngine = class {
    clock;
    rafId = null;
    lastTime = performance.now();
    lastCurrentMs = 0;
    // Bound DOM refs (cached, never queried inside tick)
    stageEl = null;
    cameraEl = null;
    ambientRimEl = null;
    lyricsContainerEl = null;
    webgl = null;
    cachedLines = [];
    activeWordRef = null;
    currentActiveLineIdx = 0;
    isInitialPositionSet = false;
    // Vertical stage spring for butter-smooth active line centering
    stageYSpring = new HarmonicSpring(0, 110, 19);
    // Horizontal camera spring for drift marquee ribbon
    cameraSpring = new SpringVector2(0, 0, 95, 18);
    // Ambient Rim Breathing
    rimOpacitySpring = new HarmonicSpring(0.45, 60, 14);
    rimRadiusSpring = new HarmonicSpring(110, 55, 12);
    currentStyle = "convex";
    currentPalette = null;
    rimEnabled = true;
    constructor() {
      this.clock = Clock.getInstance();
      if (typeof window !== "undefined") {
        window.addEventListener("resize", () => this.measureOffsets());
      }
    }
    bindWebgl(webgl) {
      this.webgl = webgl;
    }
    bindElements(stageEl, cameraEl, ambientRimEl, lyricsContainerEl, cachedLines) {
      this.stageEl = stageEl;
      this.cameraEl = cameraEl;
      this.ambientRimEl = ambientRimEl;
      this.lyricsContainerEl = lyricsContainerEl;
      this.cachedLines = cachedLines;
      this.activeWordRef = null;
      this.currentActiveLineIdx = 0;
      this.isInitialPositionSet = false;
      this.lastCurrentMs = 0;
      this.measureOffsets();
      this.stageYSpring.reset(0, 0);
      this.cameraSpring.reset(0, 0);
    }
    measureOffsets() {
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
    setStyle(style) {
      this.currentStyle = style;
      this.cameraSpring.reset(0, 0);
      this.stageYSpring.reset(0, 0);
      this.isInitialPositionSet = false;
      if (this.lyricsContainerEl) {
        this.lyricsContainerEl.className = `ve-lyrics-container ve-style-${style}`;
      }
      this.invalidateRenderCache();
      if (typeof window !== "undefined") {
        requestAnimationFrame(() => {
          this.measureOffsets();
        });
      }
    }
    setPalette(palette) {
      this.currentPalette = palette;
      if (this.webgl) {
        this.webgl.setPalette(palette);
      }
    }
    setRimEnabled(enabled) {
      this.rimEnabled = enabled;
      if (this.ambientRimEl) {
        this.ambientRimEl.style.display = enabled ? "block" : "none";
      }
    }
    start() {
      if (this.rafId !== null) return;
      this.lastTime = performance.now();
      const loop = (time) => {
        const rawDt = (time - this.lastTime) / 1e3;
        const dt = Math.max(1e-3, Math.min(rawDt, 0.05));
        this.lastTime = time;
        this.tick(dt);
        this.rafId = requestAnimationFrame(loop);
      };
      this.rafId = requestAnimationFrame(loop);
    }
    stop() {
      if (this.rafId !== null) {
        cancelAnimationFrame(this.rafId);
        this.rafId = null;
      }
    }
    invalidateRenderCache() {
      for (let i = 0; i < this.cachedLines.length; i++) {
        const lineRef = this.cachedLines[i];
        lineRef.lastTransform = void 0;
        lineRef.lastOpacity = void 0;
        lineRef.lastFilter = void 0;
        lineRef.lastVisibility = void 0;
        for (let w = 0; w < lineRef.words.length; w++) {
          const wordRef = lineRef.words[w];
          wordRef.lastFill = void 0;
          wordRef.lastTransform = void 0;
          wordRef.lastFilter = void 0;
          wordRef.lastOpacity = void 0;
        }
      }
    }
    /**
     * PURE 144Hz RAF TICK: Direct DOM mutations on cached refs with dirty checking.
     */
    tick(dt) {
      if (!this.cachedLines || this.cachedLines.length === 0) return;
      const currentMs = this.clock.tick();
      if (this.lastCurrentMs > 0 && currentMs < this.lastCurrentMs - 250) {
        this.handleSeekBackward(currentMs);
      }
      this.lastCurrentMs = currentMs;
      let anyVocalActive = false;
      let targetLineIdx = this.findActiveLineIndex(currentMs);
      let currentActiveWord = null;
      if (targetLineIdx !== -1) {
        const activeLine = this.cachedLines[targetLineIdx].line;
        if (currentMs >= activeLine.startMs && currentMs <= activeLine.endMs) {
          anyVocalActive = true;
        }
      } else {
        targetLineIdx = 0;
      }
      this.currentActiveLineIdx = targetLineIdx;
      if (this.webgl) {
        this.webgl.updateVocalIntensity(anyVocalActive ? 0.85 : 0.15);
      }
      if (this.lyricsContainerEl && this.cachedLines[targetLineIdx]) {
        const activeLineRef = this.cachedLines[targetLineIdx];
        const offsetTop = activeLineRef.cachedOffsetTop ?? activeLineRef.el.offsetTop;
        const targetStageY = -offsetTop + window.innerHeight * 0.4;
        if (!this.isInitialPositionSet) {
          this.stageYSpring.reset(targetStageY, 0);
          this.isInitialPositionSet = true;
        } else {
          this.stageYSpring.setTarget(targetStageY);
        }
        const curStageY = this.stageYSpring.step(dt);
        this.lyricsContainerEl.style.transform = `translate3d(0, ${curStageY.toFixed(1)}px, 0)`;
      }
      for (let lIdx = 0; lIdx < this.cachedLines.length; lIdx++) {
        const lineRef = this.cachedLines[lIdx];
        const lineDist = lIdx - targetLineIdx;
        const absDist = Math.abs(lineDist);
        if (absDist > 6) {
          if (lineRef.lastVisibility !== "hidden") {
            lineRef.el.style.visibility = "hidden";
            lineRef.lastVisibility = "hidden";
          }
          continue;
        }
        if (lineRef.lastVisibility !== "visible") {
          lineRef.el.style.visibility = "visible";
          lineRef.lastVisibility = "visible";
        }
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
        let focalPos = 0;
        if (lineDist === 0 && lineRef.words.length > 0 && activeWordIdxInLine >= 0) {
          const curWordRef = lineRef.words[activeWordIdxInLine];
          const curWord = curWordRef?.word;
          const wordProg = curWord ? Math.max(0, Math.min(1, (currentMs - curWord.startMs) / Math.max(1, curWord.durationMs))) : 0;
          focalPos = activeWordIdxInLine + wordProg;
        }
        this.applyLineStyles(lineRef, lineDist, absDist, currentMs);
        for (let wIdx = 0; wIdx < lineRef.words.length; wIdx++) {
          const wordRef = lineRef.words[wIdx];
          const word = wordRef.word;
          const isWordActive = lineDist === 0 && wIdx === activeWordIdxInLine;
          const isWordPast = currentMs > word.endMs;
          if (isWordActive) {
            currentActiveWord = wordRef;
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
            const targetFill = lineDist < 0 ? "100%" : "0%";
            if (wordRef.lastFill !== targetFill) {
              wordRef.el.style.setProperty("--word-p", targetFill);
              wordRef.lastFill = targetFill;
            }
            if (wordRef.lastTransform !== "none") {
              wordRef.el.style.transform = "none";
              wordRef.lastTransform = "none";
            }
            if (wordRef.lastFilter !== "none") {
              wordRef.el.style.filter = "none";
              wordRef.lastFilter = "none";
            }
            if (wordRef.lastOpacity !== "") {
              wordRef.el.style.opacity = "";
              wordRef.lastOpacity = "";
            }
          }
        }
      }
      this.activeWordRef = currentActiveWord;
      this.tickCamera(currentActiveWord, this.cachedLines[targetLineIdx] ?? null, currentMs, dt);
      this.tickRim(anyVocalActive, dt);
    }
    /**
     * Incremental Active-Line Search: avoid linear scan of all lines every frame.
     */
    findActiveLineIndex(currentMs) {
      const totalLines = this.cachedLines.length;
      if (totalLines === 0) return 0;
      let idx = this.currentActiveLineIdx;
      if (idx < 0) idx = 0;
      if (idx >= totalLines) idx = totalLines - 1;
      const curLine = this.cachedLines[idx].line;
      if (currentMs >= curLine.startMs && currentMs <= curLine.endMs) {
        return idx;
      }
      if (currentMs > curLine.endMs) {
        while (idx + 1 < totalLines) {
          const nextLine = this.cachedLines[idx + 1].line;
          if (currentMs < nextLine.startMs) {
            return currentMs - curLine.endMs < 2e3 ? idx : idx + 1;
          }
          idx++;
          if (currentMs >= nextLine.startMs && currentMs <= nextLine.endMs) {
            return idx;
          }
        }
        return totalLines - 1;
      }
      if (currentMs < curLine.startMs) {
        while (idx > 0) {
          idx--;
          const prevLine = this.cachedLines[idx].line;
          if (currentMs >= prevLine.startMs && currentMs <= prevLine.endMs) {
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
    /**
     * Reset future state on backward seek so lyrics don't get stuck filled.
     */
    handleSeekBackward(currentMs) {
      for (let l = 0; l < this.cachedLines.length; l++) {
        const lineRef = this.cachedLines[l];
        if (lineRef.line.startMs > currentMs) {
          for (let w = 0; w < lineRef.words.length; w++) {
            const wordRef = lineRef.words[w];
            wordRef.springProgress.reset(0, 0);
            wordRef.springScale.reset(1, 0);
            wordRef.springZ.reset(0, 0);
            wordRef.springGravityY.reset(0, 0);
            wordRef.el.style.setProperty("--word-p", "0%");
            wordRef.lastFill = "0%";
            if (wordRef.shearTopEl) wordRef.shearTopEl.style.transform = "none";
            if (wordRef.shearBottomEl) wordRef.shearBottomEl.style.transform = "none";
          }
        }
      }
    }
    /**
     * Apply styles to a line with dirty checking to prevent layout reflows.
     */
    applyLineStyles(lineRef, lineDist, absDist, currentMs) {
      let transform = "";
      let opacity = "";
      let filter = "";
      if (this.currentStyle === "convex") {
        if (lineDist === 0) {
          transform = "translateZ(40px) scale(1.04)";
          opacity = "1.0";
          filter = "none";
        } else {
          const curveDeg = lineDist < 0 ? -16 : 16;
          const targetZ = -65 - absDist * 35;
          const targetScale = Math.max(0.78, 0.96 - absDist * 0.07);
          transform = `translateZ(${targetZ}px) rotateX(${curveDeg}deg) scale(${targetScale.toFixed(3)})`;
          opacity = Math.max(0.04, 0.36 / absDist).toFixed(2);
          filter = `blur(${Math.min(10, absDist * 1.8).toFixed(1)}px)`;
        }
      } else if (this.currentStyle === "drift") {
        if (lineDist === 0) {
          opacity = "1.0";
          filter = "none";
        } else {
          transform = `translateZ(-50px) rotateY(-5deg) scale(0.92)`;
          opacity = Math.max(0.04, 0.28 / absDist).toFixed(2);
          filter = `blur(${Math.min(10, absDist * 2).toFixed(1)}px)`;
        }
      } else if (this.currentStyle === "editorial") {
        if (lineDist === 0) {
          lineRef.el.classList.add("ve-line-active");
          transform = "translateZ(20px) scale(1.02)";
          opacity = "1.0";
          filter = "none";
          const dur = Math.max(1, lineRef.line.endMs - lineRef.line.startMs);
          const prog = Math.max(0, Math.min(100, (currentMs - lineRef.line.startMs) / dur * 100));
          const progStr = `${prog.toFixed(1)}%`;
          if (lineRef.lastActiveProgress !== progStr) {
            lineRef.el.style.setProperty("--line-progress", progStr);
            lineRef.lastActiveProgress = progStr;
          }
        } else {
          lineRef.el.classList.remove("ve-line-active");
          transform = "translateZ(0px) scale(1.0)";
          opacity = Math.max(0.03, 0.32 / absDist).toFixed(2);
          filter = `blur(${Math.min(8, absDist * 1.5).toFixed(1)}px)`;
        }
      } else {
        if (lineDist === 0) {
          transform = "translateZ(35px) scale(1.04)";
          opacity = "1.0";
          filter = "none";
        } else {
          transform = "translateZ(-30px) scale(0.95)";
          opacity = Math.max(0.04, 0.3 / absDist).toFixed(2);
          filter = `blur(${Math.min(10, absDist * 2).toFixed(1)}px)`;
        }
      }
      if (this.currentStyle !== "drift" || lineDist !== 0) {
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
    // ── Word-Level Kinematics ──────────────────────────────────────────────────
    updateWordKinematics(wordRef, wordIdxInLine, focalPos, activeWordIdxInLine, lineDist, currentMs, isWordActive, isWordPast, dt) {
      const word = wordRef.word;
      let targetProgress = 0;
      if (isWordPast) {
        targetProgress = 1;
      } else if (isWordActive) {
        const elapsed = currentMs - word.startMs;
        targetProgress = Math.max(0, Math.min(1, elapsed / Math.max(1, word.durationMs)));
      } else if (lineDist < 0) {
        targetProgress = 1;
      } else {
        targetProgress = 0;
      }
      wordRef.springProgress.setTarget(targetProgress);
      const curProgress = wordRef.springProgress.step(dt);
      const fillPercentStr = `${Math.round(curProgress * 100)}%`;
      if (wordRef.lastFill !== fillPercentStr) {
        wordRef.el.style.setProperty("--word-p", fillPercentStr);
        wordRef.lastFill = fillPercentStr;
      }
      let transform = "";
      let filter = "";
      let opacity = "";
      switch (this.currentStyle) {
        case "convex": {
          if (lineDist === 0) {
            const dist = wordIdxInLine + 0.5 - focalPos;
            const absDist = Math.abs(dist);
            const targetScale = 1 + 0.32 * Math.exp(-dist * dist * 0.45);
            const targetZ = 90 * Math.exp(-dist * dist * 0.4) - 30;
            const rotateY = Math.max(-32, Math.min(32, dist * 14));
            const blur = Math.max(0, (absDist - 0.7) * 2.4);
            opacity = Math.max(0.24, 1 - absDist * 0.2).toFixed(2);
            transform = `perspective(900px) translateZ(${targetZ.toFixed(1)}px) scale(${targetScale.toFixed(3)}) rotateY(${rotateY.toFixed(1)}deg)`;
            const bloomIntensity = Math.exp(-dist * dist * 2.2);
            if (bloomIntensity > 0.08) {
              filter = `drop-shadow(0 0 ${(bloomIntensity * 18).toFixed(1)}px var(--ve-primary))`;
            } else if (blur > 0.1) {
              filter = `blur(${blur.toFixed(1)}px)`;
            } else {
              filter = "none";
            }
          } else {
            transform = "perspective(900px) translateZ(0px) scale(1.0)";
            filter = "none";
            opacity = "";
          }
          break;
        }
        case "drift": {
          if (isWordActive) {
            wordRef.springScale.setTarget(1.15);
            wordRef.springZ.setTarget(40);
          } else {
            wordRef.springScale.setTarget(1);
            wordRef.springZ.setTarget(0);
          }
          const curScale = wordRef.springScale.step(dt);
          const curZ = wordRef.springZ.step(dt);
          transform = `translateZ(${curZ.toFixed(1)}px) scale(${curScale.toFixed(3)})`;
          filter = isWordActive ? "drop-shadow(0 0 20px var(--ve-primary)) drop-shadow(0 0 45px var(--ve-secondary))" : "none";
          opacity = isWordActive ? "1.0" : isWordPast ? "0.85" : "0.35";
          break;
        }
        case "editorial": {
          opacity = isWordActive ? "1.0" : isWordPast ? "0.78" : "0.24";
          if (word.isMelisma && isWordActive) {
            const melismaScaleX = 1 + Math.min(0.2, curProgress * 0.2);
            transform = `translateY(-3px) scale(${melismaScaleX.toFixed(3)}, 1.05)`;
          } else if (isWordActive) {
            transform = "translateY(-3px) scale(1.04)";
          } else {
            transform = "translateY(0) scale(1.0)";
          }
          filter = "none";
          break;
        }
        case "semantic": {
          let extraTransform = "";
          let extraFilter = "";
          if (word.semanticEffect === "GRAVITY") {
            wordRef.springGravityY.setTarget(isWordActive ? 32 : 0);
            const curSinkY = wordRef.springGravityY.step(dt);
            const curTilt = curSinkY / 32 * 5;
            extraTransform = ` translateY(${curSinkY.toFixed(1)}px) rotate(${curTilt.toFixed(1)}deg)`;
          } else if (word.semanticEffect === "PULSE") {
            if (isWordActive) {
              extraFilter = "drop-shadow(0 0 20px var(--ve-primary)) drop-shadow(0 0 45px var(--ve-secondary))";
              extraTransform = " scale(1.20)";
            }
          } else if (word.semanticEffect === "FRACTURE") {
            if (curProgress > 0.35) {
              const shear = (curProgress - 0.35) / 0.65 * 5;
              if (wordRef.shearTopEl) wordRef.shearTopEl.style.transform = `translate(${shear.toFixed(1)}px, -1px)`;
              if (wordRef.shearBottomEl) wordRef.shearBottomEl.style.transform = `translate(-${shear.toFixed(1)}px, 1px)`;
            } else {
              if (wordRef.shearTopEl) wordRef.shearTopEl.style.transform = "none";
              if (wordRef.shearBottomEl) wordRef.shearBottomEl.style.transform = "none";
            }
          } else if (word.semanticEffect === "FADE") {
            if (curProgress > 0.2) {
              const smokeProgress = (curProgress - 0.2) / 0.8;
              extraFilter = `blur(${(smokeProgress * 6).toFixed(1)}px)`;
              extraTransform = ` translateY(-${(smokeProgress * 12).toFixed(1)}px)`;
            }
          } else if (isWordActive) {
            extraTransform = " translateY(-5px) scale(1.08)";
          }
          if (word.semanticEffect === "ECHO" && wordRef.echoClones && wordRef.echoClones.length >= 2) {
            if (isWordActive) {
              const cycle = performance.now() % 800 / 800;
              const c1Scale = 1 + cycle * 0.3;
              const c1Opacity = 0.6 * (1 - cycle);
              const c2Scale = 1 + cycle * 0.6;
              const c2Opacity = 0.3 * (1 - cycle);
              wordRef.echoClones[0].style.transform = `scale(${c1Scale.toFixed(3)})`;
              wordRef.echoClones[0].style.opacity = c1Opacity.toFixed(2);
              wordRef.echoClones[1].style.transform = `scale(${c2Scale.toFixed(3)})`;
              wordRef.echoClones[1].style.opacity = c2Opacity.toFixed(2);
            } else {
              wordRef.echoClones[0].style.opacity = "0";
              wordRef.echoClones[1].style.opacity = "0";
            }
          }
          transform = extraTransform || "none";
          filter = extraFilter;
          opacity = isWordActive ? "1.0" : isWordPast ? "0.70" : "0.25";
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
    // ── Camera Choreography ────────────────────────────────────────────────────
    tickCamera(activeWord, activeLineRef, currentMs, dt) {
      if (!this.cameraEl || !this.lyricsContainerEl) return;
      if (this.currentStyle === "drift" && activeWord && activeLineRef) {
        const wordLeft = activeWord.cachedOffsetLeft ?? activeWord.el.offsetLeft;
        const wordWidth = activeWord.cachedWidth ?? activeWord.el.offsetWidth;
        const wordProg = Math.max(0, Math.min(1, (currentMs - activeWord.word.startMs) / Math.max(1, activeWord.word.durationMs)));
        const wordCenterX = wordLeft + wordWidth * wordProg;
        const targetCamX = -wordCenterX;
        this.cameraSpring.setTarget(targetCamX, 0);
        const camPos = this.cameraSpring.step(dt);
        activeLineRef.el.style.transform = `translateX(${camPos.x.toFixed(1)}px) translateZ(35px) rotateY(-5deg) scale(1.03)`;
      } else if (this.currentStyle !== "drift") {
        this.cameraSpring.reset(0, 0);
        this.cameraEl.style.transform = "translate3d(0, 0, 0)";
      }
    }
    // ── Rim Breathing ──────────────────────────────────────────────────────────
    tickRim(anyVocalActive, dt) {
      if (!this.ambientRimEl || !this.rimEnabled) return;
      const targetOpacity = anyVocalActive ? 0.9 : 0.45;
      this.rimOpacitySpring.setTarget(targetOpacity);
      const curOpacity = this.rimOpacitySpring.step(dt);
      this.ambientRimEl.style.opacity = curOpacity.toFixed(3);
      const targetRadius = anyVocalActive ? 180 : 110;
      this.rimRadiusSpring.setTarget(targetRadius);
      const curRadius = this.rimRadiusSpring.step(dt);
      this.ambientRimEl.style.setProperty("--ve-rim-size", `${curRadius.toFixed(0)}px`);
    }
  };

  // src/engine/WebGLPostProcess.ts
  var VERT_SRC = `#version 300 es
precision highp float;

in vec2 a_position;
out vec2 v_uv;

void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;
  var FRAG_SRC = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform float u_time;             // Monotonic accumulated phase from CPU
uniform float u_vocalIntensity;
uniform vec2  u_resolution;
uniform vec3  u_color1;           // Album primary (vibrant)
uniform vec3  u_color2;           // Album secondary (contrasting tone)
uniform vec3  u_color3;           // Highlight accent
uniform vec3  u_color4;           // Deep base atmospheric tone

// Fine 35mm film grain dither to eliminate color banding
float dither(vec2 uv) {
  return fract(sin(dot(uv, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec2 uv = v_uv;
  // Center-normalized coordinates [-1, 1], aspect-ratio corrected
  vec2 p = (gl_FragCoord.xy * 2.0 - u_resolution) / min(u_resolution.x, u_resolution.y);

  float t = u_time;

  // 4 large, soft, luminous color orbs orbiting on smooth Lissajous curves
  vec2 c1 = vec2(sin(t * 0.70) * 0.55, cos(t * 0.50) * 0.45);
  vec2 c2 = vec2(cos(t * 0.60 + 1.8) * 0.65, sin(t * 0.80 + 0.5) * 0.50);
  vec2 c3 = vec2(sin(t * 0.45 + 3.2) * 0.50, cos(t * 0.70 + 2.1) * 0.60);
  vec2 c4 = vec2(cos(t * 0.55 + 4.5) * 0.60, sin(t * 0.65 + 3.8) * 0.45);

  // Gentle wave distortion (very low frequency: wavelength is screen-sized)
  vec2 pWarp = p + vec2(
    sin(p.y * 1.2 + t * 0.5) * 0.10,
    cos(p.x * 1.2 + t * 0.4) * 0.10
  );

  // Soft Gaussian falloffs (massive radii: sigma ~ 0.8 to 1.2)
  float d1 = length(pWarp - c1);
  float d2 = length(pWarp - c2);
  float d3 = length(pWarp - c3);
  float d4 = length(pWarp - c4);

  float w1 = exp(-d1 * d1 * 1.1);
  float w2 = exp(-d2 * d2 * 1.2);
  float w3 = exp(-d3 * d3 * 1.4);
  float w4 = exp(-d4 * d4 * 1.0);

  // Deep atmospheric base from album palette
  vec3 base = u_color4;

  // Add warm, soft, out-of-focus luminous pools of color
  vec3 col = base;
  col += u_color1 * (w1 * 0.52 + u_vocalIntensity * 0.14);
  col += u_color2 * (w2 * 0.42);
  col += u_color3 * (w3 * 0.22);
  col += u_color1 * (w4 * 0.34);

  // Natural vignette to draw focus to center lyrics
  vec2 center = uv - 0.5;
  float vig = clamp(1.0 - dot(center, center) * 1.15, 0.0, 1.0);
  col *= (0.75 + 0.25 * vig);

  // Native resolution 35mm film grain dither
  col += (dither(gl_FragCoord.xy) - 0.5) * 0.018;

  fragColor = vec4(col, 1.0);
}`;
  var WebGLPostProcess = class {
    canvas = null;
    gl = null;
    program = null;
    vao = null;
    rafId = null;
    lastTime = performance.now();
    phase = 0;
    // Monotonic accumulated phase
    // Uniform locations
    u_time = null;
    u_vocalIntensity = null;
    u_resolution = null;
    u_color1 = null;
    u_color2 = null;
    u_color3 = null;
    u_color4 = null;
    vocalIntensity = 0;
    targetVocalIntensity = 0;
    supported = false;
    currentPalette = null;
    // Cached color vectors [r, g, b] in 0..1
    c1 = [0.35, 0.08, 0.12];
    c2 = [0.65, 0.15, 0.22];
    c3 = [0.95, 0.35, 0.42];
    c4 = [0.06, 0.04, 0.05];
    mount(containerEl) {
      this.canvas = document.createElement("canvas");
      this.canvas.id = "ve-bg-canvas";
      this.canvas.style.cssText = `
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 1;
      opacity: 0.95;
      transition: opacity 0.4s ease;
    `;
      if (containerEl.firstChild) {
        containerEl.insertBefore(this.canvas, containerEl.firstChild);
      } else {
        containerEl.appendChild(this.canvas);
      }
      try {
        this.gl = this.canvas.getContext("webgl2", {
          alpha: false,
          depth: false,
          stencil: false,
          antialias: false,
          powerPreference: "high-performance"
        });
        if (!this.gl) {
          console.warn("[VerseEngine] WebGL2 not available, falling back to CSS.");
          return false;
        }
        this.canvas.addEventListener("webglcontextlost", (e) => {
          e.preventDefault();
          this.stop();
          console.warn("[VerseEngine] WebGL context lost.");
        });
        this.canvas.addEventListener("webglcontextrestored", () => {
          console.log("[VerseEngine] WebGL context restored.");
          this.initShaders();
          this.start();
        });
        this.initShaders();
        this.resize();
        window.addEventListener("resize", this.onResize);
        this.supported = true;
        return true;
      } catch (err) {
        console.warn("[VerseEngine] WebGL init failed:", err);
        return false;
      }
    }
    unmount() {
      this.stop();
      window.removeEventListener("resize", this.onResize);
      if (this.gl && this.program) {
        this.gl.deleteProgram(this.program);
      }
      if (this.canvas?.parentElement) {
        this.canvas.parentElement.removeChild(this.canvas);
      }
      this.canvas = null;
      this.gl = null;
      this.program = null;
    }
    onResize = () => {
      this.resize();
    };
    resize() {
      if (!this.canvas || !this.gl) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.floor(window.innerWidth * dpr);
      const h = Math.floor(window.innerHeight * dpr);
      if (this.canvas.width !== w || this.canvas.height !== h) {
        this.canvas.width = w;
        this.canvas.height = h;
        this.gl.viewport(0, 0, w, h);
      }
    }
    initShaders() {
      const gl = this.gl;
      const vertShader = this.compileShader(gl.VERTEX_SHADER, VERT_SRC);
      const fragShader = this.compileShader(gl.FRAGMENT_SHADER, FRAG_SRC);
      const prog = gl.createProgram();
      gl.attachShader(prog, vertShader);
      gl.attachShader(prog, fragShader);
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        throw new Error(`Shader program link failed: ${gl.getProgramInfoLog(prog)}`);
      }
      this.program = prog;
      this.u_time = gl.getUniformLocation(prog, "u_time");
      this.u_vocalIntensity = gl.getUniformLocation(prog, "u_vocalIntensity");
      this.u_resolution = gl.getUniformLocation(prog, "u_resolution");
      this.u_color1 = gl.getUniformLocation(prog, "u_color1");
      this.u_color2 = gl.getUniformLocation(prog, "u_color2");
      this.u_color3 = gl.getUniformLocation(prog, "u_color3");
      this.u_color4 = gl.getUniformLocation(prog, "u_color4");
      const quadVertices = new Float32Array([
        -1,
        -1,
        1,
        -1,
        -1,
        1,
        -1,
        1,
        1,
        -1,
        1,
        1
      ]);
      this.vao = gl.createVertexArray();
      gl.bindVertexArray(this.vao);
      const vbo = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      gl.bufferData(gl.ARRAY_BUFFER, quadVertices, gl.STATIC_DRAW);
      const aPos = gl.getAttribLocation(prog, "a_position");
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
      gl.bindVertexArray(null);
    }
    compileShader(type, src) {
      const gl = this.gl;
      const shader = gl.createShader(type);
      gl.shaderSource(shader, src);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const err = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error(`Shader compilation error: ${err}`);
      }
      return shader;
    }
    setPalette(palette) {
      this.currentPalette = palette;
      if (this.canvas) {
        this.canvas.style.opacity = palette.isDark ? "0.95" : "0.0";
      }
      const parseRgb = (c) => {
        const rgb = c.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
        if (rgb) {
          return [parseInt(rgb[1], 10) / 255, parseInt(rgb[2], 10) / 255, parseInt(rgb[3], 10) / 255];
        }
        const hex = c.match(/^#([0-9a-fA-F]{3,8})$/);
        if (hex) {
          let h = hex[1];
          if (h.length === 3) h = h.split("").map((x) => x + x).join("");
          return [
            parseInt(h.substring(0, 2), 16) / 255,
            parseInt(h.substring(2, 4), 16) / 255,
            parseInt(h.substring(4, 6), 16) / 255
          ];
        }
        return [0.2, 0.05, 0.08];
      };
      this.c1 = parseRgb(palette.primary);
      this.c2 = parseRgb(palette.secondary);
      this.c3 = parseRgb(palette.highlight);
      this.c4 = parseRgb(palette.bg);
    }
    updateVocalIntensity(intensity) {
      this.targetVocalIntensity = Math.max(0, Math.min(1, intensity));
    }
    start() {
      if (!this.supported || this.rafId !== null) return;
      this.lastTime = performance.now();
      const render = (now) => {
        if (!this.gl || !this.program || !this.canvas) return;
        const rawDt = (now - this.lastTime) / 1e3;
        const dt = Math.max(1e-3, Math.min(rawDt, 0.05));
        this.lastTime = now;
        if (this.currentPalette && !this.currentPalette.isDark) {
          this.rafId = requestAnimationFrame(render);
          return;
        }
        this.vocalIntensity += (this.targetVocalIntensity - this.vocalIntensity) * 0.08;
        this.phase += dt * (0.12 + this.vocalIntensity * 0.06);
        const gl = this.gl;
        gl.useProgram(this.program);
        gl.uniform1f(this.u_time, this.phase);
        gl.uniform1f(this.u_vocalIntensity, this.vocalIntensity);
        gl.uniform2f(this.u_resolution, this.canvas.width, this.canvas.height);
        gl.uniform3f(this.u_color1, this.c1[0], this.c1[1], this.c1[2]);
        gl.uniform3f(this.u_color2, this.c2[0], this.c2[1], this.c2[2]);
        gl.uniform3f(this.u_color3, this.c3[0], this.c3[1], this.c3[2]);
        gl.uniform3f(this.u_color4, this.c4[0], this.c4[1], this.c4[2]);
        gl.bindVertexArray(this.vao);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        gl.bindVertexArray(null);
        this.rafId = requestAnimationFrame(render);
      };
      this.rafId = requestAnimationFrame(render);
    }
    stop() {
      if (this.rafId !== null) {
        cancelAnimationFrame(this.rafId);
        this.rafId = null;
      }
    }
  };

  // src/ui/StageView.ts
  var StageView = class {
    rootEl = null;
    rimPrimaryEl = null;
    cameraEl = null;
    lyricsContainerEl = null;
    controlPillEl = null;
    hideTimeout = null;
    clock = Clock.getInstance();
    callbacks;
    currentStyle = "convex";
    currentPaletteType = "album";
    rimEnabled = true;
    syncOffsetDisplayEl = null;
    cachedLines = [];
    constructor(callbacks) {
      this.callbacks = callbacks;
      this.loadSavedPreferences();
      this.injectGoogleFonts();
    }
    loadSavedPreferences() {
      try {
        const savedStyle = localStorage.getItem("verse_engine_style");
        if (savedStyle && ["convex", "drift", "editorial", "semantic"].includes(savedStyle)) {
          this.currentStyle = savedStyle;
        }
        const savedPalette = localStorage.getItem("verse_engine_palette");
        if (savedPalette && ["album", "editorial", "obsidian"].includes(savedPalette)) {
          this.currentPaletteType = savedPalette;
        }
        const savedRim = localStorage.getItem("verse_engine_rim");
        if (savedRim !== null) {
          this.rimEnabled = savedRim === "true";
        }
      } catch {
      }
    }
    getSavedStyle() {
      return this.currentStyle;
    }
    getSavedPaletteType() {
      return this.currentPaletteType;
    }
    getSavedRimEnabled() {
      return this.rimEnabled;
    }
    injectGoogleFonts() {
      const id = "verse-engine-fonts";
      if (!document.getElementById(id)) {
        const link = document.createElement("link");
        link.id = id;
        link.rel = "stylesheet";
        link.href = "https://fonts.googleapis.com/css2?family=Instrument+Serif:ital,wght@0,400;1,400&family=Plus+Jakarta+Sans:wght@600;700;800&family=Syne:wght@700;800&display=swap";
        document.head.appendChild(link);
      }
    }
    mount() {
      let root = document.getElementById("verse-engine-stage");
      if (!root) {
        root = document.createElement("div");
        root.id = "verse-engine-stage";
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

        /* \u2500\u2500 1. CONVEX / FISHEYE MODE \u2500\u2500 */
        .ve-style-convex .ve-line {
          margin: 2.2rem 0 !important;
        }
        .ve-style-convex .ve-word {
          font-size: clamp(2.4rem, 4.0vw, 4.4rem);
          font-weight: 700;
        }

        /* \u2500\u2500 2. DRIFT / SHIP MARQUEE MODE (Continuous un-wrapped kinetic ribbon) \u2500\u2500 */
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

        /* \u2500\u2500 3. EDITORIAL MODE (Swiss Haute-Couture Typographic Press) \u2500\u2500 */
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

        /* \u2500\u2500 4. SEMANTIC LIVING PHYSICS MODE \u2500\u2500 */
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
      this.rimPrimaryEl = document.getElementById("ve-ambient-rim");
      this.cameraEl = document.getElementById("ve-camera");
      this.lyricsContainerEl = document.getElementById("ve-lyrics-container");
      this.controlPillEl = document.getElementById("ve-control-pill");
      this.renderControlPill();
      this.bindActivityListeners();
      this.applyStyleClass(this.currentStyle);
      return {
        rootEl: this.rootEl,
        cameraEl: this.cameraEl,
        ambientRimEl: this.rimPrimaryEl,
        lyricsContainerEl: this.lyricsContainerEl
      };
    }
    applyStyleClass(style) {
      if (!this.lyricsContainerEl) return;
      this.lyricsContainerEl.className = `ve-lyrics-container ve-style-${style}`;
    }
    applyPalette(palette) {
      if (!this.rootEl) return;
      this.rootEl.style.setProperty("--ve-bg", palette.bg);
      this.rootEl.style.setProperty("--ve-primary", palette.primary);
      this.rootEl.style.setProperty("--ve-secondary", palette.secondary);
      this.rootEl.style.setProperty("--ve-highlight", palette.highlight);
      this.rootEl.style.setProperty("--ve-text-inactive", palette.textInactive);
      const rimPrimary = this._deriveRimColor(palette.primary, 0.65);
      const rimSecondary = this._deriveRimColor(palette.secondary, 0.35);
      this.rootEl.style.setProperty("--ve-rim-primary", rimPrimary);
      this.rootEl.style.setProperty("--ve-rim-secondary", rimSecondary);
    }
    _deriveRimColor(colorStr, alpha) {
      const rgbaMatch = colorStr.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
      if (rgbaMatch) {
        return `rgba(${rgbaMatch[1]}, ${rgbaMatch[2]}, ${rgbaMatch[3]}, ${alpha})`;
      }
      const hexMatch = colorStr.match(/^#([0-9a-fA-F]{3,8})$/);
      if (hexMatch) {
        let hex = hexMatch[1];
        if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
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
    renderLyrics(track) {
      if (!this.lyricsContainerEl) return [];
      this.lyricsContainerEl.innerHTML = "";
      const cachedLines = [];
      track.lines.forEach((line) => {
        const lineEl = document.createElement("div");
        lineEl.className = "ve-line";
        lineEl.id = line.id;
        lineEl.addEventListener("click", (e) => {
          e.stopPropagation();
          if (typeof Spicetify !== "undefined" && Spicetify.Player) {
            Spicetify.Player.seek(line.startMs);
          }
        });
        const cachedWords = [];
        line.words.forEach((word, wIdx) => {
          const wordEl = document.createElement("span");
          wordEl.className = "ve-word";
          wordEl.id = word.id;
          if (word.semanticEffect !== "NONE") {
            wordEl.classList.add("ve-word-key");
          }
          if (word.isAdLib) {
            wordEl.classList.add("ve-word-adlib");
          }
          let shearTopEl;
          let shearBottomEl;
          if (word.semanticEffect === "FRACTURE") {
            wordEl.innerHTML = `<span class="ve-fracture-top">${word.text}</span><span class="ve-fracture-bottom">${word.text}</span>`;
            shearTopEl = wordEl.querySelector(".ve-fracture-top");
            shearBottomEl = wordEl.querySelector(".ve-fracture-bottom");
          } else {
            wordEl.textContent = word.text;
          }
          const echoClones = [];
          if (word.semanticEffect === "ECHO") {
            for (let ci = 1; ci <= 2; ci++) {
              const clone = document.createElement("span");
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
            springScale: new HarmonicSpring(1, 150, 24),
            springProgress: new HarmonicSpring(0, 200, 22),
            springGravityY: new HarmonicSpring(0, 160, 20),
            shearTopEl,
            shearBottomEl,
            echoClones
          });
          lineEl.appendChild(wordEl);
        });
        this.lyricsContainerEl.appendChild(lineEl);
        cachedLines.push({
          el: lineEl,
          line,
          words: cachedWords
        });
      });
      this.cachedLines = cachedLines;
      return cachedLines;
    }
    getCachedLines() {
      return this.cachedLines;
    }
    renderControlPill() {
      if (!this.controlPillEl) return;
      this.controlPillEl.innerHTML = `
      <!-- STYLES -->
      <div style="display: flex; gap: 3px;">
        <button class="ve-pill-btn ${this.currentStyle === "convex" ? "active" : ""}" data-style="convex">Convex</button>
        <button class="ve-pill-btn ${this.currentStyle === "drift" ? "active" : ""}" data-style="drift">Drift</button>
        <button class="ve-pill-btn ${this.currentStyle === "editorial" ? "active" : ""}" data-style="editorial">Editorial</button>
        <button class="ve-pill-btn ${this.currentStyle === "semantic" ? "active" : ""}" data-style="semantic">Semantic</button>
      </div>

      <div class="ve-pill-divider"></div>

      <!-- PALETTES -->
      <div style="display: flex; gap: 3px;">
        <button class="ve-pill-btn ${this.currentPaletteType === "album" ? "active" : ""}" data-palette="album">Album Sync</button>
        <button class="ve-pill-btn ${this.currentPaletteType === "editorial" ? "active" : ""}" data-palette="editorial">Maroon &amp; Bone</button>
        <button class="ve-pill-btn ${this.currentPaletteType === "obsidian" ? "active" : ""}" data-palette="obsidian">Obsidian</button>
      </div>

      <div class="ve-pill-divider"></div>

      <!-- RIM TOGGLE -->
      <button class="ve-pill-btn ${this.rimEnabled ? "active" : ""}" id="ve-rim-btn">Rim ${this.rimEnabled ? "On" : "Off"}</button>

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
      this.syncOffsetDisplayEl = document.getElementById("ve-sync-display");
      this.updateSyncDisplay();
      this.bindPillEvents();
    }
    bindPillEvents() {
      if (!this.controlPillEl) return;
      this.controlPillEl.querySelectorAll("[data-style]").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const style = btn.getAttribute("data-style");
          if (style && style !== this.currentStyle) {
            this.currentStyle = style;
            try {
              localStorage.setItem("verse_engine_style", style);
            } catch {
            }
            this.applyStyleClass(style);
            this.callbacks.onStyleChange(style);
            this.renderControlPill();
          }
        });
      });
      this.controlPillEl.querySelectorAll("[data-palette]").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const palette = btn.getAttribute("data-palette");
          if (palette) {
            this.currentPaletteType = palette;
            try {
              localStorage.setItem("verse_engine_palette", palette);
            } catch {
            }
            this.callbacks.onPaletteChange(palette);
            this.renderControlPill();
          }
        });
      });
      document.getElementById("ve-rim-btn")?.addEventListener("click", (e) => {
        e.stopPropagation();
        this.rimEnabled = !this.rimEnabled;
        try {
          localStorage.setItem("verse_engine_rim", this.rimEnabled ? "true" : "false");
        } catch {
        }
        this.callbacks.onRimToggle(this.rimEnabled);
        this.renderControlPill();
      });
      document.getElementById("ve-sync-down")?.addEventListener("click", (e) => {
        e.stopPropagation();
        this.clock.adjustSyncOffset(-50);
        this.updateSyncDisplay();
      });
      document.getElementById("ve-sync-up")?.addEventListener("click", (e) => {
        e.stopPropagation();
        this.clock.adjustSyncOffset(50);
        this.updateSyncDisplay();
      });
      document.getElementById("ve-close-btn")?.addEventListener("click", (e) => {
        e.stopPropagation();
        this.callbacks.onClose();
      });
    }
    updateSyncDisplay() {
      if (this.syncOffsetDisplayEl) {
        const offset = this.clock.getSyncOffset();
        this.syncOffsetDisplayEl.textContent = `${offset >= 0 ? "+" : ""}${offset}ms`;
      }
    }
    bindActivityListeners() {
      if (!this.rootEl) return;
      const resetIdleTimer = () => {
        if (!this.rootEl || !this.controlPillEl) return;
        this.rootEl.style.cursor = "default";
        this.controlPillEl.style.opacity = "1";
        this.controlPillEl.style.transform = "translateX(-50%) translateY(0)";
        this.controlPillEl.style.pointerEvents = "auto";
        if (this.hideTimeout !== null) {
          window.clearTimeout(this.hideTimeout);
        }
        this.hideTimeout = window.setTimeout(() => {
          if (!this.rootEl || !this.controlPillEl) return;
          this.rootEl.style.cursor = "none";
          this.controlPillEl.style.opacity = "0";
          this.controlPillEl.style.transform = "translateX(-50%) translateY(16px)";
          this.controlPillEl.style.pointerEvents = "none";
        }, 2e3);
      };
      window.addEventListener("mousemove", resetIdleTimer);
      window.addEventListener("keydown", resetIdleTimer);
      resetIdleTimer();
    }
    unmount() {
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
  };

  // src/app.ts
  var VERSE_ICON_SVG = `
<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
  <rect x="2"  y="6"  width="2" height="7" rx="0.5"/>
  <rect x="5"  y="4"  width="2" height="9" rx="0.5"/>
  <rect x="8"  y="2"  width="2" height="11" rx="0.5"/>
  <rect x="11" y="4.5" width="2" height="8.5" rx="0.5"/>
</svg>`;
  var VerseEngineApp = class _VerseEngineApp {
    static instance = null;
    isOpen = false;
    playbarButton = null;
    topbarButton = null;
    stageView = null;
    animationEngine;
    webgl;
    lyricProvider;
    clock;
    currentTrack = null;
    currentStyle = "convex";
    currentPaletteType = "album";
    currentPalette = null;
    rimEnabled = true;
    boundKeyDownListener = null;
    constructor() {
      this.animationEngine = new AnimationEngine();
      this.webgl = new WebGLPostProcess();
      this.lyricProvider = LyricProvider.getInstance();
      this.clock = Clock.getInstance();
      this.bindKeyboardShortcuts();
      this.boot();
    }
    static init() {
      if (!_VerseEngineApp.instance) {
        _VerseEngineApp.instance = new _VerseEngineApp();
      }
      return _VerseEngineApp.instance;
    }
    // ── Boot sequence ──────────────────────────────────────────────────────────
    async boot() {
      console.log("[VerseEngine] v2.0.0 \u2014 144Hz kinetic typography engine booting\u2026");
      await this.waitForSpicetify();
      this.injectButtons();
      this.bindTrackChangeListener();
      this.loadCurrentTrack();
      try {
        Spicetify.showNotification?.("VerseEngine Ready (Press Alt+L)");
      } catch {
      }
    }
    waitForSpicetify() {
      return new Promise((resolve) => {
        let attempts = 0;
        const check = () => {
          attempts++;
          if (typeof Spicetify !== "undefined" && Spicetify.Player && Spicetify.Player.origin?._state) {
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
    injectButtons() {
      let retries = 0;
      const tryInject = () => {
        if (typeof Spicetify === "undefined") {
          if (++retries < 15) setTimeout(tryInject, 400);
          return;
        }
        if (!this.playbarButton && Spicetify.Playbar?.Button) {
          try {
            this.playbarButton = new Spicetify.Playbar.Button(
              "VerseEngine Kinetic Lyrics",
              VERSE_ICON_SVG,
              () => this.toggleStage(),
              false,
              false
            );
            this.playbarButton.register();
            console.log("[VerseEngine] Playbar button registered.");
          } catch (err) {
            console.warn("[VerseEngine] Playbar button error:", err);
          }
        }
        if (!this.topbarButton && Spicetify.Topbar?.Button) {
          try {
            this.topbarButton = new Spicetify.Topbar.Button(
              "VerseEngine Kinetic Lyrics (Alt+L)",
              VERSE_ICON_SVG,
              () => this.toggleStage(),
              false,
              true
            );
            console.log("[VerseEngine] Topbar button registered.");
          } catch (err) {
            console.warn("[VerseEngine] Topbar button error:", err);
          }
        }
        if (!this.playbarButton && ++retries < 15) {
          setTimeout(tryInject, 600);
        }
      };
      tryInject();
    }
    // ── Keyboard Shortcuts ─────────────────────────────────────────────────────
    bindKeyboardShortcuts() {
      if (this.boundKeyDownListener) {
        window.removeEventListener("keydown", this.boundKeyDownListener);
      }
      this.boundKeyDownListener = (e) => {
        if (e.key === "Escape" && this.isOpen) {
          e.preventDefault();
          this.closeStage();
        } else if (e.altKey && (e.key === "l" || e.key === "L") || e.key === "F9") {
          e.preventDefault();
          this.toggleStage();
        } else if (e.code === "Space" && this.isOpen) {
          const tag = e.target?.tagName?.toLowerCase();
          if (tag !== "input" && tag !== "textarea") {
            e.preventDefault();
            if (typeof Spicetify !== "undefined" && Spicetify.Player) {
              if (typeof Spicetify.Player.togglePlay === "function") {
                Spicetify.Player.togglePlay();
              } else if (Spicetify.Player.isPlaying()) {
                Spicetify.Player.pause?.();
              } else {
                Spicetify.Player.play?.();
              }
            }
          }
        }
      };
      window.addEventListener("keydown", this.boundKeyDownListener);
    }
    // ── Track Change ───────────────────────────────────────────────────────────
    bindTrackChangeListener() {
      if (typeof Spicetify === "undefined" || !Spicetify.Player) return;
      Spicetify.Player.addEventListener("songchange", () => {
        this.loadCurrentTrack();
      });
    }
    async loadCurrentTrack() {
      if (typeof Spicetify === "undefined" || !Spicetify.Player?.data?.item) return;
      const trackItem = Spicetify.Player.data.item;
      if (!trackItem?.uri) return;
      this.clock.setTrackUri(trackItem.uri);
      try {
        const albumArtUrl = trackItem.album?.images?.[0]?.url ?? "";
        const [processedTrack, palette] = await Promise.all([
          this.lyricProvider.getTrackLyrics(trackItem),
          AmbientLight.getPalette(this.currentPaletteType, albumArtUrl)
        ]);
        this.currentTrack = processedTrack;
        this.currentPalette = palette;
        if (this.isOpen && this.stageView) {
          this.applyTrackToStage(this.stageView, processedTrack, palette);
        }
      } catch (err) {
        console.error("[VerseEngine] Track load error:", err);
      }
    }
    // ── Open / Close / Toggle ──────────────────────────────────────────────────
    async toggleStage() {
      if (this.isOpen) {
        this.closeStage();
      } else {
        await this.openStage();
      }
    }
    async openStage() {
      if (this.isOpen) return;
      this.isOpen = true;
      if (this.playbarButton) this.playbarButton.active = true;
      this.stageView = new StageView({
        onStyleChange: (style) => {
          this.currentStyle = style;
          this.animationEngine.setStyle(style);
        },
        onPaletteChange: async (paletteType) => {
          this.currentPaletteType = paletteType;
          const albumArt = Spicetify?.Player?.data?.item?.album?.images?.[0]?.url ?? "";
          const pal = await AmbientLight.getPalette(paletteType, albumArt);
          this.currentPalette = pal;
          this.stageView?.applyPalette(pal);
          this.animationEngine.setPalette(pal);
          this.webgl.setPalette(pal);
        },
        onRimToggle: (enabled) => {
          this.rimEnabled = enabled;
          this.animationEngine.setRimEnabled(enabled);
        },
        onClose: () => this.closeStage()
      });
      this.currentStyle = this.stageView.getSavedStyle();
      this.currentPaletteType = this.stageView.getSavedPaletteType();
      this.rimEnabled = this.stageView.getSavedRimEnabled();
      const { rootEl, cameraEl, ambientRimEl, lyricsContainerEl } = this.stageView.mount();
      this.webgl.mount(rootEl);
      this.animationEngine.bindWebgl(this.webgl);
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
    closeStage() {
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
    applyTrackToStage(stageView, track, palette) {
      stageView.applyPalette(palette);
      stageView.renderLyrics(track);
      this.animationEngine.setPalette(palette);
      this.webgl.setPalette(palette);
      const stageEl = document.getElementById("verse-engine-stage");
      const camEl = document.getElementById("ve-camera");
      const rimEl = document.getElementById("ve-ambient-rim");
      const contEl = document.getElementById("ve-lyrics-container");
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
  };
  if (typeof window !== "undefined") {
    window.VerseEngine = VerseEngineApp.init();
  }
  var app_default = VerseEngineApp;
  return __toCommonJS(app_exports);
})();
