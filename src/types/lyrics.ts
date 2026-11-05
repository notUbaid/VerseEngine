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

export interface SongSection {
  name: 'intro' | 'verse' | 'chorus' | 'bridge' | 'interlude' | 'outro';
  startMs: number;
  endMs: number;
  energy: number;
}

export interface ProcessedTrack {
  uri: string;
  title: string;
  artist: string;
  album: string;
  albumArtUrl: string;
  durationMs: number;
  lines: LyricLine[];
  sections?: SongSection[];
  hasLyrics?: boolean;
  isAd?: boolean;
  isPodcast?: boolean;
}

export interface ColorRGB {
  r: number; // 0..1
  g: number; // 0..1
  b: number; // 0..1
}

export interface ColorOKLCH {
  l: number; // 0..1
  c: number; // 0..0.4
  h: number; // 0..360
}

export interface PaletteColors {
  type: PaletteType;
  primary: string;        // Hex or rgb string for CSS
  secondary: string;
  highlight: string;
  bg: string;
  textInactive: string;
  isDark: boolean;

  // Film-grade 5-color OKLCH palette tokens
  dominant: string;       // Atmospheric mood
  accent: string;         // Hero kinetic moments
  shadow: string;         // Deep backdrop shade
  tint: string;           // Guaranteed WCAG AAA contrast against background
  
  // Normalized 0..1 floats for WebGL uniforms
  rgbDominant: [number, number, number];
  rgbAccent: [number, number, number];
  rgbShadow: [number, number, number];
  rgbHighlight: [number, number, number];
  rgbBg: [number, number, number];
}

export interface AudioBeatInfo {
  beatIndex: number;
  timeMs: number;
  durationMs: number;
  isDownbeat: boolean;
  energy: number;       // 0..1
  loudness: number;     // dB
  beatPulse: number;    // 0..1 decaying impulse
}
