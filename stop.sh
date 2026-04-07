#!/usr/bin/env bash
# PhantomCast — stop script
# Kills any PhantomCast process on port 8000

set -e

existing=$(lsof -ti tcp:8000 2>/dev/null || true)
if [ -n "$existing" ]; then
    echo "Stopping PhantomCast (PID: $existing)..."
    kill $existing 2>/dev/null || true
    sleep 1
    # Force kill if still alive
    kill -9 $existing 2>/dev/null || true
    echo "Stopped."
else
    echo "PhantomCast is not running."
fi
