# PhantomCast — Phase 2 Feature Plan

Based on PiMapper Pro design concept mockups (April 2026).

---

## 2.1 — Dashboard / Project Overview

- Project cards with thumbnail, version, resolution, vertices count
- Multiple project support (save/load different setups)
- GO LIVE button (initialize output engine)
- System Health panel: CPU, temp, RAM, GPU vCore (real-time)
- Quick Actions: Reboot, Shutdown
- System Event Log with timestamps
- Quick Start actions (Recalibrate, Sync Assets)

## 2.2 — Workspace Enhancements

- Surface type selector toolbar: Quad, Bezier, Triangle, Mesh, Grid
- Bezier surface support (curved edges, not just quads)
- Triangle surface type
- Surface transform panel: Position X/Y, Scale, Rotation
- Layers panel (bottom) with surface ordering, visibility toggle, type labels
- Scene > Projector > Surface breadcrumb navigation
- AUTO CALIBRATE button
- Preview toggle in toolbar

## 2.3 — Media Library (NEW page)

- Drag & drop upload area
- Media cards with thumbnails, duration, resolution, FPS, codec, file size
- Encoding progress indicator
- Live Preview of selected asset in inspector
- Opacity control per asset
- Playback mode: Loop / Once toggle
- Metadata display (created, owner, location)
- Search and filter
- Codec validation (error badges for incompatible files)
- Process Selection (transcode/re-encode)

## 2.4 — Settings / Configuration (NEW page)

- System Output Preview with grid
- Projector Setup: target resolution dropdown, frame rate, orientation (landscape/portrait)
- Edge Blending: toggle, overlap percentage slider, gamma correction
- Advanced Curve Editor for falloff curves
- Master Color controls: brightness, contrast sliders
- RGB Offset: per-channel R/G/B adjustment
- Reset Calibration button
- Node info: ID, firmware version
- Quick Layers management
- Temperature alert system
- Export Config Bundle

## 2.5 — Multi-Node Support

- Multiple Pi nodes in a network
- Node management (Node 01, etc.)
- Sync status between nodes with IP + latency
- Per-node health monitoring

## 2.6 — Inspector Panel

- Contextual right panel that changes based on selection
- Properties tab: transform, media assignment, blend mode
- Layers tab: surface ordering, visibility, type
- Quick Layers for toggling overlays

---

## Implementation Estimate

| Feature | Effort |
|---------|--------|
| 2.1 Dashboard | 1 session |
| 2.2 Workspace enhancements | 2 sessions |
| 2.2 Bezier/triangle surfaces | 2 sessions |
| 2.3 Media Library | 1 session |
| 2.4 Settings page | 1 session |
| 2.4 Edge blending + curve editor | 1-2 sessions |
| 2.5 Multi-node | significant effort |
| 2.6 Inspector panel | 1 session |
