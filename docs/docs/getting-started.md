---
sidebar_position: 2
title: Getting Started
---

# Getting Started

This guide walks you through your first projection mapping session with PhantomCast.

## Opening the Interface

Once PhantomCast is running, open a browser on any device connected to the same network and navigate to:

```
http://<your-server-ip>:8000
```

You'll see the PhantomCast workspace — the central hub for all projection mapping tasks.

![PhantomCast Workspace](/img/screenshots/ui-dashboard.png)

## Your First Projection

### 1. Upload a Video

Navigate to the **Media** tab using the sidebar. Drag a video file into the upload area, or click to browse your files.

![Media Library](/img/screenshots/ui-media.png)

PhantomCast supports MP4 (H.264) video and common image formats. You'll see a thumbnail and metadata for each uploaded file.

### 2. Create a Surface

Switch to the **Workspace** tab. In the toolbar above the preview, select a surface type from the dropdown — **Quad** is the default and works for most rectangular areas. Click **Add Surface** to create one.

A new surface appears in the preview with four draggable control points.

### 3. Assign Your Video

With the surface selected, look at the **Inspector** panel on the right side. Use the source dropdown to assign your uploaded video to this surface.

### 4. Calibrate the Projection

Drag the control points in the preview to match the physical area where you want the projection to appear. For fine-tuning, use the numeric inputs in the Transform section of the inspector (position, scale, rotation).

Toggle the **calibration grid** using the grid button in the toolbar — this overlays a reference grid to help check alignment.

:::tip
Calibrate in the dark with a bright test pattern for the most accurate results. Use the grid overlay to verify straight lines and corners.
:::

### 5. Start Playback

Click the **Play** button in the toolbar. Your video is now being warped in real-time and output to the projector via HDMI.

## Next Steps

- [Learn about surface types](/docs/guide/surfaces) — quad, triangle, bezier, and mesh warp
- [Add effects and adjustments](/docs/guide/effects) — blend modes, brightness, contrast, strobe
- [Draw exclusion masks](/docs/guide/masks) — black out windows and doors
- [Record motion trails](/docs/guide/motions) — animated glowing paths across your projection
- [Save your project](/docs/guide/projects) — preserve your calibration for next time
