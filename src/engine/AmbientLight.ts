import { PaletteColors, PaletteType } from '../types/lyrics';

/**
 * AmbientLight.ts
 * Quantized album art palette engine and Lumn-style ambient rim colors.
 * - Extracts vibrant Primary (60%), harmonizing Secondary (30%), and crisp Highlight (10%)
 * - Population-weighted color quantization with contrast guarantees
 * - Supports spotify:image: URI resolution to https://i.scdn.co/image/<id>
 */

export class AmbientLight {
  private static cachedPalettes = new Map<string, PaletteColors>();

  public static getEditorialPalette(): PaletteColors {
    return {
      type: 'editorial',
      primary: '#5C1421',       // Rich Oxblood Maroon
      secondary: '#8C1D2E',     // Deep Crimson
      highlight: '#180407',     // High-contrast ink
      bg: '#FAF9F6',            // Warm Bone Cream
      textInactive: 'rgba(92, 20, 33, 0.28)',
      isDark: false
    };
  }

  public static getObsidianPalette(): PaletteColors {
    return {
      type: 'obsidian',
      primary: '#FAF9F6',
      secondary: '#8C1D2E',
      highlight: '#FAF9F6',
      bg: '#0A0808',
      textInactive: 'rgba(250, 249, 246, 0.28)',
      isDark: true
    };
  }

  public static resolveImageUrl(url: string | undefined): string {
    if (!url) return '';
    if (url.startsWith('spotify:image:')) {
      return `https://i.scdn.co/image/${url.replace('spotify:image:', '')}`;
    }
    return url;
  }

  public static async extractAlbumPalette(rawUrl: string): Promise<PaletteColors> {
    const imageUrl = AmbientLight.resolveImageUrl(rawUrl);
    if (!imageUrl) {
      return this.getObsidianPalette();
    }

    if (this.cachedPalettes.has(imageUrl)) {
      return this.cachedPalettes.get(imageUrl)!;
    }

    return new Promise((resolve) => {
      // 1. If Spicetify.colorExtractor is available natively, check it
      if (typeof Spicetify !== 'undefined' && (Spicetify as any).colorExtractor) {
        try {
          const colors = (Spicetify as any).colorExtractor(imageUrl);
          if (colors && colors.VIBRANT) {
            const pal: PaletteColors = {
              type: 'album',
              primary: colors.VIBRANT,
              secondary: colors.DARK_VIBRANT || colors.LIGHT_VIBRANT || '#8C1D2E',
              highlight: '#FAF9F6',
              bg: colors.DARK_MUTED || '#0A0808',
              textInactive: 'rgba(250, 249, 246, 0.28)',
              isDark: true
            };
            this.cachedPalettes.set(imageUrl, pal);
            resolve(pal);
            return;
          }
        } catch {
          // Fall through to manual canvas extraction
        }
      }

      // 2. Offscreen Canvas Quantization
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
            sat: number;
            lum: number;
          }

          // Quantize into 16-color RGB buckets (4 bits per channel)
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
              const max = Math.max(r, g, b);
              const min = Math.min(r, g, b);
              const sat = max === 0 ? 0 : (max - min) / max;
              const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
              bucketMap.set(key, { r, g, b, count: 1, sat, lum });
            }
          }

          const buckets = Array.from(bucketMap.values());
          // Filter out near-pure blacks, near-whites, and completely unsaturated mud
          const candidateColors = buckets.filter(
            b => b.sat > 0.16 && b.lum > 0.12 && b.lum < 0.88
          );

          if (candidateColors.length === 0) {
            resolve(this.getObsidianPalette());
            return;
          }

          // Score buckets: balance population count and saturation (60/30/10 rule)
          candidateColors.sort((a, b) => {
            const scoreA = Math.pow(a.count, 0.6) * Math.pow(a.sat, 1.2) * (1 - Math.abs(a.lum - 0.55));
            const scoreB = Math.pow(b.count, 0.6) * Math.pow(b.sat, 1.2) * (1 - Math.abs(b.lum - 0.55));
            return scoreB - scoreA;
          });

          const primaryBucket = candidateColors[0];

          // Pick secondary with distinct hue or luminance difference
          let secondaryBucket = candidateColors[Math.min(1, candidateColors.length - 1)];
          for (let i = 1; i < candidateColors.length; i++) {
            const b = candidateColors[i];
            const colorDist = Math.abs(b.r - primaryBucket.r) + Math.abs(b.g - primaryBucket.g) + Math.abs(b.b - primaryBucket.b);
            if (colorDist > 75) {
              secondaryBucket = b;
              break;
            }
          }

          const primary = `rgb(${primaryBucket.r}, ${primaryBucket.g}, ${primaryBucket.b})`;
          const secondary = `rgb(${secondaryBucket.r}, ${secondaryBucket.g}, ${secondaryBucket.b})`;
          const highlight = '#FAF9F6';

          // Atmospheric dark background with genuine depth (not near-black 0.08)
          const bgR = Math.min(26, Math.max(8, Math.round(primaryBucket.r * 0.14 + 6)));
          const bgG = Math.min(24, Math.max(7, Math.round(primaryBucket.g * 0.14 + 5)));
          const bgB = Math.min(30, Math.max(9, Math.round(primaryBucket.b * 0.16 + 7)));
          const bg = `rgb(${bgR}, ${bgG}, ${bgB})`;

          const palette: PaletteColors = {
            type: 'album',
            primary,
            secondary,
            highlight,
            bg,
            textInactive: 'rgba(250, 249, 246, 0.32)',
            isDark: true
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
