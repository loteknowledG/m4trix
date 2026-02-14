# m4trix: Agent-Based Sitcom Playground

## Project Overview

m4trix is a Next.js application designed as a playground for experimenting with agent-based sitcom environments and entertainment systems. The architecture is local-first, prioritizing user privacy and offline capability.

## Installation

**Prerequisites**

- `Node.js` (LTS) — Node 18 or 20 recommended
- `pnpm` (project uses `pnpm@10.28.2`) — install via Corepack or npm
- (optional) `git`

**Quick start (development)**

Clone & get started (PowerShell — beginner-friendly)

1. Clone the repository (HTTPS):
   - `git clone https://github.com/loteknowledG/m4trix.git`
   - (or SSH) `git clone git@github.com:loteknowledG/m4trix.git`
2. Change into the project folder:
   - `cd m4trix`
3. Verify / select Node.js (LTS):
   - `node -v` (Node 18 or 20 recommended)
   - (optional) with nvm-windows: `nvm install 18.20.0` then `nvm use 18.20.0`
4. Enable Corepack and activate the repository pnpm version (recommended):
   - `corepack enable`
   - `corepack prepare pnpm@10.28.2 --activate`
     If Corepack is unavailable, install pnpm globally:
   - `npm i -g pnpm@10.28.2`
5. Install dependencies:
   - `pnpm install`
6. Start the dev server:
   - `pnpm dev`
   - Open `http://localhost:3000` in your browser

If you already cloned the repo, skip steps 1–2 and start at step 3.

Optional — run the Electron desktop wrapper:

- `pnpm run electron:dev`

Install as a PWA (browser)

- With the dev server running at `http://localhost:3000`:
  - Desktop (Chrome / Edge): click the install icon in the address bar or open the browser menu → `Install app`.
  - Android (Chrome): open the browser menu → `Add to Home screen` or accept the install prompt.
  - iOS (Safari): open the Share menu → `Add to Home Screen` (iOS shows no automatic install prompt).
  - Firefox (desktop/mobile): PWA handling varies — use a production build to test the service worker.
- Files to edit for PWA behaviour: `public/manifest.json`, `sw.js`.
- Quick dev tip: use DevTools → Application → Service Workers → `Update on reload` or `Unregister` while developing.

Common issues & quick fixes

- `pnpm` not found: run `corepack enable` then `corepack prepare pnpm@10.28.2 --activate`, or `npm i -g pnpm@10.28.2`.
- Permission errors on Windows: run PowerShell as Administrator.
- Node version mismatch: use `nvm-windows` to switch to Node 18/20.
- If you previously ran `npm install`: remove `node_modules` and `package-lock.json` (if present), then run `pnpm install` to use the repository lockfile.

**Build & production**

- `pnpm build`
- `pnpm start`
- `pnpm run electron:prod` (build + launch desktop app)

**Checks & troubleshooting**

- Verify versions: `node -v`, `pnpm -v`
- If Corepack is unavailable: `npm i -g pnpm@10.28.2`
- Use `nvm-windows` to switch Node versions if needed

## Architecture Design

- **Agent-Based Environment:**

  - The core concept is to simulate sitcom-like interactions using autonomous agents, each with their own state and behaviors.
  - Agents interact in a shared environment, creating emergent entertainment scenarios.

- **Local-First Workflow:**

  - All user data is stored locally using [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) via the [idb](https://github.com/jakearchibald/idb) library.
  - Users can backup and restore their workflow as JSON files, ensuring privacy and control without requiring an account.
  - The system is designed so anyone can use it immediately, with no cloud dependency for core features.

  - **State Management:**
    - Persistent data that needs to be preserved for backup and restore (such as agent states and user-created content) is managed using IndexedDB.
    - Transient UI state (such as selection, temporary toggles, and ephemeral interactions) is managed using Zustand, and does not need to be backed up.

- **Next.js Application:**
  - Built with Next.js for fast, scalable, and modern web development.
  - Hosted on Vercel for seamless deployment and global availability.

## Key Features

- Agent-based sitcom simulation
- Local-first data storage (IndexedDB + idb)
- Private JSON backup/restore workflow
- No account required; instant onboarding
- Responsive UI with Tailwind CSS
- Installable PWA (service worker + manifest)
- Modular component architecture

## Tech Stack

- Next.js
- TypeScript
- Tailwind CSS
- Progressive Web App (PWA — service worker & manifest)
- Zustand (state management)
- idb (IndexedDB wrapper)

## Electron App

This repository includes an Electron wrapper so the Next.js app can run as a desktop application. The Electron source is in the `electron/` folder.

Run in development:

- `pnpm run electron:dev` — starts the Next.js dev server and launches Electron.

Build and run production:

- `pnpm run electron:prod` — builds the Next.js app and launches Electron.

## Demo & Source

- **Live Demo:** [m4trix on Vercel](https://m4trix.vercel.app/stories)
- **Source Code:** [GitHub Repository](https://github.com/loteknowledG/m4trix)

## How It Works

1. **Local Data Storage:**

   - All user actions and agent states are saved in the browser using IndexedDB.
   - Users can export their environment as a JSON file and restore it later or on another device.

2. **Agent Simulation:** _(WIP — not yet implemented)_

- Planned: Agents will be modeled as independent entities with their own logic and state.
- Planned: The environment will orchestrate interactions, allowing for emergent sitcom-like scenarios.

3. **Privacy-First:**
   - No login or account is required.
   - All workflows are private and portable.

## Example Use Case

This project can be used as a reference for:

- Designing agent-based systems
- Implementing local-first web applications
- Architecting privacy-focused entertainment platforms

---

For more details, see the [GitHub repository](https://github.com/loteknowledG/m4trix) or try the [live demo](https://m4trix.vercel.app/stories).
