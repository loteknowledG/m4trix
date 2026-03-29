---
name: m4trix-workflow
description: Small-batch repo workflow for the m4trix codebase. Use when cleaning dead code, refactoring without broad rewrites, preserving the ASCII/neon UI identity, removing commit-hook friction, or making focused, reviewable changes across multiple files.
---

# M4trix Workflow

## Core Rules

- Work in small batches.
- Prefer deletion over wrapping or duplicating code.
- Preserve the existing visual identity unless the user asks for a redesign.
- Keep diffs focused and reviewable.
- Avoid commit hooks and other friction-heavy gates.
- Use targeted verification, usually `tsc --noEmit` or a narrow runtime check.

## Refactor Strategy

- Inspect the current implementation before editing.
- Remove dead code before adding new abstractions.
- Split oversized files only when the split reduces cognitive load immediately.
- Keep behavior stable while shrinking the surface area.
- Do not "recover" by making unrelated changes.

## UI Style

- Keep the m4trix ASCII / glitch / neon identity intact.
- Match existing hard-offset 3D controls unless the user asks for a flatter style.
- Do not replace a recognizable brand mark just to make it simpler.

## Commit Hygiene

- Do not add pre-commit hooks or commit blockers.
- If lint or type errors remain, report them clearly and let the user decide when to gate commits.
- Prefer fixing the exact files the user is working on instead of sweeping the whole repo.

## When in Doubt

- Choose the smallest safe change.
- Ask before large structural rewrites.
- Keep momentum moving.
