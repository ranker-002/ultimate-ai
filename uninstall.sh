#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────
#  ⚡ ULTIMATE — Uninstaller
#  Usage: curl -fsSL https://raw.githubusercontent.com/ranker-002/ultimate-ai/main/uninstall.sh | bash
# ─────────────────────────────────────────────────────

INSTALL_DIR="${ULTIMATE_DIR:-$HOME/.ultimate}"
BIN_DIR="${HOME}/.local/bin"

# ── Colors ──────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

info()  { echo -e "${CYAN}⚡${NC} $*"; }
ok()    { echo -e "${GREEN}✓${NC} $*"; }
warn()  { echo -e "${YELLOW}⚠${NC} $*"; }

echo ""
echo -e "${BOLD}────────────────────────────────────────${NC}"
echo -e "${RED}${BOLD}  ⚡ ULTIMATE Uninstaller${NC}"
echo -e "${BOLD}────────────────────────────────────────${NC}"
echo ""

# ── Confirm ─────────────────────────────────────────
read -r -p "Remove ULTIMATE from $INSTALL_DIR? [y/N] " confirm
if [[ ! "$confirm" =~ ^[yY]$ ]]; then
  echo "Cancelled."
  exit 0
fi

# ── Remove symlink ──────────────────────────────────
if [ -f "$BIN_DIR/ultimate" ]; then
  rm -f "$BIN_DIR/ultimate"
  ok "Removed $BIN_DIR/ultimate"
fi

# ── Remove install directory ────────────────────────
if [ -d "$INSTALL_DIR" ]; then
  rm -rf "$INSTALL_DIR"
  ok "Removed $INSTALL_DIR"
fi

# ── Remove memory/snapshots if standalone ───────────
for dir in "$HOME/.ultimate_memory" "$HOME/.ultimate_snapshots"; do
  if [ -d "$dir" ]; then
    rm -rf "$dir"
    ok "Removed $dir"
  fi
done

echo ""
echo -e "${GREEN}✓ ULTIMATE uninstalled.${NC}"
echo ""
