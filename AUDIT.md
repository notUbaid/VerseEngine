# VerseEngine Technical Audit

## P0: Why It Looks Bad
1. **Album palette probably never works:** `Spicetify.Player.data.item.album.images[0].url` usually returns `spotify:image:...`, which `new Image()` cannot load directly, causing fallback. Fix: convert to `https://i.scdn.co/image/<id>` or use `Spicetify.colorExtractor(uri)`.
2. **Palette extraction is weak:** Takes single most saturated pixel and ignores 60/30/10 weighting. Background is primary × 0.08 (near black). Fix: quantize to buckets (median-cut), weight by population, enforce minimum luminance and contrast.
3. **Background shader is dim and muddy:** Output clamped to 0.52, base is bg × 0.4. Apple-Music-style depth comes from the album art itself, heavily blurred, saturated, and slowly rotating at 2–3 scales, not from four Gaussian orbs.
4. **Editorial palette is broken:** Shader canvas is opaque and dark, so the cream background (#FAF9F6) never shows, resulting in maroon text on dark grey. Fix: skip canvas for light palettes, or give it a light mode.
5. **Shader jumps:** `t = u_time * (0.12 + vocalIntensity * 0.06)` rescales elapsed time when intensity changes, causing orbs to teleport. Fix: accumulate phase `phase += dt * speed` on CPU and pass that in.
6. **Fisheye word 3D is likely flattened:** `.ve-line` has `will-change: opacity, filter`, forcing `transform-style: flat`. Line depth works, but word `translateZ` does nothing and `rotateY` squashes orthographically. Fix: put `perspective(900px)` inside each word's transform, or render via offscreen canvas texture on WebGL2 lens mesh.
7. **CSS transitions fight JS animation:** Lines have `transition: transform 0.35s, opacity, filter` while JS rewrites those properties every frame. Each write restarts a transition, causing laggy, mushy motion. Fix: remove transitions from every property JS drives.
8. **Text is probably blurry:** `will-change: transform` on lines, words, and characters rasterizes text at 1× and then upscales it (1.35× in convex). Fix: keep `will-change` only on container and camera, size text at its largest scale, scaling down instead.
9. **Per-character spans hurt typography:** Loses kerning and ligatures; hundreds of filter drop-shadow layers; hard-edge wipe gradient. Fix: one span per word, soft-edge gradient, split into characters only for active melisma word.
10. **Drift flies lines in and snaps them back:** One `cameraSpring` is shared by all lines. On line change, old line snaps to x=0 and new line starts at old line's offset (-2000px). Fix: reset spring on line change or keep one spring per line.
11. **Editorial animates letter-spacing every frame:** Reflows line, invalidates cached offsets, causes re-wraps. Fix: reserve width up front or use font-variation-settings.
12. **Convex glow pops:** Glow vanishes partway through word at `absDist < 0.4`. Focal point is word start, not center. Convex uses no springs despite docs.
13. **Stage root keeps permanent filter:** `animation: veStageFadeIn ... forwards` ends at `filter: blur(0px)`, rendering stage as one filtered layer. Fix: animate opacity only.
14. **Fonts load late:** Google Fonts load at runtime; `measureOffsets()` runs before they arrive, making cached positions wrong. Syne downloaded but never used. Fix: bundle woff2 locally.

## P1: Correctness Bugs
1. **Ad-libs render twice (verified):** Ad-lib words in both `words[]` and `adLibs[]`. Treats "yeah", "hey", "uh" as ad-libs even when real lyric. Fix: only flag parenthesized spans.
2. **Enhanced-LRC durations wrong (verified):** Uses gap before word, not duration to next word.
3. **LRCLIB User-Agent header ignored in browser:** Use Lrclib-Client header.
4. **Multiple timestamps on one line break (verified):** e.g. `[00:10][01:20]text`.
5. **[mm:ss] without fraction isn't parsed.**
6. **Non-Latin lyrics break (verified):** `sanitizeWord` strips non-ASCII (Devanagari, Hangul become empty); Devanagari conjuncts split into raw code points breaking shaping; CJK lines become one giant word. Fix: `Intl.Segmenter` for graphemes and words, `\p{L}` regex.
7. **Timing overlaps (verified):** `vocalDuration` goes negative when lines < 100ms apart. Breath pauses not budgeted.
8. **Failures cached forever:** Network error caches fallback card for session.
9. **Races:** Rapid track changes allow stale response to overwrite newer one. `openStage` sets `isOpen` before await.
10. **No empty state:** Blank stage if loading fails; instrumental fallback shown even when lyrics simply not found.
11. **Seeking backwards leaves stale state:** Inline `--char-p` stays at 100%.
12. **Clock is probably a no-op:** `polled !== last` every frame; 60ms hard-snap and 0.2 drift smoothing not implemented. Constructed before Spicetify ready.
13. **Semantic lexicon too broad:** Common words trigger constantly; `bleed` in both FRACTURE and PULSE.
14. **Smaller bugs:** Space should call `Player.togglePlay()`; global key listeners never removed; topbar button retries 20 times.

## P2: Performance
1. Every frame, every line, word, and character gets style strings written even when settled. Fix: dirty-checking and skip settled springs.
2. `visibility` written every frame. Write only on change.
3. Active-line lookup is linear scan each frame. Cache index and move incrementally.
4. Too many composited layers at once: `will-change` everywhere, backdrop-filter pill over animated content.
5. WebGL canvas renders at 0.5× and upscales. Dither at full resolution or drop it.
6. No handling for `visibilitychange`, `prefers-reduced-motion`, `webglcontextlost`, no adaptive quality fallback.
7. "144Hz" unmeasured. Add dev-only FPS and frame-time overlay (Shift+D).

## P3: Repo and Hackathon Polish
1. Docs contradict code (React claimed in README but not imported; Syne, 60/30/10 promised; version mismatches).
2. Leaks and tone: remove local user paths and AI workflow references.
3. Missing license, missing persistence for settings.
4. Tests thin: need parser fixtures, mock-Spicetify dev harness, DOM tests.
5. Types: eliminate `any` usages and internal Spotify state dependencies.
