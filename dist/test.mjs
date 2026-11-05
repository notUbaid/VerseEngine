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
console.log("--- 1. Testing HarmonicSpring Solver ---");
{
  const spring = new HarmonicSpring(0, 180, 22);
  spring.setTarget(100);
  for (let i = 0; i < 60; i++) {
    spring.step(1 / 60);
  }
  assert(!isNaN(spring.position), "Spring position must not be NaN");
  assert(!isNaN(spring.velocity), "Spring velocity must not be NaN");
  assert(spring.position > 80 && spring.position < 120, `Spring moves toward target (got ${spring.position.toFixed(2)})`);
  for (let i = 0; i < 120; i++) {
    spring.step(1 / 60);
  }
  assert(Math.abs(spring.position - 100) < 0.1, `Spring settles near target 100 (got ${spring.position.toFixed(3)})`);
  const vec = new SpringVector2(0, 0, 120, 20);
  vec.setTarget(50, -30);
  for (let i = 0; i < 60; i++) {
    vec.step(1 / 60);
  }
  assert(vec.x.position > 35 && vec.y.position < -20, "2D Vector spring tracks coordinates correctly");
}
console.log("\n--- 2. Testing SemanticPhysics Lexicon & Unicode Sanitization ---");
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
console.log("\n--- 3. Testing LyricProvider Standard LRC Parser ---");
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
console.log("\n--- 4. Testing Enhanced LRC Parser & Word Durations ---");
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
console.log("\n--- 5. Testing Garbage Lyric Filtering ---");
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
