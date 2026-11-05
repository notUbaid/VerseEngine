export type VisualStyle = 'convex' | 'drift' | 'editorial' | 'semantic';
export type PaletteType = 'album' | 'editorial' | 'obsidian';

export type SemanticEffect =
  | 'NONE'
  | 'GRAVITY'   // fall, drop, sink, down, heavy, drown, low
  | 'FRACTURE'  // break, broken, shatter, cut, split, tear, crash
  | 'FADE'      // fade, ghost, smoke, lost, memory, blur, vanish, gone
  | 'ECHO'      // echo, again, repeat, call, scream, voice
  | 'PULSE';    // heart, blood, fire, burn, sun, light, gold, love

export interface LyricChar {
  char: string;
  indexInWord: number;
  startMs: number;
  endMs: number;
  durationMs: number;
}

export interface LyricWord {
  id: string;
  text: string;
  cleanText: string;
  startMs: number;
  endMs: number;
  durationMs: number;
  isMelisma: boolean;
  isAdLib: boolean;
  semanticEffect: SemanticEffect;
  chars: LyricChar[];
}

export interface LyricLine {
  id: string;
  index: number;
  startMs: number;
  endMs: number;
  words: LyricWord[];
  adLibs: LyricWord[];
}

export interface ProcessedTrack {
  uri: string;
  title: string;
  artist: string;
  album: string;
  albumArtUrl: string;
  durationMs: number;
  lines: LyricLine[];
}

export interface PaletteColors {
  type: PaletteType;
  primary: string;     // 60% weight
  secondary: string;   // 30% weight
  highlight: string;   // 10% weight
  bg: string;
  textInactive: string;
  isDark: boolean;
}
