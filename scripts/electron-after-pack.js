/**
 * electron-builder afterPack hook.
 * Forces a full copy of desktop-dist -> resources/app-server, including
 * node_modules (electron-builder's default filters often strip them).
 */
const fs = require('fs');
const path = require('path');

exports.default = async function afterPack(context) {
  const projectDir = context.packager.projectDir;
  const src = path.join(projectDir, 'desktop-dist');
  const dest = path.join(context.appOutDir, 'resources', 'app-server');

  if (!fs.existsSync(path.join(src, 'server.js'))) {
    throw new Error(`[afterPack] Missing ${src}/server.js — run pnpm desktop:prepare first`);
  }

  fs.rmSync(dest, { recursive: true, force: true });
  fs.cpSync(src, dest, {
    recursive: true,
    // dereference junctions/symlinks so Windows packaged trees stay self-contained
    dereference: true,
  });

  if (!fs.existsSync(path.join(dest, 'node_modules', 'next'))) {
    throw new Error('[afterPack] app-server/node_modules/next missing after copy');
  }

  console.log(`[afterPack] Copied desktop-dist -> ${dest}`);
};
