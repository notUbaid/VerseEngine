# Acceptance Gates: VERSE//ENGINE

## Gate 1: TypeScript Zero-Error Gate
- [x] `tsc --noEmit` passes with exit code 0 and 0 diagnostics. (Verified: `npm run typecheck` exits 0)
- [x] Interface alignment between `StageView.ts`, `AnimationEngine.ts`, `app.ts`, `WebGLPostProcess.ts`, and `lyrics.ts`.
- [x] Zero React dependencies or JSX runtime errors.

## Gate 2: Bundle & Packaging Gate
- [x] `build.mjs` creates production bundle `dist/verse-engine.js` (~98 KB self-contained IIFE).
- [x] Automatic deployment to Spicetify Extensions paths succeeds across platforms.
- [x] Self-contained IIFE with zero external module loading failures.

## Gate 3: Spicetify Apply & Registration Gate
- [x] `spicetify apply` executes cleanly with success on themes, modifications, extensions, and apps.
- [x] Extension registered in Spicetify configuration (`verse-engine.js`).

## Gate 4: Visual & Kinetic Typography Invariants Gate
- [x] Sub-millisecond 144Hz RAF Clock with drift correction and backward seek protection (`Clock.ts`).
- [x] Pure vanilla DOM mutation loop (`AnimationEngine.ts`) with dirty checking to prevent layout reflows.
- [x] Word-level soft liquid gradient wipe (`--word-p`) retaining full font ligatures and kerning.
- [x] Damped harmonic springs for all dynamic coordinates (`HarmonicSpring` semi-implicit Euler).
- [x] 4 fully realized visual styles:
  - **Convex**: Optical dome with inline `perspective(900px)`, word-center focal tracking, and continuous Gaussian bloom.
  - **Drift**: Monumental un-wrapped horizontal marquee ribbon (`Syne 800`) with smooth horizontal tracking without line snapping.
  - **Editorial**: Swiss print typography, Italian serif italics (*Instrument Serif*), GPU `scaleX()` melisma stretch, and automatic dark shader bypass.
  - **Semantic**: Living physical responses (FRACTURE diagonal shear, GRAVITY plunge, FADE smoke blur, ECHO wireframe ghost clones, PULSE warm bloom).
- [x] 16-bucket RGB quantization palette extractor with contrast limits and transparent `spotify:image:` CDN resolution.
- [x] Monotonic CPU phase accumulation in WebGL aurora mesh shader to prevent orb teleportation.
- [x] International script support: `Intl.Segmenter` handles Devanagari (preserving conjuncts in `प्यार`) and CJK unspaced phrases.
- [x] LRC parser handles multiple timestamps on one line and fraction-less timestamps.
- [x] Auto-hiding glass control pill after 2s idle.
- [x] ZERO emojis anywhere in UI.

## Gate 5: Unit Tests Gate
- [x] Deterministic unit test harness in `test/unit-tests.ts` with 49/49 passing tests.
