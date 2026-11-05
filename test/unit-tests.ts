/**
 * test/unit-tests.ts
 * Deterministic unit tests for VERSE//ENGINE core mathematics and parsers.
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

console.log('\n--- 2. Testing SemanticPhysics Lexicon ---');
{
  assert(sanitizeWord('Shattered!') === 'shattered', 'sanitizeWord strips punctuation and lowercases');
  assert(matchSemanticEffect('shattered') === 'FRACTURE', 'shattered maps to FRACTURE');
  assert(matchSemanticEffect('falling') === 'GRAVITY', 'falling maps to GRAVITY');
  assert(matchSemanticEffect('drown') === 'GRAVITY', 'drown maps to GRAVITY');
  assert(matchSemanticEffect('smoke') === 'FADE', 'smoke maps to FADE');
  assert(matchSemanticEffect('ghostly') === 'FADE', 'ghostly maps to FADE');
  assert(matchSemanticEffect('echoes') === 'ECHO', 'echoes maps to ECHO');
  assert(matchSemanticEffect('screaming') === 'ECHO', 'screaming maps to ECHO');
  assert(matchSemanticEffect('heartbeat') === 'PULSE', 'heartbeat maps to PULSE');
  assert(matchSemanticEffect('sunlight') === 'PULSE', 'sunlight maps to PULSE');
  assert(matchSemanticEffect('telephone') === 'NONE', 'neutral word maps to NONE');
}

console.log('\n--- 3. Testing LyricProvider Synthesizer ---');
{
  const provider = LyricProvider.getInstance();
  // Access private methods for testing through any cast
  const pAny = provider as any;

  // Standard LRC parsing
  const rawLrc = `
[00:12.50]First line of lyrics
[00:15.80]Second line of lyrics (yeah)
[00:20.00]Third line ending with period.
`;
  const parsed = pAny.parseStandardLrc(rawLrc);
  assert(parsed.length === 3, `parseStandardLrc parsed 3 lines (got ${parsed.length})`);
  assert(parsed[0].timeMs === 12500, `First line starts at 12500ms (got ${parsed[0].timeMs})`);
  assert(parsed[1].timeMs === 15800, `Second line starts at 15800ms (got ${parsed[1].timeMs})`);

  // Synthesis into lines -> words -> chars
  const synthesized = pAny.synthesizeLines(parsed);
  assert(synthesized.length === 3, `synthesizeLines created 3 lines (got ${synthesized.length})`);
  
  // Line 1 words
  const line1 = synthesized[0];
  assert(line1.words.length === 4, `Line 1 has 4 words (got ${line1.words.length})`);
  assert(line1.words[0].cleanText === 'first', 'Word 1 text is "first"');
  assert(line1.words[0].chars.length === 5, 'Word "first" has 5 chars');
  assert(line1.words[0].chars[0].char === 'F', 'Char 1 is "F"');

  // Ad-lib separation on Line 2
  const line2 = synthesized[1];
  assert(line2.adLibs.length === 1, `Line 2 separated "(yeah)" into ad-lib (got ${line2.adLibs.length})`);
  assert(line2.adLibs[0].cleanText === 'yeah', 'Ad-lib clean text is "yeah"');

  // Vowel weighting verification
  const word = line1.words[0];
  const charDurations = word.chars.map((c: any) => c.durationMs);
  // 'i' (vowel) should receive more duration than consonants 'f', 'r', 's', 't'
  const vowelDur = word.chars[1].durationMs; // 'i'
  const consDur = word.chars[0].durationMs;  // 'f'
  assert(vowelDur > consDur, `Vowels receive more weight than consonants (${vowelDur}ms > ${consDur}ms)`);
}

console.log('\n--- 4. Testing Garbage Lyric Filtering ---');
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
