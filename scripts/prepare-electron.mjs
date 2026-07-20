import { cpSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const standaloneDir = path.join(root, '.next', 'standalone');
const staticSrc = path.join(root, '.next', 'static');
const publicSrc = path.join(root, 'public');

if (!existsSync(standaloneDir)) {
  console.error(
    'Missing .next/standalone. Run with ELECTRON_BUILD=true (pnpm electron:prepare).'
  );
  process.exit(1);
}

if (!existsSync(staticSrc)) {
  console.error('Missing .next/static after Next build.');
  process.exit(1);
}

if (!existsSync(publicSrc)) {
  console.error('Missing public/ directory.');
  process.exit(1);
}

const staticDest = path.join(standaloneDir, '.next', 'static');
const publicDest = path.join(standaloneDir, 'public');

mkdirSync(path.join(standaloneDir, '.next'), { recursive: true });
cpSync(staticSrc, staticDest, { recursive: true });
cpSync(publicSrc, publicDest, { recursive: true });

console.log('Prepared Electron Next.js standalone resources in .next/standalone');
