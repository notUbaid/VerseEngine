/**
 * test/unit-tests.ts
 * Deterministic unit tests for VERSE//ENGINE core mathematics, parsers, and typography.
 */

import {
  HarmonicSpring,
  SpringVector2,
  FixedStepAccumulator,
  SPRING_PRESETS,
  Easing
} from '../src/engine/SpringSolver';
import { rgbToOklch, oklchToRgb, PaletteCrossfader } from '../src/engine/AmbientLight';
import { matchSemanticEffect, sanitizeWord } from '../src/engine/SemanticPhysics';
import { LyricProvider, isGarbageLyricLine } from '../src/lyrics/LyricProvider';
import { PaletteColors } from '../src/types/lyrics';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

console.log('--- 1. Testing Motion Tokens, Easing & Fixed-Step Accumulator ---');
{
  // 4 Standard Presets
  const soft = HarmonicSpring.fromPreset('soft', 0);
  const snappy = HarmonicSpring.fromPreset('snappy', 0);
  const heavy = HarmonicSpring.fromPreset('heavy', 0);
  const float = HarmonicSpring.fromPreset('float', 0);

  assert(snappy.stiffness > heavy.stiffness, 'Snappy spring has higher stiffness than heavy');
  assert(heavy.damping > soft.damping, 'Heavy spring has higher damping than soft');
  assert(float.stiffness < soft.stiffness, 'Float spring has lowest stiffness for smooth drift');

  // Easing curves
  assert(Easing.sineInOut(0) === 0 && Math.abs(Easing.sineInOut(1) - 1) < 0.001, 'sineInOut bounds 0..1');
  assert(Easing.cubicOut(0) === 0 && Easing.cubicOut(1) === 1, 'cubicOut bounds 0..1');
  assert(Easing.expoOut(0) === 0 && Easing.expoOut(1) === 1, 'expoOut bounds 0..1');

  // Fixed 1/240s accumulator
  const acc = new FixedStepAccumulator();
  let stepCount = 0;
  // Feed 16.666ms (approx 1 frame at 60Hz = ~4 physics steps at 240Hz)
  acc.update(1 / 60, (fixedDt) => {
    assert(Math.abs(fixedDt - 1 / 240) < 0.0001, 'Fixed step callback receives exactly 1/240s');
    stepCount++;
  });
  assert(stepCount === 4, `1/60s accumulates exactly 4 physics steps at 1/240s (got ${stepCount})`);
}

console.log('\n--- 2. Testing OKLCH Color Conversion & Palette Crossfader ---');
{
  // Pure red RGB to OKLCH
  const oklchRed = rgbToOklch(1, 0, 0);
  assert(oklchRed.l > 0.5 && oklchRed.l < 0.7, `OKLCH Lightness of red is in valid perceptual range (${oklchRed.l.toFixed(3)})`);
  assert(oklchRed.c > 0.2, `OKLCH Chroma of pure red is high (${oklchRed.c.toFixed(3)})`);

  // Roundtrip test: OKLCH back to RGB
  const rgbRoundtrip = oklchToRgb(oklchRed.l, oklchRed.c, oklchRed.h);
  assert(Math.abs(rgbRoundtrip.r - 1) < 0.02, `Roundtrip red R is ~1.0 (${rgbRoundtrip.r.toFixed(3)})`);
  assert(Math.abs(rgbRoundtrip.g - 0) < 0.02, `Roundtrip red G is ~0.0 (${rgbRoundtrip.g.toFixed(3)})`);
  assert(Math.abs(rgbRoundtrip.b - 0) < 0.02, `Roundtrip red B is ~0.0 (${rgbRoundtrip.b.toFixed(3)})`);

  // Palette Crossfader test over 1.2s
  const palA: PaletteColors = {
    type: 'album',
    primary: 'rgb(200, 20, 40)',
    secondary: 'rgb(120, 20, 30)',
    highlight: '#FAF9F6',
    bg: 'rgb(10, 8, 10)',
    textInactive: 'rgba(250, 249, 246, 0.28)',
    isDark: true,
    dominant: 'rgb(200, 20, 40)',
    accent: 'rgb(240, 60, 80)',
    shadow: 'rgb(10, 8, 10)',
    tint: '#FAF9F6',
    rgbDominant: [0.8, 0.1, 0.15],
    rgbAccent: [0.95, 0.25, 0.3],
    rgbShadow: [0.04, 0.03, 0.04],
    rgbHighlight: [0.98, 0.98, 0.96],
    rgbBg: [0.04, 0.03, 0.04]
  };

  const palB: PaletteColors = {
    ...palA,
    rgbDominant: [0.1, 0.8, 0.2],
    rgbAccent: [0.2, 0.95, 0.4]
  };

  const crossfader = new PaletteCrossfader(palA);
  crossfader.setTarget(palB);

  // Advance 0.6s (halfway through 1.2s transition)
  const mid = crossfader.update(0.6);
  assert(!crossfader.isComplete(), 'Crossfader is not yet complete at 0.6s');
  assert(mid.rgbDominant[0] < 0.8 && mid.rgbDominant[0] > 0.1, `Dominant R interpolates smoothly (${mid.rgbDominant[0].toFixed(2)})`);

  // Advance remaining 0.6s
  const finalPal = crossfader.update(0.6);
  assert(crossfader.isComplete(), 'Crossfader completes at 1.2s');
  assert(Math.abs(finalPal.rgbDominant[0] - 0.1) < 0.01, 'Dominant R reaches target at 1.2s');
}

console.log('\n--- 3. Testing SemanticPhysics Lexicon & Unicode Sanitization ---');
{
  assert(sanitizeWord('Shattered!') === 'shattered', 'sanitizeWord strips punctuation and lowercases ASCII');
  assert(sanitizeWord('café') === 'café', 'sanitizeWord preserves accented Latin characters (café)');
  assert(sanitizeWord('प्यार!') === 'प्यार', 'sanitizeWord preserves Devanagari characters (प्यार)');
  assert(sanitizeWord('你好，世界！') === '你好世界', 'sanitizeWord preserves CJK characters (你好世界)');

  assert(matchSemanticEffect('shattered') === 'FRACTURE', 'shattered maps to FRACTURE');
  assert(matchSemanticEffect('falling') === 'GRAVITY', 'falling maps to GRAVITY');
  assert(matchSemanticEffect('drown') === 'GRAVITY', 'drown maps to GRAVITY');
  assert(matchSemanticEffect('smoke') === 'FADE', 'smoke maps to FADE');
  assert(matchSemanticEffect('ghostly') === 'FADE', 'ghostly maps to FADE');
  assert(matchSemanticEffect('echoes') === 'ECHO', 'echoes maps to ECHO');
  assert(matchSemanticEffect('screaming') === 'ECHO', 'screaming maps to ECHO');
  assert(matchSemanticEffect('heartbeat') === 'PULSE', 'heartbeat maps to PULSE');
  assert(matchSemanticEffect('sunlight') === 'PULSE', 'sunlight maps to PULSE');

  assert(matchSemanticEffect('love') === 'NONE', '"love" is neutral to avoid visual clutter');
  assert(matchSemanticEffect('light') === 'NONE', '"light" is neutral to avoid visual clutter');
  assert(matchSemanticEffect('down') === 'NONE', '"down" is neutral to avoid visual clutter');
  assert(matchSemanticEffect('telephone') === 'NONE', 'neutral word maps to NONE');
}

console.log('\n--- 4. Testing LyricProvider Standard LRC Parser ---');
{
  const provider = LyricProvider.getInstance();
  const pAny = provider as any;

  const rawLrc = `
[00:10.50][00:25.00]Repeated line with multiple timestamps
[01:15]Line without fraction
[01:20.80]Normal line (yeah)
`;
  const parsed = pAny.parseStandardLrc(rawLrc);
  assert(parsed.length === 4, `Parsed 4 lines total (multiple timestamps expanded)`);
  assert(parsed[0].timeMs === 10500, `First timestamp at 10500ms`);
  assert(parsed[1].timeMs === 25000, `Repeated line timestamp sorted at 25000ms`);
  assert(parsed[2].timeMs === 75000, `Fraction-less timestamp [01:15] parsed as 75000ms`);
  assert(parsed[3].timeMs === 80800, `Fraction timestamp [01:20.80] parsed as 80800ms`);

  const synthesized = pAny.synthesizeLines(parsed);
  assert(synthesized.length === 4, `synthesizeLines produced 4 lines`);

  const line3 = synthesized[3];
  const adLibWord = line3.words.find((w: any) => w.text === '(yeah)');
  assert(adLibWord !== undefined, 'Ad-lib "(yeah)" is present in words');
  assert(adLibWord?.isAdLib === true, 'Ad-lib "(yeah)" is flagged as isAdLib === true');
  assert(line3.adLibs.length === 0, 'Ad-lib is NOT duplicated into line.adLibs (prevents double-rendering)');

  const intlLrc = `
[00:05.00]मेरा प्यार सच्चा है
[00:10.00]夜空に輝く星
`;
  const intlParsed = pAny.parseStandardLrc(intlLrc);
  const intlSynthesized = pAny.synthesizeLines(intlParsed);
  assert(intlSynthesized.length === 2, 'International lyrics parsed into 2 lines');

  const hindiLine = intlSynthesized[0];
  const hindiWords = hindiLine.words.map((w: any) => w.text);
  assert(hindiWords.includes('प्यार'), 'Devanagari word "प्यार" segmented with intact conjuncts');

  const cjkLine = intlSynthesized[1];
  assert(cjkLine.words.length >= 2, 'CJK line segmented into multiple tokens (not one giant word)');
}

console.log('\n--- 5. Testing Enhanced LRC Parser & Word Durations ---');
{
  const provider = LyricProvider.getInstance();
  const pAny = provider as any;

  const enhLrc = `[00:04.20]<00:04.20>Hello <00:04.70>darkness <00:05.20>my <00:05.60>old <00:06.00>friend`;
  const enhLines = pAny.parseEnhancedLrc(enhLrc);

  assert(enhLines.length === 1, 'Enhanced LRC parsed 1 line');
  const line = enhLines[0];
  assert(line.words.length === 5, 'Line has 5 words');

  const wHello = line.words[0];
  assert(wHello.startMs === 4200, '"Hello" starts at 4200ms');
  assert(wHello.durationMs === 500, `"Hello" duration is exactly 500ms (got ${wHello.durationMs}ms)`);

  const wDarkness = line.words[1];
  assert(wDarkness.startMs === 4700, '"darkness" starts at 4700ms');
  assert(wDarkness.durationMs === 500, `"darkness" duration is 500ms (got ${wDarkness.durationMs}ms)`);
}

console.log('\n--- 6. Testing Garbage Lyric Filtering ---');
{
  assert(isGarbageLyricLine('00:00'), '00:00 is detected as garbage timestamp');
  assert(isGarbageLyricLine('00:16'), '00:16 is detected as garbage timestamp');
  assert(isGarbageLyricLine('[01:23.45]'), '[01:23.45] is detected as garbage timestamp');
  assert(isGarbageLyricLine('♪'), '♪ musical note is detected as garbage');
  assert(isGarbageLyricLine('---'), '--- dashes are detected as garbage');
  assert(isGarbageLyricLine('(Instrumental)'), '(Instrumental) label is detected as garbage');
  assert(isGarbageLyricLine('   '), 'whitespace is detected as garbage');
  assert(!isGarbageLyricLine('Yeah, she from Texas'), 'Valid lyric line is NOT marked as garbage');
  assert(!isGarbageLyricLine('I want you'), 'Valid lyric line is NOT marked as garbage');
}

console.log(`\n========================================`);
console.log(`Tests: ${passed} passed, ${failed} failed`);
console.log(`========================================`);

if (failed > 0) {
  process.exit(1);
}
