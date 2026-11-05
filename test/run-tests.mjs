import esbuild from 'esbuild';
import { spawnSync } from 'child_process';
import path from 'path';

await esbuild.build({
  entryPoints: ['test/unit-tests.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: 'dist/test.mjs',
  target: 'node18'
});

const res = spawnSync('node', ['dist/test.mjs'], { stdio: 'inherit' });
process.exit(res.status ?? 0);
