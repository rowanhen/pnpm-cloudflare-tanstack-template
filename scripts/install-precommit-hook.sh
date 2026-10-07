#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel)"
HOOKS_DIR="$ROOT_DIR/.githooks"
TARGET="$HOOKS_DIR/pre-commit"

mkdir -p "$HOOKS_DIR"
cat >"$TARGET" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel)"
cd "$ROOT_DIR"

pnpm run precommit:check
EOF

chmod +x "$TARGET"

# Route git to the repository-level hook directory so hooks are versioned and portable.
git config core.hooksPath .githooks

echo "Pre-commit hook installed. Run 'pnpm run hooks:install' again after changing this file."
