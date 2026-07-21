/**
 * Static export (`output: "export"`) cannot use middleware or runtime
 * `/characters/[id]` routes. Strip them before GitHub Pages builds.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const middlewarePath = path.join(root, 'src', 'middleware.ts');
const middlewareBackup = path.join(root, 'src', 'middleware.dev.ts');
const legacyRouteDir = path.join(root, 'src', 'app', '(site)', 'characters', '[id]');

function rmrf(target) {
  if (fs.existsSync(target)) {
    fs.rmSync(target, { recursive: true, force: true });
  }
}

if (fs.existsSync(middlewarePath)) {
  fs.renameSync(middlewarePath, middlewareBackup);
  console.log('[prepare-pages-export] moved src/middleware.ts → middleware.dev.ts');
}

rmrf(legacyRouteDir);
if (fs.existsSync(legacyRouteDir)) {
  console.log('[prepare-pages-export] removed characters/[id]');
} else {
  console.log('[prepare-pages-export] characters/[id] already absent');
}
