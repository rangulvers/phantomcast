# CLAUDE.md — PhantomCast

## Project Overview
PhantomCast is a Raspberry Pi 5 projection mapping system with a web-based calibration UI. It warps video content onto physical surfaces (buildings, windows, doors) using a projector connected via HDMI.

## Tech Stack
- **Backend:** Python 3.12 + FastAPI
- **Rendering:** GStreamer + OpenGL ES (GPU-accelerated warp)
- **Warp Math:** OpenCV (cv2.findHomography, warpPerspective)
- **Frontend:** React + TypeScript + Vite + Three.js
- **Preview:** MJPEG stream over HTTP
- **Config:** JSON files (surfaces.json)

## Project Structure
```
phantomcast/
├── api/              # FastAPI backend
│   ├── main.py
│   └── routers/
├── engine/           # Rendering engine (GStreamer + OpenGL)
├── web/              # React frontend
├── config/           # Default configs
├── data/             # User content (videos, not in git)
├── PRD.md            # Product Requirements Document
└── CLAUDE.md         # This file
```

## Key Design Decisions
- Quad warp (4 control points) for MVP; mesh warp later
- MJPEG preview (not WebRTC) — simpler, 5-10fps sufficient for calibration
- JSON config files — no database needed
- Headless operation via systemd after initial calibration
- German + English UI (configurable)

## Commands
```bash
# Backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn api.main:app --host 0.0.0.0 --port 8000

# Frontend
cd web && npm install && npm run dev

# Rendering engine (separate process)
python -m engine.run
```
