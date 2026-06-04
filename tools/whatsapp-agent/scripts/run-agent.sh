#!/bin/zsh
set -euo pipefail

SCRIPT_DIR=${0:A:h}
AGENT_DIR=${SCRIPT_DIR:h}

cd "$AGENT_DIR"
mkdir -p data
{
  echo "[$(/bin/date -u +%Y-%m-%dT%H:%M:%SZ)] launchd wrapper starting"
  echo "HOME=${HOME:-}"
  echo "PATH=${PATH:-}"
} >> data/launchd-wrapper.log

# If browser-connect mode — wait for Chrome debug port to be ready
if grep -q "AGENT_BROWSER_URL=http" "$AGENT_DIR/.env" 2>/dev/null; then
  echo "[$(/bin/date -u +%Y-%m-%dT%H:%M:%SZ)] Waiting for Chrome debug port 9222..." >> data/launchd-wrapper.log
  MAX_WAIT=60
  WAITED=0
  until curl -s http://127.0.0.1:9222/json/version > /dev/null 2>&1; do
    sleep 2
    WAITED=$((WAITED + 2))
    if [ $WAITED -ge $MAX_WAIT ]; then
      echo "[$(/bin/date -u +%Y-%m-%dT%H:%M:%SZ)] Chrome not ready after ${MAX_WAIT}s — starting anyway" >> data/launchd-wrapper.log
      break
    fi
  done
  echo "[$(/bin/date -u +%Y-%m-%dT%H:%M:%SZ)] Chrome ready — starting agent" >> data/launchd-wrapper.log
fi

exec /opt/homebrew/bin/node "$AGENT_DIR/src/index.js"
