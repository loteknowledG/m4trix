/**
 * Build Next.js with the desktop (standalone) target.
 */
const { spawnSync } = require('child_process');

const env = {
  ...process.env,
  M4TRIX_BUILD_TARGET: 'desktop',
};

const prepare = spawnSync('node', ['scripts/write-api-dynamic.mjs'], {
  stdio: 'inherit',
  env,
  shell: true,
});
if ((prepare.status ?? 1) !== 0) {
  process.exit(prepare.status ?? 1);
}

const result = spawnSync('pnpm', ['exec', 'next', 'build'], {
  stdio: 'inherit',
  env,
  shell: true,
});

process.exit(result.status ?? 1);
