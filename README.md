# 🌌 VERSE//ENGINE

> **Next-Generation Spicetify Kinetic Typography & Ethereal Optical Visualizer for Spotify Desktop**  
> *Rivaling Verci, Lumn, and Apple Music through sub-millisecond letter animation, WebGL aurora shaders, and monumental typography.*

---

## ✦ Vision & The "Anti-AI-Slop" Mandate

Most lyric visualizers suffer from generic design tropes: blue-gradient templates, bouncing frequency bars, cluttered telemetry dashboards, and 30fps CSS opacity transitions.

**VerseEngine** was engineered to redefine music visualization inside Spotify Desktop via Spicetify:

1. **Zero Dashboard Chrome**: No cards, boxes, 1px solid borders, sidebars, progress bars, or status tickers. When the mouse is idle for 2 seconds, 100% of the screen is pure background, ambient rim light bleed, and monumental typography.
2. **Zero React in the Animation Loop**: React is completely decoupled from frame rendering. React/DOM renders once upon track load; all 144Hz per-frame updates run in a pure vanilla TypeScript `AnimationEngine` directly mutating pre-cached DOM nodes and WebGL uniforms via `requestAnimationFrame`.
3. **Continuous Physical Harmonic Springs**: Characters and camera coordinates are solved using a damped harmonic spring solver (`HarmonicSpring` with semi-implicit Euler integration) controlling Y-offset, scale, sub-pixel gradient sweeps, and optical blooms.
4. **No Emojis**: Emotional resonance is expressed exclusively through typographic physics, optical shaders, and palette geometry.

---

## ⚡ What We Have Built

```text
verse-engine/
├── package.json                   # Dependencies, typecheck, build, test scripts
├── tsconfig.json                  # Strict TypeScript configuration
├── build.mjs                      # esbuild bundler -> single self-contained IIFE bundle
├── ARCHITECTURE.md                # Comprehensive architectural specification
├── GATES.md                       # Verification acceptance gates
├── test/
│   ├── unit-tests.ts              # 36 deterministic unit tests (Springs, Lexicon, Synthesizer, Sanitizer)
│   └── run-tests.mjs              # Test runner
├── dist/
│   └── verse-engine.js            # Compiled production bundle ready for Spicetify
└── src/
    ├── app.tsx                    # Spicetify Playbar button hook, shortcuts, and orchestrator
    ├── types/
    │   ├── lyrics.ts              # AST: LyricChar, LyricWord, LyricLine, ProcessedTrack
    │   └── spicetify.d.ts         # Type definitions for Spicetify APIs
    ├── engine/
    │   ├── Clock.ts               # 144Hz drift-corrected interpolated playback clock
    │   ├── SpringSolver.ts        # HarmonicSpring & SpringVector2 (semi-implicit Euler)
    │   ├── SemanticPhysics.ts     # 150+ stem lexicon for concrete semantic physics
    │   ├── AmbientLight.ts        # 60/30/10 album art palette extractor & Lumn rim colors
    │   ├── WebGLPostProcess.ts    # GPU Ethereal Liquid Aurora Mesh Background shader
    │   └── AnimationEngine.ts     # Pure vanilla 144Hz RAF loop with direct DOM mutations
    ├── lyrics/
    │   └── LyricProvider.ts       # Multi-source waterfall + Phonetic Synthesizer + Sanitizer
    └── ui/
        └── StageView.ts           # Chromeless DOM builder, Lumn bezel rim, auto-hiding glass pill
```

---

## 🎨 Core Architectural Features

### 1. Ethereal Liquid Aurora Mesh Shader (`src/engine/WebGLPostProcess.ts`)
- **Apple Music-grade optical background:** 4 large, soft Gaussian color orbs ($\sigma \approx 0.8\text{--}1.2$) orbiting on smooth Lissajous curves that dynamically blend 4 extracted album palette colors (`u_color1` through `u_color4`).
- **Velvety OLED contrast:** Dark, rich baseline canvas ensuring white text (`#FAF9F6`) maintains an $8:1+$ contrast ratio across the screen.
- **Responsive vocal energy:** Speeds up fluid circulation and gently expands the highlight aura during active vocal lines.
- **Cinematic dither:** 35mm film grain dither prevents 8-bit color banding in dark gradients.

### 2. Atmospheric Viewport Gradient Mask (`src/ui/StageView.ts`)
- Viewport features a multi-stop cubic alpha gradient mask (`-webkit-mask-image: linear-gradient(...)`).
- Lyrics emerge seamlessly from dark atmospheric mist at the top and dissolve gracefully at the bottom.

### 3. High-Precision Interpolated Clock (`src/engine/Clock.ts`)
- Solves Spotify's coarse 250ms–500ms polling jitter by extrapolating playback monotonically at 144Hz using `performance.now()`.
- Incorporates automatic hard-snapping on seeks and exponential drift smoothing during normal playback.

### 4. Multi-Source Waterfall & Phonetic Synthesizer (`src/lyrics/LyricProvider.ts`)
- **Waterfall:** Spotify Color-Lyrics $\to$ LRCLIB API (`/api/get` & `/api/search`) $\to$ Procedural Fallback.
- **Phonetic Timing Synthesizer:** For tracks with line timestamps, synthesizes word and character timings using phonetic vowel weighting ($1.6\times$ duration for vowels vs. consonants).
- **Sanitizer:** Filters out raw timestamp noise (`"00:00"`, `"00:16"`), musical markers (`"♪"`, `"---"`), and metadata artifacts.

---

## 🎭 The 4 Visual Styles

| Style | Inspiration | Visual Choreography |
| :--- | :--- | :--- |
| **Convex** | Verci *Fisheye* | **Continuous floating-point optical dome.** Active word sits closest to the glass ($Z = +60\text{px}$, scale $1.35\times$), while surrounding words curve backward along a smooth Gaussian lens with parabolic depth and realistic optical depth-of-field blur. |
| **Drift** | Verci *Ship* | **Monumental un-wrapped horizontal marquee ribbon.** Lines never wrap; rendered in uppercase display type. A virtual 144Hz camera glides horizontally, locking the sung word to the 36% horizontal focal third while inactive lines stack with 3D perspective. |
| **Editorial** | Swiss Print Press | **Haute-couture typographic contrast.** Geometric sans paired with Italian serif italics (*Instrument Serif*) for keywords and ad-libs. Active lines feature an animated baseline hairline progress rule (`--line-progress`). Sustained melisma notes physically stretch letter kerning (`letter-spacing: 0.22em`). |
| **Semantic** | Concrete Typo-Physics | **Living word physics (Zero Emojis).** Gravity words physically plunge $+36\text{px}$ with a damped bounce; pulse/burn words emit double chromatic bloom drop-shadows; fracture words shear along diagonal clip-paths; echo words emit twin expanding wireframe ghost outlines. |

---

## 🎮 Controls & Keybindings

| Key / Control | Action |
| :--- | :--- |
| **Playbar Button** | Native waveform icon in Spotify's bottom player bar |
| **`Alt + L`** or **`F9`** | Toggle Fullscreen Lyrics Stage |
| **`Escape`** | Exit fullscreen with smooth fade |
| **`Space`** | Play / Pause playback |
| **Mouse Idle (2s)** | Cursor and control pill auto-hide completely for 100% pure typography |
| **Control Pill** | Bottom floating glass dock: switch styles, switch palettes (Album Sync, Maroon & Bone, Obsidian), toggle bezel rim, and fine-tune sync offset ($\pm 50\text{ms}$). |

---

## 🚀 Installation & Quick Start

### Prerequisites
- [Spotify Desktop](https://www.spotify.com/download/) (Windows, macOS, or Linux)
- [Spicetify CLI](https://spicetify.app/docs/getting-started/) installed

### Option A: Direct Extension Install (Quickest)
1. Copy `dist/verse-engine.js` into your Spicetify extensions directory:
   - **Windows:** `%APPDATA%\spicetify\Extensions\`
   - **macOS / Linux:** `~/.config/spicetify/Extensions/`
2. Enable and apply the extension:
   ```bash
   spicetify config extensions verse-engine.js
   spicetify apply
   ```

### Option B: Build from Source
1. Clone this repository:
   ```bash
   git clone https://github.com/notUbaid/VerseEngine.git
   cd VerseEngine
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run tests and typecheck:
   ```bash
   npm test
   npm run typecheck
   ```
4. Build the extension bundle (automatically copies to your Spicetify directories):
   ```bash
   npm run build
   spicetify apply
   ```
5. In Spotify, press **`Ctrl + Shift + R`** (or restart Spotify) and press **`Alt + L`** to launch!

---

## 🧪 Verification & Test Suite

Run the deterministic test suite:
```bash
npm test
```
All **36 unit tests** verify:
- Harmonic spring convergence, velocity limits, and 2D vector springs
- Semantic physics lexicon matching across 150+ stems
- Standard & enhanced LRC timestamp parsing
- Phonetic duration weights and ad-lib separation
- Garbage timestamp and notation filtering

---

## 📄 License
MIT © [notUbaid](https://github.com/notUbaid)
