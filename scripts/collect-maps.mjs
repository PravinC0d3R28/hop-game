// scripts/collect-maps.mjs
// 6.5 profile 3: private error-analysis build.
// After `vite build --mode analyze` (sourcemap: 'hidden'), move the generated
// .map files OUT of dist/ (the public package) into error-maps/ so they are
// retained privately for error analysis but never shipped to the portal.
import { copyFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const distAssets = join(process.cwd(), 'dist', 'assets');
const outDir = join(process.cwd(), 'error-maps', 'assets');

mkdirSync(outDir, { recursive: true });

let moved = 0;
for (const file of readdirSync(distAssets)) {
  if (file.endsWith('.map')) {
    copyFileSync(join(distAssets, file), join(outDir, file));
    rmSync(join(distAssets, file));
    moved += 1;
  }
}

console.log(`collect-maps: moved ${moved} .map file(s) to error-maps/ (outside the public package)`);