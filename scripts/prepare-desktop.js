/**
 * Prepare Next.js standalone output for Electron packaging.
 *
 * Expects a prior: M4TRIX_BUILD_TARGET=desktop pnpm build
 * Copies:
 *   .next/standalone  -> desktop-dist/
 *   .next/static      -> desktop-dist/.next/static
 *   public            -> desktop-dist/public
 */
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const standalone = path.join(root, '.next', 'standalone');
const staticDir = path.join(root, '.next', 'static');
const publicDir = path.join(root, 'public');
const outDir = path.join(root, 'desktop-dist');

function exists(p) {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

function rmrf(p) {
  fs.rmSync(p, { recursive: true, force: true });
}

function copyDir(src, dest) {
  fs.cpSync(src, dest, { recursive: true });
}

if (!exists(standalone)) {
  console.error(
    '[desktop:prepare] Missing .next/standalone. Run: pnpm desktop:build',
  );
  process.exit(1);
}

if (!exists(staticDir)) {
  console.error('[desktop:prepare] Missing .next/static after build.');
  process.exit(1);
}

rmrf(outDir);
copyDir(standalone, outDir);

const destNext = path.join(outDir, '.next');
fs.mkdirSync(destNext, { recursive: true });
copyDir(staticDir, path.join(destNext, 'static'));

if (exists(publicDir)) {
  copyDir(publicDir, path.join(outDir, 'public'));
}

const serverJs = path.join(outDir, 'server.js');
if (!exists(serverJs)) {
  console.error('[desktop:prepare] desktop-dist/server.js missing after copy.');
  process.exit(1);
}

// Ensure top-level aliases for packages Next resolves at runtime (pnpm layout).
const nestedMods = path.join(outDir, 'node_modules', '.pnpm', 'node_modules');
const topMods = path.join(outDir, 'node_modules');
if (exists(nestedMods)) {
  for (const name of fs.readdirSync(nestedMods)) {
    if (name.startsWith('.')) continue;
    const src = path.join(nestedMods, name);
    const dest = path.join(topMods, name);
    if (exists(dest)) continue;
    try {
      // Prefer real copies so electron packaging does not drop junctions.
      copyDir(src, dest);
    } catch (err) {
      console.warn(`[desktop:prepare] could not copy ${name}:`, err.message);
    }
  }
}

console.log(`[desktop:prepare] Ready: ${outDir}`);
