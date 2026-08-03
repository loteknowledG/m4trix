import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const wasmSource = join(rootDir, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
const wasmTargetDir = join(rootDir, 'public', 'wasm');
const wasmTarget = join(wasmTargetDir, 'sql-wasm.wasm');

if (!existsSync(wasmSource)) {
  console.warn(`sql.js wasm not found at ${wasmSource}; run pnpm install first.`);
  process.exit(0);
}

mkdirSync(wasmTargetDir, { recursive: true });
copyFileSync(wasmSource, wasmTarget);
console.log(`Copied ${wasmSource} -> ${wasmTarget}`);
