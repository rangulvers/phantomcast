---
sidebar_position: 1
title: The Workspace
---

# The Workspace

When you open PhantomCast, you land on the workspace -- your main control center for designing and calibrating projections. Everything happens here: previewing your output, editing surfaces, tweaking effects, and managing layers.

![PhantomCast Workspace](/img/screenshots/ui-workspace.png)

## Layout Overview

The workspace is divided into four main areas:

### Left Sidebar

The sidebar gives you quick access to every section of PhantomCast:

- **Dashboard** -- overview of your current project
- **Workspace** -- the main editing view (you are here)
- **Media** -- your video and image library
- **Settings** -- project configuration and system options

Click any icon to switch between sections.

### Central Preview

The large central area shows a live MJPEG preview of your projection output. This is where you see exactly what the projector is displaying, including all surfaces, effects, and masks.

You interact directly with this preview to:

- Drag control points to position surfaces
- Draw exclusion masks
- Record motion trails
- See changes reflected in real time

### Toolbar

The toolbar sits above the preview and contains your most-used controls:

| Control | What it does |
|---|---|
| **Surface type selector** | Choose the type of surface to add (Quad, Triangle, Bezier, Mesh) |
| **Play / Pause / Stop** | Control video playback on all surfaces |
| **Sync** | Re-synchronize playback across surfaces |
| **Record Motion** | Start recording a motion trail path |
| **Mask Draw** | Enter mask drawing mode to define exclusion areas |
| **Grid Toggle** | Show or hide the calibration grid overlay |

### Inspector Panel (Right Side)

The inspector is your detail panel for the selected surface. It has two tabs:

**Properties Tab**
- **Transform** -- X position, Y position, Scale, and Rotation values. Use these number fields for precise positioning that goes beyond what dragging can achieve.
- **Adjustments** -- Brightness, Contrast, Saturation, and Opacity sliders to fine-tune the look of each surface.
- **Effects** -- Choose an effect (Strobe, Color Shift, Fade In, Fade Out), set the speed, and pick a blend mode.

**Layers Tab**
- See all surfaces stacked in their draw order
- Drag to reorder which surfaces appear on top
- Toggle visibility of individual surfaces

### Status Bar

The bar along the bottom of the screen shows system status at a glance -- connection state, frame rate, and any warnings or errors.

## Getting Started

A typical workflow in the workspace looks like this:

1. **Add a surface** using the toolbar dropdown and the add button
2. **Assign a video** from the inspector's source dropdown
3. **Drag the control points** in the preview to align the surface with your physical target
4. **Fine-tune** with the inspector's Transform fields and Adjustment sliders
5. **Add effects or masks** as needed
6. **Save your project** when everything looks right

The next sections of this guide walk through each of these steps in detail.
