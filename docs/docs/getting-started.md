---
sidebar_position: 2
title: Getting Started
---

# Getting Started

Get PhantomCast running in under 5 minutes.

## Prerequisites

- A Linux computer with HDMI output
- Python 3.12 or newer
- Node.js 22 or newer
- A projector connected via HDMI

## Installation

Clone the repository and run the setup script:

```bash
git clone https://github.com/rangulvers/phantomcast
cd phantomcast
./setup.sh
```

This creates a Python virtual environment, installs all dependencies, and builds the web frontend.

## Starting PhantomCast

```bash
./start.sh
```

This starts the backend server on port **8000** and the rendering engine.

## Opening the Interface

Open a browser on any device connected to the same network and go to:

```
http://<your-computer-ip>:8000
```

You'll see the PhantomCast workspace:

![PhantomCast Dashboard](/img/screenshots/ui-dashboard.png)

## Your First Projection

### 1. Upload a Video

Navigate to the **Media** tab and drag a video file into the upload area, or click to browse.

![Media Library](/img/screenshots/ui-media.png)

### 2. Create a Surface

In the **Workspace**, click the surface type selector in the toolbar (default is "Quad") and click **+ Add Surface**. A new surface appears with four corner control points.

### 3. Assign a Video

Select your surface in the layers panel on the right, then choose your uploaded video from the source dropdown in the inspector panel.

### 4. Calibrate

Drag the corner control points to match the area on your wall where you want the projection to appear. Use the calibration grid (toggle with the grid button in the toolbar) to check alignment.

### 5. Play

Click the **Play** button in the toolbar. Your video is now being warped onto the surface and projected via HDMI.

## Running as a Service

To start PhantomCast automatically on boot:

```bash
sudo cp phantomcast.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable phantomcast
sudo systemctl start phantomcast
```

## Stopping PhantomCast

```bash
./stop.sh
```
