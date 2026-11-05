import esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import os from 'os';

const outdir = 'dist';
if (!fs.existsSync(outdir)) {
  fs.mkdirSync(outdir, { recursive: true });
}

console.log('[VerseEngine] Bundling extension with esbuild...');

try {
  await esbuild.build({
    entryPoints: ['src/app.ts'],
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

  // Copy to Spicetify Extensions (Windows Roaming/Local, Linux/macOS configs, and Spotify client xpui)
  const homeDir = os.homedir();
  const targets = [
    // Windows standard Spicetify extension paths
    process.env.APPDATA ? path.join(process.env.APPDATA, 'spicetify', 'Extensions', 'verse-engine.js') : '',
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'spicetify', 'Extensions', 'verse-engine.js') : '',
    process.env.APPDATA ? path.join(process.env.APPDATA, 'Spotify', 'Apps', 'xpui', 'extensions', 'verse-engine.js') : '',
    // Linux / macOS standard Spicetify extension paths
    path.join(homeDir, '.config', 'spicetify', 'Extensions', 'verse-engine.js'),
    path.join(homeDir, '.spicetify', 'Extensions', 'verse-engine.js')
  ].filter(Boolean);

  let copiedCount = 0;
  for (const target of targets) {
    try {
      const dir = path.dirname(target);
      if (fs.existsSync(dir)) {
        fs.copyFileSync('dist/verse-engine.js', target);
        console.log(`[VerseEngine] Deployed to: ${target}`);
        copiedCount++;
      }
    } catch (e) {
      // Non-fatal if target directory is not present
    }
  }

  if (copiedCount === 0) {
    console.log('[VerseEngine] Note: No installed Spicetify Extensions directory auto-detected on standard paths. Use `dist/verse-engine.js`.');
  }
} catch (err) {
  console.error('[VerseEngine] Build failed:', err);
  process.exit(1);
}
