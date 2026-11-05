import { PaletteColors, PaletteType, ColorOKLCH, ColorRGB } from '../types/lyrics';

/**
 * AmbientLight.ts
 * Film-grade OKLCH 5-color palette engine and 1.2s smooth crossfade interpolator.
 * 
 * Extracts:
 * 1. Dominant: Atmospheric mood
 * 2. Accent: High-chroma hero moment highlights
 * 3. Shadow: Deep, rich background canvas (never pure black)
 * 4. Highlight: Specular flare / optical glow
 * 5. Text-Safe Tint: Guaranteed WCAG AAA contrast ratio (>= 8:1) against background
 */

// ─── OKLCH & sRGB Color Math ──────────────────────────────────────────────────

function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function linearToSrgb(c: number): number {
  const clamped = Math.max(0, Math.min(1, c));
  return clamped <= 0.0031308 ? clamped * 12.92 : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
}

export function rgbToOklch(r: number, g: number, b: number): ColorOKLCH {
  // r, g, b in 0..1
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);

  const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;

  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);

  const L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_;
  const a = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_;
  const b_ = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_;

  const C = Math.sqrt(a * a + b_ * b_);
  let h = (Math.atan2(b_, a) * 180) / Math.PI;
  if (h < 0) h += 360;

  return { l: L, c: C, h };
}

export function oklchToRgb(l: number, c: number, h: number): ColorRGB {
  const hRad = (h * Math.PI) / 180;
  const a = c * Math.cos(hRad);
  const b_ = c * Math.sin(hRad);

  const l_ = l + 0.3963377774 * a + 0.2158037573 * b_;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b_;
  const s_ = l - 0.0894841775 * a - 1.2914855480 * b_;

  const lCube = l_ * l_ * l_;
  const mCube = m_ * m_ * m_;
  const sCube = s_ * s_ * s_;

  const lr = +4.0767416621 * lCube - 3.3077115913 * mCube + 0.2309699292 * sCube;
  const lg = -1.2684380046 * lCube + 2.6097574011 * mCube - 0.3413193965 * sCube;
  const lb = -0.0041960863 * lCube - 0.7034186147 * mCube + 1.7076147010 * sCube;

  return {
    r: Math.max(0, Math.min(1, linearToSrgb(lr))),
    g: Math.max(0, Math.min(1, linearToSrgb(lg))),
    b: Math.max(0, Math.min(1, linearToSrgb(lb)))
  };
}

export function rgbToString(rgb: ColorRGB, alpha: number = 1.0): string {
  const r = Math.round(rgb.r * 255);
  const g = Math.round(rgb.g * 255);
  const b = Math.round(rgb.b * 255);
  return alpha < 1.0 ? `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(2)})` : `rgb(${r}, ${g}, ${b})`;
}

// ─── AmbientLight Palette Engine ──────────────────────────────────────────────

export class AmbientLight {
  private static cachedPalettes = new Map<string, PaletteColors>();

  public static getEditorialPalette(): PaletteColors {
    const dominantRGB: ColorRGB = { r: 0.36, g: 0.08, b: 0.13 };   // Oxblood Maroon #5C1421
    const accentRGB: ColorRGB = { r: 0.55, g: 0.11, b: 0.18 };     // Deep Crimson #8C1D2E
    const shadowRGB: ColorRGB = { r: 0.98, g: 0.98, b: 0.96 };     // Bone Cream #FAF9F6
    const highlightRGB: ColorRGB = { r: 0.10, g: 0.02, b: 0.04 };  // High-contrast ink
    const tintRGB: ColorRGB = { r: 0.12, g: 0.03, b: 0.05 };       // Text-safe ink

    return {
      type: 'editorial',
      primary: rgbToString(dominantRGB),
      secondary: rgbToString(accentRGB),
      highlight: rgbToString(highlightRGB),
      bg: '#FAF9F6',
      textInactive: 'rgba(92, 20, 33, 0.30)',
      isDark: false,
      dominant: rgbToString(dominantRGB),
      accent: rgbToString(accentRGB),
      shadow: rgbToString(shadowRGB),
      tint: rgbToString(tintRGB),
      rgbDominant: [dominantRGB.r, dominantRGB.g, dominantRGB.b],
      rgbAccent: [accentRGB.r, accentRGB.g, accentRGB.b],
      rgbShadow: [shadowRGB.r, shadowRGB.g, shadowRGB.b],
      rgbHighlight: [highlightRGB.r, highlightRGB.g, highlightRGB.b],
      rgbBg: [shadowRGB.r, shadowRGB.g, shadowRGB.b]
    };
  }

  public static getObsidianPalette(): PaletteColors {
    const dominantRGB: ColorRGB = { r: 0.55, g: 0.11, b: 0.18 };   // Deep Crimson
    const accentRGB: ColorRGB = { r: 0.88, g: 0.24, b: 0.32 };     // Coral Crimson
    const shadowRGB: ColorRGB = { r: 0.04, g: 0.03, b: 0.03 };     // Obsidian Dark #0A0808
    const highlightRGB: ColorRGB = { r: 0.98, g: 0.98, b: 0.96 };  // Crisp White
    const tintRGB: ColorRGB = { r: 0.98, g: 0.98, b: 0.96 };

    return {
      type: 'obsidian',
      primary: rgbToString(dominantRGB),
      secondary: rgbToString(accentRGB),
      highlight: rgbToString(highlightRGB),
      bg: '#0A0808',
      textInactive: 'rgba(250, 249, 246, 0.28)',
      isDark: true,
      dominant: rgbToString(dominantRGB),
      accent: rgbToString(accentRGB),
      shadow: rgbToString(shadowRGB),
      tint: rgbToString(tintRGB),
      rgbDominant: [dominantRGB.r, dominantRGB.g, dominantRGB.b],
      rgbAccent: [accentRGB.r, accentRGB.g, accentRGB.b],
      rgbShadow: [shadowRGB.r, shadowRGB.g, shadowRGB.b],
      rgbHighlight: [highlightRGB.r, highlightRGB.g, highlightRGB.b],
      rgbBg: [shadowRGB.r, shadowRGB.g, shadowRGB.b]
    };
  }

  public static resolveImageUrl(url: string | undefined): string {
    if (!url) return '';
    if (url.startsWith('spotify:image:')) {
      return `https://i.scdn.co/image/${url.replace('spotify:image:', '')}`;
    }
    return url;
  }

  /**
   * Extracts a 5-color film-grade OKLCH palette from album artwork
   */
  public static async extractAlbumPalette(rawUrl: string): Promise<PaletteColors> {
    const imageUrl = AmbientLight.resolveImageUrl(rawUrl);
    if (!imageUrl) {
      return this.getObsidianPalette();
    }

    if (this.cachedPalettes.has(imageUrl)) {
      return this.cachedPalettes.get(imageUrl)!;
    }

    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';

      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(this.getObsidianPalette());
            return;
          }

          const size = 48;
          canvas.width = size;
          canvas.height = size;
          ctx.drawImage(img, 0, 0, size, size);

          const data = ctx.getImageData(0, 0, size, size).data;

          interface Bucket {
            r: number;
            g: number;
            b: number;
            count: number;
            oklch: ColorOKLCH;
          }

          const bucketMap = new Map<number, Bucket>();

          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            // Quantize to 32-step buckets
            const qr = Math.floor(r / 24) * 24;
            const qg = Math.floor(g / 24) * 24;
            const qb = Math.floor(b / 24) * 24;
            const key = (qr << 16) | (qg << 8) | qb;

            const existing = bucketMap.get(key);
            if (existing) {
              existing.count++;
            } else {
              const oklch = rgbToOklch(r / 255, g / 255, b / 255);
              bucketMap.set(key, { r, g, b, count: 1, oklch });
            }
          }

          const buckets = Array.from(bucketMap.values());
          // Filter out near-pure blacks and unsaturated mud
          const candidateColors = buckets.filter(
            b => b.oklch.c > 0.04 && b.oklch.l > 0.12 && b.oklch.l < 0.88
          );

          if (candidateColors.length === 0) {
            resolve(this.getObsidianPalette());
            return;
          }

          // Score buckets: balance population count and OKLCH chroma (vibrancy)
          candidateColors.sort((a, b) => {
            const scoreA = Math.pow(a.count, 0.55) * Math.pow(a.oklch.c, 1.4) * (1 - Math.abs(a.oklch.l - 0.52));
            const scoreB = Math.pow(b.count, 0.55) * Math.pow(b.oklch.c, 1.4) * (1 - Math.abs(b.oklch.l - 0.52));
            return scoreB - scoreA;
          });

          const primaryBucket = candidateColors[0];

          // 1. Dominant: Boosted chroma for rich atmosphere, capped lightness
          const dominantL = Math.max(0.38, Math.min(0.68, primaryBucket.oklch.l));
          const dominantC = Math.max(0.12, Math.min(0.28, primaryBucket.oklch.c * 1.35));
          const dominantRGB = oklchToRgb(dominantL, dominantC, primaryBucket.oklch.h);

          // 2. Accent: Highest chroma complementary or triadic color
          let accentBucket = candidateColors[Math.min(1, candidateColors.length - 1)];
          for (let i = 1; i < candidateColors.length; i++) {
            const b = candidateColors[i];
            const hueDiff = Math.abs(b.oklch.h - primaryBucket.oklch.h);
            const normalizedHueDiff = hueDiff > 180 ? 360 - hueDiff : hueDiff;
            if (normalizedHueDiff > 40 && b.oklch.c > 0.08) {
              accentBucket = b;
              break;
            }
          }
          const accentL = Math.max(0.48, Math.min(0.74, accentBucket.oklch.l * 1.1));
          const accentC = Math.max(0.16, Math.min(0.32, accentBucket.oklch.c * 1.5));
          const accentRGB = oklchToRgb(accentL, accentC, accentBucket.oklch.h);

          // 3. Shadow: Deep rich atmospheric background (not pure black)
          const shadowL = 0.07 + dominantL * 0.05; // 0.09 .. 0.11
          const shadowC = Math.min(0.04, dominantC * 0.22);
          const shadowRGB = oklchToRgb(shadowL, shadowC, primaryBucket.oklch.h);

          // 4. Highlight: Luminous specular tint
          const highlightL = 0.94;
          const highlightC = Math.min(0.05, dominantC * 0.3);
          const highlightRGB = oklchToRgb(highlightL, highlightC, primaryBucket.oklch.h);

          // 5. Text-Safe Tint: Guaranteed WCAG AAA contrast (> 8:1) against shadow
          const tintRGB: ColorRGB = { r: 0.98, g: 0.98, b: 0.96 }; // Pure Bone White

          const dominantStr = rgbToString(dominantRGB);
          const accentStr = rgbToString(accentRGB);
          const shadowStr = rgbToString(shadowRGB);
          const highlightStr = rgbToString(highlightRGB);
          const tintStr = rgbToString(tintRGB);

          const palette: PaletteColors = {
            type: 'album',
            primary: dominantStr,
            secondary: accentStr,
            highlight: highlightStr,
            bg: shadowStr,
            textInactive: 'rgba(250, 249, 246, 0.32)',
            isDark: true,
            dominant: dominantStr,
            accent: accentStr,
            shadow: shadowStr,
            tint: tintStr,
            rgbDominant: [dominantRGB.r, dominantRGB.g, dominantRGB.b],
            rgbAccent: [accentRGB.r, accentRGB.g, accentRGB.b],
            rgbShadow: [shadowRGB.r, shadowRGB.g, shadowRGB.b],
            rgbHighlight: [highlightRGB.r, highlightRGB.g, highlightRGB.b],
            rgbBg: [shadowRGB.r, shadowRGB.g, shadowRGB.b]
          };

          this.cachedPalettes.set(imageUrl, palette);
          resolve(palette);
        } catch {
          resolve(this.getObsidianPalette());
        }
      };

      img.onerror = () => {
        resolve(this.getObsidianPalette());
      };

      img.src = imageUrl;
    });
  }

  public static async getPalette(type: PaletteType, albumArtUrl?: string): Promise<PaletteColors> {
    if (type === 'editorial') return this.getEditorialPalette();
    if (type === 'obsidian') return this.getObsidianPalette();
    return this.extractAlbumPalette(albumArtUrl || '');
  }
}

/**
 * PaletteCrossfader: Smooth 1.2s OKLCH / RGB interpolation between track palettes
 * Prevents hard visual pops on track changes.
 */
export class PaletteCrossfader {
  private currentPalette: PaletteColors;
  private targetPalette: PaletteColors;
  private progress: number = 1.0; // 0..1
  private duration: number = 1.2;  // 1.2s crossfade duration

  constructor(initialPalette: PaletteColors) {
    this.currentPalette = initialPalette;
    this.targetPalette = initialPalette;
  }

  public setTarget(newPalette: PaletteColors): void {
    if (this.progress < 1.0) {
      // If mid-transition, freeze current blended state as source
      this.currentPalette = this.getCurrentBlended();
    }
    this.targetPalette = newPalette;
    this.progress = 0.0;
  }

  public update(dt: number): PaletteColors {
    if (this.progress >= 1.0) {
      return this.targetPalette;
    }

    this.progress = Math.min(1.0, this.progress + dt / this.duration);
    // Smooth cubic ease-in-out
    const t = this.progress < 0.5
      ? 4 * this.progress * this.progress * this.progress
      : 1 - Math.pow(-2 * this.progress + 2, 3) / 2;

    const lerpColor = (c1: [number, number, number], c2: [number, number, number]): [number, number, number] => [
      c1[0] + (c2[0] - c1[0]) * t,
      c1[1] + (c2[1] - c1[1]) * t,
      c1[2] + (c2[2] - c1[2]) * t
    ];

    const rgbDom = lerpColor(this.currentPalette.rgbDominant, this.targetPalette.rgbDominant);
    const rgbAcc = lerpColor(this.currentPalette.rgbAccent, this.targetPalette.rgbAccent);
    const rgbSha = lerpColor(this.currentPalette.rgbShadow, this.targetPalette.rgbShadow);
    const rgbHig = lerpColor(this.currentPalette.rgbHighlight, this.targetPalette.rgbHighlight);
    const rgbBg  = lerpColor(this.currentPalette.rgbBg, this.targetPalette.rgbBg);

    const toStr = (rgb: [number, number, number]) =>
      `rgb(${Math.round(rgb[0] * 255)}, ${Math.round(rgb[1] * 255)}, ${Math.round(rgb[2] * 255)})`;

    return {
      type: this.targetPalette.type,
      primary: toStr(rgbDom),
      secondary: toStr(rgbAcc),
      highlight: toStr(rgbHig),
      bg: toStr(rgbSha),
      textInactive: this.targetPalette.textInactive,
      isDark: this.targetPalette.isDark,
      dominant: toStr(rgbDom),
      accent: toStr(rgbAcc),
      shadow: toStr(rgbSha),
      tint: this.targetPalette.tint,
      rgbDominant: rgbDom,
      rgbAccent: rgbAcc,
      rgbShadow: rgbSha,
      rgbHighlight: rgbHig,
      rgbBg: rgbBg
    };
  }

  public getCurrentBlended(): PaletteColors {
    return this.update(0);
  }

  public isComplete(): boolean {
    return this.progress >= 1.0;
  }
}
