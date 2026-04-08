---
sidebar_position: 1
title: What is PhantomCast?
---

# What is PhantomCast?

PhantomCast is an open-source projection mapping tool that lets you warp video content onto physical surfaces — buildings, walls, windows, doors, or any shape you can imagine. Connect a projector, open the web interface, and start mapping.

![PhantomCast Workspace](/img/screenshots/ui-workspace.png)

## What You Can Do

- **Map video onto any surface** — drag corner points to fit your projection to walls, windows, or architectural features
- **Multiple surface types** — quad (4-point), triangle (3-point), bezier (curved edges), and mesh (grid warp) for complex shapes
- **Per-surface video** — assign different videos to different surfaces, each with independent playback
- **Real-time effects** — strobe, color shift, and fade effects with adjustable speed
- **Exclusion masks** — black out areas like windows or doors so light doesn't bleed through
- **Motion trails** — record and play back animated glowing trails across your projection
- **Blend modes** — combine surfaces with additive, multiply, or screen blending
- **Image adjustments** — brightness, contrast, saturation, and opacity per surface
- **Layer ordering** — control which surfaces render on top

## How It Works

1. **Connect a projector** via HDMI to your computer
2. **Start PhantomCast** — it runs a local web server
3. **Open the web UI** in any browser on your network
4. **Upload content** — videos or images
5. **Create surfaces** and drag their control points to match your projection area
6. **Hit play** — PhantomCast warps your content in real-time and outputs it directly to the projector

The web UI provides a live preview so you can calibrate from any device — your phone, tablet, or laptop — without standing at the projector.

## System Requirements

- Any Linux computer with HDMI output (tested on ARM and x86)
- Python 3.12+
- Node.js 22+ (for building the frontend)
- A projector connected via HDMI
- Network access (for the web calibration UI)
