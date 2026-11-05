# VERSE//ENGINE

> **Film-Grade Kinetic Typography and Optical Atmosphere for Spotify Desktop**  
> *Crafted with 144Hz fixed-step harmonic springs, WebGL album-art atmosphere, and monumental typography.*

---

## 1. Creative Direction: Lyrics as a Film Title Sequence

Most lyric visualizers suffer from generic design tropes: blue-gradient templates, bouncing frequency bars, cluttered telemetry dashboards, and 30fps CSS opacity transitions.

**VerseEngine** approaches lyric presentation as a live, cinematic film title sequence built on restraint, depth, consistent timing, and monumental typography:

1. **Exactly Three Layers**:
   - **Atmosphere**: WebGL album-art optical textures, slow noise drift, 35mm grain, and peripheral bezel ambient rim.
   - **Text (The Hero)**: Large, expressive variable grotesque typography (`clamp(3.8rem, 6.4vw, 7.2rem)`), line-height $1.08$, letter-spacing $-0.03\text{em}$, `text-wrap: balance`.
   - **Accents**: Rare specular flares, chromatic shockwaves on chorus slams, and subtle particle bursts (at most one every ~8s).
2. **Four Tempos of Motion**:
   - **Ambient (10–30s loops)**: Slow rotating background textures, atmospheric noise drift, floating dust particles.
   - **Line (450–700ms)**: Anticipatory line rise ($180\text{ms}$ before vocal onset) with $25\text{ms}$ word stagger.
   - **Word (120–300ms)**: Soft-edge liquid gradient wipe (`--p`), active scale lift ($1.04\times$), and $3\text{px}$ elevation.
   - **Accent (400–900ms)**: Chorus slam push, chromatic split spikes, particle burst scatter.
3. **One Hero Look**: **Convex** (Optical Dome) is the refined default, with **Drift**, **Editorial**, and **Semantic** serving as alternate grades on the same motion core.
4. **Global Dynamic Energy ($E \in [0, 1]$)**: Calm verses sit around $0.20$ and choruses surge to $0.85$. Background speed, glow, particle scatter, camera breathing, and accent frequency dynamically scale with energy.
5. **No Emojis**: Emotional resonance is expressed exclusively through typographic physics, optical shaders, and palette geometry.

---

## 2. Architecture and Repository Structure

```text
verse-engine/
├── package.json                   # Zero-dependency runtime, typecheck, build, test scripts
├── tsconfig.json                  # Strict TypeScript configuration
├── build.mjs                      # Cross-platform esbuild bundler -> single self-contained IIFE bundle
├── ARCHITECTURE.md                # System design & mathematical specifications
├── GATES.md                       # Formal verification acceptance gates
├── LICENSE                        # MIT License
├── test/
│   ├── unit-tests.ts              # 64 deterministic unit tests (Springs, OKLCH, Parsers, Clock, Accumulator)
│   └── run-tests.mjs              # Test runner
├── dist/
│   └── verse-engine.js            # Compiled production bundle (~112 KB self-contained IIFE)
└── src/
    ├── app.ts                     # Spicetify orchestrator, keyboard hooks, lifecycle listeners
    ├── types/
    │   ├── lyrics.ts              # AST: LyricChar, LyricWord, LyricLine, ProcessedTrack, ColorOKLCH
    │   └── spicetify.d.ts         # Type definitions for Spicetify and AudioAnalysis APIs
    ├── engine/
    │   ├── Clock.ts               # Slew clock with lookahead (+150ms anticipation) and beat tracker
    │   ├── SpringSolver.ts        # 4 motion tokens, 3 easing curves, fixed 1/240s accumulator
    │   ├── SemanticPhysics.ts     # Curated lexicon for concrete physical responses
    │   ├── AmbientLight.ts        # 5-color OKLCH palette extractor with 1.2s smooth crossfade
    │   ├── WebGLPostProcess.ts    # 3-scale album-art texture background, bokeh, 24fps grain, flares
    │   └── AnimationEngine.ts     # Unified master RAF loop, compositor-only styles, layer governor
    ├── lyrics/
    │   └── LyricProvider.ts       # Multi-source waterfall + Phonetic Synthesizer + Intl.Segmenter
    └── ui/
        └── StageView.ts           # 3-layer DOM builder, hero typography, Dev HUD, icon dock
```

---

## 3. Visual & Optical System

### Apple-Music-Grade Background Atmosphere (`src/engine/WebGLPostProcess.ts`)
- **3-Scale Artwork Texture**: Album art is mapped to a WebGL texture and sampled at 3 distinct scales ($1.0\times, 1.8\times, 2.6\times$) with independent slow noise rotation and translation.
- **1.4x Saturation Boost & Vignette**: Enriches muted album art while blending with dark shadow base to guarantee text contrast.
- **250 Bokeh & Dust Particles**: Distributed across 3 depth planes ($Z = 0.2, 0.6, 1.0$), drifting with ambient updrafts and scattering on peak beat energy.
- **Film Cues**:
  - Full-resolution 24fps film grain dither (`floor(u_time * 24.0)`).
  - Edge-only chromatic aberration that spikes on chorus impacts.
  - Anamorphic horizontal specular flare traveling across the active word.
  - Subtle lens breathing ($1.00$ to $1.015$) on bar downbeats.

### 5-Color OKLCH Palette & Smooth Crossfading (`src/engine/AmbientLight.ts`)
- Builds a 5-color perceptual palette from artwork: `dominant`, `accent`, `shadow`, `highlight`, and `tint`.
- Lightness is capped and chroma is boosted ($C \ge 0.12$).
- Contrast is verified against background luminance ($> 8:1$ WCAG AAA contrast).
- `PaletteCrossfader` smoothly interpolates colors over $1.2\text{s}$ on track changes with zero hard visual pops.

### Hero Typography & Single-Span Word Reveal (`src/ui/StageView.ts`)
- **Hero Scale**: `clamp(3.8rem, 6.4vw, 7.2rem)` with tight `line-height: 1.08` and `letter-spacing: -0.03em`.
- **Word Reveal Wipe**:
  ```css
  .ve-word.is-active {
    background: linear-gradient(90deg, #FAF9F6 calc(var(--p) - 14%), rgba(250, 249, 246, 0.28) var(--p));
    -webkit-background-clip: text;
    color: transparent;
  }
  ```
  `--p = (t * 114) + '%'` where $t \in [0, 1]$.
- Settled words receive static class `.ve-word-past` and upcoming words receive `.ve-word-future`, eliminating redundant per-frame style writes.
- One duplicate glow element per line (`.ve-line-glow`), avoiding hundreds of per-character filters.

---

## 4. Smoothness Engineering

- **Unified Master Loop**: Merged DOM and WebGL into a single `requestAnimationFrame` loop that reads one clock sample per frame.
- **Fixed-Step Physics Step (1/240s)**: Spring simulation uses a fixed-step accumulator at $4.166\text{ms}$, ensuring kinematics never depend on monitor refresh rates ($60\text{Hz}, 120\text{Hz}, 144\text{Hz}, 240\text{Hz}$).
- **Compositor-Only Mutations**: Only `transform` and `opacity` are updated every frame.
- **Layer Budgeting ($\le 20$ Layers)**: `will-change: transform, opacity` is promoted strictly on the active line and its $\pm 1$ immediate neighbors. Farther lines use `content-visibility: auto` and `contain: layout paint`.
- **Slew Clock**: Render time advances at real time and bleeds off error against audio time (`slewRate = Math.min(1, dt * 8)`). Snaps strictly on genuine seeks ($> 150\text{ms}$). Includes $+150\text{ms}$ anticipation lookahead.
- **Depth-of-Field Isolation**: Blur is restricted strictly to immediate $\pm 1$ neighbors. Farther lines use scale and opacity only.
- **Quality Governor**: Monitors rolling frame times and p95/1%-low metrics. Automatically steps down particle count and render resolution if frame budgets are exceeded.
- **Dev Telemetry HUD**: Toggleable via `Shift + D`. Displays live FPS, 1%-low, frame duration (ms), dynamic energy $E$, beat pulse, and active layer count.

---

## 5. Film Moments

| Moment | Trigger | Visual Choreography |
| :--- | :--- | :--- |
| **Title-Card Intro** | Track start | Fullscreen title card reveals artwork with song and artist, then dissolves into the first lyric line. |
| **Chorus Slam** | Energy spike ($E \ge 0.78$) or section climax | Camera pushes forward, shockwave ripples, chromatic aberration spikes, and bokeh particles burst outward. |
| **Held Notes (Melisma)** | Vocal syllable held $\ge 600\text{ms}$ | Word expands horizontally via GPU `scaleX()` with reserved width to prevent layout reflows. |
| **Specular Sweep** | Active vocal line | Narrow horizontal anamorphic flare tracks across the active word. |
| **Instrumental Interlude** | Gaps $> 4000\text{ms}$ between lines | Typography gently yields to breathing `• • •` dots and slow artwork zoom. |
| **Outro** | Song concludes | Lyrics dissolve upward, title card returns, and background dims. |
| **No Lyrics / Instrumental** | Track without lyrics | Cinematic film card with rotating artwork atmosphere and breathing ambient rim. |

---

## 6. Controls and Keybindings

| Key / Control | Action |
| :--- | :--- |
| **Playbar Button** | Waveform icon in Spotify's bottom player bar |
| **`Alt + L`** or **`F9`** | Toggle Fullscreen Lyrics Stage |
| **`Shift + D`** | Toggle Real-Time Dev Telemetry HUD (FPS, 1% Low, Frame ms, Energy, Layers) |
| **`Escape`** | Exit fullscreen with smooth fade |
| **`Space`** | Passthrough Play / Pause playback |
| **Mouse Idle (2s)** | Cursor and control dock auto-hide for pure chromeless typography |
| **Control Dock** | Bottom floating glass dock: switch styles, switch palettes, toggle rim, and tune latency ($\pm 50\text{ms}$). |

---

## 7. Installation and Development

### Prerequisites
- Spotify Desktop (Windows, macOS, or Linux)
- [Spicetify CLI](https://spicetify.app/) installed and working
- Node.js 18+

### Quick Start
```bash
# Clone the repository
git clone https://github.com/notUbaid/VerseEngine.git
cd VerseEngine

# Install build dependencies
npm install

# Run 64 deterministic unit tests
npm test

# Verify TypeScript types
npm run typecheck

# Bundle extension & auto-deploy to Spicetify extensions directory
npm run build
```

### Enabling in Spicetify
```bash
# Enable verse-engine extension
spicetify config extensions verse-engine.js

# Apply changes to Spotify
spicetify apply
```

---

## 8. License

MIT License. See [LICENSE](LICENSE) for details.
