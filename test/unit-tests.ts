/**
 * test/unit-tests.ts
 * Deterministic unit tests for VERSE//ENGINE core mathematics, parsers, and typography.
 */

import { HarmonicSpring, SpringVector2 } from '../src/engine/SpringSolver';
import { matchSemanticEffect, sanitizeWord } from '../src/engine/SemanticPhysics';
import { LyricProvider, isGarbageLyricLine } from '../src/lyrics/LyricProvider';

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

console.log('--- 1. Testing HarmonicSpring Solver ---');
{
  const spring = new HarmonicSpring(0, 180, 22);
  spring.setTarget(100);

  // Step 60 frames (1 second at 60fps)
  for (let i = 0; i < 60; i++) {
    spring.step(1 / 60);
  }

  assert(!isNaN(spring.position), 'Spring position must not be NaN');
  assert(!isNaN(spring.velocity), 'Spring velocity must not be NaN');
  assert(spring.position > 80 && spring.position < 120, `Spring moves toward target (got ${spring.position.toFixed(2)})`);

  // Step until settle
  for (let i = 0; i < 120; i++) {
    spring.step(1 / 60);
  }
  assert(Math.abs(spring.position - 100) < 0.1, `Spring settles near target 100 (got ${spring.position.toFixed(3)})`);

  // 2D Vector Spring
  const vec = new SpringVector2(0, 0, 120, 20);
  vec.setTarget(50, -30);
  for (let i = 0; i < 60; i++) {
    vec.step(1 / 60);
  }
  assert(vec.x.position > 35 && vec.y.position < -20, '2D Vector spring tracks coordinates correctly');
}

console.log('\n--- 2. Testing SemanticPhysics Lexicon & Unicode Sanitization ---');
{
  // Unicode sanitization: Must preserve Devanagari, accents, CJK, etc.
  assert(sanitizeWord('Shattered!') === 'shattered', 'sanitizeWord strips punctuation and lowercases ASCII');
  assert(sanitizeWord('café') === 'café', 'sanitizeWord preserves accented Latin characters (café)');
  assert(sanitizeWord('प्यार!') === 'प्यार', 'sanitizeWord preserves Devanagari characters (प्यार)');
  assert(sanitizeWord('你好，世界！') === '你好世界', 'sanitizeWord preserves CJK characters (你好世界)');

  // Semantic lexicon mappings
  assert(matchSemanticEffect('shattered') === 'FRACTURE', 'shattered maps to FRACTURE');
  assert(matchSemanticEffect('falling') === 'GRAVITY', 'falling maps to GRAVITY');
  assert(matchSemanticEffect('drown') === 'GRAVITY', 'drown maps to GRAVITY');
  assert(matchSemanticEffect('smoke') === 'FADE', 'smoke maps to FADE');
  assert(matchSemanticEffect('ghostly') === 'FADE', 'ghostly maps to FADE');
  assert(matchSemanticEffect('echoes') === 'ECHO', 'echoes maps to ECHO');
  assert(matchSemanticEffect('screaming') === 'ECHO', 'screaming maps to ECHO');
  assert(matchSemanticEffect('heartbeat') === 'PULSE', 'heartbeat maps to PULSE');
  assert(matchSemanticEffect('sunlight') === 'PULSE', 'sunlight maps to PULSE');

  // Removed overly common words to avoid diluting semantic physics
  assert(matchSemanticEffect('love') === 'NONE', '"love" is neutral to avoid visual clutter');
  assert(matchSemanticEffect('light') === 'NONE', '"light" is neutral to avoid visual clutter');
  assert(matchSemanticEffect('down') === 'NONE', '"down" is neutral to avoid visual clutter');
  assert(matchSemanticEffect('telephone') === 'NONE', 'neutral word maps to NONE');
}

console.log('\n--- 3. Testing LyricProvider Standard LRC Parser ---');
{
  const provider = LyricProvider.getInstance();
  const pAny = provider as any;

  // Multiple timestamps per line & fraction-less timestamps
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

  // Synthesis into lines & words
  const synthesized = pAny.synthesizeLines(parsed);
  assert(synthesized.length === 4, `synthesizeLines produced 4 lines`);

  // Line 3 ad-lib verification: flagged inline, never duplicated
  const line3 = synthesized[3];
  const adLibWord = line3.words.find((w: any) => w.text === '(yeah)');
  assert(adLibWord !== undefined, 'Ad-lib "(yeah)" is present in words');
  assert(adLibWord?.isAdLib === true, 'Ad-lib "(yeah)" is flagged as isAdLib === true');
  assert(line3.adLibs.length === 0, 'Ad-lib is NOT duplicated into line.adLibs (prevents double-rendering)');

  // International script segmentation: Devanagari and CJK
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

console.log('\n--- 4. Testing Enhanced LRC Parser & Word Durations ---');
{
  const provider = LyricProvider.getInstance();
  const pAny = provider as any;

  // Enhanced LRC with <mm:ss.xx> word timestamps
  const enhLrc = `[00:04.20]<00:04.20>Hello <00:04.70>darkness <00:05.20>my <00:05.60>old <00:06.00>friend`;
  const enhLines = pAny.parseEnhancedLrc(enhLrc);

  assert(enhLines.length === 1, 'Enhanced LRC parsed 1 line');
  const line = enhLines[0];
  assert(line.words.length === 5, 'Line has 5 words');

  // Word 0 "Hello": 04.20 to 04.70 = 500ms (NOT measuring gap before word!)
  const wHello = line.words[0];
  assert(wHello.startMs === 4200, '"Hello" starts at 4200ms');
  assert(wHello.durationMs === 500, `"Hello" duration is exactly 500ms (got ${wHello.durationMs}ms)`);

  const wDarkness = line.words[1];
  assert(wDarkness.startMs === 4700, '"darkness" starts at 4700ms');
  assert(wDarkness.durationMs === 500, `"darkness" duration is 500ms (got ${wDarkness.durationMs}ms)`);
}

console.log('\n--- 5. Testing Garbage Lyric Filtering ---');
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
