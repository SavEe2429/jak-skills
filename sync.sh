#!/usr/bin/env bash
# Pull the skill out of the repository it is developed in and into this package.
#
#   ./sync.sh ../NDRS_MODBUS_SIMULATOR
#
# The one transformation is the script path: in a checkout the scripts live under
# .claude/skills/, installed as a plugin they live under ${CLAUDE_PLUGIN_ROOT}. Doing
# it here rather than by hand is what stops the two copies drifting -- the packaged
# SKILL.md was already overwritten once by a plain cp.
set -euo pipefail

src="${1:?usage: ./sync.sh <path-to-repo-with-.claude/skills/for-review>}/.claude/skills/for-review"
dst="$(cd "$(dirname "$0")" && pwd)/skills/for-review"

cp "$src"/scripts/*.mjs "$src"/scripts/package.json "$src"/scripts/package-lock.json "$dst/scripts/"
cp -r "$src"/references/. "$dst/references/"
sed 's|\.claude/skills/for-review/scripts|${CLAUDE_PLUGIN_ROOT}/skills/for-review/scripts|g' \
  "$src/SKILL.md" > "$dst/SKILL.md"

echo "synced from $src"
git -C "$(dirname "$0")" status --short
