# VERSE//ENGINE: Architectural Specification and System Design

> **Hardware-Accelerated Kinetic Typography and Ethereal Optical Visualizer for Spotify Desktop**
> Compatible with Spotify Desktop via Spicetify CLI (Windows / macOS / Linux).

---

## 1. System Philosophy

**VERSE//ENGINE** is a hardware-accelerated, chromeless, fullscreen kinetic lyrics visualizer for Spotify Desktop. It transforms standard line-synced lyrics into 120fps/144Hz word-by-word and letter-by-letter typographic choreography, inspired by the high-craft aesthetics of optical typography and ambient lighting systems.

### Core Invariants
1. **Zero Dashboard Chrome**: No sidebars, cards, boxes, 1px solid grid borders, BPM tickers, or monospace status telemetry during lyric playback. When idle for 2 seconds, the screen contains only pure background, ambient rim light, and monumental typography.
2. **Zero React in the Animation Loop**: React is completely eliminated from the animation loop. DOM initialization occurs once per track; all continuous kinetic transformations execute in a vanilla TypeScript `AnimationEngine` via `requestAnimationFrame` mutating pre-cached DOM nodes and WebGL uniforms with dirty checking.
3. **Continuous Kinetic Physics**: Words do not use abrupt transitions or stepped opacity jumps. Coordinates are driven by a semi-implicit Euler damped harmonic spring solver controlling vertical offset, scale, liquid gradient sweep, and optical glow.
4. **No Emojis**: All emotional resonance is expressed purely through typographic physics, optical shaders, and palette geometry.

---

## 2. Directory Layout and Module Boundaries

```text
verse-engine/
├── package.json                   # Zero-dependency runtime, typecheck, build, test scripts
├── tsconfig.json                  # Strict TypeScript configuration
├── build.mjs                      # Cross-platform esbuild bundler -> IIFE bundle + auto-deploy
├── ARCHITECTURE.md                # System architecture specification
├── LICENSE                        # MIT License
├── test/
│   ├── unit-tests.ts              # 49 deterministic unit tests
│   └── run-tests.mjs              # Test runner
├── dist/
│   └── verse-engine.js            # Compiled production bundle (~98 KB self-contained IIFE)
└── src/
    ├── app.ts                     # Entry point, Spicetify button injection, keyboard shortcuts
    ├── types/
    │   ├── lyrics.ts              # AST: LyricChar, LyricWord, LyricLine, ProcessedTrack
    │   └── spicetify.d.ts         # Type definitions for Spicetify APIs
    ├── engine/
    │   ├── Clock.ts               # 144Hz drift-corrected interpolated playback clock
    │   ├── SpringSolver.ts        # HarmonicSpring & SpringVector2 (semi-implicit Euler)
    │   ├── SemanticPhysics.ts     # Curated lexicon for concrete semantic physics
    │   ├── AmbientLight.ts        # 16-bucket RGB quantization palette extractor with contrast limits
    │   ├── WebGLPostProcess.ts    # WebGL2 Ethereal Liquid Aurora Background shader
    │   └── AnimationEngine.ts     # Pure vanilla 144Hz RAF loop with direct DOM mutations
    ├── lyrics/
    │   └── LyricProvider.ts       # Multi-source waterfall + Phonetic Synthesizer + Intl.Segmenter
    └── ui/
        └── StageView.ts           # Chromeless DOM builder, Lumn bezel rim, auto-hiding pill
```

---

## 3. High-Precision Interpolated Clock (`src/engine/Clock.ts`)

### The Problem
Spotify's native `Spicetify.Player.getProgress()` polls asynchronously every ~250ms–500ms. Binding character animations directly to raw progress produces jerky, stepped transitions.

### The Solution
`Clock` implements an interpolated high-resolution timekeeper synchronized with `performance.now()`:

$$\text{CurrentMs}(t) = \text{LastSpotifyMs} + (t - t_{\text{sample}}) + \text{SyncOffset}$$

- **Hard-Snap Threshold ($\ge 60\text{ ms}$)**: When user seeks, skips, or buffers, the clock snaps immediately to avoid lagging behind.
- **Exponential Smoothing Drift Correction ($> 3\text{ ms}$)**: Minor discrepancies are absorbed smoothly without micro-stuttering:
  $$\text{LastSpotifyMs} \leftarrow \text{LastSpotifyMs} + (\text{PolledProgress} - \text{Estimated}) \times 0.2$$
- **Persistent Offset Micro-Adjustment**: Users can tune audio-to-visual latency by $\pm 50\text{ ms}$ directly from the control pill, stored in `localStorage['verse_engine_sync_offset']`.

---

## 4. Multi-Source Lyric Pipeline and Phonetic Synthesizer (`src/lyrics/LyricProvider.ts`)

Lyrics are fetched through a 3-tier waterfall:

```
[Song Change Event]
        │
        ▼
Tier 1: Spicetify Color-Lyrics (wg.spotify.com/color-lyrics/v2/track/...)
        │  (Fastest & Native; Syllable/Line Synced)
        ├── Found? ──► Normalize & Synthesize AST
        │
        ▼ Not Found / Empty
Tier 2: LRCLIB API (https://lrclib.net/api/get -> /api/search)
        │  (Open database with millions of enhanced and synced tracks)
        ├── Found? ──► Parse standard/enhanced LRC
        │
        ▼ Not Found
Tier 3: Ambient Instrumental Fallback (Generates structured section break markers)
```

### The Phonetic Word and Letter Synthesizer
When tracks only provide line timestamps, `LyricProvider` synthesizes sub-millisecond word and character boundaries:

1. **Active Vocal Window Calculation**:
   $$\text{Duration} = \min(\text{NextLineStart} - \text{CurrentLineStart} - 80\text{ ms},\; \max(1400\text{ ms},\; N_{\text{chars}} \times 65\text{ ms}))$$
2. **Phonetic Weighting**:
   - Vowels (`a, e, i, o, u, y`): **$1.6\times$ weight**
   - Consonants: **$1.0\times$ weight**
   - Terminal Punctuation (`. , ! ? ; :`): **$+1.4\times$ weight**
3. **International Script Segmentation**:
   - Uses `Intl.Segmenter` to properly segment complex scripts like Devanagari (preserving conjuncts in `प्यार`) and unspaced CJK logograms without character corruption.
4. **Ad-Lib Handling**:
   - Parenthetical vocalizations (e.g., `(yeah)`, `(ooh)`, `(hey)`) are flagged inline (`isAdLib: true`) with distinct typographic styling without duplicating DOM nodes.

---

## 5. Damped Harmonic Spring Solver (`src/engine/SpringSolver.ts`)

All dynamic coordinates use **semi-implicit Euler integration** for unconditional numerical stability:

```typescript
const springForce  = -stiffness * (position - target);
const dampingForce = -damping * velocity;
const acceleration = (springForce + dampingForce) / mass;

velocity += acceleration * dt;
position += velocity * dt;
```

### Physics Tunings
| Parameter | Stiffness ($k$) | Damping ($c$) | Mass ($m$) | Purpose |
|:---|:---:|:---:|:---:|:---|
| Word Scale | $150$ | $24$ | $1.0$ | Gentle magnification pulse ($1.0 \to 1.15$) |
| Liquid Sweep Progress | $200$ | $22$ | $1.0$ | Sub-pixel fluid ink illumination |
| Word 3D Depth ($Z$) | $140$ | $22$ | $1.0$ | Smooth optical glide toward the glass |
| Stage Y Centering | $110$ | $19$ | $1.0$ | Continuous active-line centering |
| Camera XY Chaser | $95$ | $18$ | $1.0$ | Horizontal ribbon camera tracking |

---

## 6. The 4 Kinetic Typography Styles

### 1. Convex Glass (`convex`)
Simulates viewing lyrics through a curved optical lens:
- Words near the active vocal timepoint curve forward to $Z = +60\text{ px}$, scale $1.32$, with zero blur.
- Words receding in time curve backward along a smooth Gaussian lens.
- `perspective(900px)` is applied directly inside each word's transform to prevent Chromium 3D flattening bugs.
- Continuous organic bloom transitions smoothly without abrupt pops.

### 2. Drifting Wall (`drift`)
- Monolithic, all-caps display typography (`Syne 800`).
- Lines form a continuous horizontal ribbon (`white-space: nowrap`).
- Virtual 144Hz camera smoothly tracks the active word center across lines without snapping back or abrupt jumps.

### 3. Editorial Swiss Press (`editorial`)
- Classic bone-white (`#FAF9F6`) and oxblood maroon (`#5C1421`) printing press aesthetic.
- Pairing of geometric grotesque with Italian serif italics (*Instrument Serif*).
- Active lines feature an animated baseline progress rule.
- Melisma note-stretch uses GPU `scaleX()` instead of layout-reflowing letter-spacing.
- Automatically bypasses dark WebGL overlays for an authentic paper aesthetic.

### 4. Living Semantics (`semantic`)
Words trigger concrete physical responses based on `SemanticPhysics.ts`:
- **`GRAVITY`** (`fall`, `drop`, `sink`, `heavy`, `drown`): Word physically sinks below the baseline with a physical spring.
- **`FRACTURE`** (`shatter`, `split`, `crash`, `crack`, `snap`): Word shears into twin diagonal clip-path layers.
- **`FADE`** (`ghost`, `smoke`, `blur`, `vanish`, `dissolve`): Letters expand and dissipate upward into a smoke blur.
- **`ECHO`** (`echo`, `scream`, `shout`, `resound`): Dual wireframe stroke ghost clones ripple outward.
- **`PULSE`** (`heartbeat`, `pulse`, `burn`, `flame`, `ignite`, `sunlight`): Dual-stage warm chromatic halation bloom.

---

## 7. Ambient Rim Lighting (`src/engine/AmbientLight.ts`)

A full-screen peripheral rim light that bleeds inward from all four bezel edges:
- **16-bucket RGB quantization with population weighting and luminance bounds** extracts rich, vibrant hues from Spotify album art.
- Derived dark backgrounds guarantee high contrast ratios ($8:1+$) with white text.
- Dynamic breathing: When vocals are singing, rim opacity surges from $0.45 \to 0.90$ and rim penetration radius expands from $110\text{ px} \to 180\text{ px}$ via dedicated harmonic springs.

---

## 8. WebGL2 Ethereal Liquid Aurora Mesh Shader (`src/engine/WebGLPostProcess.ts`)

A GPU-accelerated canvas sits behind the lyrics stage at `z-index: 1`:
- **Smooth Gaussian Color Orbs**: 4 soft luminous orbs orbiting on serene Lissajous curves that dynamically blend 4 extracted album palette colors. Pure smooth optical bokeh with ZERO high-frequency noise or marble veins.
- **Monotonic CPU Phase Accumulation**: Time phase advances continuously (`phase += dt * speed`), ensuring smooth acceleration without teleportation on vocal intensity changes.
- **Native Resolution Dither**: 35mm grain dither rendered at native device resolution to eliminate 8-bit banding without pixelation.
- **Graceful Context Recovery**: Full WebGL context loss and restoration handling.

---

## 9. Performance & Dirty Checking

To achieve rock-solid 144Hz performance inside Spotify's Chromium Embedded Framework:
1. **Dirty Checking**: Style strings (`transform`, `opacity`, `filter`, `visibility`) are compared against cached values and only written when changed.
2. **Incremental Line Tracking**: Line lookups start from the previous active line index, avoiding $O(N)$ linear scans every frame.
3. **Seek Backward Protection**: Backwards seeks reset future word progress and springs immediately.
4. **Single-Span Words**: Words are kept as single DOM nodes, eliminating hundreds of nested character span layers and preserving native font ligatures and kerning.
