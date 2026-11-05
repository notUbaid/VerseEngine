import esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';

const outdir = 'dist';
if (!fs.existsSync(outdir)) {
  fs.mkdirSync(outdir, { recursive: true });
}

console.log('[VerseEngine] Bundling extension with esbuild...');

try {
  await esbuild.build({
    entryPoints: ['src/app.tsx'],
    bundle: true,
    outfile: 'dist/verse-engine.js',
    format: 'iife',
    globalName: 'VerseEngineBundle',
    platform: 'browser',
    target: ['chrome100', 'es2022'],
    minify: false, // Keep readable for inspection/debugging in dev tools
    sourcemap: false,
    define: {
      'process.env.NODE_ENV': '"production"',
      'global': 'window',
    },
    loader: {
      '.glsl': 'text',
      '.vert': 'text',
      '.frag': 'text',
      '.css': 'text',
    },
  });

  console.log('[VerseEngine] Build completed successfully -> dist/verse-engine.js');

  // Copy to Spicetify Extensions (Roaming & Local) and directly to extracted Spotify xpui
  const targets = [
    path.join(process.env.APPDATA || '', 'spicetify', 'Extensions', 'verse-engine.js'),
    path.join(process.env.LOCALAPPDATA || '', 'spicetify', 'Extensions', 'verse-engine.js'),
    path.join(process.env.APPDATA || '', 'Spotify', 'Apps', 'xpui', 'extensions', 'verse-engine.js')
  ];

  for (const target of targets) {
    try {
      const dir = path.dirname(target);
      if (fs.existsSync(dir)) {
        fs.copyFileSync('dist/verse-engine.js', target);
        console.log(`[VerseEngine] Deployed to: ${target}`);
      }
    } catch (e) {
      console.warn(`[VerseEngine] Could not copy to ${target}:`, e.message);
    }
  }
} catch (err) {
  console.error('[VerseEngine] Build failed:', err);
  process.exit(1);
}
