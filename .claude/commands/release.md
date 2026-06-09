---
description: Cut a release — bump version, tag, push, and let CI build the dmg + exe
argument-hint: "[patch|minor|major]  (default: patch)"
allowed-tools: Bash(git status:*), Bash(git rev-parse:*), Bash(git branch:*), Bash(git push:*), Bash(git log:*), Bash(git describe:*), Bash(npm version:*), Bash(npm test:*), Bash(npm run lint:*), Bash(gh run list:*), Bash(gh run watch:*), Bash(gh release view:*), Read
---

You are cutting a release of Airplane Banner. The `.exe` (Windows NSIS) and
`.dmg` (macOS) installers are built by the GitHub Actions matrix in
`.github/workflows/build.yml`, which triggers on any `v*` tag push and publishes
a single GitHub release with every platform's artifacts. A Windows `.exe` cannot
be built reliably on macOS, so **CI is the only path that produces both** — this
command bumps the version and pushes a tag to trigger it.

Bump type: **$ARGUMENTS** (if empty, use `patch`).

Do the following in order. Stop and report if any step fails — never force past a
failure.

1. **Preflight.**
   - Confirm the current branch is `main` (`git rev-parse --abbrev-ref HEAD`). If not, stop and tell the user.
   - Confirm the working tree is clean (`git status --porcelain`). If dirty, stop and list what's uncommitted — `npm version` refuses to run otherwise.
   - Run `npm test` and `npm run lint`. If either fails, stop and show the output. Do not release broken code.

2. **Bump + tag.** Run `npm version <patch|minor|major> -m "release: v%s"`. This
   updates `package.json` + `package-lock.json`, commits, and creates the matching
   `vX.Y.Z` tag in one step. Capture the new version it prints.

3. **Push.** `git push origin main` then `git push origin v<newversion>`. The tag
   push is what starts the installer build.

4. **Watch CI.** Find the tag's workflow run with `gh run list --limit 5`, then
   `gh run watch <run-id>` (or poll `gh run list`) until it completes. If the run
   fails, surface the failing job and stop.

5. **Confirm artifacts.** Once green, run `gh release view v<newversion>` and
   confirm the release has both a `.dmg` and an `.exe` (plus the `.zip`). Report
   the release URL and the installer asset names to the user.

Notes:
- Respect the user's commit-message convention: do **not** add a Claude co-author trailer.
- For a quick *local* macOS-only check (no Windows exe), the user can run `npm run dist:mac` — mention this only if they ask for a local build rather than a release.
