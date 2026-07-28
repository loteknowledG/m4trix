/**
 * Static export (`output: "export"`) cannot use proxy or runtime
 * `/characters/[id]` routes. Strip them before GitHub Pages builds.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const proxyPath = path.join(root, 'src', 'proxy.ts');
const proxyBackup = path.join(root, 'src', 'proxy.dev.ts');
const legacyRouteDir = path.join(root, 'src', 'app', '(site)', 'characters', '[id]');

function rmrf(target) {
  if (fs.existsSync(target)) {
    fs.rmSync(target, { recursive: true, force: true });
  }
}

if (fs.existsSync(proxyPath)) {
  fs.renameSync(proxyPath, proxyBackup);
  console.log('[prepare-pages-export] moved src/proxy.ts → proxy.dev.ts');
}

rmrf(legacyRouteDir);
if (fs.existsSync(legacyRouteDir)) {
  console.log('[prepare-pages-export] removed characters/[id]');
} else {
  console.log('[prepare-pages-export] characters/[id] already absent');
}
