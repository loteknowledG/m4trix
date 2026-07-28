/**
 * Restore dev proxy after a local static-export build.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const proxyPath = path.join(root, 'src', 'proxy.ts');
const proxyBackup = path.join(root, 'src', 'proxy.dev.ts');

if (fs.existsSync(proxyBackup)) {
  if (fs.existsSync(proxyPath)) {
    fs.rmSync(proxyPath, { force: true });
  }
  fs.renameSync(proxyBackup, proxyPath);
  console.log('[restore-pages-export] restored src/proxy.ts');
} else {
  console.log('[restore-pages-export] nothing to restore');
}
