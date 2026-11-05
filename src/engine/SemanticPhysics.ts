import { SemanticEffect } from '../types/lyrics';

/**
 * SemanticPhysics.ts
 * Real-time semantic typography physical engine.
 * Curated high-impact lyrical stems to modulate character physics.
 * ZERO EMOJIS: Uses pure physical character kinematics & optical shaders.
 */

const SEMANTIC_STEMS: Record<SemanticEffect, string[]> = {
  NONE: [],
  GRAVITY: [
    'sink', 'sinking', 'sinks', 'sank', 'sunk',
    'heavy', 'heavier', 'heavily', 'heaviest',
    'drown', 'drowning', 'drowned', 'drowns',
    'fall', 'falling', 'falls', 'fell', 'fallen',
    'descend', 'descent', 'collapse', 'tumble', 'gravity',
    'burden', 'plunge', 'anchor', 'submerge', 'underneath', 'abyss'
  ],
  FRACTURE: [
    'shatter', 'shattered', 'shattering',
    'split', 'splitting', 'splits',
    'crash', 'crashing', 'crashed', 'crashes',
    'crack', 'cracked', 'cracking', 'cracks',
    'snap', 'snapped', 'slice', 'sliced',
    'sever', 'severed', 'shard', 'shards', 'bleed', 'bled',
    'splinter', 'rupture'
  ],
  FADE: [
    'ghost', 'ghostly', 'ghosts',
    'smoke', 'smoky', 'smoking',
    'blur', 'blurred', 'blurry',
    'vanish', 'vanished', 'vanishing',
    'dust', 'mist', 'haze', 'vapor',
    'disappear', 'evaporate', 'dissolve'
  ],
  ECHO: [
    'echo', 'echoing', 'echoes', 'echoed',
    'scream', 'screaming', 'screamed', 'screams',
    'shout', 'shouting', 'howl',
    'resound', 'reverberate', 'whisper'
  ],
  PULSE: [
    'heartbeat', 'pulse', 'pulsing',
    'burn', 'burning', 'burned', 'burnt', 'burns',
    'flame', 'flames', 'blaze', 'ignite', 'sparks', 'fever',
    'sun', 'sunlight', 'shine', 'shining', 'glow', 'glowing'
  ]
};

// Fast lookup map
const STEM_MAP = new Map<string, SemanticEffect>();

for (const [effect, stems] of Object.entries(SEMANTIC_STEMS) as [SemanticEffect, string[]][]) {
  for (const stem of stems) {
    STEM_MAP.set(stem.toLowerCase(), effect);
  }
}

/**
 * Unicode-aware sanitizer preserving international letters, combining marks (virama/matras), and numbers.
 */
export function sanitizeWord(word: string): string {
  if (!word) return '';
  // Keep all Unicode letters (\p{L}), combining marks (\p{M}), and numbers (\p{N})
  return word.toLowerCase().replace(/[^\p{L}\p{M}\p{N}]/gu, '').trim();
}

export function matchSemanticEffect(rawWord: string): SemanticEffect {
  const clean = sanitizeWord(rawWord);
  if (!clean || clean.length < 3) return 'NONE';

  const exact = STEM_MAP.get(clean);
  if (exact) return exact;

  // Suffix strip heuristics (English only)
  const stems = [
    clean.replace(/(ing|ed|es|s|ly|er|est)$/, ''),
    clean.replace(/(ting|ping|ning|ring)$/, '')
  ];

  for (const stem of stems) {
    if (stem.length >= 3) {
      const match = STEM_MAP.get(stem);
      if (match) return match;
    }
  }

  return 'NONE';
}
