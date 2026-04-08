---
sidebar_position: 2
title: Working with Surfaces
---

# Working with Surfaces

Surfaces are the building blocks of your projection. Each surface is a region of the projected image that you shape and position to match a physical area -- a wall, a window, a column, or any other target.

## Surface Types

PhantomCast offers four surface types, each suited to different shapes:

### Quad

The most common choice. A quad has **4 control points** that define a quadrilateral shape.

- Best for rectangular areas like walls, doors, panels, and windows
- Drag any corner to reshape the projection area
- Start here if you are unsure which type to use

### Triangle

A simpler surface with **3 control points** forming a triangle.

- Great for angular architectural features like roof gables or angled walls
- Also useful for creative, non-rectangular compositions

### Bezier

A quad with **curved edges**. Each edge has adjustable handles that let you bend it inward or outward.

- 4 corner points plus curve handles on each edge
- Ideal for arches, rounded window frames, columns, or organic shapes
- Drag the handles to sculpt the curvature of each edge

### Mesh

A grid of control points for the most precise warping control.

- Configurable grid size (e.g., 3x3, 4x4, 5x5)
- Every grid intersection is a draggable point
- Best for complex curved surfaces or correcting uneven distortion
- Requires more setup time but gives the most flexibility

## Creating a Surface

1. In the toolbar above the preview, open the **surface type dropdown** and select the type you want (Quad, Triangle, Bezier, or Mesh)
2. Click the **Add** button
3. A new surface appears in the preview with default control points
4. The surface is also added to the Layers list in the inspector panel

## Selecting and Editing a Surface

- **Click a surface** in the preview or in the Layers tab to select it
- When selected, its control points become visible as draggable handles
- Drag any control point to reshape the surface
- Use the **Transform** fields in the inspector (X, Y, Scale, Rotation) for precise numeric adjustments
- All changes are reflected in the live preview immediately

## Assigning a Video Source

Each surface displays one video or image at a time:

1. Select the surface you want to configure
2. In the inspector panel, find the **Source** dropdown
3. Choose from your uploaded media files
4. The content appears on the surface right away

A surface with no assigned source displays as black.

## Deleting a Surface

1. Select the surface you want to remove
2. Click the **Delete** button in the inspector panel, or use the delete option in the Layers tab
3. The surface and all its settings (masks, effects, motions) are removed

:::tip
If you just want to temporarily hide a surface without losing its settings, toggle its visibility off in the Layers tab instead of deleting it.
:::

## Surface Draw Order

When surfaces overlap, the one higher in the Layers list is drawn on top. Drag surfaces up or down in the Layers tab to change which appears in front.
