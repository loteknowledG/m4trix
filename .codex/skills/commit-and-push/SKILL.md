---
name: commit-and-push
description: >-
  After finishing a coding or docs task in m4trix, verify, commit, push to
  master, and confirm Vercel production deploy. Use when the user asks to
  commit and push, ship changes, deploy, or says to always commit and push
  when done.
---

# Commit, push, and deploy after task

When the task is **done** and the working tree has changes from that task, verify, commit, push to `master`, and confirm deploy before ending.

## M4trix deploy model

- **Production branch:** `master`
- **Deploy trigger:** push to `master` runs `.github/workflows/vercel-deploy.yml`
- **Live site:** https://m4trix.vercel.app
- Pushing to `master` **is** the deploy step — do not skip push and call deploy done.

## When to run

Do this when **all** are true:

1. The requested work is complete (not mid-debug / waiting on the user).
2. There are relevant uncommitted changes from this task.
3. The user did not say to skip commit/push/deploy.

Skip when:

- No file changes
- Only secrets would be included (`.env`, keys, tokens)
- The user only asked a question with no edits
- Push would need force / history rewrite they did not request

## Steps

Run in parallel first:

- `git status`
- `git diff` and `git diff --staged`
- `git log -5 --oneline` (match message style)
- `git branch -vv` (check upstream)

Then sequentially:

1. **Verify** — run `pnpm exec tsc --noEmit`. Fix failures before committing.
2. Stage only files for this task (`git add` paths — avoid unrelated junk like `_test_*.mp3`).
3. Commit with a short why-focused message:

```powershell
git commit -m "Summarize the why in 1-2 sentences."
```

On bash:

```bash
git commit -m "$(cat <<'EOF'
Summarize the why in 1-2 sentences.

EOF
)"
```

4. Push to `master` (`git push -u origin HEAD` if no upstream, else `git push`).
5. **Confirm deploy** — after push, check the Vercel workflow:

```powershell
gh run list --workflow="Vercel Deploy" --limit 1
```

If the run is still in progress, watch it:

```powershell
gh run watch <run-id> --exit-status
```

6. Report to the user: commit subject, push result, deploy status (success / in progress / failed), and https://m4trix.vercel.app

## Safety

- Never `git push --force` to `main`/`master`
- Never `--no-verify` unless the user explicitly asks
- Never update git config
- Never commit `.env`, credentials, or private keys — warn instead
- If commit fails (hook), fix and create a **new** commit — do not amend unless the user asked and amend rules allow it
- If push fails, report the error; do not invent success
- If deploy fails, report the workflow URL and offer to fix the build
