import { SemanticEffect } from '../types/lyrics';

/**
 * SemanticPhysics.ts
 * Real-time semantic typography physical engine.
 * Categorizes 150+ common lyrical stems to physically modulate character springs.
 * ZERO EMOJIS: Uses pure physical character kinematics & subtle SVG vector glyph accents.
 */

const SEMANTIC_STEMS: Record<SemanticEffect, string[]> = {
  NONE: [],
  GRAVITY: [
    'fall', 'falling', 'falls', 'fallen', 'fell',
    'drop', 'dropping', 'drops', 'dropped',
    'sink', 'sinking', 'sinks', 'sank', 'sunk',
    'down', 'downward', 'downwards',
    'heavy', 'heavier', 'heavily', 'heaviest',
    'drown', 'drowning', 'drowned', 'drowns',
    'low', 'lower', 'lowest', 'bottom',
    'floor', 'knees', 'ground', 'dirt', 'depth', 'deep',
    'descend', 'descent', 'collapse', 'tumble', 'gravity',
    'burden', 'plunge', 'anchor', 'submerge', 'underneath', 'beneath'
  ],
  FRACTURE: [
    'break', 'breaking', 'broken', 'breaks',
    'shatter', 'shattered', 'shattering',
    'cut', 'cutting', 'cuts',
    'split', 'splitting', 'splits',
    'tear', 'tearing', 'torn', 'tore', 'tears',
    'crash', 'crashing', 'crashed', 'crashes',
    'crack', 'cracked', 'cracking', 'cracks',
    'snap', 'snapped', 'slice', 'sliced',
    'sever', 'severed', 'shard', 'shards', 'bleed', 'bled',
    'piece', 'pieces', 'fragment', 'splinter', 'rupture', 'wound'
  ],
  FADE: [
    'fade', 'fading', 'faded', 'fades',
    'ghost', 'ghostly', 'ghosts',
    'smoke', 'smoky', 'smoking',
    'lost', 'lose', 'losing',
    'memory', 'memories',
    'blur', 'blurred', 'blurry',
    'vanish', 'vanished', 'vanishing',
    'gone', 'depart', 'departed',
    'dust', 'mist', 'haze', 'vapor', 'shadow',
    'disappear', 'evaporate', 'dissolve', 'erase', 'forget', 'forgot', 'forgotten', 'breath', 'wind'
  ],
  ECHO: [
    'echo', 'echoing', 'echoes', 'echoed',
    'again', 'repeat', 'repeated', 'repeating',
    'call', 'calling', 'called', 'calls',
    'scream', 'screaming', 'screamed', 'screams',
    'voice', 'voices', 'shout', 'shouting', 'howl',
    'replay', 'resound', 'reverberate', 'ringing', 'rings', 'whisper', 'chorus', 'chant'
  ],
  PULSE: [
    'heart', 'hearts', 'heartbeat',
    'blood', 'bleed', 'pulse', 'pulsing',
    'fire', 'fiery', 'fires',
    'burn', 'burning', 'burned', 'burnt', 'burns',
    'sun', 'sunny', 'sunlight',
    'light', 'lit', 'lighting', 'lights',
    'gold', 'golden',
    'love', 'loved', 'loving',
    'flame', 'flames', 'warm', 'warmth', 'glow', 'blaze', 'ignite', 'sparks', 'fever', 'radiate'
  ]
};

// Fast lookup map
const STEM_MAP = new Map<string, SemanticEffect>();

for (const [effect, stems] of Object.entries(SEMANTIC_STEMS) as [SemanticEffect, string[]][]) {
  for (const stem of stems) {
    STEM_MAP.set(stem.toLowerCase(), effect);
  }
}

export function sanitizeWord(word: string): string {
  return word.toLowerCase().replace(/[^\w]/g, '').trim();
}

export function matchSemanticEffect(rawWord: string): SemanticEffect {
  const clean = sanitizeWord(rawWord);
  if (!clean || clean.length < 2) return 'NONE';

  const exact = STEM_MAP.get(clean);
  if (exact) return exact;

  // Suffix strip heuristics
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
