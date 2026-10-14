#!/usr/bin/env bash
# Idempotent: starts the API server and a public Cloudflare quick tunnel if they are not running.
# Writes the public URL to ~/service/PUBLIC_URL. Safe to run at any time.
set -u
SVC="$HOME/service"; LOGS="$HOME/logs"; PORT="${PORT:-8787}"
mkdir -p "$LOGS" "$HOME/bin"
export PATH="$HOME/bin:$PATH"
[ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh" >/dev/null

if curl -fs "http://127.0.0.1:$PORT/health" >/dev/null; then
  echo "server: already running on :$PORT"
else
  (cd "$SVC" && nohup node server.js >> "$LOGS/service.log" 2>&1 & echo $! > "$SVC/server.pid")
  sleep 1; curl -fs "http://127.0.0.1:$PORT/health" >/dev/null && echo "server: started on :$PORT" || { echo "server: FAILED, see $LOGS/service.log"; tail -5 "$LOGS/service.log"; exit 1; }
fi

if [ ! -x "$HOME/bin/cloudflared" ]; then
  echo "tunnel: downloading cloudflared…"
  curl -fsSL -o "$HOME/bin/cloudflared" https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 && chmod +x "$HOME/bin/cloudflared"
fi
TOKEN_FILE="$HOME/.cloudflared/tunnel_token"
if [ -s "$TOKEN_FILE" ]; then
  # Permanent named tunnel (own domain). Token is read from a 0600 file and passed via env, never on the command line.
  if pgrep -f "cloudflared tunnel --no-autoupdate run" >/dev/null; then
    echo "tunnel (permanent): already running"
  else
    pkill -f "cloudflared tunnel" 2>/dev/null; sleep 1
    TUNNEL_TOKEN="$(cat "$TOKEN_FILE")" nohup "$HOME/bin/cloudflared" tunnel --no-autoupdate run >> "$LOGS/tunnel.log" 2>&1 &
    sleep 3; echo "tunnel (permanent): started"
  fi
  [ -s "$HOME/.cloudflared/public_url" ] && cp "$HOME/.cloudflared/public_url" "$SVC/PUBLIC_URL"
else
# exactly one tunnel: if several are running (old bug), keep none and start fresh
N=$(pgrep -fc "cloudflared tunnel" || true)
if [ "${N:-0}" -gt 1 ]; then pkill -f "cloudflared tunnel"; sleep 1; N=0; fi
if [ "${N:-0}" -eq 1 ] && [ -s "$SVC/PUBLIC_URL" ]; then
  echo "tunnel: already running"
else
  : > "$LOGS/tunnel.log"
  nohup "$HOME/bin/cloudflared" tunnel --no-autoupdate --url "http://localhost:$PORT" >> "$LOGS/tunnel.log" 2>&1 &
  for i in $(seq 1 30); do
    URL=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$LOGS/tunnel.log" | head -1)
    [ -n "$URL" ] && break; sleep 1
  done
  if [ -n "${URL:-}" ]; then echo "$URL" > "$SVC/PUBLIC_URL"; echo "tunnel: $URL"; else echo "tunnel: no URL yet, see $LOGS/tunnel.log"; fi
fi
fi
echo "public url: $(cat "$SVC/PUBLIC_URL" 2>/dev/null || echo unknown)"
