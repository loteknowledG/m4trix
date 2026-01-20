# Diagrams

This folder contains Mermaid (.mmd) diagrams for the repository.

Files:
- `architecture.mmd` — high-level runtime & artifact flow (Electron, Next.js, registry).
- `structure.mmd` — detailed folder/file structure with key entry points.

Render to SVG/PNG using the official Mermaid CLI (`@mermaid-js/mermaid-cli`). Examples:

Using npx (no global install):

```bash
npx @mermaid-js/mermaid-cli -i diagrams/architecture.mmd -o diagrams/architecture.svg
npx @mermaid-js/mermaid-cli -i diagrams/structure.mmd -o diagrams/structure.svg
```

Using npm (install first):

```bash
npm install -D @mermaid-js/mermaid-cli
npx mmdc -i diagrams/architecture.mmd -o diagrams/architecture.svg
npx mmdc -i diagrams/structure.mmd -o diagrams/structure.svg
```

Using Docker (if you prefer not to install):

```bash
docker run --rm -v "$PWD":/data minlag/mermaid-cli -i diagrams/architecture.mmd -o diagrams/architecture.svg
docker run --rm -v "$PWD":/data minlag/mermaid-cli -i diagrams/structure.mmd -o diagrams/structure.svg
```

If you want, I can run the rendering here (requires installing the CLI). Reply `render` and I'll attempt to generate SVG files in this repo.
