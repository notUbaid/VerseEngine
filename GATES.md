# Acceptance Gates: VERSE//ENGINE

## Gate 1: TypeScript Zero-Error Gate
- [x] `tsc --noEmit` passes with exit code 0 and 0 diagnostics. (Verified: `npm run typecheck` exits 0)
- [x] Interface alignment between `StageView.ts`, `AnimationEngine.ts`, `app.ts`, `WebGLPostProcess.ts`, `Clock.ts`, `AmbientLight.ts`, and `lyrics.ts`.
- [x] Zero React dependencies or JSX runtime errors.

## Gate 2: Bundle & Packaging Gate
- [x] `build.mjs` creates production bundle `dist/verse-engine.js` (~112 KB self-contained IIFE).
- [x] Automatic deployment to Spicetify Extensions paths succeeds across platforms.
- [x] Self-contained IIFE with zero external module loading failures.

## Gate 3: Spicetify Apply & Registration Gate
- [x] `spicetify apply` executes cleanly with success on themes, modifications, extensions, and apps.
- [x] Extension registered in Spicetify configuration (`verse-engine.js`).

## Gate 4: Visual & Kinetic Typography Invariants Gate
- [x] **Three Layers**: Atmosphere (WebGL background + rim), Text (The Hero), Accents (rare bursts).
- [x] **Four Tempos of Motion**: Ambient (10–30s loops), Line (450–700ms), Word (120–300ms), Accent (400–900ms).
- [x] **Hero Look (Convex Refined)**: Optical dome with inline `perspective(900px)` inside word transforms, continuous Gaussian bloom, and anamorphic specular streak.
- [x] **Unified Single Loop**: Merged DOM and WebGL into a single master RAF loop reading one clock sample per frame.
- [x] **Slew Clock**: Real-time monotonic clock with error bleeding (`slewRate = Math.min(1, dt * 8)`), snap threshold ($> 150\text{ms}$), and anticipation lookahead ($+150\text{ms}$).
- [x] **Fixed 1/240s Physics Step**: Deterministic accumulator steps springs at $4.166\text{ms}$ regardless of monitor refresh rate.
- [x] **4 Motion Tokens**: Standardized presets (`snappy`, `heavy`, `soft`, `float`) and 3 easing curves (`sineInOut`, `cubicOut`, `expoOut`).
- [x] **Apple-Music-Grade Background**: 3-scale rotating artwork texture, $1.4\times$ saturation boost, blur, vignette, 250 bokeh/dust particles across 3 depths, full-res 24fps grain, edge chromatic aberration, and lens breathing ($1.00 \to 1.014$).
- [x] **OKLCH 5-Color Palette**: Perceptual extraction (`dominant`, `accent`, `shadow`, `highlight`, `tint`) with $1.2\text{s}$ cubic crossfader on track changes.
- [x] **Compositor-Only Mutations**: Only `transform` and `opacity` updated each frame on lines.
- [x] **Layer Budgeting ($\le 20$ Layers)**: `will-change` strictly promoted on active line and $\pm 1$ neighbors. `content-visibility: auto` on distant lines.
- [x] **Depth-of-Field Isolation**: Blur restricted strictly to immediate $\pm 1$ neighbors.
- [x] **Film Moments**: Title Card intro, Chorus Slam push/shockwave, Held-note melisma GPU `scaleX()` stretch, Specular streak, Breathing interlude dots, Outro.
- [x] **Dev Telemetry HUD**: Toggleable via `Shift + D`. Displays live FPS, 1%-low, frame duration (ms), energy $E$, beat pulse, active layers.
- [x] **Quality Governor**: Automatic step-down of particles and DPR if frame budget is exceeded.
- [x] **ZERO emojis** anywhere in UI.

## Gate 5: Unit Tests Gate
- [x] Deterministic unit test harness in `test/unit-tests.ts` with 64/64 passing tests.
