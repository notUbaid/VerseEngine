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
  function srgbToLinear(c) {
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }
  function linearToSrgb(c) {
    const clamped = Math.max(0, Math.min(1, c));
    return clamped <= 31308e-7 ? clamped * 12.92 : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
  }
  function rgbToOklch(r, g, b) {
    const lr = srgbToLinear(r);
    const lg = srgbToLinear(g);
    const lb = srgbToLinear(b);
    const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
    const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
    const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;
    const l_ = Math.cbrt(l);
    const m_ = Math.cbrt(m);
    const s_ = Math.cbrt(s);
    const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
    const a = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
    const b_ = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;
    const C = Math.sqrt(a * a + b_ * b_);
    let h = Math.atan2(b_, a) * 180 / Math.PI;
    if (h < 0) h += 360;
    return { l: L, c: C, h };
  }
  function oklchToRgb(l, c, h) {
    const hRad = h * Math.PI / 180;
    const a = c * Math.cos(hRad);
    const b_ = c * Math.sin(hRad);
    const l_ = l + 0.3963377774 * a + 0.2158037573 * b_;
    const m_ = l - 0.1055613458 * a - 0.0638541728 * b_;
    const s_ = l - 0.0894841775 * a - 1.291485548 * b_;
    const lCube = l_ * l_ * l_;
    const mCube = m_ * m_ * m_;
    const sCube = s_ * s_ * s_;
    const lr = 4.0767416621 * lCube - 3.3077115913 * mCube + 0.2309699292 * sCube;
    const lg = -1.2684380046 * lCube + 2.6097574011 * mCube - 0.3413193965 * sCube;
    const lb = -0.0041960863 * lCube - 0.7034186147 * mCube + 1.707614701 * sCube;
    return {
      r: Math.max(0, Math.min(1, linearToSrgb(lr))),
      g: Math.max(0, Math.min(1, linearToSrgb(lg))),
      b: Math.max(0, Math.min(1, linearToSrgb(lb)))
    };
  }
  function rgbToString(rgb, alpha = 1) {
    const r = Math.round(rgb.r * 255);
    const g = Math.round(rgb.g * 255);
    const b = Math.round(rgb.b * 255);
    return alpha < 1 ? `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(2)})` : `rgb(${r}, ${g}, ${b})`;
  }
  var AmbientLight = class _AmbientLight {
    static cachedPalettes = /* @__PURE__ */ new Map();
    static getEditorialPalette() {
      const dominantRGB = { r: 0.36, g: 0.08, b: 0.13 };
      const accentRGB = { r: 0.55, g: 0.11, b: 0.18 };
      const shadowRGB = { r: 0.98, g: 0.98, b: 0.96 };
      const highlightRGB = { r: 0.1, g: 0.02, b: 0.04 };
      const tintRGB = { r: 0.12, g: 0.03, b: 0.05 };
      return {
        type: "editorial",
        primary: rgbToString(dominantRGB),
        secondary: rgbToString(accentRGB),
        highlight: rgbToString(highlightRGB),
        bg: "#FAF9F6",
        textInactive: "rgba(92, 20, 33, 0.30)",
        isDark: false,
        dominant: rgbToString(dominantRGB),
        accent: rgbToString(accentRGB),
        shadow: rgbToString(shadowRGB),
        tint: rgbToString(tintRGB),
        rgbDominant: [dominantRGB.r, dominantRGB.g, dominantRGB.b],
        rgbAccent: [accentRGB.r, accentRGB.g, accentRGB.b],
        rgbShadow: [shadowRGB.r, shadowRGB.g, shadowRGB.b],
        rgbHighlight: [highlightRGB.r, highlightRGB.g, highlightRGB.b],
        rgbBg: [shadowRGB.r, shadowRGB.g, shadowRGB.b]
      };
    }
    static getObsidianPalette() {
      const dominantRGB = { r: 0.55, g: 0.11, b: 0.18 };
      const accentRGB = { r: 0.88, g: 0.24, b: 0.32 };
      const shadowRGB = { r: 0.04, g: 0.03, b: 0.03 };
      const highlightRGB = { r: 0.98, g: 0.98, b: 0.96 };
      const tintRGB = { r: 0.98, g: 0.98, b: 0.96 };
      return {
        type: "obsidian",
        primary: rgbToString(dominantRGB),
        secondary: rgbToString(accentRGB),
        highlight: rgbToString(highlightRGB),
        bg: "#0A0808",
        textInactive: "rgba(250, 249, 246, 0.28)",
        isDark: true,
        dominant: rgbToString(dominantRGB),
        accent: rgbToString(accentRGB),
        shadow: rgbToString(shadowRGB),
        tint: rgbToString(tintRGB),
        rgbDominant: [dominantRGB.r, dominantRGB.g, dominantRGB.b],
        rgbAccent: [accentRGB.r, accentRGB.g, accentRGB.b],
        rgbShadow: [shadowRGB.r, shadowRGB.g, shadowRGB.b],
        rgbHighlight: [highlightRGB.r, highlightRGB.g, highlightRGB.b],
        rgbBg: [shadowRGB.r, shadowRGB.g, shadowRGB.b]
      };
    }
    static resolveImageUrl(url) {
      if (!url) return "";
      if (url.startsWith("spotify:image:")) {
        return `https://i.scdn.co/image/${url.replace("spotify:image:", "")}`;
      }
      return url;
    }
    /**
     * Extracts a 5-color film-grade OKLCH palette from album artwork
     */
    static async extractAlbumPalette(rawUrl) {
      const imageUrl = _AmbientLight.resolveImageUrl(rawUrl);
      if (!imageUrl) {
        return this.getObsidianPalette();
      }
      if (this.cachedPalettes.has(imageUrl)) {
        return this.cachedPalettes.get(imageUrl);
      }
      return new Promise((resolve) => {
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
                const oklch = rgbToOklch(r / 255, g / 255, b / 255);
                bucketMap.set(key, { r, g, b, count: 1, oklch });
              }
            }
            const buckets = Array.from(bucketMap.values());
            const candidateColors = buckets.filter(
              (b) => b.oklch.c > 0.04 && b.oklch.l > 0.12 && b.oklch.l < 0.88
            );
            if (candidateColors.length === 0) {
              resolve(this.getObsidianPalette());
              return;
            }
            candidateColors.sort((a, b) => {
              const scoreA = Math.pow(a.count, 0.55) * Math.pow(a.oklch.c, 1.4) * (1 - Math.abs(a.oklch.l - 0.52));
              const scoreB = Math.pow(b.count, 0.55) * Math.pow(b.oklch.c, 1.4) * (1 - Math.abs(b.oklch.l - 0.52));
              return scoreB - scoreA;
            });
            const primaryBucket = candidateColors[0];
            const dominantL = Math.max(0.38, Math.min(0.68, primaryBucket.oklch.l));
            const dominantC = Math.max(0.12, Math.min(0.28, primaryBucket.oklch.c * 1.35));
            const dominantRGB = oklchToRgb(dominantL, dominantC, primaryBucket.oklch.h);
            let accentBucket = candidateColors[Math.min(1, candidateColors.length - 1)];
            for (let i = 1; i < candidateColors.length; i++) {
              const b = candidateColors[i];
              const hueDiff = Math.abs(b.oklch.h - primaryBucket.oklch.h);
              const normalizedHueDiff = hueDiff > 180 ? 360 - hueDiff : hueDiff;
              if (normalizedHueDiff > 40 && b.oklch.c > 0.08) {
                accentBucket = b;
                break;
              }
            }
            const accentL = Math.max(0.48, Math.min(0.74, accentBucket.oklch.l * 1.1));
            const accentC = Math.max(0.16, Math.min(0.32, accentBucket.oklch.c * 1.5));
            const accentRGB = oklchToRgb(accentL, accentC, accentBucket.oklch.h);
            const shadowL = 0.07 + dominantL * 0.05;
            const shadowC = Math.min(0.04, dominantC * 0.22);
            const shadowRGB = oklchToRgb(shadowL, shadowC, primaryBucket.oklch.h);
            const highlightL = 0.94;
            const highlightC = Math.min(0.05, dominantC * 0.3);
            const highlightRGB = oklchToRgb(highlightL, highlightC, primaryBucket.oklch.h);
            const tintRGB = { r: 0.98, g: 0.98, b: 0.96 };
            const dominantStr = rgbToString(dominantRGB);
            const accentStr = rgbToString(accentRGB);
            const shadowStr = rgbToString(shadowRGB);
            const highlightStr = rgbToString(highlightRGB);
            const tintStr = rgbToString(tintRGB);
            const palette = {
              type: "album",
              primary: dominantStr,
              secondary: accentStr,
              highlight: highlightStr,
              bg: shadowStr,
              textInactive: "rgba(250, 249, 246, 0.32)",
              isDark: true,
              dominant: dominantStr,
              accent: accentStr,
              shadow: shadowStr,
              tint: tintStr,
              rgbDominant: [dominantRGB.r, dominantRGB.g, dominantRGB.b],
              rgbAccent: [accentRGB.r, accentRGB.g, accentRGB.b],
              rgbShadow: [shadowRGB.r, shadowRGB.g, shadowRGB.b],
              rgbHighlight: [highlightRGB.r, highlightRGB.g, highlightRGB.b],
              rgbBg: [shadowRGB.r, shadowRGB.g, shadowRGB.b]
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
  var PaletteCrossfader = class {
    currentPalette;
    targetPalette;
    progress = 1;
    // 0..1
    duration = 1.2;
    // 1.2s crossfade duration
    constructor(initialPalette) {
      this.currentPalette = initialPalette;
      this.targetPalette = initialPalette;
    }
    setTarget(newPalette) {
      if (this.progress < 1) {
        this.currentPalette = this.getCurrentBlended();
      }
      this.targetPalette = newPalette;
      this.progress = 0;
    }
    update(dt) {
      if (this.progress >= 1) {
        return this.targetPalette;
      }
      this.progress = Math.min(1, this.progress + dt / this.duration);
      const t = this.progress < 0.5 ? 4 * this.progress * this.progress * this.progress : 1 - Math.pow(-2 * this.progress + 2, 3) / 2;
      const lerpColor = (c1, c2) => [
        c1[0] + (c2[0] - c1[0]) * t,
        c1[1] + (c2[1] - c1[1]) * t,
        c1[2] + (c2[2] - c1[2]) * t
      ];
      const rgbDom = lerpColor(this.currentPalette.rgbDominant, this.targetPalette.rgbDominant);
      const rgbAcc = lerpColor(this.currentPalette.rgbAccent, this.targetPalette.rgbAccent);
      const rgbSha = lerpColor(this.currentPalette.rgbShadow, this.targetPalette.rgbShadow);
      const rgbHig = lerpColor(this.currentPalette.rgbHighlight, this.targetPalette.rgbHighlight);
      const rgbBg = lerpColor(this.currentPalette.rgbBg, this.targetPalette.rgbBg);
      const toStr = (rgb) => `rgb(${Math.round(rgb[0] * 255)}, ${Math.round(rgb[1] * 255)}, ${Math.round(rgb[2] * 255)})`;
      return {
        type: this.targetPalette.type,
        primary: toStr(rgbDom),
        secondary: toStr(rgbAcc),
        highlight: toStr(rgbHig),
        bg: toStr(rgbSha),
        textInactive: this.targetPalette.textInactive,
        isDark: this.targetPalette.isDark,
        dominant: toStr(rgbDom),
        accent: toStr(rgbAcc),
        shadow: toStr(rgbSha),
        tint: this.targetPalette.tint,
        rgbDominant: rgbDom,
        rgbAccent: rgbAcc,
        rgbShadow: rgbSha,
        rgbHighlight: rgbHig,
        rgbBg
      };
    }
    getCurrentBlended() {
      return this.update(0);
    }
    isComplete() {
      return this.progress >= 1;
    }
  };

  // src/engine/Clock.ts
  var Clock = class _Clock {
    static instance = null;
    // Slew timekeeper state
    renderMs = 0;
    lastPerfTime = performance.now();
    isPlaying = false;
    syncOffsetMs = 0;
    currentTrackUri = "";
    boundEvents = false;
    // Anticipation lookahead: visuals lead the audio by 150ms for crisp, film-like anticipation
    static LOOKAHEAD_MS = 150;
    // Beat & Energy analysis
    audioData = null;
    beats = [];
    bars = [];
    currentBeatIndex = 0;
    beatPulse = 0;
    isDownbeat = false;
    globalEnergy = 0.25;
    // Synthetic fallback pulse
    fallbackBpm = 120;
    lastSyntheticBeatMs = 0;
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
    async setTrackUri(uri) {
      if (this.currentTrackUri !== uri) {
        this.currentTrackUri = uri;
        this.audioData = null;
        this.beats = [];
        this.bars = [];
        this.currentBeatIndex = 0;
        this.beatPulse = 0;
        this.globalEnergy = 0.25;
        const polled = this.getSafeProgress();
        this.renderMs = polled + _Clock.LOOKAHEAD_MS;
        this.lastPerfTime = performance.now();
        await this.fetchAudioAnalysis();
      }
    }
    async fetchAudioAnalysis() {
      try {
        if (typeof Spicetify !== "undefined" && typeof Spicetify.getAudioData === "function") {
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
      }
      this.audioData = null;
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
        });
        Spicetify.Player.addEventListener("onplaypause", () => {
          this.isPlaying = this.getSafeIsPlaying();
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
    /**
     * Continuous Slew Tick: Advances renderMs in real time and slews towards audioMs
     * @param dt delta time in seconds
     * @returns adjusted playback renderMs for visual choreography
     */
    tick(dt) {
      const now = performance.now();
      this.isPlaying = this.getSafeIsPlaying();
      const rawAudioMs = this.getSafeProgress();
      const targetAudioMs = rawAudioMs + _Clock.LOOKAHEAD_MS + this.syncOffsetMs;
      const err = targetAudioMs - this.renderMs;
      if (Math.abs(err) > 150) {
        this.renderMs = targetAudioMs;
      } else {
        const forwardDelta = this.isPlaying ? dt * 1e3 : 0;
        const slewRate = Math.min(1, dt * 8);
        this.renderMs += forwardDelta + err * slewRate;
      }
      this.lastPerfTime = now;
      this.updateBeatsAndEnergy(this.renderMs - _Clock.LOOKAHEAD_MS, dt);
      return Math.max(0, this.renderMs);
    }
    /**
     * Calculate beat downbeats and global dynamic energy (0..1)
     */
    updateBeatsAndEnergy(audioMs, dt) {
      this.beatPulse = Math.max(0, this.beatPulse - dt * 4.5);
      this.isDownbeat = false;
      if (this.beats.length > 0) {
        const audioSec = audioMs / 1e3;
        while (this.currentBeatIndex < this.beats.length - 1 && this.beats[this.currentBeatIndex + 1].start <= audioSec) {
          this.currentBeatIndex++;
          this.beatPulse = 1;
          const beatStart = this.beats[this.currentBeatIndex].start;
          for (let b = 0; b < this.bars.length; b++) {
            if (Math.abs(this.bars[b].start - beatStart) < 0.04) {
              this.isDownbeat = true;
              break;
            }
          }
        }
        if (this.audioData?.sections) {
          for (const sec of this.audioData.sections) {
            if (audioSec >= sec.start && audioSec <= sec.start + sec.duration) {
              const normLoudness = Math.max(0, Math.min(1, (sec.loudness + 26) / 22));
              const targetEnergy = 0.2 + normLoudness * 0.65;
              this.globalEnergy += (targetEnergy - this.globalEnergy) * Math.min(1, dt * 2);
              return;
            }
          }
        }
      } else {
        const beatIntervalMs = 60 / this.fallbackBpm * 1e3;
        if (audioMs - this.lastSyntheticBeatMs >= beatIntervalMs) {
          this.lastSyntheticBeatMs = audioMs;
          this.beatPulse = 1;
          this.currentBeatIndex++;
          if (this.currentBeatIndex % 4 === 0) {
            this.isDownbeat = true;
          }
        }
      }
    }
    setVocalActivityEnergy(isActive, dt) {
      if (this.audioData) return;
      const target = isActive ? 0.75 : 0.22;
      this.globalEnergy += (target - this.globalEnergy) * Math.min(1, dt * 3);
    }
    getEnergy() {
      return Math.max(0.1, Math.min(1, this.globalEnergy));
    }
    getBeatPulse() {
      return this.beatPulse;
    }
    getIsDownbeat() {
      return this.isDownbeat;
    }
    getRenderMs() {
      return Math.max(0, this.renderMs);
    }
    getIsPlaying() {
      return this.isPlaying;
    }
  };

  // src/engine/SpringSolver.ts
  var SPRING_PRESETS = {
    // Ambient breathing, soft opacity/rim transitions
    soft: { stiffness: 75, damping: 16, mass: 1 },
    // Word reveals, active scale lift, liquid fill sweep
    snappy: { stiffness: 190, damping: 22, mass: 1 },
    // Line entrances, vertical stage tracking, gravity drop
    heavy: { stiffness: 120, damping: 24, mass: 1 },
    // Camera noise drift, background parallax, floating particles
    float: { stiffness: 40, damping: 11, mass: 1 }
  };
  var HarmonicSpring = class _HarmonicSpring {
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
    static fromPreset(preset, initialPosition = 0) {
      const cfg = SPRING_PRESETS[preset];
      return new _HarmonicSpring(initialPosition, cfg.stiffness, cfg.damping, cfg.mass);
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
  var SpringVector2 = class _SpringVector2 {
    x;
    y;
    constructor(initX = 0, initY = 0, stiffness = 120, damping = 22) {
      this.x = new HarmonicSpring(initX, stiffness, damping);
      this.y = new HarmonicSpring(initY, stiffness, damping);
    }
    static fromPreset(preset, initX = 0, initY = 0) {
      const cfg = SPRING_PRESETS[preset];
      return new _SpringVector2(initX, initY, cfg.stiffness, cfg.damping);
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
    isSettled() {
      return this.x.isSettled() && this.y.isSettled();
    }
  };
  var FixedStepAccumulator = class _FixedStepAccumulator {
    accumulator = 0;
    static FIXED_TIMESTEP = 1 / 240;
    // ~4.166ms
    update(dt, stepCallback) {
      this.accumulator += Math.min(dt, 0.1);
      while (this.accumulator >= _FixedStepAccumulator.FIXED_TIMESTEP) {
        stepCallback(_FixedStepAccumulator.FIXED_TIMESTEP);
        this.accumulator -= _FixedStepAccumulator.FIXED_TIMESTEP;
      }
    }
    reset() {
      this.accumulator = 0;
    }
  };

  // src/engine/AnimationEngine.ts
  var AnimationEngine = class {
    clock;
    rafId = null;
    lastTime = performance.now();
    lastCurrentMs = 0;
    // Fixed 1/240s physics accumulator
    physicsAccumulator = new FixedStepAccumulator();
    // Bound DOM refs (cached, never queried inside tick)
    stageEl = null;
    cameraEl = null;
    ambientRimEl = null;
    lyricsContainerEl = null;
    webgl = null;
    stageView = null;
    cachedLines = [];
    currentTrack = null;
    activeWordRef = null;
    currentActiveLineIdx = 0;
    isInitialPositionSet = false;
    // Vertical stage spring for butter-smooth active line centering
    stageYSpring = HarmonicSpring.fromPreset("heavy", 0);
    // Horizontal camera spring for drift marquee ribbon
    cameraSpring = SpringVector2.fromPreset("heavy", 0, 0);
    // Ambient Rim Breathing
    rimOpacitySpring = HarmonicSpring.fromPreset("soft", 0.45);
    rimRadiusSpring = HarmonicSpring.fromPreset("soft", 110);
    // Ambient 10-30s Camera Noise Drift
    cameraDriftTime = 0;
    // Cinematic Moment tracking
    lastChorusSlamMs = 0;
    lastAccentMs = 0;
    currentStyle = "convex";
    currentPalette = null;
    rimEnabled = true;
    // Telemetry & Quality Governor
    frameTimes = [];
    frameCount = 0;
    governorLevel = 0;
    // 0 = High (1.5x DPR, 240 particles), 1 = Med, 2 = Low
    governorCheckTimer = 0;
    constructor() {
      this.clock = Clock.getInstance();
      if (typeof window !== "undefined") {
        window.addEventListener("resize", () => this.measureOffsets());
      }
    }
    bindWebgl(webgl) {
      this.webgl = webgl;
    }
    bindStageView(stageView) {
      this.stageView = stageView;
    }
    bindElements(stageEl, cameraEl, ambientRimEl, lyricsContainerEl, cachedLines, track) {
      this.stageEl = stageEl;
      this.cameraEl = cameraEl;
      this.ambientRimEl = ambientRimEl;
      this.lyricsContainerEl = lyricsContainerEl;
      this.cachedLines = cachedLines;
      if (track) this.currentTrack = track;
      this.activeWordRef = null;
      this.currentActiveLineIdx = 0;
      this.isInitialPositionSet = false;
      this.lastCurrentMs = 0;
      this.lastChorusSlamMs = 0;
      this.lastAccentMs = 0;
      this.cameraDriftTime = 0;
      this.measureOffsets();
      this.stageYSpring.reset(0, 0);
      this.cameraSpring.reset(0, 0);
      this.physicsAccumulator.reset();
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
        lineRef.isPromotedLayer = void 0;
        for (let w = 0; w < lineRef.words.length; w++) {
          const wordRef = lineRef.words[w];
          wordRef.lastFill = void 0;
          wordRef.lastTransform = void 0;
          wordRef.lastFilter = void 0;
          wordRef.lastOpacity = void 0;
          wordRef.isMarkedPast = void 0;
          wordRef.isMarkedFuture = void 0;
        }
      }
    }
    /**
     * UNIFIED MASTER RAF TICK (Synchronously orchestrates Clock, Physics, DOM, WebGL, Telemetry)
     */
    tick(dt) {
      const frameStart = performance.now();
      if (!this.cachedLines || this.cachedLines.length === 0) return;
      const currentMs = this.clock.tick(dt);
      const energy = this.clock.getEnergy();
      const beatPulse = this.clock.getBeatPulse();
      const isDownbeat = this.clock.getIsDownbeat();
      if (this.lastCurrentMs > 0 && currentMs < this.lastCurrentMs - 250) {
        this.handleSeekBackward(currentMs);
      }
      this.lastCurrentMs = currentMs;
      let targetLineIdx = this.findActiveLineIndex(currentMs);
      let anyVocalActive = false;
      let currentActiveWord = null;
      if (targetLineIdx !== -1 && this.cachedLines[targetLineIdx]) {
        const activeLine = this.cachedLines[targetLineIdx].line;
        if (currentMs >= activeLine.startMs - 180 && currentMs <= activeLine.endMs) {
          anyVocalActive = true;
        }
      } else {
        targetLineIdx = 0;
      }
      this.currentActiveLineIdx = targetLineIdx;
      this.clock.setVocalActivityEnergy(anyVocalActive, dt);
      this.physicsAccumulator.update(dt, (fixedDt) => {
        this.stepAllSprings(fixedDt, targetLineIdx, currentMs);
      });
      this.handleFilmMoments(currentMs, targetLineIdx, energy, beatPulse);
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
        const curStageY = this.stageYSpring.position;
        this.cameraDriftTime += dt * (0.2 + energy * 0.15);
        const driftX = Math.sin(this.cameraDriftTime * 0.7) * 4.5;
        const driftY = Math.cos(this.cameraDriftTime * 0.5) * 3.5;
        const driftRot = Math.sin(this.cameraDriftTime * 0.4) * 0.25;
        this.lyricsContainerEl.style.transform = `translate3d(${driftX.toFixed(1)}px, ${(curStageY + driftY).toFixed(1)}px, 0) rotate(${driftRot.toFixed(2)}deg)`;
      }
      currentActiveWord = this.renderLinesAndWords(targetLineIdx, currentMs, dt);
      this.activeWordRef = currentActiveWord;
      this.tickCamera(currentActiveWord, this.cachedLines[targetLineIdx] ?? null, currentMs, dt);
      this.tickRim(anyVocalActive, dt);
      if (currentActiveWord && this.webgl && this.currentStyle === "convex") {
        const wEl = currentActiveWord.el;
        const rect = wEl.getBoundingClientRect();
        const screenX = (rect.left + rect.width * 0.5) / (window.innerWidth || 1920);
        const screenY = (rect.top + rect.height * 0.5) / (window.innerHeight || 1080);
        this.webgl.setSpecularStreak(0.75, screenX, screenY);
      }
      if (this.webgl) {
        this.webgl.render(dt, energy, beatPulse, isDownbeat);
      }
      const frameEnd = performance.now();
      this.updateTelemetry(frameEnd - frameStart, dt, energy, beatPulse);
    }
    stepAllSprings(fixedDt, targetLineIdx, currentMs) {
      this.stageYSpring.step(fixedDt);
      this.cameraSpring.step(fixedDt);
      this.rimOpacitySpring.step(fixedDt);
      this.rimRadiusSpring.step(fixedDt);
      for (let l = Math.max(0, targetLineIdx - 1); l <= Math.min(this.cachedLines.length - 1, targetLineIdx + 1); l++) {
        const lineRef = this.cachedLines[l];
        for (let w = 0; w < lineRef.words.length; w++) {
          const wordRef = lineRef.words[w];
          wordRef.springProgress.step(fixedDt);
          wordRef.springScale.step(fixedDt);
          wordRef.springZ.step(fixedDt);
          wordRef.springGravityY.step(fixedDt);
        }
      }
    }
    renderLinesAndWords(targetLineIdx, currentMs, dt) {
      let activeWord = null;
      for (let lIdx = 0; lIdx < this.cachedLines.length; lIdx++) {
        const lineRef = this.cachedLines[lIdx];
        const lineDist = lIdx - targetLineIdx;
        const absDist = Math.abs(lineDist);
        if (absDist > 5) {
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
        const shouldPromote = absDist <= 1;
        if (lineRef.isPromotedLayer !== shouldPromote) {
          lineRef.el.style.willChange = shouldPromote ? "transform, opacity" : "auto";
          lineRef.isPromotedLayer = shouldPromote;
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
          focalPos = activeWordIdxInLine + 0.5 + wordProg * 0.5;
        }
        this.applyLineStyles(lineRef, lineDist, absDist, currentMs);
        for (let wIdx = 0; wIdx < lineRef.words.length; wIdx++) {
          const wordRef = lineRef.words[wIdx];
          const word = wordRef.word;
          const isWordActive = lineDist === 0 && wIdx === activeWordIdxInLine;
          const isWordPast = currentMs > word.endMs;
          if (isWordActive) {
            activeWord = wordRef;
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
            if (lineDist < 0) {
              if (!wordRef.isMarkedPast) {
                wordRef.el.className = "ve-word ve-word-past";
                wordRef.isMarkedPast = true;
                wordRef.isMarkedFuture = false;
              }
            } else {
              if (!wordRef.isMarkedFuture) {
                wordRef.el.className = "ve-word ve-word-future";
                wordRef.isMarkedFuture = true;
                wordRef.isMarkedPast = false;
              }
            }
          }
        }
      }
      return activeWord;
    }
    handleFilmMoments(currentMs, targetLineIdx, energy, beatPulse) {
      if (!this.cachedLines || this.cachedLines.length === 0 || !this.stageView) return;
      const firstLine = this.cachedLines[0].line;
      const lastLine = this.cachedLines[this.cachedLines.length - 1].line;
      if (currentMs < firstLine.startMs - 500) {
        if (this.currentTrack) {
          this.stageView.showTitleCard(this.currentTrack.title, this.currentTrack.artist, this.currentTrack.albumArtUrl);
        }
      } else {
        this.stageView.hideTitleCard();
      }
      if (currentMs > lastLine.endMs + 1500) {
        if (this.currentTrack) {
          this.stageView.showTitleCard(this.currentTrack.title, this.currentTrack.artist, this.currentTrack.albumArtUrl);
        }
      }
      const curLine = this.cachedLines[targetLineIdx]?.line;
      const nextLine = this.cachedLines[targetLineIdx + 1]?.line;
      if (curLine && nextLine && nextLine.startMs - curLine.endMs > 4e3) {
        if (currentMs > curLine.endMs + 800 && currentMs < nextLine.startMs - 600) {
          this.stageView.setInterludeVisible(true);
        } else {
          this.stageView.setInterludeVisible(false);
        }
      } else {
        this.stageView.setInterludeVisible(false);
      }
      const now = performance.now();
      if (energy >= 0.78 && beatPulse >= 0.85 && now - this.lastChorusSlamMs > 8e3) {
        this.lastChorusSlamMs = now;
        if (this.webgl) {
          this.webgl.triggerChorusSlam();
          this.webgl.triggerParticleBurst();
        }
      }
    }
    applyLineStyles(lineRef, lineDist, absDist, currentMs) {
      let transform = "";
      let opacity = "";
      let filter = "";
      if (this.currentStyle === "convex") {
        if (lineDist === 0) {
          lineRef.el.classList.add("is-active");
          transform = "translateZ(45px) scale(1.04)";
          opacity = "1.0";
          filter = "none";
        } else {
          lineRef.el.classList.remove("is-active");
          const curveDeg = lineDist < 0 ? -16 : 16;
          const targetZ = -65 - absDist * 35;
          const targetScale = Math.max(0.76, 0.96 - absDist * 0.08);
          transform = `translateZ(${targetZ}px) rotateX(${curveDeg}deg) scale(${targetScale.toFixed(3)})`;
          opacity = Math.max(0.04, 0.36 / absDist).toFixed(2);
          filter = absDist === 1 ? "blur(2.2px)" : "none";
        }
      } else if (this.currentStyle === "drift") {
        if (lineDist === 0) {
          lineRef.el.classList.add("is-active");
          opacity = "1.0";
          filter = "none";
        } else {
          lineRef.el.classList.remove("is-active");
          transform = `translateZ(-50px) rotateY(-5deg) scale(0.92)`;
          opacity = Math.max(0.04, 0.28 / absDist).toFixed(2);
          filter = absDist === 1 ? "blur(2.5px)" : "none";
        }
      } else if (this.currentStyle === "editorial") {
        if (lineDist === 0) {
          lineRef.el.classList.add("is-active");
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
          lineRef.el.classList.remove("is-active");
          transform = "translateZ(0px) scale(1.0)";
          opacity = Math.max(0.03, 0.32 / absDist).toFixed(2);
          filter = absDist === 1 ? "blur(1.8px)" : "none";
        }
      } else {
        if (lineDist === 0) {
          lineRef.el.classList.add("is-active");
          transform = "translateZ(35px) scale(1.04)";
          opacity = "1.0";
          filter = "none";
        } else {
          lineRef.el.classList.remove("is-active");
          transform = "translateZ(-30px) scale(0.95)";
          opacity = Math.max(0.04, 0.3 / absDist).toFixed(2);
          filter = absDist === 1 ? "blur(2.0px)" : "none";
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
    updateWordKinematics(wordRef, wordIdxInLine, focalPos, activeWordIdxInLine, lineDist, currentMs, isWordActive, isWordPast, dt) {
      const word = wordRef.word;
      const wordStartWithStagger = word.startMs - (lineDist === 1 ? 180 - wordIdxInLine * 25 : 0);
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
      const curProgress = wordRef.springProgress.position;
      if (isWordActive) {
        wordRef.el.className = "ve-word is-active";
        const fillStr = `${(curProgress * 114).toFixed(1)}%`;
        if (wordRef.lastFill !== fillStr) {
          wordRef.el.style.setProperty("--p", fillStr);
          wordRef.lastFill = fillStr;
        }
      } else if (isWordPast || lineDist < 0) {
        if (!wordRef.isMarkedPast) {
          wordRef.el.className = "ve-word ve-word-past";
          wordRef.isMarkedPast = true;
          wordRef.isMarkedFuture = false;
        }
      } else {
        if (!wordRef.isMarkedFuture) {
          wordRef.el.className = "ve-word ve-word-future";
          wordRef.isMarkedFuture = true;
          wordRef.isMarkedPast = false;
        }
      }
      let transform = "";
      let filter = "";
      let opacity = "";
      switch (this.currentStyle) {
        case "convex": {
          if (lineDist === 0) {
            const dist = wordIdxInLine + 0.5 - focalPos;
            const absDist = Math.abs(dist);
            const targetScale = isWordActive ? 1.05 : 1 + 0.28 * Math.exp(-dist * dist * 0.45);
            const targetZ = 85 * Math.exp(-dist * dist * 0.4) - 25;
            const rotateY = Math.max(-28, Math.min(28, dist * 12));
            opacity = Math.max(0.24, 1 - absDist * 0.2).toFixed(2);
            transform = `perspective(900px) translateZ(${targetZ.toFixed(1)}px) scale(${targetScale.toFixed(3)}) rotateY(${rotateY.toFixed(1)}deg)`;
            filter = "none";
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
            wordRef.springZ.setTarget(35);
          } else {
            wordRef.springScale.setTarget(1);
            wordRef.springZ.setTarget(0);
          }
          transform = `translateZ(${wordRef.springZ.position.toFixed(1)}px) scale(${wordRef.springScale.position.toFixed(3)})`;
          filter = "none";
          opacity = isWordActive ? "1.0" : isWordPast ? "0.85" : "0.35";
          break;
        }
        case "editorial": {
          opacity = isWordActive ? "1.0" : isWordPast ? "0.78" : "0.24";
          if (word.isMelisma && isWordActive) {
            const melismaScaleX = 1 + Math.min(0.18, curProgress * 0.18);
            transform = `translateY(-3px) scale(${melismaScaleX.toFixed(3)}, 1.04)`;
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
          if (word.semanticEffect === "GRAVITY") {
            wordRef.springGravityY.setTarget(isWordActive ? 28 : 0);
            const curSinkY = wordRef.springGravityY.position;
            const curTilt = curSinkY / 28 * 4;
            extraTransform = ` translateY(${curSinkY.toFixed(1)}px) rotate(${curTilt.toFixed(1)}deg)`;
          } else if (word.semanticEffect === "PULSE") {
            if (isWordActive) {
              extraTransform = " scale(1.16)";
            }
          } else if (word.semanticEffect === "FRACTURE") {
            if (curProgress > 0.35) {
              const shear = (curProgress - 0.35) / 0.65 * 4;
              if (wordRef.shearTopEl) wordRef.shearTopEl.style.transform = `translate(${shear.toFixed(1)}px, -1px)`;
              if (wordRef.shearBottomEl) wordRef.shearBottomEl.style.transform = `translate(-${shear.toFixed(1)}px, 1px)`;
            } else {
              if (wordRef.shearTopEl) wordRef.shearTopEl.style.transform = "none";
              if (wordRef.shearBottomEl) wordRef.shearBottomEl.style.transform = "none";
            }
          }
          transform = extraTransform || (isWordActive ? "translateY(-3px) scale(1.04)" : "none");
          filter = "none";
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
    tickCamera(activeWord, activeLineRef, currentMs, dt) {
      if (!this.cameraEl || !this.lyricsContainerEl) return;
      if (this.currentStyle === "drift" && activeWord && activeLineRef) {
        const wordLeft = activeWord.cachedOffsetLeft ?? activeWord.el.offsetLeft;
        const wordWidth = activeWord.cachedWidth ?? activeWord.el.offsetWidth;
        const wordProg = Math.max(0, Math.min(1, (currentMs - activeWord.word.startMs) / Math.max(1, activeWord.word.durationMs)));
        const wordCenterX = wordLeft + wordWidth * wordProg;
        const targetCamX = -wordCenterX;
        this.cameraSpring.setTarget(targetCamX, 0);
        const camX = this.cameraSpring.x.position;
        activeLineRef.el.style.transform = `translateX(${camX.toFixed(1)}px) translateZ(35px) rotateY(-5deg) scale(1.02)`;
      } else if (this.currentStyle !== "drift") {
        this.cameraSpring.reset(0, 0);
        this.cameraEl.style.transform = "translate3d(0, 0, 0)";
      }
    }
    tickRim(anyVocalActive, dt) {
      if (!this.ambientRimEl || !this.rimEnabled) return;
      const targetOpacity = anyVocalActive ? 0.9 : 0.45;
      this.rimOpacitySpring.setTarget(targetOpacity);
      const curOpacity = this.rimOpacitySpring.position;
      this.ambientRimEl.style.opacity = curOpacity.toFixed(3);
      const targetRadius = anyVocalActive ? 180 : 110;
      this.rimRadiusSpring.setTarget(targetRadius);
      const curRadius = this.rimRadiusSpring.position;
      this.ambientRimEl.style.setProperty("--ve-rim-size", `${curRadius.toFixed(0)}px`);
    }
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
            wordRef.el.className = "ve-word ve-word-future";
            wordRef.isMarkedFuture = true;
            wordRef.isMarkedPast = false;
            if (wordRef.shearTopEl) wordRef.shearTopEl.style.transform = "none";
            if (wordRef.shearBottomEl) wordRef.shearBottomEl.style.transform = "none";
          }
        }
      }
    }
    findActiveLineIndex(currentMs) {
      const totalLines = this.cachedLines.length;
      if (totalLines === 0) return 0;
      let idx = this.currentActiveLineIdx;
      if (idx < 0) idx = 0;
      if (idx >= totalLines) idx = totalLines - 1;
      const curLine = this.cachedLines[idx].line;
      if (currentMs >= curLine.startMs - 180 && currentMs <= curLine.endMs) {
        return idx;
      }
      if (currentMs > curLine.endMs) {
        while (idx + 1 < totalLines) {
          const nextLine = this.cachedLines[idx + 1].line;
          if (currentMs < nextLine.startMs - 180) {
            return currentMs - curLine.endMs < 2e3 ? idx : idx + 1;
          }
          idx++;
          if (currentMs >= nextLine.startMs - 180 && currentMs <= nextLine.endMs) {
            return idx;
          }
        }
        return totalLines - 1;
      }
      if (currentMs < curLine.startMs - 180) {
        while (idx > 0) {
          idx--;
          const prevLine = this.cachedLines[idx].line;
          if (currentMs >= prevLine.startMs - 180 && currentMs <= prevLine.endMs) {
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
    updateTelemetry(frameDurationMs, dt, energy, beatPulse) {
      this.frameTimes.push(frameDurationMs);
      if (this.frameTimes.length > 60) this.frameTimes.shift();
      this.frameCount++;
      this.governorCheckTimer += dt;
      if (this.governorCheckTimer > 1.5) {
        this.governorCheckTimer = 0;
        const sorted = [...this.frameTimes].sort((a, b) => a - b);
        const p95 = sorted[Math.floor(sorted.length * 0.95)] || 16.6;
        if (p95 > 22 && this.governorLevel < 2) {
          this.governorLevel++;
          if (this.webgl) {
            const dpr = this.governorLevel === 1 ? 1.25 : 1;
            const partCount = this.governorLevel === 1 ? 120 : 0;
            this.webgl.setQualityGovernor(dpr, partCount);
          }
        } else if (p95 < 13 && this.governorLevel > 0) {
          this.governorLevel--;
          if (this.webgl) {
            const dpr = this.governorLevel === 0 ? 1.5 : 1.25;
            const partCount = this.governorLevel === 0 ? 240 : 120;
            this.webgl.setQualityGovernor(dpr, partCount);
          }
        }
      }
      if (this.frameCount % 10 === 0 && this.stageView) {
        const avgDuration = this.frameTimes.reduce((a, b) => a + b, 0) / (this.frameTimes.length || 1);
        const fps = Math.min(144, 1e3 / Math.max(1, avgDuration));
        const sorted = [...this.frameTimes].sort((a, b) => a - b);
        const low1PercentIdx = Math.max(0, Math.floor(sorted.length * 0.05));
        const low1Percent = Math.min(144, 1e3 / Math.max(1, sorted[sorted.length - 1 - low1PercentIdx]));
        const activeLayers = this.cachedLines.filter((l) => l.isPromotedLayer).length;
        this.stageView.updateHud(fps, low1Percent, avgDuration, energy, beatPulse, activeLayers);
      }
    }
  };

  // src/engine/WebGLPostProcess.ts
  var VERT_SRC = `#version 300 es
precision highp float;

in vec2 a_position;
out vec2 v_uv;

uniform float u_lensBreath; // 1.00 .. 1.015 lens breathing on downbeats

void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position * u_lensBreath, 0.0, 1.0);
}
`;
  var FRAG_SRC = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform sampler2D u_artTexture;
uniform sampler2D u_prevArtTexture;
uniform float     u_artCrossfade;      // 0..1 transition between track artworks
uniform float     u_hasArt;            // 1.0 if texture is loaded, 0.0 fallback

uniform float     u_time;              // Continuous phase
uniform float     u_grainTime;         // 24fps stepped time for grain
uniform float     u_energy;            // Global energy 0..1
uniform float     u_beatPulse;         // 0..1 beat impulse
uniform float     u_chromaticSpike;    // Spikes on chorus slam / impact
uniform float     u_streakIntensity;   // Anamorphic horizontal flare
uniform vec2      u_streakCenter;      // Screen UV of active word
uniform vec2      u_resolution;

uniform vec3      u_colorDominant;     // Atmospheric mood
uniform vec3      u_colorAccent;       // High-chroma accents
uniform vec3      u_colorShadow;       // Deep velvety background
uniform vec3      u_colorHighlight;    // Specular glow

// Saturation adjustment
vec3 adjustSaturation(vec3 color, float saturation) {
  float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
  return mix(vec3(luma), color, saturation);
}

// 24fps full-resolution grain
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec2 uv = v_uv;
  vec2 center = uv - vec2(0.5);
  float distToCenter = length(center);

  // 1. Edge-only chromatic aberration (spiking on chorus slam)
  float caAmount = (0.0018 + u_chromaticSpike * 0.008) * pow(distToCenter * 1.5, 2.2);
  vec2 caDir = distToCenter > 0.001 ? normalize(center) * caAmount : vec2(0.0);

  // 2. 3-Scale dynamic rotating album art atmosphere
  float t = u_time * 0.12;

  // Scale 1: 1.1x slow sway
  vec2 uv1 = uv + vec2(sin(t * 0.6) * 0.06, cos(t * 0.4) * 0.05);
  uv1 = (uv1 - 0.5) * 0.85 + 0.5;

  // Scale 2: 1.8x slow rotation
  float ang2 = t * 0.25;
  mat2 rot2 = mat2(cos(ang2), -sin(ang2), sin(ang2), cos(ang2));
  vec2 uv2 = rot2 * (uv - 0.5) * 1.6 + 0.5;

  // Scale 3: 2.6x translation
  vec2 uv3 = (uv - 0.5) * 2.4 + 0.5 + vec2(cos(t * 0.35) * 0.08, sin(t * 0.5) * 0.08);

  vec3 texSample = vec3(0.0);

  if (u_hasArt > 0.5) {
    // Current artwork with chromatic separation
    vec3 c1 = vec3(
      texture(u_artTexture, uv1 + caDir).r,
      texture(u_artTexture, uv1).g,
      texture(u_artTexture, uv1 - caDir).b
    );
    vec3 c2 = texture(u_artTexture, uv2).rgb;
    vec3 c3 = texture(u_artTexture, uv3).rgb;
    vec3 artBlended = c1 * 0.45 + c2 * 0.35 + c3 * 0.20;

    // Previous artwork for smooth crossfade
    if (u_artCrossfade < 1.0) {
      vec3 p1 = texture(u_prevArtTexture, uv1).rgb;
      vec3 p2 = texture(u_prevArtTexture, uv2).rgb;
      vec3 prevBlended = p1 * 0.55 + p2 * 0.45;
      artBlended = mix(prevBlended, artBlended, u_artCrossfade);
    }

    texSample = artBlended;
  } else {
    // Procedural fallback: Soft Lissajous color orbs
    vec2 orb1 = vec2(sin(t * 0.8) * 0.35 + 0.5, cos(t * 0.6) * 0.30 + 0.5);
    vec2 orb2 = vec2(cos(t * 0.7) * 0.40 + 0.5, sin(t * 0.9) * 0.35 + 0.5);
    float d1 = length(uv - orb1);
    float d2 = length(uv - orb2);
    texSample = u_colorDominant * exp(-d1 * d1 * 4.0) + u_colorAccent * exp(-d2 * d2 * 5.0);
  }

  // Saturated color grade (1.4x saturation)
  vec3 graded = adjustSaturation(texSample, 1.40);

  // Blend with rich shadow base: guarantees readability of text
  vec3 finalColor = mix(u_colorShadow, graded, 0.48 + u_energy * 0.18);
  finalColor += u_colorDominant * (0.12 + u_beatPulse * 0.06);

  // 3. Anamorphic Horizontal Specular Flare on active word
  if (u_streakIntensity > 0.01) {
    float dy = abs(uv.y - u_streakCenter.y);
    float dx = abs(uv.x - u_streakCenter.x);
    float streakY = exp(-dy * dy * 1800.0);       // Ultra-narrow vertical line
    float streakX = exp(-dx * dx * 4.0);          // Wide horizontal wings
    vec3 flareColor = mix(u_colorHighlight, u_colorAccent, 0.35);
    finalColor += flareColor * streakY * streakX * u_streakIntensity * 0.75;
  }

  // 4. Cinematic Vignette (depth focus)
  float vignette = clamp(1.0 - distToCenter * 1.15, 0.0, 1.0);
  finalColor *= mix(0.72, 1.0, vignette);

  // 5. 24fps Film Grain (full-resolution)
  vec2 grainCoord = gl_FragCoord.xy + vec2(u_grainTime * 123.45);
  float grain = (hash(grainCoord) - 0.5) * 0.022;
  finalColor += vec3(grain);

  fragColor = vec4(clamp(finalColor, 0.0, 1.0), 1.0);
}
`;
  var PARTICLE_VERT = `#version 300 es
precision highp float;

in vec3 a_particle; // x, y, depth (z = 0.2..1.0)
in float a_size;
in float a_alpha;

uniform vec2 u_resolution;
uniform float u_energy;
uniform float u_beatPulse;

out float v_alpha;
out float v_depth;

void main() {
  vec2 ndc = (a_particle.xy / u_resolution) * 2.0 - 1.0;
  ndc.y = -ndc.y; // Flip Y
  gl_Position = vec4(ndc, 0.0, 1.0);

  float sizeScale = 1.0 + u_beatPulse * 0.35 + u_energy * 0.20;
  gl_PointSize = a_size * sizeScale * (a_particle.z * 1.5 + 0.5);
  v_alpha = a_alpha * (0.45 + u_energy * 0.55);
  v_depth = a_particle.z;
}
`;
  var PARTICLE_FRAG = `#version 300 es
precision highp float;

in float v_alpha;
in float v_depth;
out vec4 fragColor;

uniform vec3 u_particleColor;

void main() {
  vec2 coord = gl_PointCoord - vec2(0.5);
  float dist = length(coord);
  if (dist > 0.5) discard;

  // Soft bokeh gaussian falloff
  float falloff = exp(-dist * dist * 9.0);
  fragColor = vec4(u_particleColor, v_alpha * falloff * (v_depth * 0.6 + 0.4));
}
`;
  var WebGLPostProcess = class {
    canvas = null;
    gl = null;
    // Main quad program
    program = null;
    vao = null;
    // Particle program
    particleProgram = null;
    particleVao = null;
    particleBuffer = null;
    particles = [];
    MAX_PARTICLES = 240;
    // Artwork textures
    currentArtTexture = null;
    prevArtTexture = null;
    artCrossfade = 1;
    hasArt = false;
    currentArtUrl = "";
    // Uniform locations
    u_artTexture = null;
    u_prevArtTexture = null;
    u_artCrossfade = null;
    u_hasArt = null;
    u_time = null;
    u_grainTime = null;
    u_energy = null;
    u_beatPulse = null;
    u_chromaticSpike = null;
    u_streakIntensity = null;
    u_streakCenter = null;
    u_resolution = null;
    u_lensBreath = null;
    u_colorDominant = null;
    u_colorAccent = null;
    u_colorShadow = null;
    u_colorHighlight = null;
    u_partRes = null;
    u_partEnergy = null;
    u_partBeatPulse = null;
    u_particleColor = null;
    // Dynamic parameters
    phase = 0;
    chromaticSpike = 0;
    streakIntensity = 0;
    streakCenter = [0.5, 0.5];
    lensBreath = 1;
    currentPalette = null;
    supported = false;
    // Quality governor
    qualityDpr = 1.5;
    activeParticleCount = 240;
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
          console.warn("[VerseEngine] WebGL2 not available; relying on pure CSS mode.");
          return false;
        }
        this.canvas.addEventListener("webglcontextlost", (e) => {
          e.preventDefault();
          console.warn("[VerseEngine] WebGL context lost.");
        });
        this.canvas.addEventListener("webglcontextrestored", () => {
          console.log("[VerseEngine] WebGL context restored.");
          this.initShaders();
          this.initParticles();
        });
        this.initShaders();
        this.initParticles();
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
      window.removeEventListener("resize", this.onResize);
      if (this.gl) {
        if (this.program) this.gl.deleteProgram(this.program);
        if (this.particleProgram) this.gl.deleteProgram(this.particleProgram);
        if (this.currentArtTexture) this.gl.deleteTexture(this.currentArtTexture);
        if (this.prevArtTexture) this.gl.deleteTexture(this.prevArtTexture);
      }
      if (this.canvas?.parentElement) {
        this.canvas.parentElement.removeChild(this.canvas);
      }
      this.canvas = null;
      this.gl = null;
    }
    onResize = () => {
      this.resize();
    };
    resize() {
      if (!this.canvas || !this.gl) return;
      const dpr = Math.min(window.devicePixelRatio || 1, this.qualityDpr);
      const w = Math.floor(window.innerWidth * dpr);
      const h = Math.floor(window.innerHeight * dpr);
      if (this.canvas.width !== w || this.canvas.height !== h) {
        this.canvas.width = w;
        this.canvas.height = h;
        this.gl.viewport(0, 0, w, h);
      }
    }
    setQualityGovernor(dprLimit, particleCount) {
      this.qualityDpr = dprLimit;
      this.activeParticleCount = Math.min(this.MAX_PARTICLES, Math.max(0, particleCount));
      this.resize();
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
        throw new Error(`Main shader link failed: ${gl.getProgramInfoLog(prog)}`);
      }
      this.program = prog;
      this.u_artTexture = gl.getUniformLocation(prog, "u_artTexture");
      this.u_prevArtTexture = gl.getUniformLocation(prog, "u_prevArtTexture");
      this.u_artCrossfade = gl.getUniformLocation(prog, "u_artCrossfade");
      this.u_hasArt = gl.getUniformLocation(prog, "u_hasArt");
      this.u_time = gl.getUniformLocation(prog, "u_time");
      this.u_grainTime = gl.getUniformLocation(prog, "u_grainTime");
      this.u_energy = gl.getUniformLocation(prog, "u_energy");
      this.u_beatPulse = gl.getUniformLocation(prog, "u_beatPulse");
      this.u_chromaticSpike = gl.getUniformLocation(prog, "u_chromaticSpike");
      this.u_streakIntensity = gl.getUniformLocation(prog, "u_streakIntensity");
      this.u_streakCenter = gl.getUniformLocation(prog, "u_streakCenter");
      this.u_resolution = gl.getUniformLocation(prog, "u_resolution");
      this.u_lensBreath = gl.getUniformLocation(prog, "u_lensBreath");
      this.u_colorDominant = gl.getUniformLocation(prog, "u_colorDominant");
      this.u_colorAccent = gl.getUniformLocation(prog, "u_colorAccent");
      this.u_colorShadow = gl.getUniformLocation(prog, "u_colorShadow");
      this.u_colorHighlight = gl.getUniformLocation(prog, "u_colorHighlight");
      const quadVertices = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);
      this.vao = gl.createVertexArray();
      gl.bindVertexArray(this.vao);
      const vbo = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      gl.bufferData(gl.ARRAY_BUFFER, quadVertices, gl.STATIC_DRAW);
      const aPos = gl.getAttribLocation(prog, "a_position");
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
      gl.bindVertexArray(null);
      const pVert = this.compileShader(gl.VERTEX_SHADER, PARTICLE_VERT);
      const pFrag = this.compileShader(gl.FRAGMENT_SHADER, PARTICLE_FRAG);
      const pProg = gl.createProgram();
      gl.attachShader(pProg, pVert);
      gl.attachShader(pProg, pFrag);
      gl.linkProgram(pProg);
      if (!gl.getProgramParameter(pProg, gl.LINK_STATUS)) {
        throw new Error(`Particle shader link failed: ${gl.getProgramInfoLog(pProg)}`);
      }
      this.particleProgram = pProg;
      this.u_partRes = gl.getUniformLocation(pProg, "u_resolution");
      this.u_partEnergy = gl.getUniformLocation(pProg, "u_energy");
      this.u_partBeatPulse = gl.getUniformLocation(pProg, "u_beatPulse");
      this.u_particleColor = gl.getUniformLocation(pProg, "u_particleColor");
      this.particleVao = gl.createVertexArray();
      gl.bindVertexArray(this.particleVao);
      this.particleBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.particleBuffer);
      const stride = 5 * Float32Array.BYTES_PER_ELEMENT;
      const aParticle = gl.getAttribLocation(pProg, "a_particle");
      const aSize = gl.getAttribLocation(pProg, "a_size");
      const aAlpha = gl.getAttribLocation(pProg, "a_alpha");
      gl.enableVertexAttribArray(aParticle);
      gl.vertexAttribPointer(aParticle, 3, gl.FLOAT, false, stride, 0);
      gl.enableVertexAttribArray(aSize);
      gl.vertexAttribPointer(aSize, 1, gl.FLOAT, false, stride, 3 * Float32Array.BYTES_PER_ELEMENT);
      gl.enableVertexAttribArray(aAlpha);
      gl.vertexAttribPointer(aAlpha, 1, gl.FLOAT, false, stride, 4 * Float32Array.BYTES_PER_ELEMENT);
      gl.bindVertexArray(null);
    }
    initParticles() {
      this.particles = [];
      const w = window.innerWidth || 1920;
      const h = window.innerHeight || 1080;
      for (let i = 0; i < this.MAX_PARTICLES; i++) {
        const depthTier = i % 3 === 0 ? 1 : i % 3 === 1 ? 0.6 : 0.2;
        const baseSize = depthTier === 1 ? 16 + Math.random() * 24 : depthTier === 0.6 ? 8 + Math.random() * 12 : 3 + Math.random() * 4;
        this.particles.push({
          x: Math.random() * w,
          y: Math.random() * h,
          z: depthTier,
          vx: (Math.random() - 0.5) * (depthTier * 22 + 8),
          vy: -Math.random() * (depthTier * 18 + 6),
          // Upward ambient float
          size: baseSize,
          alpha: Math.random() * 0.4 + 0.1,
          baseAlpha: Math.random() * 0.35 + 0.15
        });
      }
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
    /**
     * Loads album artwork into a WebGL texture with smooth crossfade
     */
    async loadAlbumTexture(rawUrl) {
      const url = AmbientLight.resolveImageUrl(rawUrl);
      if (!url || url === this.currentArtUrl || !this.gl) return;
      this.currentArtUrl = url;
      return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.onload = () => {
          if (!this.gl) return resolve();
          const gl = this.gl;
          if (this.prevArtTexture) {
            gl.deleteTexture(this.prevArtTexture);
          }
          this.prevArtTexture = this.currentArtTexture;
          this.artCrossfade = 0;
          const tex = gl.createTexture();
          gl.bindTexture(gl.TEXTURE_2D, tex);
          gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
          this.currentArtTexture = tex;
          this.hasArt = true;
          resolve();
        };
        img.onerror = () => {
          this.hasArt = false;
          resolve();
        };
        img.src = url;
      });
    }
    setPalette(palette) {
      this.currentPalette = palette;
      if (this.canvas) {
        this.canvas.style.opacity = palette.isDark ? "0.95" : "0.0";
      }
    }
    triggerChorusSlam() {
      this.chromaticSpike = 1;
    }
    triggerParticleBurst() {
      const cx = (this.canvas?.width || 1920) * 0.5;
      const cy = (this.canvas?.height || 1080) * 0.5;
      for (const p of this.particles) {
        const dx = p.x - cx;
        const dy = p.y - cy;
        const len = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        p.vx += dx / len * (180 + Math.random() * 120);
        p.vy += dy / len * (180 + Math.random() * 120);
        p.alpha = Math.min(1, p.baseAlpha * 2.5);
      }
    }
    setSpecularStreak(intensity, screenUvX, screenUvY) {
      this.streakIntensity = Math.max(0, Math.min(1, intensity));
      this.streakCenter = [screenUvX, screenUvY];
    }
    /**
     * MASTER SHARED RAF TICK: Called directly by AnimationEngine in the unified frame loop.
     */
    render(dt, energy, beatPulse, isDownbeat) {
      if (!this.gl || !this.program || !this.canvas || !this.supported) return;
      if (this.currentPalette && !this.currentPalette.isDark) {
        return;
      }
      const gl = this.gl;
      this.phase += dt * (0.8 + energy * 0.6);
      this.chromaticSpike = Math.max(0, this.chromaticSpike - dt * 2.8);
      this.streakIntensity = Math.max(0, this.streakIntensity - dt * 2.5);
      const targetLens = isDownbeat ? 1.014 : 1;
      this.lensBreath += (targetLens - this.lensBreath) * Math.min(1, dt * 8);
      if (this.artCrossfade < 1) {
        this.artCrossfade = Math.min(1, this.artCrossfade + dt / 1.2);
      }
      gl.useProgram(this.program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.currentArtTexture);
      gl.uniform1i(this.u_artTexture, 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.prevArtTexture);
      gl.uniform1i(this.u_prevArtTexture, 1);
      gl.uniform1f(this.u_artCrossfade, this.artCrossfade);
      gl.uniform1f(this.u_hasArt, this.hasArt ? 1 : 0);
      gl.uniform1f(this.u_time, this.phase);
      gl.uniform1f(this.u_grainTime, Math.floor(this.phase * 24) / 24);
      gl.uniform1f(this.u_energy, energy);
      gl.uniform1f(this.u_beatPulse, beatPulse);
      gl.uniform1f(this.u_chromaticSpike, this.chromaticSpike);
      gl.uniform1f(this.u_streakIntensity, this.streakIntensity);
      gl.uniform2f(this.u_streakCenter, this.streakCenter[0], this.streakCenter[1]);
      gl.uniform2f(this.u_resolution, this.canvas.width, this.canvas.height);
      gl.uniform1f(this.u_lensBreath, this.lensBreath);
      const pal = this.currentPalette;
      const dom = pal?.rgbDominant || [0.45, 0.12, 0.18];
      const acc = pal?.rgbAccent || [0.85, 0.22, 0.3];
      const sha = pal?.rgbShadow || [0.06, 0.04, 0.05];
      const hig = pal?.rgbHighlight || [0.98, 0.98, 0.96];
      gl.uniform3f(this.u_colorDominant, dom[0], dom[1], dom[2]);
      gl.uniform3f(this.u_colorAccent, acc[0], acc[1], acc[2]);
      gl.uniform3f(this.u_colorShadow, sha[0], sha[1], sha[2]);
      gl.uniform3f(this.u_colorHighlight, hig[0], hig[1], hig[2]);
      gl.bindVertexArray(this.vao);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.bindVertexArray(null);
      if (this.activeParticleCount > 0 && this.particleProgram && this.particleVao) {
        this.updateAndDrawParticles(dt, energy, beatPulse, acc);
      }
    }
    updateAndDrawParticles(dt, energy, beatPulse, colorAccent) {
      const gl = this.gl;
      const w = this.canvas.width;
      const h = this.canvas.height;
      const count = this.activeParticleCount;
      const data = new Float32Array(count * 5);
      for (let i = 0; i < count; i++) {
        const p = this.particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= Math.pow(0.92, dt * 60);
        p.vy = p.vy * Math.pow(0.92, dt * 60) - (p.z * 16 + 8) * (1 - Math.pow(0.92, dt * 60));
        p.alpha += (p.baseAlpha - p.alpha) * Math.min(1, dt * 2);
        if (p.x < -40) p.x = w + 40;
        if (p.x > w + 40) p.x = -40;
        if (p.y < -40) p.y = h + 40;
        if (p.y > h + 40) p.y = -40;
        const idx = i * 5;
        data[idx] = p.x;
        data[idx + 1] = p.y;
        data[idx + 2] = p.z;
        data[idx + 3] = p.size;
        data[idx + 4] = p.alpha;
      }
      gl.useProgram(this.particleProgram);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      gl.uniform2f(this.u_partRes, w, h);
      gl.uniform1f(this.u_partEnergy, energy);
      gl.uniform1f(this.u_partBeatPulse, beatPulse);
      gl.uniform3f(this.u_particleColor, colorAccent[0], colorAccent[1], colorAccent[2]);
      gl.bindVertexArray(this.particleVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.particleBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
      gl.drawArrays(gl.POINTS, 0, count);
      gl.disable(gl.BLEND);
      gl.bindVertexArray(null);
    }
  };

  // src/ui/StageView.ts
  var StageView = class {
    rootEl = null;
    rimPrimaryEl = null;
    cameraEl = null;
    lyricsContainerEl = null;
    controlPillEl = null;
    titleCardEl = null;
    interludeEl = null;
    devHudEl = null;
    hideTimeout = null;
    clock = Clock.getInstance();
    callbacks;
    currentStyle = "convex";
    currentPaletteType = "album";
    rimEnabled = true;
    isHudVisible = false;
    syncOffsetDisplayEl = null;
    cachedLines = [];
    constructor(callbacks) {
      this.callbacks = callbacks;
      this.loadSavedPreferences();
      this.injectFontCascades();
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
    injectFontCascades() {
      const id = "verse-engine-fonts";
      if (!document.getElementById(id)) {
        const link = document.createElement("link");
        link.id = id;
        link.rel = "stylesheet";
        link.href = "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800&family=Instrument+Serif:ital@0;1&family=Plus+Jakarta+Sans:wght@600;700;800&family=Syne:wght@700;800&display=swap";
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

        /* \u2500\u2500 LAYER 1: ATMOSPHERE (Lumn-Style 4-Edge Peripheral Rim Glow) \u2500\u2500 */
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

        /* \u2500\u2500 LAYER 2: TEXT (The Hero Viewport & Atmosphere Mask) \u2500\u2500 */
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

        /* \u2500\u2500 HERO WORD TYPOGRAPHY \u2500\u2500 */
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

        /* \u2500\u2500 1. CONVEX / OPTICAL DOME MODE (The Refined Hero Default) \u2500\u2500 */
        .ve-style-convex .ve-line {
          margin: 3.4rem 0 !important;
        }

        /* \u2500\u2500 2. DRIFT MARQUEE MODE (Unwrapped Horizontal Ribbon) \u2500\u2500 */
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

        /* \u2500\u2500 3. EDITORIAL MODE (Swiss Print Press) \u2500\u2500 */
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

        /* \u2500\u2500 4. SEMANTIC LIVING PHYSICS \u2500\u2500 */
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

        /* \u2500\u2500 FILM TITLE CARD INTRO & OUTRO \u2500\u2500 */
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

        /* \u2500\u2500 INSTRUMENTAL INTERLUDE (Breathing Dots) \u2500\u2500 */
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

        /* \u2500\u2500 DEV TELEMETRY HUD (Shift + D) \u2500\u2500 */
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

        /* \u2500\u2500 LIQUID GLASS CONTROL ICON DOCK \u2500\u2500 */
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
      this.rimPrimaryEl = document.getElementById("ve-ambient-rim");
      this.cameraEl = document.getElementById("ve-camera");
      this.lyricsContainerEl = document.getElementById("ve-lyrics-container");
      this.titleCardEl = document.getElementById("ve-title-card");
      this.interludeEl = document.getElementById("ve-interlude");
      this.devHudEl = document.getElementById("ve-dev-hud");
      this.controlPillEl = document.getElementById("ve-control-dock");
      this.renderControlDock();
      this.bindActivityListeners();
      this.applyStyleClass(this.currentStyle);
      return {
        rootEl: this.rootEl,
        cameraEl: this.cameraEl,
        ambientRimEl: this.rimPrimaryEl,
        lyricsContainerEl: this.lyricsContainerEl,
        titleCardEl: this.titleCardEl,
        interludeEl: this.interludeEl,
        devHudEl: this.devHudEl
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
      this.rootEl.style.setProperty("--ve-accent", palette.accent);
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
     * Builds the DOM tree once for the song.
     * Words are single spans with soft liquid gradient wipes.
     * One duplicate glow element per line.
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
        const lineGlow = document.createElement("div");
        lineGlow.className = "ve-line-glow";
        lineGlow.setAttribute("aria-hidden", "true");
        lineEl.appendChild(lineGlow);
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
          const formattedText = word.text.replace(/'/g, "\u2019");
          let shearTopEl;
          let shearBottomEl;
          if (word.semanticEffect === "FRACTURE") {
            wordEl.innerHTML = `<span class="ve-fracture-top">${formattedText}</span><span class="ve-fracture-bottom">${formattedText}</span>`;
            shearTopEl = wordEl.querySelector(".ve-fracture-top");
            shearBottomEl = wordEl.querySelector(".ve-fracture-bottom");
          } else {
            wordEl.textContent = formattedText;
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
            springScale: new HarmonicSpring(1, 190, 22),
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
    showTitleCard(title, artist, artUrl) {
      if (!this.titleCardEl) return;
      const h = document.getElementById("ve-title-heading");
      const a = document.getElementById("ve-title-artist");
      const img = document.getElementById("ve-title-art");
      if (h) h.textContent = title;
      if (a) a.textContent = artist;
      if (img && artUrl) img.src = artUrl;
      this.titleCardEl.classList.add("is-visible");
    }
    hideTitleCard() {
      if (this.titleCardEl) {
        this.titleCardEl.classList.remove("is-visible");
      }
    }
    setInterludeVisible(visible) {
      if (this.interludeEl) {
        if (visible) this.interludeEl.classList.add("is-visible");
        else this.interludeEl.classList.remove("is-visible");
      }
    }
    toggleHud() {
      this.isHudVisible = !this.isHudVisible;
      if (this.devHudEl) {
        if (this.isHudVisible) this.devHudEl.classList.add("is-visible");
        else this.devHudEl.classList.remove("is-visible");
      }
    }
    updateHud(fps, low1Percent, frameMs, energy, beat, layers) {
      if (!this.isHudVisible) return;
      const f = document.getElementById("hud-fps");
      const l = document.getElementById("hud-low");
      const m = document.getElementById("hud-frame");
      const e = document.getElementById("hud-energy");
      const b = document.getElementById("hud-beat");
      const ly = document.getElementById("hud-layers");
      if (f) f.textContent = Math.round(fps).toString();
      if (l) l.textContent = Math.round(low1Percent).toString();
      if (m) m.textContent = frameMs.toFixed(1);
      if (e) e.textContent = energy.toFixed(2);
      if (b) b.textContent = beat.toFixed(2);
      if (ly) ly.textContent = layers.toString();
    }
    getCachedLines() {
      return this.cachedLines;
    }
    renderControlDock() {
      if (!this.controlPillEl) return;
      this.controlPillEl.innerHTML = `
      <button class="ve-dock-btn ${this.currentStyle === "convex" ? "active" : ""}" data-style="convex" title="Optical Dome (Hero Look)">Convex</button>
      <button class="ve-dock-btn ${this.currentStyle === "drift" ? "active" : ""}" data-style="drift" title="Unwrapped Ribbon">Drift</button>
      <button class="ve-dock-btn ${this.currentStyle === "editorial" ? "active" : ""}" data-style="editorial" title="Swiss Print Press">Editorial</button>
      <button class="ve-dock-btn ${this.currentStyle === "semantic" ? "active" : ""}" data-style="semantic" title="Living Typo-Physics">Semantic</button>

      <div class="ve-dock-divider"></div>

      <button class="ve-dock-btn ${this.currentPaletteType === "album" ? "active" : ""}" data-palette="album" title="OKLCH Album Art Sync">Album</button>
      <button class="ve-dock-btn ${this.currentPaletteType === "editorial" ? "active" : ""}" data-palette="editorial" title="Bone & Maroon Press">Editorial</button>
      <button class="ve-dock-btn ${this.currentPaletteType === "obsidian" ? "active" : ""}" data-palette="obsidian" title="Pure Dark OLED">Obsidian</button>

      <div class="ve-dock-divider"></div>

      <button class="ve-dock-btn ${this.rimEnabled ? "active" : ""}" id="ve-dock-rim-btn" title="Peripheral Bezel Bleed">${this.rimEnabled ? "Rim On" : "Rim Off"}</button>

      <div class="ve-dock-divider"></div>

      <button class="ve-dock-btn" id="ve-dock-sync-down" title="Retard sync 50ms">-50ms</button>
      <span style="font-size: 10px; opacity: 0.6;" id="ve-dock-sync-val">${this.clock.getSyncOffset()}ms</span>
      <button class="ve-dock-btn" id="ve-dock-sync-up" title="Advance sync 50ms">+50ms</button>

      <div class="ve-dock-divider"></div>

      <button class="ve-dock-btn" id="ve-dock-close" title="Exit Fullscreen (Esc)">\u2715</button>
    `;
      this.syncOffsetDisplayEl = document.getElementById("ve-dock-sync-val");
      this.controlPillEl.querySelectorAll("[data-style]").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          const style = e.currentTarget.getAttribute("data-style");
          this.currentStyle = style;
          try {
            localStorage.setItem("verse_engine_style", style);
          } catch {
          }
          this.applyStyleClass(style);
          this.renderControlDock();
          this.callbacks.onStyleChange(style);
        });
      });
      this.controlPillEl.querySelectorAll("[data-palette]").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          const palette = e.currentTarget.getAttribute("data-palette");
          this.currentPaletteType = palette;
          try {
            localStorage.setItem("verse_engine_palette", palette);
          } catch {
          }
          this.renderControlDock();
          this.callbacks.onPaletteChange(palette);
        });
      });
      const rimBtn = document.getElementById("ve-dock-rim-btn");
      rimBtn?.addEventListener("click", () => {
        this.rimEnabled = !this.rimEnabled;
        try {
          localStorage.setItem("verse_engine_rim", String(this.rimEnabled));
        } catch {
        }
        this.renderControlDock();
        this.callbacks.onRimToggle(this.rimEnabled);
      });
      document.getElementById("ve-dock-sync-down")?.addEventListener("click", () => {
        const val = this.clock.adjustSyncOffset(-50);
        if (this.syncOffsetDisplayEl) this.syncOffsetDisplayEl.textContent = `${val}ms`;
      });
      document.getElementById("ve-dock-sync-up")?.addEventListener("click", () => {
        const val = this.clock.adjustSyncOffset(50);
        if (this.syncOffsetDisplayEl) this.syncOffsetDisplayEl.textContent = `${val}ms`;
      });
      document.getElementById("ve-dock-close")?.addEventListener("click", () => {
        this.callbacks.onClose();
      });
    }
    bindActivityListeners() {
      const showPill = () => {
        if (this.controlPillEl) {
          this.controlPillEl.style.opacity = "1";
          this.controlPillEl.style.transform = "translateX(-50%) translateY(0)";
        }
        if (this.rootEl) {
          this.rootEl.style.cursor = "default";
        }
        if (this.hideTimeout !== null) {
          window.clearTimeout(this.hideTimeout);
        }
        this.hideTimeout = window.setTimeout(() => {
          if (this.controlPillEl) {
            this.controlPillEl.style.opacity = "0";
            this.controlPillEl.style.transform = "translateX(-50%) translateY(14px)";
          }
          if (this.rootEl) {
            this.rootEl.style.cursor = "none";
          }
        }, 2e3);
      };
      window.addEventListener("mousemove", showPill);
      window.addEventListener("mousedown", showPill);
      showPill();
    }
    unmount() {
      if (this.hideTimeout !== null) {
        window.clearTimeout(this.hideTimeout);
      }
      if (this.rootEl?.parentElement) {
        this.rootEl.parentElement.removeChild(this.rootEl);
      }
      this.rootEl = null;
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
    crossfader = null;
    currentTrack = null;
    currentStyle = "convex";
    currentPaletteType = "album";
    currentPalette = null;
    rimEnabled = true;
    boundKeyDownListener = null;
    boundVisibilityListener = null;
    constructor() {
      this.animationEngine = new AnimationEngine();
      this.webgl = new WebGLPostProcess();
      this.lyricProvider = LyricProvider.getInstance();
      this.clock = Clock.getInstance();
      this.bindKeyboardShortcuts();
      this.bindLifecycleEvents();
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
      console.log("[VerseEngine] v2.0.0 \u2014 Film-grade kinetic typography engine booting\u2026");
      await this.waitForSpicetify();
      this.injectButtons();
      this.bindTrackChangeListener();
      this.loadCurrentTrack();
      try {
        Spicetify.showNotification?.("VerseEngine Ready (Press Alt+L or Shift+D for HUD)");
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
    // ── Keyboard Shortcuts & Lifecycle Events ──────────────────────────────────
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
        } else if (e.shiftKey && (e.key === "D" || e.key === "d")) {
          e.preventDefault();
          this.stageView?.toggleHud();
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
    bindLifecycleEvents() {
      if (this.boundVisibilityListener) {
        document.removeEventListener("visibilitychange", this.boundVisibilityListener);
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
      document.addEventListener("visibilitychange", this.boundVisibilityListener);
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
      await this.clock.setTrackUri(trackItem.uri);
      try {
        const albumArtUrl = trackItem.album?.images?.[0]?.url ?? "";
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
        if (this.webgl) {
          await this.webgl.loadAlbumTexture(albumArtUrl);
        }
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
          if (this.crossfader) {
            this.crossfader.setTarget(pal);
          }
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
    closeStage() {
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
          stageView.getCachedLines(),
          track
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
