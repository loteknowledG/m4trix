---
name: commit-and-push
description: >-
  After finishing a coding or docs task that changed the repo, create a git
  commit and push to the remote. Use when the user asks to commit and push
  after a task, wants changes shipped at the end of work, or says to always
  commit and push when done.
---

# Commit and push after task

When the task is **done** and the working tree has changes from that task, commit and push before ending.

## When to run

Do this when **all** are true:

1. The requested work is complete (not mid-debug / waiting on the user).
2. There are relevant uncommitted changes from this task.
3. The user did not say to skip commit/push.

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

1. Stage only files for this task (`git add` paths — avoid unrelated junk).
2. Commit with a short why-focused message:

```powershell
git commit -m @"
Summarize the why in 1-2 sentences.
"@
```

On bash:

```bash
git commit -m "$(cat <<'EOF'
Summarize the why in 1-2 sentences.

EOF
)"
```

3. Push the current branch (`git push -u origin HEAD` if no upstream, else `git push`).
4. Show `git status` and report the commit subject + remote result.

## Safety

- Never `git push --force` to `main`/`master`
- Never `--no-verify` unless the user explicitly asks
- Never update git config
- Never commit `.env`, credentials, or private keys — warn instead
- If commit fails (hook), fix and create a **new** commit — do not amend unless the user asked and amend rules allow it
- If push fails, report the error; do not invent success
