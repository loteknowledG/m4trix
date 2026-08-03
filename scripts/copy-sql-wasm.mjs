import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const wasmTargetDir = join(rootDir, 'public', 'wasm');

/** Browser vs Node sql.js builds request different wasm filenames. */
const WASM_FILES = ['sql-wasm.wasm', 'sql-wasm-browser.wasm'];

mkdirSync(wasmTargetDir, { recursive: true });

let copied = 0;

for (const file of WASM_FILES) {
  const wasmSource = join(rootDir, 'node_modules', 'sql.js', 'dist', file);
  const wasmTarget = join(wasmTargetDir, file);

  if (!existsSync(wasmSource)) {
    console.warn(`sql.js wasm not found at ${wasmSource}; run pnpm install first.`);
    continue;
  }

  copyFileSync(wasmSource, wasmTarget);
  console.log(`Copied ${wasmSource} -> ${wasmTarget}`);
  copied += 1;
}

if (copied === 0) {
  process.exit(0);
}
