# Agent notes

Python pipeline in `pipeline/` (uv), static Next.js app in `web/` (pnpm). `web/AGENTS.md` has
Next.js-specific notes; this file covers the whole repo.

## Before every commit

Run `./scripts/check.sh` (or `./scripts/check.sh --fix` to apply ruff formatting first). It runs
exactly what CI runs: ruff check, ruff format --check, pytest, eslint, tsc and `next build`. Don't
commit if it fails. Hand edits to Python files are the usual cause of a `ruff format --check`
failure, so run the formatter after every Python edit, however small.

## Shipping a change

1. Preview locally (`pnpm dev` in `web/`) and let the maintainer look before opening a PR.
2. Open an issue, then a branch and a PR that closes it.
3. Review the diff (`/code-review low` is enough for most changes).
4. **Before merging, confirm every check passed.** Run `gh pr checks <n>` on its own, with no
   `tail` or `grep`, and read every line. There are four checks: `pipeline`, `web`, `Vercel`
   and `Vercel Preview Comments`. Any `fail` or `pending` means don't merge.
   `gh pr checks --watch` can stop on one finished job while others are still running or
   failing.
5. Squash-merge. Merging to `main` deploys production automatically.

Commit messages, PRs and issues describe the change itself, not what inspired the design.

## Deployment

- The Vercel project `statistical-twin` is connected to this repo with **Root Directory = `web`**.
  If a deploy fails with `NEXT_NO_VERSION` ("No Next.js version detected"), that setting has been
  lost. Check it with `vercel api /v9/projects/statistical-twin` and restore it with
  `vercel api /v9/projects/statistical-twin -X PATCH -F rootDirectory=web`.
- PRs get a preview deploy; `main` deploys to https://statistical-twin.vercel.app.
- The site is a static export (`output: "export"`). The data lives in the committed
  `web/public/data/*.json`, so Vercel never runs the pipeline. To refresh the data, run
  `uv run twin build` in `pipeline/` and commit the JSON.
