#!/bin/bash
# PhantomCast setup script for Raspberry Pi 5
set -e

echo "=== PhantomCast Setup ==="

# Python virtual environment
echo "[1/5] Setting up Python environment..."
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Frontend build
echo "[2/5] Building frontend..."
cd web && npm install && npx vite build && cd ..

# Content directory
echo "[3/5] Creating data directories..."
mkdir -p data/content

# mDNS (phantomcast.local)
echo "[4/5] Configuring mDNS..."
if ! dpkg -l avahi-daemon &>/dev/null; then
    sudo apt-get install -y avahi-daemon
fi

# systemd service
echo "[5/5] Installing systemd service..."
sudo cp phantomcast.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable phantomcast

echo ""
echo "=== Setup complete! ==="
echo ""
echo "Start PhantomCast:"
echo "  sudo systemctl start phantomcast"
echo ""
echo "Or run manually:"
echo "  source .venv/bin/activate"
echo "  uvicorn api.main:app --host 0.0.0.0 --port 8000"
echo ""
echo "Open in browser: http://phantomcast.local:8000"
