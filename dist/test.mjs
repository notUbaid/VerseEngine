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
    "fall",
    "falling",
    "falls",
    "fallen",
    "fell",
    "drop",
    "dropping",
    "drops",
    "dropped",
    "sink",
    "sinking",
    "sinks",
    "sank",
    "sunk",
    "down",
    "downward",
    "downwards",
    "heavy",
    "heavier",
    "heavily",
    "heaviest",
    "drown",
    "drowning",
    "drowned",
    "drowns",
    "low",
    "lower",
    "lowest",
    "bottom",
    "floor",
    "knees",
    "ground",
    "dirt",
    "depth",
    "deep",
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
    "beneath"
  ],
  FRACTURE: [
    "break",
    "breaking",
    "broken",
    "breaks",
    "shatter",
    "shattered",
    "shattering",
    "cut",
    "cutting",
    "cuts",
    "split",
    "splitting",
    "splits",
    "tear",
    "tearing",
    "torn",
    "tore",
    "tears",
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
    "piece",
    "pieces",
    "fragment",
    "splinter",
    "rupture",
    "wound"
  ],
  FADE: [
    "fade",
    "fading",
    "faded",
    "fades",
    "ghost",
    "ghostly",
    "ghosts",
    "smoke",
    "smoky",
    "smoking",
    "lost",
    "lose",
    "losing",
    "memory",
    "memories",
    "blur",
    "blurred",
    "blurry",
    "vanish",
    "vanished",
    "vanishing",
    "gone",
    "depart",
    "departed",
    "dust",
    "mist",
    "haze",
    "vapor",
    "shadow",
    "disappear",
    "evaporate",
    "dissolve",
    "erase",
    "forget",
    "forgot",
    "forgotten",
    "breath",
    "wind"
  ],
  ECHO: [
    "echo",
    "echoing",
    "echoes",
    "echoed",
    "again",
    "repeat",
    "repeated",
    "repeating",
    "call",
    "calling",
    "called",
    "calls",
    "scream",
    "screaming",
    "screamed",
    "screams",
    "voice",
    "voices",
    "shout",
    "shouting",
    "howl",
    "replay",
    "resound",
    "reverberate",
    "ringing",
    "rings",
    "whisper",
    "chorus",
    "chant"
  ],
  PULSE: [
    "heart",
    "hearts",
    "heartbeat",
    "blood",
    "bleed",
    "pulse",
    "pulsing",
    "fire",
    "fiery",
    "fires",
    "burn",
    "burning",
    "burned",
    "burnt",
    "burns",
    "sun",
    "sunny",
    "sunlight",
    "light",
    "lit",
    "lighting",
    "lights",
    "gold",
    "golden",
    "love",
    "loved",
    "loving",
    "flame",
    "flames",
    "warm",
    "warmth",
    "glow",
    "blaze",
    "ignite",
    "sparks",
    "fever",
    "radiate"
  ]
};
var STEM_MAP = /* @__PURE__ */ new Map();
for (const [effect, stems] of Object.entries(SEMANTIC_STEMS)) {
  for (const stem of stems) {
    STEM_MAP.set(stem.toLowerCase(), effect);
  }
}
function sanitizeWord(word) {
  return word.toLowerCase().replace(/[^\w]/g, "").trim();
}
function matchSemanticEffect(rawWord) {
  const clean = sanitizeWord(rawWord);
  if (!clean || clean.length < 2) return "NONE";
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
var VOWEL_REGEX = /[aeiouyAEIOUY]/;
var PUNCTUATION_END_REGEX = /[.,!?;:…'"]$/;
function isGarbageLyricLine(text) {
  if (!text) return true;
  const trimmed = text.trim();
  if (trimmed.length === 0) return true;
  if (/^\[?\d{1,2}:\d{2}(\.\d{1,3})?\]?$/.test(trimmed)) return true;
  if (/^[♪♫♬\s\-_–—•·.…\*\#\(\)]+$/.test(trimmed)) return true;
  if (/^(\(|\[)?(instrumental|intro|outro|break|solo|music)(\)|\])?$/i.test(trimmed)) return true;
  return false;
}
var LyricProvider = class _LyricProvider {
  static instance = null;
  cache = /* @__PURE__ */ new Map();
  constructor() {
  }
  static getInstance() {
    if (!_LyricProvider.instance) {
      _LyricProvider.instance = new _LyricProvider();
    }
    return _LyricProvider.instance;
  }
  async getTrackLyrics(track) {
    const uri = track.uri;
    if (this.cache.has(uri)) {
      return this.cache.get(uri);
    }
    const title = track.name || "";
    const artist = track.artists?.[0]?.name || "";
    const album = track.album?.name || "";
    const albumArtUrl = track.album?.images?.[0]?.url || "";
    const durationMs = track.duration?.milliseconds || 18e4;
    const trackId = this.getTrackId(uri);
    let rawLines = null;
    let wordSyncedLines = null;
    try {
      const spotifyLyrics = await this.fetchSpotifyLyrics(trackId);
      if (spotifyLyrics && spotifyLyrics.length > 0) {
        rawLines = spotifyLyrics;
      }
    } catch {
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
      } catch {
      }
    }
    let lines = [];
    if (wordSyncedLines && wordSyncedLines.length > 0) {
      lines = wordSyncedLines;
    } else if (rawLines && rawLines.length > 0) {
      lines = this.synthesizeLines(rawLines);
    } else {
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
    this.cache.set(uri, processed);
    return processed;
  }
  getTrackId(uri) {
    const parts = uri.split(":");
    return parts[parts.length - 1] || "";
  }
  async fetchSpotifyLyrics(trackId) {
    if (!trackId || typeof Spicetify === "undefined" || !Spicetify.CosmosAsync) return null;
    const url = `https://spclient.wg.spotify.com/color-lyrics/v2/track/${trackId}?format=json&vocalRemoval=false`;
    const res = await Spicetify.CosmosAsync.get(url);
    if (res?.lyrics?.lines && Array.isArray(res.lyrics.lines)) {
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
      let res = await fetch(getUrl, {
        headers: { "User-Agent": "VerseEngine/2.0.0 (Spicetify Extension)" }
      });
      let data = null;
      if (res.ok) {
        data = await res.json();
      } else {
        const searchUrl = `https://lrclib.net/api/search?track_name=${encodeURIComponent(title)}&artist_name=${encodeURIComponent(artist)}`;
        const searchRes = await fetch(searchUrl, {
          headers: { "User-Agent": "VerseEngine/2.0.0 (Spicetify Extension)" }
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
        const text = data.syncedLyrics;
        if (text.includes("<") && text.includes(">")) {
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
    }
    return null;
  }
  parseStandardLrc(lrc) {
    const lines = [];
    const regex = /\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/;
    for (const raw of lrc.split("\n")) {
      const match = regex.exec(raw);
      if (match) {
        const min = parseInt(match[1], 10);
        const sec = parseInt(match[2], 10);
        const fracStr = match[3];
        const ms = fracStr.length === 2 ? parseInt(fracStr, 10) * 10 : parseInt(fracStr, 10);
        const timeMs = min * 6e4 + sec * 1e3 + ms;
        const text = match[4].trim();
        if (text && !isGarbageLyricLine(text)) {
          lines.push({ timeMs, text });
        }
      }
    }
    return lines.sort((a, b) => a.timeMs - b.timeMs);
  }
  parseEnhancedLrc(lrc) {
    const lines = [];
    const lineRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/;
    const wordRegex = /<(\d{2}):(\d{2})\.(\d{2,3})>([^<]+)/g;
    const rows = lrc.split("\n");
    let lIdx = 0;
    for (const row of rows) {
      const match = lineRegex.exec(row);
      if (!match) continue;
      const min = parseInt(match[1], 10);
      const sec = parseInt(match[2], 10);
      const frac = match[3];
      const lineStartMs = min * 6e4 + sec * 1e3 + (frac.length === 2 ? parseInt(frac, 10) * 10 : parseInt(frac, 10));
      const rest = match[4];
      const words = [];
      const adLibs = [];
      let wordMatch;
      let lastEnd = lineStartMs;
      while ((wordMatch = wordRegex.exec(rest)) !== null) {
        const wMin = parseInt(wordMatch[1], 10);
        const wSec = parseInt(wordMatch[2], 10);
        const wFrac = wordMatch[3];
        const wStart = wMin * 6e4 + wSec * 1e3 + (wFrac.length === 2 ? parseInt(wFrac, 10) * 10 : parseInt(wFrac, 10));
        const token = wordMatch[4].trim();
        if (token) {
          const wDuration = Math.max(80, wStart - lastEnd);
          const clean = sanitizeWord(token);
          const isAdLib = this.isParentheticalAdLib(token);
          const semanticEffect = matchSemanticEffect(token);
          const isMelisma = wDuration >= 600 && clean.length >= 2;
          const chars = this.subdivideChars(token, wStart, wDuration);
          const wObj = {
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
  synthesizeLines(rawLines) {
    const lines = [];
    for (let i = 0; i < rawLines.length; i++) {
      const cur = rawLines[i];
      const next = i < rawLines.length - 1 ? rawLines[i + 1] : null;
      const text = cur.text.trim();
      const charCount = text.length;
      const vocalDuration = next ? Math.min(next.timeMs - cur.timeMs - 100, Math.max(1600, charCount * 68)) : Math.max(1600, charCount * 68);
      const lineStartMs = cur.timeMs;
      const lineEndMs = lineStartMs + vocalDuration;
      const rawTokens = text.split(/\s+/).filter(Boolean);
      const words = [];
      const adLibs = [];
      const weights = rawTokens.map((token) => {
        const chars = Array.from(token);
        let weight = 0;
        for (const c of chars) {
          if (VOWEL_REGEX.test(c)) {
            weight += 1.6;
          } else {
            weight += 1;
          }
        }
        if (PUNCTUATION_END_REGEX.test(token)) {
          weight += 1.8;
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
        if (wEnd <= wStart) wEnd = wStart + 100;
        const wDuration = wEnd - wStart;
        const clean = sanitizeWord(token);
        const isAdLib = this.isParentheticalAdLib(token);
        const semanticEffect = matchSemanticEffect(token);
        const isMelisma = wDuration >= 600 && clean.length >= 2;
        const chars = this.subdivideChars(token, wStart, wDuration);
        const wordObj = {
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
  subdivideChars(wordText, wordStartMs, wordDurationMs) {
    const chars = Array.from(wordText);
    const weights = chars.map((c) => {
      if (VOWEL_REGEX.test(c)) return 1.6;
      if (/[.,!?;:…'"]/.test(c)) return 0.4;
      return 1;
    });
    const totalWeight = weights.reduce((sum, w) => sum + w, 0) || 1;
    const result = [];
    let curStart = wordStartMs;
    chars.forEach((char, index) => {
      const cDuration = Math.max(12, Math.round(weights[index] / totalWeight * wordDurationMs));
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
  isParentheticalAdLib(token) {
    const t = token.trim();
    if (t.startsWith("(") || t.endsWith(")") || t.startsWith("[") || t.endsWith("]")) {
      return true;
    }
    const clean = sanitizeWord(t);
    return ["yeah", "yea", "ooh", "oooh", "ahh", "ahhh", "woah", "whoa", "hey", "uh"].includes(clean);
  }
  generateFallbackLines(title, artist, durationMs) {
    const demo = [
      { timeMs: Math.round(durationMs * 0.1), text: title },
      { timeMs: Math.round(durationMs * 0.35), text: artist },
      { timeMs: Math.round(durationMs * 0.65), text: "Instrumental" }
    ];
    return this.synthesizeLines(demo);
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
console.log("\n--- 2. Testing SemanticPhysics Lexicon ---");
{
  assert(sanitizeWord("Shattered!") === "shattered", "sanitizeWord strips punctuation and lowercases");
  assert(matchSemanticEffect("shattered") === "FRACTURE", "shattered maps to FRACTURE");
  assert(matchSemanticEffect("falling") === "GRAVITY", "falling maps to GRAVITY");
  assert(matchSemanticEffect("drown") === "GRAVITY", "drown maps to GRAVITY");
  assert(matchSemanticEffect("smoke") === "FADE", "smoke maps to FADE");
  assert(matchSemanticEffect("ghostly") === "FADE", "ghostly maps to FADE");
  assert(matchSemanticEffect("echoes") === "ECHO", "echoes maps to ECHO");
  assert(matchSemanticEffect("screaming") === "ECHO", "screaming maps to ECHO");
  assert(matchSemanticEffect("heartbeat") === "PULSE", "heartbeat maps to PULSE");
  assert(matchSemanticEffect("sunlight") === "PULSE", "sunlight maps to PULSE");
  assert(matchSemanticEffect("telephone") === "NONE", "neutral word maps to NONE");
}
console.log("\n--- 3. Testing LyricProvider Synthesizer ---");
{
  const provider = LyricProvider.getInstance();
  const pAny = provider;
  const rawLrc = `
[00:12.50]First line of lyrics
[00:15.80]Second line of lyrics (yeah)
[00:20.00]Third line ending with period.
`;
  const parsed = pAny.parseStandardLrc(rawLrc);
  assert(parsed.length === 3, `parseStandardLrc parsed 3 lines (got ${parsed.length})`);
  assert(parsed[0].timeMs === 12500, `First line starts at 12500ms (got ${parsed[0].timeMs})`);
  assert(parsed[1].timeMs === 15800, `Second line starts at 15800ms (got ${parsed[1].timeMs})`);
  const synthesized = pAny.synthesizeLines(parsed);
  assert(synthesized.length === 3, `synthesizeLines created 3 lines (got ${synthesized.length})`);
  const line1 = synthesized[0];
  assert(line1.words.length === 4, `Line 1 has 4 words (got ${line1.words.length})`);
  assert(line1.words[0].cleanText === "first", 'Word 1 text is "first"');
  assert(line1.words[0].chars.length === 5, 'Word "first" has 5 chars');
  assert(line1.words[0].chars[0].char === "F", 'Char 1 is "F"');
  const line2 = synthesized[1];
  assert(line2.adLibs.length === 1, `Line 2 separated "(yeah)" into ad-lib (got ${line2.adLibs.length})`);
  assert(line2.adLibs[0].cleanText === "yeah", 'Ad-lib clean text is "yeah"');
  const word = line1.words[0];
  const charDurations = word.chars.map((c) => c.durationMs);
  const vowelDur = word.chars[1].durationMs;
  const consDur = word.chars[0].durationMs;
  assert(vowelDur > consDur, `Vowels receive more weight than consonants (${vowelDur}ms > ${consDur}ms)`);
}
console.log("\n--- 4. Testing Garbage Lyric Filtering ---");
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
