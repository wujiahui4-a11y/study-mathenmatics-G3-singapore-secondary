#!/usr/bin/env bash
#
# setup-vnc-linux.sh — put a Linux desktop behind the browser console in web/.
#
# A browser cannot open a raw TCP connection, so noVNC talks RFB over a
# WebSocket. websockify is the bridge:
#
#     browser  --wss-->  websockify :6080  --tcp-->  VNC server :5901
#
# This script installs a VNC server and websockify, creates a session, and
# starts websockify (optionally serving web/ at the same time, so the whole
# thing is reachable from one URL).
#
# Usage:
#   ./setup-vnc-linux.sh install                 # packages only
#   ./setup-vnc-linux.sh start                   # Xvnc :1 + websockify :6080
#   ./setup-vnc-linux.sh start --tls             # same, but wss:// (self-signed)
#   ./setup-vnc-linux.sh start --attach          # share the physical display (x11vnc)
#   ./setup-vnc-linux.sh status
#   ./setup-vnc-linux.sh stop
#
# Options:
#   --display N       X display number for the VNC session (default 1 -> :5901)
#   --web-port N      port websockify listens on (default 6080)
#   --geometry WxH    session size (default 1440x900)
#   --tls             terminate TLS in websockify (needed for wss://)
#   --cert PATH       certificate to use instead of the generated self-signed one
#   --key PATH        private key that goes with --cert
#   --attach          export the already-running X display instead of a new session
#   --no-web          do not serve web/; websockify only bridges the socket
#   --bind ADDR       address websockify binds to (default 0.0.0.0)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEB_DIR="$(cd "$SCRIPT_DIR/../web" && pwd)"
RUN_DIR="${XDG_RUNTIME_DIR:-/tmp}/linux-vnc-console"
CERT_DIR="$HOME/.vnc/novnc-certs"

DISPLAY_NUM=1
WEB_PORT=6080
GEOMETRY=1440x900
USE_TLS=0
CERT=""
KEY=""
ATTACH=0
SERVE_WEB=1
BIND=0.0.0.0

log()  { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m!! \033[0m%s\n' "$*" >&2; }
die()  { printf '\033[1;31mxx \033[0m%s\n' "$*" >&2; exit 1; }

# --------------------------------------------------------------------------
# argument parsing
# --------------------------------------------------------------------------

COMMAND="${1:-help}"
[ $# -gt 0 ] && shift || true

while [ $# -gt 0 ]; do
  case "$1" in
    --display)   DISPLAY_NUM="$2"; shift 2 ;;
    --web-port)  WEB_PORT="$2";    shift 2 ;;
    --geometry)  GEOMETRY="$2";    shift 2 ;;
    --cert)      CERT="$2"; USE_TLS=1; shift 2 ;;
    --key)       KEY="$2";  USE_TLS=1; shift 2 ;;
    --bind)      BIND="$2";        shift 2 ;;
    --tls)       USE_TLS=1;   shift ;;
    --attach)    ATTACH=1;    shift ;;
    --no-web)    SERVE_WEB=0; shift ;;
    -h|--help)   COMMAND=help; shift ;;
    *) die "Unknown option: $1" ;;
  esac
done

VNC_PORT=$((5900 + DISPLAY_NUM))
WEBSOCKIFY_PID="$RUN_DIR/websockify.pid"
X11VNC_PID="$RUN_DIR/x11vnc.pid"

# --------------------------------------------------------------------------
# package installation
# --------------------------------------------------------------------------

detect_pm() {
  for pm in apt-get dnf yum pacman zypper apk; do
    command -v "$pm" >/dev/null 2>&1 && { echo "$pm"; return; }
  done
  echo none
}

as_root() {
  if [ "$(id -u)" -eq 0 ]; then "$@"; else sudo "$@"; fi
}

cmd_install() {
  local pm; pm="$(detect_pm)"
  log "Package manager: $pm"

  case "$pm" in
    apt-get)
      as_root apt-get update
      as_root apt-get install -y \
        tigervnc-standalone-server tigervnc-common x11vnc \
        python3-websockify python3-numpy openssl \
        xfce4 xfce4-goodies dbus-x11
      ;;
    dnf|yum)
      as_root "$pm" install -y \
        tigervnc-server x11vnc python3-websockify python3-numpy openssl \
        @xfce-desktop-environment || \
      as_root "$pm" install -y tigervnc-server x11vnc python3-websockify openssl
      ;;
    pacman)
      as_root pacman -Sy --noconfirm tigervnc x11vnc python-websockify openssl xfce4
      ;;
    zypper)
      as_root zypper --non-interactive install \
        tigervnc x11vnc python3-websockify openssl xfce4-session
      ;;
    apk)
      as_root apk add --no-cache tigervnc x11vnc py3-websockify openssl xfce4
      ;;
    *)
      die "No supported package manager found. Install manually: a VNC server (tigervnc or x11vnc), websockify, openssl."
      ;;
  esac

  log "Installed. Next: ./setup-vnc-linux.sh start"
}

# --------------------------------------------------------------------------
# helpers
# --------------------------------------------------------------------------

require() {
  command -v "$1" >/dev/null 2>&1 || die "'$1' not found — run: $0 install"
}

# Bash's own /dev/tcp rather than ss/netstat, which minimal images often lack.
port_open() {
  (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null
}

ensure_password() {
  [ -f "$HOME/.vnc/passwd" ] && return
  log "No VNC password set yet."
  mkdir -p "$HOME/.vnc"
  if command -v vncpasswd >/dev/null 2>&1; then
    vncpasswd "$HOME/.vnc/passwd"
  else
    x11vnc -storepasswd "$HOME/.vnc/passwd"
  fi
  chmod 600 "$HOME/.vnc/passwd"
}

ensure_cert() {
  if [ -n "$CERT" ]; then
    [ -f "$CERT" ] || die "Certificate not found: $CERT"
    [ -n "$KEY" ] && [ ! -f "$KEY" ] && die "Key not found: $KEY"
    return
  fi

  CERT="$CERT_DIR/self-signed.crt"
  KEY="$CERT_DIR/self-signed.key"
  [ -f "$CERT" ] && [ -f "$KEY" ] && return

  require openssl
  log "Generating a self-signed certificate in $CERT_DIR"
  mkdir -p "$CERT_DIR"
  openssl req -new -x509 -days 825 -nodes \
    -subj "/CN=$(hostname -f 2>/dev/null || hostname)" \
    -addext "subjectAltName=DNS:$(hostname),DNS:localhost,IP:127.0.0.1" \
    -out "$CERT" -keyout "$KEY" 2>/dev/null
  chmod 600 "$KEY"

  warn "This certificate is self-signed. The browser will refuse the wss://"
  warn "connection until you visit https://<host>:$WEB_PORT/ once and accept it,"
  warn "or install a real certificate with --cert/--key."
}

pick_desktop_session() {
  for session in startxfce4 xfce4-session startlxde mate-session startplasma-x11 gnome-session openbox-session icewm fluxbox xterm; do
    command -v "$session" >/dev/null 2>&1 && { echo "$session"; return; }
  done
  echo ""
}

write_xstartup() {
  local session; session="$(pick_desktop_session)"
  [ -z "$session" ] && die "No desktop session found. Install one (e.g. xfce4) or run: $0 install"

  mkdir -p "$HOME/.vnc"
  cat > "$HOME/.vnc/xstartup" <<EOF
#!/bin/sh
unset SESSION_MANAGER
unset DBUS_SESSION_BUS_ADDRESS
[ -x /etc/vnc/xstartup ] && exec /etc/vnc/xstartup
[ -r "\$HOME/.Xresources" ] && xrdb "\$HOME/.Xresources"
exec $session
EOF
  chmod +x "$HOME/.vnc/xstartup"
  log "Session: $session (edit ~/.vnc/xstartup to change it)"
}

# --------------------------------------------------------------------------
# start / stop / status
# --------------------------------------------------------------------------

start_vnc_server() {
  if port_open "$VNC_PORT"; then
    log "Something is already listening on :$VNC_PORT — reusing it."
    return
  fi

  if [ "$ATTACH" -eq 1 ]; then
    require x11vnc
    local target="${DISPLAY:-:0}"
    log "Sharing the running X display $target with x11vnc on :$VNC_PORT"
    x11vnc -display "$target" -rfbport "$VNC_PORT" -rfbauth "$HOME/.vnc/passwd" \
           -forever -shared -localhost -bg -o "$RUN_DIR/x11vnc.log" \
           -nopw_warn 2>/dev/null || \
    x11vnc -display "$target" -rfbport "$VNC_PORT" -rfbauth "$HOME/.vnc/passwd" \
           -forever -shared -localhost -bg -o "$RUN_DIR/x11vnc.log"
    pgrep -n x11vnc > "$X11VNC_PID" || true
  else
    require vncserver
    write_xstartup
    log "Starting a VNC session on :$DISPLAY_NUM ($GEOMETRY), listening on :$VNC_PORT"
    # -localhost: only websockify may reach the raw RFB port.
    vncserver ":$DISPLAY_NUM" \
      -geometry "$GEOMETRY" \
      -localhost yes \
      -rfbauth "$HOME/.vnc/passwd" \
      -SecurityTypes VncAuth >/dev/null
  fi
}

start_websockify() {
  require websockify

  local args=(--daemon)
  [ "$SERVE_WEB" -eq 1 ] && args+=(--web "$WEB_DIR")

  if [ "$USE_TLS" -eq 1 ]; then
    ensure_cert
    args+=(--cert "$CERT")
    [ -n "$KEY" ] && args+=(--key "$KEY")
    args+=(--ssl-only)
  fi

  log "Starting websockify on $BIND:$WEB_PORT -> 127.0.0.1:$VNC_PORT"
  websockify "${args[@]}" \
    --log-file "$RUN_DIR/websockify.log" \
    "$BIND:$WEB_PORT" "127.0.0.1:$VNC_PORT"

  sleep 1
  pgrep -f "websockify.*:$WEB_PORT" > "$WEBSOCKIFY_PID" 2>/dev/null || true
}

cmd_start() {
  mkdir -p "$RUN_DIR"
  ensure_password
  start_vnc_server
  start_websockify

  local scheme="http" ws="ws"
  [ "$USE_TLS" -eq 1 ] && { scheme="https"; ws="wss"; }
  local host; host="$(hostname -I 2>/dev/null | awk '{print $1}')"
  [ -z "$host" ] && host="$(hostname)"

  echo
  log "Ready."
  if [ "$SERVE_WEB" -eq 1 ]; then
    echo "    Open:        $scheme://$host:$WEB_PORT/"
    echo "    Autoconnect: $scheme://$host:$WEB_PORT/?host=$host&port=$WEB_PORT&encrypt=$USE_TLS&autoconnect=1"
  else
    echo "    WebSocket:   $ws://$host:$WEB_PORT/websockify"
    echo "    Serve web/ yourself, e.g.: python3 -m http.server -d $WEB_DIR 8080"
  fi
  echo "    Logs:        $RUN_DIR"
  echo
  [ "$USE_TLS" -eq 0 ] && warn "Traffic is unencrypted. Use --tls, or tunnel over SSH:
       ssh -L $WEB_PORT:127.0.0.1:$WEB_PORT $USER@$host"
}

cmd_stop() {
  log "Stopping websockify"
  pkill -f "websockify.*:$WEB_PORT" 2>/dev/null || true

  if [ "$ATTACH" -eq 1 ]; then
    log "Stopping x11vnc"
    pkill -f "x11vnc.*-rfbport $VNC_PORT" 2>/dev/null || true
  elif command -v vncserver >/dev/null 2>&1; then
    log "Killing VNC session :$DISPLAY_NUM"
    vncserver -kill ":$DISPLAY_NUM" 2>/dev/null || true
  fi

  rm -f "$WEBSOCKIFY_PID" "$X11VNC_PID"
  log "Stopped."
}

cmd_status() {
  echo "VNC display    : :$DISPLAY_NUM (TCP $VNC_PORT)"
  echo "WebSocket port : $WEB_PORT"
  echo "Web root       : $([ "$SERVE_WEB" -eq 1 ] && echo "$WEB_DIR" || echo '(not served)')"
  echo
  if port_open "$VNC_PORT"; then
    echo "  [up]   VNC server on :$VNC_PORT"
  else
    echo "  [down] VNC server on :$VNC_PORT"
  fi
  if port_open "$WEB_PORT"; then
    echo "  [up]   websockify on :$WEB_PORT"
  else
    echo "  [down] websockify on :$WEB_PORT"
  fi
  echo
  echo "Logs: $RUN_DIR"
}

cmd_help() {
  sed -n '2,/^set -euo/p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//; $d'
}

case "$COMMAND" in
  install) cmd_install ;;
  start)   cmd_start ;;
  stop)    cmd_stop ;;
  status)  cmd_status ;;
  help|*)  cmd_help ;;
esac
