/**
 * Vendor electron-updater into electron/vendor using a temporary npm install
 * so packaged Electron builds get a self-contained updater (pnpm-safe).
 */
const { execSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = path.join(__dirname, '..');
const vendorRoot = path.join(root, 'electron', 'vendor');
const rootPkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const updaterRange = rootPkg.dependencies?.['electron-updater'];

if (!updaterRange) {
  console.error('[vendor-electron-updater] electron-updater missing from package.json dependencies');
  process.exit(1);
}

function rimraf(target) {
  fs.rmSync(target, { recursive: true, force: true });
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'm4trix-updater-vendor-'));
try {
  fs.writeFileSync(
    path.join(tmp, 'package.json'),
    JSON.stringify(
      {
        name: 'm4trix-updater-vendor',
        private: true,
        dependencies: {
          'electron-updater': updaterRange,
        },
      },
      null,
      2,
    ),
    'utf8',
  );

  console.log(`[vendor-electron-updater] npm install in ${tmp}`);
  execSync('npm install --omit=dev --no-package-lock --no-fund --no-audit', {
    cwd: tmp,
    stdio: 'inherit',
    env: { ...process.env, npm_config_fund: 'false' },
  });

  rimraf(vendorRoot);
  ensureDir(vendorRoot);
  fs.cpSync(path.join(tmp, 'node_modules'), path.join(vendorRoot, 'node_modules'), {
    recursive: true,
  });

  fs.writeFileSync(
    path.join(vendorRoot, 'electron-updater.js'),
    "module.exports = require('./node_modules/electron-updater');\n",
    'utf8',
  );

  const names = fs
    .readdirSync(path.join(vendorRoot, 'node_modules'))
    .filter((name) => name !== '.bin' && !name.startsWith('.'));
  console.log(
    `[vendor-electron-updater] ready (${names.length} top-level packages) at ${vendorRoot}`,
  );
} finally {
  rimraf(tmp);
}
