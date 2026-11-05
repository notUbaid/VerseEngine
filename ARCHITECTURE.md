# VERSE//ENGINE: Architectural Specification & System Design

> **Hardware-Accelerated Kinetic Typography and Film Title Sequence Atmosphere for Spotify Desktop**
> Compatible with Spotify Desktop via Spicetify CLI (Windows / macOS / Linux).

---

## 1. System Philosophy: Lyrics as a Film Title Sequence

**VERSE//ENGINE** transforms streaming music lyrics into an authentic film title sequence. Instead of cluttering the viewport with dashboard widgets and uncoordinated effects, VerseEngine enforces restraint, depth, consistent timing, and monumental typography.

### Three Architectural Layers
1. **Atmosphere (Background & Light)**:
   - WebGL2 dynamic texture background sampling album art at 3 distinct scales ($1.0\times, 1.8\times, 2.6\times$) with slow noise rotation and $1.4\times$ saturation boost.
   - 250 soft bokeh and dust particles drifting across 3 depth planes ($Z = 0.2, 0.6, 1.0$) reacting to energy.
   - Full-resolution 24fps film grain dither (`floor(u_time * 24.0)`).
   - Peripheral 4-edge ambient rim lighting bleeding inward with vocal energy.
2. **Text (The Hero)**:
   - Large, expressive variable grotesque typography (`clamp(3.8rem, 6.4vw, 7.2rem)`), line-height $1.08$, letter-spacing $-0.03\text{em}$, `text-wrap: balance`.
   - Single-span `.ve-word` elements with sub-pixel liquid gradient wipes (`var(--p)`).
   - Settled words marked with static `.ve-word-past` classes, completely skipping continuous background style writes.
   - Single blurred glow element per line (`.ve-line-glow`), replacing hundreds of per-character filters.
3. **Accents (Rare Bursts)**:
   - Anamorphic horizontal specular streak tracking across the active word.
   - Chorus slam push with chromatic aberration spike and radial bokeh scatter (at most once every ~8s).

### Four Tempos of Motion
- **Ambient (10–30s loops)**: Continuous rotating background textures, atmospheric noise drift ($\pm 4.5\text{px}, \pm 0.25^\circ$), floating dust particles.
- **Line (450–700ms)**: Anticipatory line rise ($180\text{ms}$ before vocal onset) with $25\text{ms}$ word stagger.
- **Word (120–300ms)**: Soft-edge liquid gradient wipe (`--p = (t * 114) + '%'`), active scale lift ($1.04\times$), and $3\text{px}$ elevation.
- **Accent (400–900ms)**: Chorus slam push, chromatic split spikes, particle burst scatter.

---

## 2. Directory Layout & Module Responsibilities

```text
verse-engine/
├── package.json                   # Zero-dependency runtime, typecheck, build, test scripts
├── tsconfig.json                  # Strict TypeScript configuration
├── build.mjs                      # Cross-platform esbuild bundler -> single self-contained IIFE bundle
├── ARCHITECTURE.md                # System design & mathematical specifications
├── GATES.md                       # Formal verification acceptance gates
├── LICENSE                        # MIT License
├── test/
│   ├── unit-tests.ts              # 64 deterministic unit tests
│   └── run-tests.mjs              # Test runner
├── dist/
│   └── verse-engine.js            # Compiled production bundle (~112 KB self-contained IIFE)
└── src/
    ├── app.ts                     # Spicetify button injection, keyboard shortcuts, lifecycle events
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

## 3. High-Precision Slew Clock & Beat Synchronization (`src/engine/Clock.ts`)

### Slew Timekeeping
Spotify's native `Spicetify.Player.getProgress()` polls asynchronously every ~250ms–500ms. Binding character animations directly to raw progress produces jerky, stepped transitions.

The `Clock` implements a continuous slewing timekeeper with anticipation lookahead:

$$\text{TargetAudioMs} = \text{RawSpotifyMs} + \text{LOOKAHEAD\_MS} (150\text{ms}) + \text{SyncOffset}$$
$$\text{Err} = \text{TargetAudioMs} - \text{RenderMs}$$

- **Hard-Snap Threshold ($|\text{Err}| > 150\text{ms}$)**: When user seeks, skips, or buffers, the clock snaps immediately to avoid lagging behind.
- **Slew Rate ($|\text{Err}| \le 150\text{ms}$)**: Render time advances monotonically at real time and bleeds off error smoothly without micro-stuttering:
  $$\text{RenderMs} \leftarrow \text{RenderMs} + (\text{playing} ? dt \times 1000 : 0) + \text{Err} \times \min(1, dt \times 8)$$
- **Anticipation Lookahead ($+150\text{ms}$)**: Visual kinematics lead the audio slightly so lyrics feel crisp and anticipatory rather than lagging behind vocal audio.

### Audio Analysis & Dynamic Energy
- Integrates with `Spicetify.getAudioData()` to track bars, beats, sections, and segment loudness.
- **Decaying Beat Pulse**: Impulse resets to $1.0$ on every beat and decays exponentially ($e^{-4.5 t}$), driving particle brightness and lens breathing ($1.00 \to 1.014$ on bar downbeats).
- **Global Dynamic Energy ($E \in [0.1, 1.0]$)**: Normalized from segment loudness ($-30\text{dB}$ to $-3\text{dB}$) and line cadence. Drives background rotation speed, particle scatter, and accent frequency.

---

## 4. Damped Harmonic Springs & Standardized Motion Tokens (`src/engine/SpringSolver.ts`)

All dynamic coordinates use **semi-implicit Euler integration** executed inside a **fixed 1/240s physics accumulator**:

```typescript
const springForce  = -stiffness * (position - target);
const dampingForce = -damping * velocity;
const acceleration = (springForce + dampingForce) / mass;

velocity += acceleration * fixedDt; // fixedDt = 1/240s
position += velocity * fixedDt;
```

### The 4 Motion Tokens
| Token | Stiffness ($k$) | Damping ($c$) | Mass ($m$) | Purpose |
|:---|:---:|:---:|:---:|:---|
| **`snappy`** | $190$ | $22$ | $1.0$ | Active word scale lift ($1.04\times$), liquid fill sweep (`--p`) |
| **`heavy`** | $120$ | $24$ | $1.0$ | Line entrances, vertical stage tracking, gravity drop |
| **`soft`** | $75$ | $16$ | $1.0$ | Ambient rim breathing, smooth opacity crossfades |
| **`float`** | $40$ | $11$ | $1.0$ | Camera noise drift, floating dust particles |

### Fixed-Step Physics Accumulator
```typescript
acc += Math.min(dt, 0.1);
while (acc >= 1 / 240) {
  stepAllSprings(1 / 240);
  acc -= 1 / 240;
}
```
This guarantees that physics behavior remains mathematically identical across 60Hz, 120Hz, 144Hz, and 240Hz displays.

---

## 5. OKLCH Color Engine & 1.2s Smooth Crossfade (`src/engine/AmbientLight.ts`)

Extracts 5 perceptual color tokens from the album artwork using the **OKLCH** color space:
- **`dominant`**: Primary atmospheric color, boosted in chroma ($C \ge 0.12$), lightness capped ($0.38 \le L \le 0.68$).
- **`accent`**: Highest chroma complementary or triadic color ($C \ge 0.16$).
- **`shadow`**: Deep rich background canvas ($L \approx 0.08\text{--}0.11$, never pure black), with subtle dominant tint.
- **`highlight`**: Luminous specular tint ($L = 0.94$).
- **`tint`**: Text-safe bone white (`#FAF9F6`) with verified $> 8:1$ WCAG AAA contrast against shadow.

### Smooth Crossfade
`PaletteCrossfader` smoothly interpolates OKLCH / RGB coordinates over $1.2\text{s}$ using cubic ease-in-out interpolation on track changes, completely eliminating color snapping.

---

## 6. Apple-Music-Grade WebGL Atmosphere (`src/engine/WebGLPostProcess.ts`)

A GPU-accelerated canvas sits behind the lyrics stage at `z-index: 1`:
- **3-Scale Rotating Texture Atmosphere**:
  - Sample 1: $1.1\times$, slow noise translation.
  - Sample 2: $1.8\times$, slow rotation.
  - Sample 3: $2.6\times$, translation with noise.
  - Saturated by $1.4\times$ and blended with `u_colorShadow` and `u_colorDominant`.
- **250 Soft Bokeh & Dust Particles**:
  - Distributed across 3 depth planes ($Z = 0.2, 0.6, 1.0$).
  - Drift with ambient updrafts; scatter radially on chorus slam / peak beat impulses.
- **Film Cues**:
  - Full-resolution 24fps film grain dither (`floor(u_time * 24.0)`).
  - Edge-only chromatic aberration that spikes on chorus slams.
  - Anamorphic horizontal specular flare traveling across the active word.
  - Lens breathing scale modulation ($1.00 \to 1.014$) on downbeats.
- **Context Resilience**:
  - Automatically handles `webglcontextlost` and `webglcontextrestored`.
  - Automatically hides dark canvas in `editorial` mode to show authentic bone-white paper.

---

## 7. Compositor-Only Typography & Layer Budgeting (`src/engine/AnimationEngine.ts`)

To maintain rock-solid 144Hz performance without layout thrashing:
1. **Compositor-Only Mutations**: Only `transform` and `opacity` are updated every frame. No `letter-spacing`, no per-frame filters, and no per-character custom properties.
2. **Layer Budgeting ($\le 20$ Layers)**:
   - `will-change: transform, opacity` is promoted strictly on the active line and its $\pm 1$ immediate neighbors.
   - Lines with `absDist > 2` use `content-visibility: auto` and `contain: layout paint`.
3. **Depth-of-Field Isolation**: Blur is applied strictly to immediate $\pm 1$ neighbors. Farther lines use scale and opacity only.
4. **Anticipation**: Next line begins rising $180\text{ms}$ before its `startMs`, while past lines elevate and fade. Word stagger of $25\text{ms}$ ensures words cascade in organically.
5. **Quality Governor**: Monitors rolling p95 and 1%-low frame times. If frame duration exceeds $22\text{ms}$ sustained, automatically steps down particle count ($240 \to 120 \to 0$) and render DPR ($1.5 \to 1.25 \to 1.0$).
6. **Dev Telemetry HUD (`Shift + D`)**: Displays live FPS, 1%-low, frame duration (ms), dynamic energy $E$, beat pulse, and active layer count.

---

## 8. Unit Testing & Verification

The test harness in `test/unit-tests.ts` contains **64 deterministic unit tests**:
- Motion token physics and 1/240s fixed accumulator stepping
- OKLCH color math and 1.2s palette crossfading
- Unicode sanitization and semantic stems
- Multi-timestamp and fraction-less standard LRC parsing
- Devanagari (`प्यार`) and CJK word segmentation
- Enhanced LRC word duration calculation (`next.startMs - cur.startMs`)
- Garbage timestamp and metadata filtering
