/**
 * Launch Electron against the prepared desktop-dist server (no installer).
 * Useful as a pre-pack smoke test after `pnpm desktop:prepare`.
 */
const { spawn } = require('child_process');

const child = spawn('pnpm', ['exec', 'electron', '.'], {
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    M4TRIX_USE_PACKAGED_SERVER: '1',
  },
});

child.on('exit', (code) => {
  process.exit(code ?? 1);
});
