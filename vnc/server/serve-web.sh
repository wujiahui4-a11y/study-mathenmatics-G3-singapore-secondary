#!/usr/bin/env bash
#
# serve-web.sh — serve vnc/web over plain HTTP for local development.
#
# The page loads noVNC as ES modules, and browsers refuse ES module imports
# over file://, so it has to come from a real HTTP server. In production
# websockify serves these files itself (setup-vnc-linux.sh does that by
# default) and this script is not needed.
#
# Usage: ./serve-web.sh [port]        # default 8080

set -euo pipefail

PORT="${1:-8080}"
WEB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../web" && pwd)"

command -v python3 >/dev/null 2>&1 || { echo "python3 is required" >&2; exit 1; }

echo "Serving $WEB_DIR on http://localhost:$PORT/"
echo "Press Ctrl+C to stop."
exec python3 -m http.server "$PORT" --directory "$WEB_DIR" --bind 127.0.0.1
