#!/data/data/com.termux/files/usr/bin/sh
# Starts the always-on server when the phone boots (Termux:Boot).
# Install: mkdir -p ~/.termux/boot && cp scripts/termux-boot.sh ~/.termux/boot/neolithic && chmod +x ~/.termux/boot/neolithic
# Logs go to ~/neolithic-server.log. Adjust NEOLITHIC_DIR if the project lives elsewhere.
NEOLITHIC_DIR="$HOME/neolithic-engine"

# Stop any running artificial-life server to give Neolithic exclusive CPU headroom
pkill -f "artificial-life" 2>/dev/null || true
pkill -f "dist-server/main.js" 2>/dev/null || true

termux-wake-lock
cd "$NEOLITHIC_DIR" || exit 1
# Capped speed keeps the phone cool while running for hours
ALIFE_MAX_SPEED=30 nohup node dist-server/main.js >> "$HOME/neolithic-server.log" 2>&1 &
