# VERSE//ENGINE: Architectural Specification & Developer Guide

> **Next-Generation Spicetify Kinetic Typography & Optical Visualizer**
> Compatible with Spotify Desktop via Spicetify CLI (Windows / macOS / Linux).

---

## 1. Executive Summary & Design Vision

**VERSE//ENGINE** is a hardware-accelerated, chromeless, fullscreen kinetic lyrics visualizer for Spotify Desktop. It transforms standard line-synced lyrics into buttery 120fps/144Hz word-by-word and letter-by-letter typographic choreography, inspired by the high-craft aesthetics of **Verci** (`verci.xyz`) and the ambient bezel glow of **Lumn** (`trylumn.xyz`).

### Core Engineering Invariants
1. **Zero Dashboard Chrome**: No sidebars, cards, boxes, 1px solid grid borders, BPM tickers, or monospace status telemetry during lyric playback. When idle for 2 seconds, the screen contains only pure background, ambient rim light, and monumental typography.
2. **Zero React in the Animation Loop**: React is completely decoupled from per-frame updates. React/DOM initializes once per track; all continuous kinetic transformations execute in a vanilla TypeScript `AnimationEngine` via `requestAnimationFrame` mutating pre-cached DOM nodes and WebGL uniforms.
3. **No Cheap Opacity Fades**: Letters do not simply transition between `opacity: 0.3` and `opacity: 1.0`. Characters are driven by a semi-implicit Euler damped harmonic spring solver controlling vertical offset, scale, liquid gradient sweep, and optical glow.
4. **No Emojis**: All emotional resonance is expressed purely through typographic physics, optical shaders, and palette geometry.

---

## 2. Directory Layout & Module Responsibilities

```text
verse-engine/
├── package.json                   # Dependencies, typecheck, build, test scripts
├── tsconfig.json                  # Strict TypeScript configuration
├── build.mjs                      # esbuild bundler -> IIFE bundle + auto-deploy
├── ARCHITECTURE.md                # This document: agent continuation specification
├── GATES.md                       # Formal verification acceptance gates
├── .session-checkpoint.md         # Persistent session state for multi-turn continuity
├── test/
│   ├── unit-tests.ts              # Deterministic unit test suite
│   └── run-tests.mjs              # Test runner
├── src/
│   ├── app.tsx                    # Entry point, Spicetify button injection, keyboard shortcuts
│   ├── types/
│   │   ├── lyrics.ts              # AST: LyricChar, LyricWord, LyricLine, ProcessedTrack
│   │   └── spicetify.d.ts         # Type definitions for Spicetify APIs
│   ├── engine/
│   │   ├── Clock.ts               # 144Hz drift-corrected interpolated playback clock
│   │   ├── SpringSolver.ts        # HarmonicSpring & SpringVector2 (semi-implicit Euler)
│   │   ├── SemanticPhysics.ts     # 150+ stem lexicon for concrete semantic physics
│   │   ├── AmbientLight.ts        # 60/30/10 album art palette extractor & Lumn rim color
│   │   ├── WebGLPostProcess.ts    # WebGL2 Ethereal Liquid Aurora Mesh Background shader
│   │   └── AnimationEngine.ts     # Pure vanilla 144Hz RAF loop with direct DOM mutations
│   ├── lyrics/
│   │   └── LyricProvider.ts       # Multi-source waterfall + Phonetic Letter Synthesizer + Sanitizer
│   └── ui/
│       └── StageView.ts           # Chromeless DOM builder, Lumn bezel rim, auto-hiding pill
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

## 4. Multi-Source Lyric Pipeline & Phonetic Synthesizer (`src/lyrics/LyricProvider.ts`)

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

### The Phonetic Word & Letter Synthesizer
When tracks only provide line timestamps (common across 80% of streaming lyrics), `LyricProvider` synthesizes sub-millisecond word and character boundaries:

1. **Active Vocal Window Calculation**:
   $$\text{Duration} = \min(\text{NextLineStart} - \text{CurrentLineStart} - 100\text{ ms},\; \max(1600\text{ ms},\; N_{\text{chars}} \times 68\text{ ms}))$$
2. **Phonetic Weighting**:
   - Vowels (`a, e, i, o, u, y`): **$1.6\times$ weight** (held longer by vocal chords)
   - Consonants: **$1.0\times$ weight**
   - Terminal Punctuation (`. , ! ? ; :`): **$+1.8\times$ weight** + automatically appends a **$140\text{ ms}$ breath pause** before the next word starts.
3. **Ad-Lib Isolation**:
   Parenthetical vocalizations (e.g., `(yeah)`, `(ooh)`, `(hey)`) are extracted into `line.adLibs` and rendered in deep background space ($Z = -160\text{ px}$, `blur(2.5px)`), preventing visual clutter on the primary vocal baseline.

---

## 5. Damped Harmonic Spring Solver (`src/engine/SpringSolver.ts`)

All character and camera physics use **semi-implicit Euler integration** for unconditional numerical stability:

```typescript
const springForce  = -stiffness * (position - target);
const dampingForce = -damping * velocity;
const acceleration = (springForce + dampingForce) / mass;

velocity += acceleration * dt;
position += velocity * dt;
```

### Default Physics Tunings
| Parameter | Stiffness ($k$) | Damping ($c$) | Mass ($m$) | Purpose |
|:---|:---:|:---:|:---:|:---|
| Character $Y$ Offset | $190$ | $20$ | $1.0$ | Snappy organic bounce on arrival |
| Character Scale | $180$ | $22$ | $1.0$ | Gentle magnification pulse ($1.0 \to 1.09$) |
| Liquid Sweep Progress | $210$ | $24$ | $1.0$ | Sub-pixel ink illumination |
| Word 3D Depth ($Z$) | $140$ | $22$ | $1.0$ | Smooth optical glide toward the glass |
| Camera $XY$ Chaser | $90$ | $18$ | $1.0$ | Cinematic trailing camera for Drift wall |

---

## 6. The 4 Kinetic Typography Styles

### 1. Convex Glass (`convex`)
Simulates viewing lyrics through a curved optical lens:
- Words near the active vocal timepoint curve forward to $Z = +60\text{ px}$, scale $1.12$, and zero blur.
- Words receding in time curve backward parabolically:
  $$\theta_{\text{curve}} = \operatorname{sgn}(\Delta t) \times \left(\frac{|\Delta t|}{2800\text{ ms}}\right)^{0.6} \times 11^{\circ}$$
- Depth-of-field blur scales continuously up to $8\text{ px}$.

### 2. Drifting Wall (`drift`)
- Monolithic, all-caps architectural wall typography (`Syne 800`, `clamp(3.5rem, 6.5vw, 7rem)`).
- Camera spring smoothly tracks the exact world-space bounding box center of the sung word, panning across the typographic plane with subtle 3D pitch/yaw ($3^{\circ} / -4^{\circ}$).

### 3. Editorial Swiss Press (`editorial`)
- Classic bone-white and oxblood maroon printing press aesthetic.
- Sophisticated pairing of **Syne Grotesque** with **Instrument Serif Italic**.
- Words identified with semantic significance or length $> 5$ characters are set in `Instrument Serif Italic 1.22em`.
- **Melisma Note-Stretch**: When a syllable is held for $> 600\text{ ms}$, the word's `letter-spacing` stretches smoothly up to $+0.16\text{em}$ over its active duration.

### 4. Living Semantics (`semantic`)
Words dynamically trigger concrete physical responses based on `SemanticPhysics.ts`:
- **`GRAVITY`** (`fall`, `drop`, `sink`, `down`, `heavy`, `drown`): Word sinks $14\text{ px}$ below the baseline with a physical spring.
- **`FRACTURE`** (`break`, `shatter`, `cut`, `split`, `crash`): Character splits into twin diagonal clip-path layers (`.ve-fracture-top` and `.ve-fracture-bottom`), shearing apart by $5\text{ px}$ with skew.
- **`FADE`** (`ghost`, `smoke`, `lost`, `memory`, `blur`, `vanish`): Letters expand spacing and dissipate upward $18\text{ px}$ with a $10\text{ px}$ smoke blur.
- **`ECHO`** (`echo`, `repeat`, `call`, `voice`, `scream`): Dual wireframe stroke ghost clones (`.ve-echo-clone-1/2`) ripple outward in scale and fade.
- **`PULSE`** (`heart`, `blood`, `fire`, `burn`, `sun`, `light`, `gold`): Dual-stage warm crimson and amber halation bloom.

---

## 7. Ambient Rim Lighting (`src/engine/AmbientLight.ts`)

Inspired by **Lumn**, the stage features a full-screen peripheral rim light that bleeds inward from all four bezel edges:
- **60% Primary / 30% Secondary / 10% Highlight** algorithm extracts dominant, highly saturated hues from Spotify album art via an offscreen $36\times 36$ canvas downsampler.
- Built using dual radial gradients with elliptical focal geometry at bottom, top, left, and right screen boundaries.
- Dynamic breathing: When vocals are singing, rim opacity surges from $0.45 \to 0.92$ and rim penetration radius expands from $110\text{ px} \to 185\text{ px}$ via dedicated harmonic springs.

---

## 8. WebGL2 Ethereal Liquid Aurora Mesh Shader (`src/engine/WebGLPostProcess.ts`)

A GPU-accelerated canvas sits behind the lyrics stage at `z-index: 1`:
- **Smooth Gaussian Color Orbs**: 4 soft, out-of-focus luminous orbs orbiting on serene Lissajous curves that dynamically blend 4 extracted album palette colors. Pure smooth optical bokeh with ZERO high-frequency noise or marble veins.
- **Velvety Dark OLED Canvas**: Deep background base ensuring white typography (`#FAF9F6`) maintains high contrast across all lighting conditions.
- **Vocal-Reactive Energy**: Automatically accelerates fluid circulation and expands the highlight aura during singing lines.
- **35mm Film Grain Dither**: High-frequency micro-dither to eliminate 8-bit gradient banding.
- **Graceful Fallback**: If WebGL2 is disabled or unsupported in Spotify's CEF, it safely skips without affecting the DOM typography.

---

## 9. Kinetic Vertical Centering & Inter-Track Transitions

### Vertical Spring Centering
Rather than statically piling lyrics into document flow, `AnimationEngine` continuously positions the active vocal line at the golden ratio of the viewport ($40\%$ of screen height):
- **Precomputed Offsets (`cachedOffsetTop`)**: Cached once per track render and refreshed on window `resize`, preventing forced layout reflows/thrashing inside the 144Hz RAF loop.
- **Initial Frame Snap**: On opening the visualizer, `stageYSpring` immediately snaps to `-activeLine.cachedOffsetTop + window.innerHeight * 0.40` so the sung lyric is immediately centered with zero awkward scroll-through.
- **Continuous Spring Interpolation**: Subsequent line advances are pulled smoothly via `HarmonicSpring(0, 110, 19)` ($\zeta \approx 0.91$), gliding the upcoming line up as past lines elevate and fade.
- **Click to Seek**: Clicking any line immediately seeks Spotify playback to `line.startMs` (`Spicetify.Player.seek(line.startMs)`). Hovering over past or future lines subtly illuminates them to signal interactiveness.
- **Spacebar Play/Pause Passthrough**: Hitting `Spacebar` anywhere inside the fullscreen stage cleanly pauses or resumes Spotify playback.

---

## 10. How to Build, Test, and Deploy

```powershell
# 1. Navigate to the project
cd "C:\Users\ubaid\.gemini\antigravity\scratch\verse-engine"

# 2. Run deterministic unit test suite (36 tests)
npm test

# 3. Verify TypeScript zero-error compilation
npm run typecheck

# 4. Bundle into single IIFE extension & auto-deploy to Spicetify
npm run build

# 5. Apply changes to running Spotify
spicetify apply
```

### Keyboard Shortcuts Inside Spotify
- **`Alt + L`** or **`F9`**: Toggle VerseEngine Fullscreen Stage
- **`Escape`**: Exit Fullscreen Stage
- **`Spacebar`**: Passthrough play/pause toggle
