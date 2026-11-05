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
var Easing = {
  sineInOut(t) {
    return -(Math.cos(Math.PI * Math.max(0, Math.min(1, t))) - 1) / 2;
  },
  cubicOut(t) {
    const f = Math.max(0, Math.min(1, t)) - 1;
    return f * f * f + 1;
  },
  expoOut(t) {
    const clamped = Math.max(0, Math.min(1, t));
    return clamped === 1 ? 1 : 1 - Math.pow(2, -10 * clamped);
  }
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
    this.loadPersistentCache();
  }
  static getInstance() {
    if (!_LyricProvider.instance) {
      _LyricProvider.instance = new _LyricProvider();
    }
    return _LyricProvider.instance;
  }
  loadPersistentCache() {
    try {
      const serialized = localStorage.getItem("verse_engine_lyrics_cache_v2");
      if (serialized) {
        const parsed = JSON.parse(serialized);
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (item && item.uri && Array.isArray(item.lines)) {
              this.cache.set(item.uri, item);
            }
          }
        }
      }
    } catch {
    }
  }
  savePersistentCache() {
    try {
      const items = Array.from(this.cache.values()).slice(-40);
      localStorage.setItem("verse_engine_lyrics_cache_v2", JSON.stringify(items));
    } catch {
    }
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
  isAdOrPodcast(track) {
    const uri = track.uri || "";
    if (uri.includes(":episode:") || uri.includes(":show:") || uri.includes(":ad:")) {
      return true;
    }
    if (track.metadata?.is_advertisement === "true" || track.is_ad === true) {
      return true;
    }
    return false;
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
    if (this.isAdOrPodcast(track)) {
      const isPodcast = uri.includes(":episode:");
      const processed2 = {
        uri,
        title: isPodcast ? title : "Advertisement",
        artist: isPodcast ? artist : "Spotify Sponsor",
        album,
        albumArtUrl,
        durationMs,
        lines: [],
        hasLyrics: false,
        isAd: !isPodcast,
        isPodcast
      };
      return processed2;
    }
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
    let hasLyrics = true;
    if (wordSyncedLines && wordSyncedLines.length > 0) {
      lines = wordSyncedLines;
    } else if (rawLines && rawLines.length > 0) {
      lines = this.synthesizeLines(rawLines);
    } else {
      hasLyrics = false;
      lines = [];
    }
    const processed = {
      uri,
      title,
      artist,
      album,
      albumArtUrl,
      durationMs,
      lines,
      hasLyrics
    };
    if (hasLyrics && lines.length > 0) {
      this.cache.set(uri, processed);
      this.savePersistentCache();
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
    const cleanTitle = title.replace(/\s*-\s*.*$/, "").replace(/\(feat\..*?\)/i, "").trim();
    const durationSec = Math.round(durationMs / 1e3);
    const getUrl = `https://lrclib.net/api/get?track_name=${encodeURIComponent(cleanTitle)}&artist_name=${encodeURIComponent(artist)}&duration=${durationSec}`;
    try {
      const res = await fetch(getUrl, {
        headers: { "Lrclib-Client": "VerseEngine-Spicetify v2.0.0 (https://github.com/notUbaid/VerseEngine)" }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.syncedLyrics) {
          const parsed = this.parseLrclibResponse(data);
          if (parsed) return parsed;
        }
      }
    } catch {
    }
    const searchUrl = `https://lrclib.net/api/search?track_name=${encodeURIComponent(cleanTitle)}&artist_name=${encodeURIComponent(artist)}`;
    try {
      const res = await fetch(searchUrl, {
        headers: { "Lrclib-Client": "VerseEngine-Spicetify v2.0.0 (https://github.com/notUbaid/VerseEngine)" }
      });
      if (res.ok) {
        const results = await res.json();
        if (Array.isArray(results) && results.length > 0) {
          const match = results.find(
            (r) => r.syncedLyrics && Math.abs(r.duration - durationSec) <= 4
          );
          if (match) {
            return this.parseLrclibResponse(match);
          }
        }
      }
    } catch {
    }
    return null;
  }
  parseLrclibResponse(data) {
    try {
      if (!data.syncedLyrics) return null;
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
   * Phonetic Word & Letter Timing Synthesizer
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
};

// test/unit-tests.ts
var passed = 0;
var failed = 0;
function assert(condition, message) {
  if (condition) {
    console.log(`  \u2713 ${message}`);
    passed++;
  } else {
    console.error(`  \u2717 FAIL: ${message}`);
    failed++;
  }
}
console.log("--- 1. Testing Motion Tokens, Easing & Fixed-Step Accumulator ---");
{
  const soft = HarmonicSpring.fromPreset("soft", 0);
  const snappy = HarmonicSpring.fromPreset("snappy", 0);
  const heavy = HarmonicSpring.fromPreset("heavy", 0);
  const float = HarmonicSpring.fromPreset("float", 0);
  assert(snappy.stiffness > heavy.stiffness, "Snappy spring has higher stiffness than heavy");
  assert(heavy.damping > soft.damping, "Heavy spring has higher damping than soft");
  assert(float.stiffness < soft.stiffness, "Float spring has lowest stiffness for smooth drift");
  assert(Easing.sineInOut(0) === 0 && Math.abs(Easing.sineInOut(1) - 1) < 1e-3, "sineInOut bounds 0..1");
  assert(Easing.cubicOut(0) === 0 && Easing.cubicOut(1) === 1, "cubicOut bounds 0..1");
  assert(Easing.expoOut(0) === 0 && Easing.expoOut(1) === 1, "expoOut bounds 0..1");
  const acc = new FixedStepAccumulator();
  let stepCount = 0;
  acc.update(1 / 60, (fixedDt) => {
    assert(Math.abs(fixedDt - 1 / 240) < 1e-4, "Fixed step callback receives exactly 1/240s");
    stepCount++;
  });
  assert(stepCount === 4, `1/60s accumulates exactly 4 physics steps at 1/240s (got ${stepCount})`);
}
console.log("\n--- 2. Testing OKLCH Color Conversion & Palette Crossfader ---");
{
  const oklchRed = rgbToOklch(1, 0, 0);
  assert(oklchRed.l > 0.5 && oklchRed.l < 0.7, `OKLCH Lightness of red is in valid perceptual range (${oklchRed.l.toFixed(3)})`);
  assert(oklchRed.c > 0.2, `OKLCH Chroma of pure red is high (${oklchRed.c.toFixed(3)})`);
  const rgbRoundtrip = oklchToRgb(oklchRed.l, oklchRed.c, oklchRed.h);
  assert(Math.abs(rgbRoundtrip.r - 1) < 0.02, `Roundtrip red R is ~1.0 (${rgbRoundtrip.r.toFixed(3)})`);
  assert(Math.abs(rgbRoundtrip.g - 0) < 0.02, `Roundtrip red G is ~0.0 (${rgbRoundtrip.g.toFixed(3)})`);
  assert(Math.abs(rgbRoundtrip.b - 0) < 0.02, `Roundtrip red B is ~0.0 (${rgbRoundtrip.b.toFixed(3)})`);
  const palA = {
    type: "album",
    primary: "rgb(200, 20, 40)",
    secondary: "rgb(120, 20, 30)",
    highlight: "#FAF9F6",
    bg: "rgb(10, 8, 10)",
    textInactive: "rgba(250, 249, 246, 0.28)",
    isDark: true,
    dominant: "rgb(200, 20, 40)",
    accent: "rgb(240, 60, 80)",
    shadow: "rgb(10, 8, 10)",
    tint: "#FAF9F6",
    rgbDominant: [0.8, 0.1, 0.15],
    rgbAccent: [0.95, 0.25, 0.3],
    rgbShadow: [0.04, 0.03, 0.04],
    rgbHighlight: [0.98, 0.98, 0.96],
    rgbBg: [0.04, 0.03, 0.04]
  };
  const palB = {
    ...palA,
    rgbDominant: [0.1, 0.8, 0.2],
    rgbAccent: [0.2, 0.95, 0.4]
  };
  const crossfader = new PaletteCrossfader(palA);
  crossfader.setTarget(palB);
  const mid = crossfader.update(0.6);
  assert(!crossfader.isComplete(), "Crossfader is not yet complete at 0.6s");
  assert(mid.rgbDominant[0] < 0.8 && mid.rgbDominant[0] > 0.1, `Dominant R interpolates smoothly (${mid.rgbDominant[0].toFixed(2)})`);
  const finalPal = crossfader.update(0.6);
  assert(crossfader.isComplete(), "Crossfader completes at 1.2s");
  assert(Math.abs(finalPal.rgbDominant[0] - 0.1) < 0.01, "Dominant R reaches target at 1.2s");
}
console.log("\n--- 3. Testing SemanticPhysics Lexicon & Unicode Sanitization ---");
{
  assert(sanitizeWord("Shattered!") === "shattered", "sanitizeWord strips punctuation and lowercases ASCII");
  assert(sanitizeWord("caf\xE9") === "caf\xE9", "sanitizeWord preserves accented Latin characters (caf\xE9)");
  assert(sanitizeWord("\u092A\u094D\u092F\u093E\u0930!") === "\u092A\u094D\u092F\u093E\u0930", "sanitizeWord preserves Devanagari characters (\u092A\u094D\u092F\u093E\u0930)");
  assert(sanitizeWord("\u4F60\u597D\uFF0C\u4E16\u754C\uFF01") === "\u4F60\u597D\u4E16\u754C", "sanitizeWord preserves CJK characters (\u4F60\u597D\u4E16\u754C)");
  assert(matchSemanticEffect("shattered") === "FRACTURE", "shattered maps to FRACTURE");
  assert(matchSemanticEffect("falling") === "GRAVITY", "falling maps to GRAVITY");
  assert(matchSemanticEffect("drown") === "GRAVITY", "drown maps to GRAVITY");
  assert(matchSemanticEffect("smoke") === "FADE", "smoke maps to FADE");
  assert(matchSemanticEffect("ghostly") === "FADE", "ghostly maps to FADE");
  assert(matchSemanticEffect("echoes") === "ECHO", "echoes maps to ECHO");
  assert(matchSemanticEffect("screaming") === "ECHO", "screaming maps to ECHO");
  assert(matchSemanticEffect("heartbeat") === "PULSE", "heartbeat maps to PULSE");
  assert(matchSemanticEffect("sunlight") === "PULSE", "sunlight maps to PULSE");
  assert(matchSemanticEffect("love") === "NONE", '"love" is neutral to avoid visual clutter');
  assert(matchSemanticEffect("light") === "NONE", '"light" is neutral to avoid visual clutter');
  assert(matchSemanticEffect("down") === "NONE", '"down" is neutral to avoid visual clutter');
  assert(matchSemanticEffect("telephone") === "NONE", "neutral word maps to NONE");
}
console.log("\n--- 4. Testing LyricProvider Standard LRC Parser ---");
{
  const provider = LyricProvider.getInstance();
  const pAny = provider;
  const rawLrc = `
[00:10.50][00:25.00]Repeated line with multiple timestamps
[01:15]Line without fraction
[01:20.80]Normal line (yeah)
`;
  const parsed = pAny.parseStandardLrc(rawLrc);
  assert(parsed.length === 4, `Parsed 4 lines total (multiple timestamps expanded)`);
  assert(parsed[0].timeMs === 10500, `First timestamp at 10500ms`);
  assert(parsed[1].timeMs === 25e3, `Repeated line timestamp sorted at 25000ms`);
  assert(parsed[2].timeMs === 75e3, `Fraction-less timestamp [01:15] parsed as 75000ms`);
  assert(parsed[3].timeMs === 80800, `Fraction timestamp [01:20.80] parsed as 80800ms`);
  const synthesized = pAny.synthesizeLines(parsed);
  assert(synthesized.length === 4, `synthesizeLines produced 4 lines`);
  const line3 = synthesized[3];
  const adLibWord = line3.words.find((w) => w.text === "(yeah)");
  assert(adLibWord !== void 0, 'Ad-lib "(yeah)" is present in words');
  assert(adLibWord?.isAdLib === true, 'Ad-lib "(yeah)" is flagged as isAdLib === true');
  assert(line3.adLibs.length === 0, "Ad-lib is NOT duplicated into line.adLibs (prevents double-rendering)");
  const intlLrc = `
[00:05.00]\u092E\u0947\u0930\u093E \u092A\u094D\u092F\u093E\u0930 \u0938\u091A\u094D\u091A\u093E \u0939\u0948
[00:10.00]\u591C\u7A7A\u306B\u8F1D\u304F\u661F
`;
  const intlParsed = pAny.parseStandardLrc(intlLrc);
  const intlSynthesized = pAny.synthesizeLines(intlParsed);
  assert(intlSynthesized.length === 2, "International lyrics parsed into 2 lines");
  const hindiLine = intlSynthesized[0];
  const hindiWords = hindiLine.words.map((w) => w.text);
  assert(hindiWords.includes("\u092A\u094D\u092F\u093E\u0930"), 'Devanagari word "\u092A\u094D\u092F\u093E\u0930" segmented with intact conjuncts');
  const cjkLine = intlSynthesized[1];
  assert(cjkLine.words.length >= 2, "CJK line segmented into multiple tokens (not one giant word)");
}
console.log("\n--- 5. Testing Enhanced LRC Parser & Word Durations ---");
{
  const provider = LyricProvider.getInstance();
  const pAny = provider;
  const enhLrc = `[00:04.20]<00:04.20>Hello <00:04.70>darkness <00:05.20>my <00:05.60>old <00:06.00>friend`;
  const enhLines = pAny.parseEnhancedLrc(enhLrc);
  assert(enhLines.length === 1, "Enhanced LRC parsed 1 line");
  const line = enhLines[0];
  assert(line.words.length === 5, "Line has 5 words");
  const wHello = line.words[0];
  assert(wHello.startMs === 4200, '"Hello" starts at 4200ms');
  assert(wHello.durationMs === 500, `"Hello" duration is exactly 500ms (got ${wHello.durationMs}ms)`);
  const wDarkness = line.words[1];
  assert(wDarkness.startMs === 4700, '"darkness" starts at 4700ms');
  assert(wDarkness.durationMs === 500, `"darkness" duration is 500ms (got ${wDarkness.durationMs}ms)`);
}
console.log("\n--- 6. Testing Garbage Lyric Filtering ---");
{
  assert(isGarbageLyricLine("00:00"), "00:00 is detected as garbage timestamp");
  assert(isGarbageLyricLine("00:16"), "00:16 is detected as garbage timestamp");
  assert(isGarbageLyricLine("[01:23.45]"), "[01:23.45] is detected as garbage timestamp");
  assert(isGarbageLyricLine("\u266A"), "\u266A musical note is detected as garbage");
  assert(isGarbageLyricLine("---"), "--- dashes are detected as garbage");
  assert(isGarbageLyricLine("(Instrumental)"), "(Instrumental) label is detected as garbage");
  assert(isGarbageLyricLine("   "), "whitespace is detected as garbage");
  assert(!isGarbageLyricLine("Yeah, she from Texas"), "Valid lyric line is NOT marked as garbage");
  assert(!isGarbageLyricLine("I want you"), "Valid lyric line is NOT marked as garbage");
}
console.log(`
========================================`);
console.log(`Tests: ${passed} passed, ${failed} failed`);
console.log(`========================================`);
if (failed > 0) {
  process.exit(1);
}
