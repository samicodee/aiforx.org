#!/bin/bash
# Launch Chrome with remote debugging so the WhatsApp agent can connect to it.
# Run this ONCE before starting the agent.
# Chrome opens as a real window — log into WhatsApp Web normally.

PORT=9222
PROFILE_DIR="$HOME/Library/Application Support/aiforx-whatsapp-chrome-profile"

mkdir -p "$PROFILE_DIR"

echo "Launching Chrome with remote debugging on port $PORT..."
echo "Open WhatsApp Web (web.whatsapp.com) in the window that opens."
echo ""

/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=$PORT \
  --user-data-dir="$PROFILE_DIR" \
  --no-first-run \
  --no-default-browser-check \
  "https://web.whatsapp.com" &

echo "Chrome launched. Once WhatsApp Web is open and connected, start the agent:"
echo "  launchctl kickstart gui/$(id -u)/com.aiforx.whatsapp-agent"
