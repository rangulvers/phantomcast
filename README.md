# PhantomCast

**Open-source projection mapping system with a web-based calibration UI.**

Turn any projector into a projection mapping setup. Map video content onto walls, buildings, windows, or any surface — calibrate from your phone, run headless after setup. Built because existing tools like MadMapper (349 EUR) and Resolume (799 EUR) are overkill for seasonal decorations and small events.

![License](https://img.shields.io/badge/license-MIT-green)
![Python](https://img.shields.io/badge/python-3.12+-blue)
![Platform](https://img.shields.io/badge/platform-Linux%20%7C%20Raspberry%20Pi-orange)

---

## Features

### Quad Warp Mapping
- Define projection surfaces with 4 draggable control points
- Real-time homography warp using OpenCV
- Multiple independent surfaces, each with its own video source
- Fine-tune coordinates with direct numeric input

### Web-Based Calibration UI
- Professional dark UI accessible from any browser
- Live MJPEG preview of the projector output
- Drag control points directly on the preview
- No monitor needed — calibrate from your phone or laptop

### Per-Surface Video Playback
- Assign different videos to each projection surface
- Independent looping and opacity per surface
- Sync button to align all surfaces to the same frame
- Upload content directly through the UI

### Calibration Grid
- Toggle an alignment grid overlay per surface
- Works with or without video playing
- Green grid with center crosshair and corner markers for precise wall alignment

### Motion Recorder
- Draw animation paths directly on the preview
- Automatic cubic spline smoothing for silky curves
- Glowing dot with fading trail playback
- Export/import animations as JSON files
- Multiple motions play simultaneously

### Headless Operation
- Direct framebuffer output (no X11/Wayland required)
- Runs as a systemd service — starts on boot
- SSH-friendly — the browser UI is the only control surface

---

## Quick Start

### Requirements

- Linux system with HDMI output (Raspberry Pi 5 recommended)
- Python 3.12+
- Node.js 18+
- A projector connected via HDMI

### Installation

```bash
git clone https://github.com/rangulvers/phantomcast.git
cd phantomcast
chmod +x setup.sh
./setup.sh
```

The setup script will:
1. Create a Python virtual environment and install dependencies
2. Build the React frontend
3. Create data directories
4. Configure mDNS (`phantomcast.local`)
5. Install and enable the systemd service

### Running

**As a service (recommended for production):**

```bash
sudo systemctl start phantomcast
```

**Manually:**

```bash
./start.sh
```

**Or step by step:**

```bash
source .venv/bin/activate
uvicorn api.main:app --host 0.0.0.0 --port 8000
```

Then open **http://phantomcast.local:8000** (or your device's IP) in any browser.

---

## Usage

### 1. Set Up Surfaces

Each surface represents a physical area you want to project onto (a wall, window, door, etc.).

- Click **+ Neue Oberfläche** to add a surface
- Drag the green control points on the preview to match the physical surface
- Fine-tune with the numeric coordinate inputs below the preview

### 2. Assign Content

- Click a video file in the **Content** section to assign it to the selected surface
- Upload new videos with the **+ Hochladen** button
- Each surface can play a different video independently

### 3. Calibrate with Grid

- Click **Raster einblenden** to show a calibration grid on the surface
- Stop video playback for a clean grid-only view
- Adjust control points until the grid lines are straight on the wall
- Disable the grid when done

### 4. Record Motions

- Click **Aufnehmen** to enter recording mode (the button turns red)
- Draw a path on the preview by clicking and dragging
- Release to save — the motion plays back immediately as a looping animation
- Drawing speed is preserved — draw fast for fast animations, slow for slow ones
- Paths are automatically smoothed with cubic spline interpolation
- Export animations as JSON to share or back up

---

## Architecture

```
phantomcast/
├── api/                    # FastAPI backend
│   ├── main.py             # App setup, lifespan, static serving
│   └── routers/
│       ├── surfaces.py     # Surface CRUD + calibration
│       ├── sources.py      # Content file management
│       ├── playback.py     # Play/pause/stop/sync controls
│       ├── motions.py      # Motion recording + spline smoothing
│       └── preview.py      # MJPEG preview stream
├── engine/                 # Rendering engine
│   ├── renderer.py         # Frame loop, framebuffer output, compositing
│   └── warp.py             # Homography math, Surface/Motion data models
├── web/                    # React frontend (Vite + TypeScript)
│   ├── src/
│   │   ├── App.tsx         # Main UI component
│   │   ├── api.ts          # API client
│   │   └── styles.css      # Professional dark theme
│   └── index.html
├── config/
│   └── surfaces.json       # Persisted surfaces, motions, and settings
├── data/
│   └── content/            # Uploaded videos and images
├── phantomcast.service     # systemd unit file
├── setup.sh                # One-command installation
├── start.sh                # Quick start script
└── requirements.txt        # Python dependencies
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.12, FastAPI, Uvicorn |
| Warp Math | OpenCV (`findHomography`, `warpPerspective`) |
| Smoothing | SciPy (`CubicSpline`) |
| Video I/O | OpenCV VideoCapture |
| Display Output | Linux framebuffer (`/dev/fb0`), direct memory-mapped writes |
| Frontend | React 19, TypeScript, Vite |
| Preview | MJPEG over HTTP |
| Config | JSON files |

### How the Rendering Pipeline Works

1. **Frame read** — Each surface reads from its own `VideoCapture` independently
2. **Grid overlay** — If calibration grid is enabled, it's drawn on the frame
3. **Homography warp** — `cv2.warpPerspective` maps the frame onto the destination quad
4. **Compositing** — All surfaces are composited onto a single output frame
5. **Motion trails** — Recorded animations are drawn in projector space
6. **Pixel format** — Output is converted to the framebuffer's format (BGR565 via `cv2.cvtColor`)
7. **Display** — Frame is written directly to `/dev/fb0` via memory-mapped I/O
8. **Preview** — Downscaled copy is served as MJPEG for the web UI

---

## Performance

Optimized for real-time rendering on resource-constrained hardware:

- Native OpenCV BGR-to-BGR565 conversion (vs. manual numpy — 5x faster)
- Color conversion at source resolution before upscaling
- `INTER_NEAREST` interpolation for framebuffer upscale and warp (no visible difference on projectors)
- Cached homography matrices (recomputed only when control points change)
- Target: 30fps at 1080p rendering resolution

**Tip:** If your HDMI output negotiated 4K but your projector is 1080p, force 1080p output in `/boot/firmware/config.txt` to eliminate the upscale overhead:
```
hdmi_group=1
hdmi_mode=16
```

---

## API Reference

All endpoints are prefixed with `/api`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/status` | Renderer status, resolution, playback state |
| `GET` | `/surfaces` | List all surfaces |
| `POST` | `/surfaces` | Create a new surface |
| `PUT` | `/surfaces/{id}` | Update surface (points, source, grid, etc.) |
| `DELETE` | `/surfaces/{id}` | Delete a surface |
| `GET` | `/sources` | List content files |
| `POST` | `/sources/upload` | Upload a video/image |
| `DELETE` | `/sources/{filename}` | Delete a content file |
| `POST` | `/playback/start` | Start playback (optional: specify source) |
| `POST` | `/playback/stop` | Stop playback |
| `POST` | `/playback/pause` | Pause playback |
| `POST` | `/playback/resume` | Resume playback |
| `POST` | `/playback/sync` | Sync all surfaces to frame 0 |
| `GET` | `/motions` | List all motions |
| `POST` | `/motions` | Create a motion (with auto-smoothing) |
| `PUT` | `/motions/{id}` | Update motion properties |
| `DELETE` | `/motions/{id}` | Delete a motion |
| `GET` | `/motions/export/all` | Export all motions as JSON |
| `POST` | `/motions/import` | Import motions from JSON file |
| `GET` | `/preview.mjpeg` | Live MJPEG preview stream |

---

## Contributing

Contributions are welcome! This project is in active development heading toward Halloween 2026.

Areas where help is appreciated:
- GPU-accelerated rendering (OpenGL ES / DRM/KMS)
- Mesh warp (beyond 4-point quad)
- Audio-reactive effects
- Content generation tools
- Mobile UI improvements
- Documentation and tutorials

---

## License

MIT License. See [LICENSE](LICENSE) for details.

---

Built with FastAPI, OpenCV, React, and a healthy obsession with Halloween.
