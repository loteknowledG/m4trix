# m4trix: Agent-Based Sitcom Playground

## Project Overview

m4trix is a Next.js application designed as a playground for experimenting with agent-based sitcom environments and entertainment systems. The architecture is local-first, prioritizing user privacy and offline capability. 

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
- Modular component architecture

## Tech Stack

- Next.js
- TypeScript
- Tailwind CSS
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

2. **Agent Simulation:** *(WIP — not yet implemented)*
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
