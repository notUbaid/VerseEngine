import { PaletteColors, PaletteType } from '../types/lyrics';

/**
 * AmbientLight.ts
 * Lumn-style ambient rim lighting and 3-color album art palette engine.
 * Inspired by trylumn.xyz and verci.xyz:
 * - 60% Primary / 30% Secondary / 10% Highlight
 * - Full-viewport inner bezel ambient rim bleed that breathes with vocal activity
 */

export class AmbientLight {
  private static cachedPalettes = new Map<string, PaletteColors>();

  public static getEditorialPalette(): PaletteColors {
    return {
      type: 'editorial',
      primary: '#5C1421',
      secondary: '#8C1D2E',
      highlight: '#FAF9F6',
      bg: '#FAF9F6',
      textInactive: 'rgba(92, 20, 33, 0.22)',
      isDark: false
    };
  }

  public static getObsidianPalette(): PaletteColors {
    return {
      type: 'obsidian',
      primary: '#FAF9F6',
      secondary: '#7A1C2D',
      highlight: '#FAF9F6',
      bg: '#0A0808',
      textInactive: 'rgba(250, 249, 246, 0.24)',
      isDark: true
    };
  }

  public static async extractAlbumPalette(imageUrl: string): Promise<PaletteColors> {
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

          canvas.width = 36;
          canvas.height = 36;
          ctx.drawImage(img, 0, 0, 36, 36);

          const data = ctx.getImageData(0, 0, 36, 36).data;
          interface ColorScore {
            r: number;
            g: number;
            b: number;
            sat: number;
            lum: number;
            count: number;
          }

          const samples: ColorScore[] = [];

          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            const sat = max === 0 ? 0 : (max - min) / max;
            const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

            // Filter out muddy/washed out grays
            if (sat > 0.18 && lum > 0.15 && lum < 0.90) {
              samples.push({ r, g, b, sat, lum, count: 1 });
            }
          }

          if (samples.length === 0) {
            resolve(this.getObsidianPalette());
            return;
          }

          // Sort by saturation and pick vibrant Primary (60%) and harmonizing Secondary (30%)
          samples.sort((a, b) => b.sat - a.sat);
          const primarySample = samples[0];

          // Secondary: pick sample with contrasting hue/lum
          let secondarySample = samples[Math.floor(samples.length * 0.4)] || primarySample;
          for (let i = 1; i < samples.length; i++) {
            const s = samples[i];
            const colorDist = Math.abs(s.r - primarySample.r) + Math.abs(s.g - primarySample.g) + Math.abs(s.b - primarySample.b);
            if (colorDist > 80) {
              secondarySample = s;
              break;
            }
          }

          const primary = `rgb(${primarySample.r}, ${primarySample.g}, ${primarySample.b})`;
          const secondary = `rgb(${secondarySample.r}, ${secondarySample.g}, ${secondarySample.b})`;
          const highlight = '#FFFFFF';

          // Deep atmospheric tinted background based on primary hue
          const bgR = Math.round(primarySample.r * 0.08);
          const bgG = Math.round(primarySample.g * 0.08);
          const bgB = Math.round(primarySample.b * 0.09);
          const bg = `rgb(${bgR}, ${bgG}, ${bgB})`;

          const palette: PaletteColors = {
            type: 'album',
            primary,
            secondary,
            highlight,
            bg,
            textInactive: 'rgba(250, 249, 246, 0.28)',
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
