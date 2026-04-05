#!/usr/bin/env bash
# PhantomCast — clean start script
# Kills any existing instance, activates venv, launches server

set -e

cd "$(dirname "$0")"

# Kill any existing PhantomCast process on port 8000
existing=$(lsof -ti tcp:8000 2>/dev/null || true)
if [ -n "$existing" ]; then
    echo "Killing existing process on port 8000 (PID: $existing)..."
    kill $existing 2>/dev/null || true
    sleep 1
    # Force kill if still alive
    kill -9 $existing 2>/dev/null || true
fi

source .venv/bin/activate

echo "Starting PhantomCast..."
exec uvicorn api.main:app --host 0.0.0.0 --port 8000
