/**
 * Repair a broken Electron binary install.
 *
 * On some Windows paths (notably deep pnpm store folders on USB/external drives),
 * extract-zip silently fails partway through. This script downloads/uses the
 * cached zip, extracts to a short temp path, then copies into the electron package.
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

function findElectronPackage(root) {
  const pnpm = path.join(root, 'node_modules', '.pnpm');
  if (!fs.existsSync(pnpm)) {
    throw new Error('node_modules/.pnpm not found — run pnpm install first');
  }
  const dirs = fs
    .readdirSync(pnpm)
    .filter((name) => name.startsWith('electron@'))
    .sort()
    .reverse();
  if (!dirs.length) {
    throw new Error('No electron package found under node_modules/.pnpm');
  }
  return path.join(pnpm, dirs[0], 'node_modules', 'electron');
}

function main() {
  const root = process.cwd();
  const electronDir = findElectronPackage(root);
  const { version } = require(path.join(electronDir, 'package.json'));
  const distPath = path.join(electronDir, 'dist');
  const exePath = path.join(distPath, 'electron.exe');

  if (fs.existsSync(exePath) && fs.existsSync(path.join(electronDir, 'path.txt'))) {
    console.log(`[electron:repair] Already installed: ${exePath}`);
    return;
  }

  console.log(`[electron:repair] Repairing electron@${version} at ${electronDir}`);

  // Prefer @electron/get from the electron package context.
  const getPath = require.resolve('@electron/get', { paths: [electronDir] });
  const { downloadArtifact } = require(getPath);
  const checksums = require(path.join(electronDir, 'checksums.json'));

  const tmpRoot = path.join(os.tmpdir(), `m4trix-electron-${version}`);
  const zipPromise = downloadArtifact({
    version,
    artifactName: 'electron',
    force: process.env.force_no_cache === 'true',
    platform: process.platform,
    arch: process.arch,
    checksums,
  });

  zipPromise
    .then((zipPath) => {
      console.log(`[electron:repair] zip ${zipPath}`);
      fs.rmSync(tmpRoot, { recursive: true, force: true });
      fs.mkdirSync(tmpRoot, { recursive: true });

      if (process.platform === 'win32') {
        // Expand-Archive is more reliable than extract-zip on some external drives.
        const ps = spawnSync(
          'powershell.exe',
          [
            '-NoProfile',
            '-Command',
            `Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${tmpRoot.replace(/'/g, "''")}' -Force`,
          ],
          { stdio: 'inherit' },
        );
        if (ps.status !== 0) {
          throw new Error('Expand-Archive failed');
        }
      } else {
        const extract = require(require.resolve('extract-zip', { paths: [electronDir] }));
        return extract(zipPath, { dir: tmpRoot }).then(() => zipPath);
      }
      return zipPath;
    })
    .then(() => {
      const extractedExe = path.join(tmpRoot, process.platform === 'win32' ? 'electron.exe' : 'electron');
      if (!fs.existsSync(extractedExe)) {
        throw new Error(`Extracted binary missing at ${extractedExe}`);
      }

      fs.rmSync(distPath, { recursive: true, force: true });
      fs.cpSync(tmpRoot, distPath, { recursive: true });
      fs.writeFileSync(
        path.join(electronDir, 'path.txt'),
        process.platform === 'win32' ? 'electron.exe' : 'electron',
      );
      fs.rmSync(tmpRoot, { recursive: true, force: true });
      console.log(`[electron:repair] OK — ${path.join(distPath, process.platform === 'win32' ? 'electron.exe' : 'electron')}`);
    })
    .catch((err) => {
      console.error('[electron:repair] failed:', err.stack || err);
      process.exit(1);
    });
}

main();
