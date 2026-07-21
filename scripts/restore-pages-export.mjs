/**
 * Restore dev middleware after a local static-export build.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const middlewarePath = path.join(root, 'src', 'middleware.ts');
const middlewareBackup = path.join(root, 'src', 'middleware.dev.ts');

if (fs.existsSync(middlewareBackup)) {
  if (fs.existsSync(middlewarePath)) {
    fs.rmSync(middlewarePath, { force: true });
  }
  fs.renameSync(middlewareBackup, middlewarePath);
  console.log('[restore-pages-export] restored src/middleware.ts');
} else {
  console.log('[restore-pages-export] nothing to restore');
}
