#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════
# HiveSandbox — Developer Playground  (Phase 1)
# ═══════════════════════════════════════════════════════════════════════
# Starts both the FastAPI backend and Next.js frontend concurrently.
#
# Prerequisites:
#   1. microsandbox CLI (`msb` on PATH)
#      curl -fsSL https://install.microsandbox.dev | sh
#   2. Python 3.10+ with venv
#   3. Node.js 18+
#
# Usage:
#   chmod +x start.sh
#   ./start.sh
# ═══════════════════════════════════════════════════════════════════════

set -euo pipefail

# Ensure the microsandbox CLI is findable (official installer puts it here).
export PATH="${HOME}/.local/bin:${HOME}/.microsandbox/bin:${PATH}"

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
API_DIR="$ROOT_DIR/api"
FRONTEND_SRC="$ROOT_DIR/frontend"

# ── Resolve a Linux-native runtime directory for the frontend ────────
# npm creates symlinks in node_modules/.bin — WSL cross-filesystem mounts
# (e.g. /mnt/c/…) do not support those.  We mirror the frontend source
# into $HOME/.hivesandbox-runtime so the dev server runs with real symlinks.
RUNTIME_DIR="${HOME}/.hivesandbox-runtime/frontend"

echo "╔══════════════════════════════════════════════════╗"
echo "║        HiveSandbox — Developer Playground        ║"
echo "╚══════════════════════════════════════════════════╝"

# ── Kill any lingering processes from a previous run ──────────────────
pkill -f "uvicorn main:app" 2>/dev/null || true
pkill -f "next dev" 2>/dev/null || true
sleep 1
echo ""

# ── Backend ──────────────────────────────────────────────────────────
echo "◆ Setting up Python virtual environment …"
if [ ! -d "$API_DIR/venv" ]; then
    python3 -m venv "$API_DIR/venv"
fi
source "$API_DIR/venv/bin/activate"
pip install -q -r "$API_DIR/requirements.txt"

echo "◆ Starting FastAPI backend on http://localhost:8000 …"
cd "$API_DIR"
uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

# ── Frontend ─────────────────────────────────────────────────────────
echo "◆ Syncing frontend source → Linux-native runtime …"
mkdir -p "$RUNTIME_DIR"
# Sync only source files (not node_modules, .next, etc.)
rsync -a --delete \
    --exclude 'node_modules' \
    --exclude '.next' \
    --exclude 'package-lock.json' \
    "$FRONTEND_SRC/" "$RUNTIME_DIR/"

echo "◆ Installing frontend dependencies …"
cd "$RUNTIME_DIR"
npm install --silent 2>&1 | tail -1

echo "◆ Starting Next.js frontend on http://localhost:3000 …"
npm run dev &
FRONTEND_PID=$!

# ── Trap ─────────────────────────────────────────────────────────────
cleanup() {
    echo ""
    echo "◆ Shutting down …"
    kill $BACKEND_PID 2>/dev/null || true
    kill $FRONTEND_PID 2>/dev/null || true
    wait 2>/dev/null || true
    echo "✓ Done."
}
trap cleanup EXIT INT TERM

echo ""
echo "╭──────────────────────────────────────────────────╮"
echo "│  Backend  →  http://localhost:8000               │"
echo "│  Frontend →  http://localhost:3000               │"
echo "│  API Docs →  http://localhost:8000/docs           │"
echo "╰──────────────────────────────────────────────────╯"
echo ""
echo "Press Ctrl+C to stop."

wait
