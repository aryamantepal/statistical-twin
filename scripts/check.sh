#!/usr/bin/env bash
# Run everything CI runs, in the same order. Use before every commit: ./scripts/check.sh
# Pass --fix to apply ruff formatting and lint fixes first.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"

echo "▸ pipeline"
cd "$root/pipeline"
if [[ "${1:-}" == "--fix" ]]; then
  uv run ruff format .
  uv run ruff check --fix .
fi
uv run ruff check .
uv run ruff format --check .
uv run pytest -q

echo "▸ web"
cd "$root/web"
pnpm lint
pnpm exec tsc --noEmit
pnpm build

echo "✓ all checks passed"
