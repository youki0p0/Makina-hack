#!/usr/bin/env bash
# Jen v2 (Claude Code) installer — run from your repository root after
# extracting this pack here. Safe & idempotent. Does NOT enable hooks by default.
set -euo pipefail
echo "Installing Jen v2 into: $(pwd)"

# 1) runtime state dirs
mkdir -p .jen/logs .jen/reports .jen/checkpoints

# 2) make scripts/hooks executable
chmod +x .claude/hooks/*.py 2>/dev/null || true
chmod +x .claude/skills/jen/scripts/*.sh .claude/skills/jen/scripts/*.py 2>/dev/null || true

# 3) append .gitignore snippet (idempotent)
if [ -f .gitignore.jen-snippet ]; then
  if ! grep -q "# Jen runtime state" .gitignore 2>/dev/null; then
    printf '\n' >> .gitignore
    cat .gitignore.jen-snippet >> .gitignore
    echo "  + appended Jen entries to .gitignore"
  else
    echo "  = .gitignore already has Jen entries (skipped)"
  fi
fi

# 4) settings are opt-in (they wire hooks + permission deny rules)
if [ ! -f .claude/settings.json ]; then
  echo
  echo "  NOTE: hooks/permissions are OFF until you opt in."
  echo "        Review then enable with:"
  echo "          cp .claude/settings.jen.example.json .claude/settings.json"
fi

cat <<'NEXT'

Done. Next steps:
  1) Open Claude Code in this repo
  2) /agents            -> confirm jen-* subagents are listed
  3) /jen conduct       (or /jen-longrun /jen-repair /jen-review /jen-release)
NEXT
