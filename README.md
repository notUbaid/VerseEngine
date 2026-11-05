# VERSE//ENGINE

> **Next-Generation Spicetify Kinetic Typography and Optical Visualizer for Spotify Desktop**  
> *Crafted with sub-millisecond word animation, WebGL aurora shaders, and monumental typography.*

---

## 1. Vision and Principles

Most lyric visualizers suffer from generic design tropes: blue-gradient templates, bouncing frequency bars, cluttered telemetry dashboards, and 30fps CSS opacity transitions.

**VerseEngine** redefines music visualization inside Spotify Desktop via Spicetify:

1. **Zero Dashboard Chrome**: No cards, boxes, 1px solid borders, sidebars, progress bars, or status tickers. When the mouse is idle for 2 seconds, 100% of the screen is pure background, ambient rim light bleed, and monumental typography.
2. **Zero React in the Animation Loop**: React is completely eliminated from the runtime architecture. All 144Hz per-frame updates run in a pure vanilla TypeScript `AnimationEngine` directly mutating pre-cached DOM nodes and WebGL uniforms via `requestAnimationFrame`.
3. **Continuous Physical Harmonic Springs**: Word kinematics and camera coordinates are solved using a damped harmonic spring solver (`HarmonicSpring` with semi-implicit Euler integration) controlling Y-offset, depth, scale, sub-pixel gradient sweeps, and optical blooms.
4. **No Emojis**: Emotional resonance is expressed exclusively through typographic physics, optical shaders, and palette geometry.

---

## 2. Architecture and Repository Structure

```text
verse-engine/
├── package.json                   # Zero-dependency runtime, typecheck, build, test scripts
├── tsconfig.json                  # Strict TypeScript configuration
├── build.mjs                      # Cross-platform esbuild bundler -> single self-contained IIFE bundle
├── ARCHITECTURE.md                # In-depth architectural specification and math
├── LICENSE                        # MIT License
├── test/
│   ├── unit-tests.ts              # 49 deterministic unit tests (Springs, Lexicon, Synthesizer, International scripts)
│   └── run-tests.mjs              # Test runner
├── dist/
│   └── verse-engine.js            # Compiled production bundle (~98 KB self-contained IIFE)
└── src/
    ├── app.ts                     # Spicetify button injection, keyboard shortcuts, and orchestrator
    ├── types/
    │   ├── lyrics.ts              # AST: LyricChar, LyricWord, LyricLine, ProcessedTrack
    │   └── spicetify.d.ts         # Type definitions for Spicetify APIs
    ├── engine/
    │   ├── Clock.ts               # 144Hz drift-corrected interpolated playback clock
    │   ├── SpringSolver.ts        # HarmonicSpring & SpringVector2 (semi-implicit Euler)
    │   ├── SemanticPhysics.ts     # Curated lexicon for concrete semantic physics
    │   ├── AmbientLight.ts        # 16-bucket RGB quantization palette extractor with contrast limits
    │   ├── WebGLPostProcess.ts    # GPU Ethereal Liquid Aurora Background shader with monotonic phase
    │   └── AnimationEngine.ts     # Pure vanilla 144Hz RAF loop with dirty checking & DOM caching
    ├── lyrics/
    │   └── LyricProvider.ts       # Multi-source waterfall + Phonetic Synthesizer + Intl.Segmenter
    └── ui/
        └── StageView.ts           # Chromeless DOM builder, Lumn bezel rim, auto-hiding glass pill
```

---

## 3. Core Architectural Features

### Ethereal Liquid Aurora Mesh Shader (`src/engine/WebGLPostProcess.ts`)
- **Apple Music-grade optical background:** 4 large, soft Gaussian color orbs orbiting on smooth Lissajous curves that dynamically blend 4 extracted album palette colors.
- **Monotonic CPU phase accumulation:** Phase accumulates continuously via `dt * speed`, completely eliminating stutter or teleportation when vocal intensity changes.
- **Velvety OLED contrast:** Dark, rich baseline canvas ensuring white text (`#FAF9F6`) maintains high contrast across the screen.
- **Theme intelligence:** Light themes (`editorial`) automatically bypass the dark WebGL shader to present an authentic bone-white paper finish.
- **Native-resolution dither:** Micro-dither prevents 8-bit color banding without blocky upscaled pixelation.

### Single-Span Word Architecture and Liquid Gradient Sweep (`src/ui/StageView.ts`)
- Words render as single `.ve-word` elements with a soft-edge liquid gradient sweep (`var(--word-p)`).
- Full retention of font ligatures, kerning, and sub-pixel glyph alignment across Latin, Indic (Devanagari), and CJK scripts.
- Zero CSS transitions on JS-driven properties (`transform`, `filter`, `opacity`) to eliminate frame-rate fighting and mushy motion.

### High-Precision Interpolated Clock (`src/engine/Clock.ts`)
- Solves Spotify's coarse 250ms–500ms polling jitter by extrapolating playback monotonically at 144Hz using `performance.now()`.
- Incorporates automatic hard-snapping on seeks ($\ge 60\text{ms}$) and exponential drift smoothing during normal playback.

### Multi-Source Waterfall and International Parsing (`src/lyrics/LyricProvider.ts`)
- **Waterfall:** Spotify Color-Lyrics -> LRCLIB API (`/api/get` and `/api/search`) -> Procedural Fallback.
- **URI Resolution:** Transparently transforms internal `spotify:image:<hash>` URIs to public HTTPS CDNs for reliable browser canvas decoding.
- **International Script Support:** Powered by `Intl.Segmenter` and Unicode `\p{L}\p{M}\p{N}` matching. Correctly preserves Devanagari conjuncts (e.g., `प्यार`) and segments unspaced CJK phrases without breaking graphemes.
- **Standard LRC Enhancements:** Full support for multi-timestamp lines (e.g. `[00:10.00][00:25.00]`) and fraction-less timestamps (`[01:15]`).
- **Enhanced LRC Durations:** Measures accurate word durations (`next.startMs - cur.startMs`).

---

## 4. The 4 Visual Styles

| Style | Inspiration | Visual Choreography |
| :--- | :--- | :--- |
| **Convex** | Verci *Fisheye* | **Continuous floating-point optical dome.** Active word sits closest to the glass ($Z = +60\text{px}$, scale $1.32\times$), while surrounding words curve backward along a smooth Gaussian lens. Inline `perspective(900px)` inside word transforms prevents Chromium 3D flattening bugs. |
| **Drift** | Verci *Ship* | **Monumental un-wrapped horizontal marquee ribbon.** Lines never wrap; rendered in display typography (`Syne 800`). A virtual 144Hz camera glides horizontally, locking the sung word to the focal third while inactive lines stack with 3D perspective without snapping. |
| **Editorial** | Swiss Print Press | **Haute-couture typographic contrast.** Geometric sans paired with Italian serif italics (*Instrument Serif*) for key words and ad-libs on a bone-white `#FAF9F6` paper background. Active lines feature an animated baseline progress rule. Melisma notes smoothly stretch via GPU `scaleX()` without triggering DOM layout reflows. |
| **Semantic** | Concrete Typo-Physics | **Living word physics (Zero Emojis).** Gravity words physically plunge with a damped bounce; pulse words emit chromatic bloom; fracture words shear along diagonal clip-paths; echo words emit twin expanding wireframe ghost outlines. |

---

## 5. Controls and Keybindings

| Key / Control | Action |
| :--- | :--- |
| **Playbar Button** | Native waveform icon in Spotify's bottom player bar |
| **`Alt + L`** or **`F9`** | Toggle Fullscreen Lyrics Stage |
| **`Escape`** | Exit fullscreen with smooth fade |
| **`Space`** | Play / Pause playback |
| **Mouse Idle (2s)** | Cursor and control pill auto-hide completely for 100% pure typography |
| **Control Pill** | Bottom floating glass dock: switch styles, switch palettes (Album Sync, Maroon & Bone, Obsidian), toggle bezel rim, and fine-tune sync offset ($\pm 50\text{ms}$). |

---

## 6. Installation and Development

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

# Run 49 deterministic unit tests
npm test

# Verify TypeScript types
npm run typecheck

# Bundle extension
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

## 7. License

MIT License. See [LICENSE](LICENSE) for details.
