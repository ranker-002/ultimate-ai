#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────
#  ⚡ ULTIMATE — One-Line Installer
#  Usage: curl -fsSL https://raw.githubusercontent.com/ranker-002/ultimate-ai/main/install.sh | bash
# ─────────────────────────────────────────────────────

REPO="https://github.com/ranker-002/ultimate-ai.git"
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
err()   { echo -e "${RED}✗${NC} $*" >&2; }
line()  { echo -e "${BOLD}────────────────────────────────────────${NC}"; }

# ── Banner ──────────────────────────────────────────
echo ""
line
echo -e "${CYAN}${BOLD}  ⚡ ULTIMATE — Living AI Entity${NC}"
echo -e "  Installer v1.0"
line
echo ""

# ── Check: git ──────────────────────────────────────
if ! command -v git &>/dev/null; then
  err "git is required but not installed."
  echo "  Install it with your package manager:"
  echo "    Ubuntu/Debian:  sudo apt install git"
  echo "    macOS:          xcode-select --install"
  echo "    Arch:           sudo pacman -S git"
  exit 1
fi
ok "git found"

# ── Check: node ─────────────────────────────────────
if ! command -v node &>/dev/null; then
  err "Node.js is required but not installed."
  echo "  Install Node.js v18+:"
  echo "    Official:  https://nodejs.org"
  echo "    Ubuntu:    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs"
  echo "    macOS:     brew install node"
  echo "    Arch:      sudo pacman -S nodejs npm"
  exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  err "Node.js v18+ required (found v$(node -v | sed 's/v//'))"
  exit 1
fi
ok "Node.js $(node -v) found"

# ── Check: npm ──────────────────────────────────────
if ! command -v npm &>/dev/null; then
  err "npm is required but not installed."
  exit 1
fi
ok "npm $(npm -v) found"

# ── Clone or Update ─────────────────────────────────
echo ""
info "Installing ULTIMATE to ${INSTALL_DIR}..."

if [ -d "$INSTALL_DIR" ]; then
  warn "Existing installation found. Updating..."
  cd "$INSTALL_DIR"
  git pull --ff-only 2>/dev/null || {
    warn "Pull failed. Re-cloning..."
    cd "$HOME"
    rm -rf "$INSTALL_DIR"
    git clone --depth 1 "$REPO" "$INSTALL_DIR"
    cd "$INSTALL_DIR"
  }
else
  git clone --depth 1 "$REPO" "$INSTALL_DIR"
  cd "$INSTALL_DIR"
fi
ok "Repository ready"

# ── Install Dependencies ────────────────────────────
echo ""
info "Installing dependencies..."
npm install --production=false 2>/dev/null || npm install
ok "Dependencies installed"

# ── Build ───────────────────────────────────────────
echo ""
info "Building ULTIMATE..."
npm run build
ok "Build complete"

# ── Create symlink ──────────────────────────────────
echo ""
mkdir -p "$BIN_DIR"

# Create the ultimate launcher script
cat > "$BIN_DIR/ultimate" << 'LAUNCHER'
#!/usr/bin/env bash
exec node "$HOME/.ultimate/dist/index.js" "$@"
LAUNCHER
chmod +x "$BIN_DIR/ultimate"
ok "Created launcher: $BIN_DIR/ultimate"

# ── PATH check ──────────────────────────────────────
if ! echo "$PATH" | tr ':' '\n' | grep -qx "$BIN_DIR"; then
  echo ""
  warn "$BIN_DIR is not in your PATH."
  echo ""
  echo "  Add it to your shell profile:"
  echo ""
  echo "    # bash:"
  echo "    echo 'export PATH=\"\$HOME/.local/bin:\$PATH\"' >> ~/.bashrc"
  echo ""
  echo "    # zsh:"
  echo "    echo 'export PATH=\"\$HOME/.local/bin:\$PATH\"' >> ~/.zshrc"
  echo ""
  echo "    # fish:"
  echo "    fish_add_path ~/.local/bin"
  echo ""
  echo "  Then restart your shell or run:"
  echo "    source ~/.bashrc  (or ~/.zshrc)"
fi

# ── API Key ─────────────────────────────────────────
if [ -z "${OPENROUTER_API_KEY:-}" ]; then
  echo ""
  warn "OPENROUTER_API_KEY is not set."
  echo ""
  echo "  Get a free key at: https://openrouter.ai/keys"
  echo "  Then set it:"
  echo ""
  echo "    export OPENROUTER_API_KEY=your_key_here"
  echo ""
  echo "  Or add it to your shell profile for persistence."
fi

# ── Done ────────────────────────────────────────────
echo ""
line
echo -e "${GREEN}${BOLD}  ⚡ ULTIMATE installed successfully!${NC}"
line
echo ""
echo -e "  Launch with:"
echo ""
echo -e "    ${CYAN}ultimate${NC}"
echo ""
echo -e "  Or run directly:"
echo ""
echo -e "    ${CYAN}node $HOME/.ultimate/dist/index.js${NC}"
echo ""
echo -e "  Uninstall:"
echo ""
echo -e "    ${CYAN}curl -fsSL https://raw.githubusercontent.com/ranker-002/ultimate-ai/main/uninstall.sh | bash${NC}"
echo ""
