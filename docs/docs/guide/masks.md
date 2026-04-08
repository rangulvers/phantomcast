---
sidebar_position: 6
title: Exclusion Masks
---

# Exclusion Masks

Masks let you black out specific areas within a surface. Any region inside a mask is excluded from the projection -- it simply goes dark. This is essential for avoiding light where you do not want it.

## Why Use Masks?

Imagine you are projecting onto a building facade. You want the video to cover the whole wall, but there are windows where you do not want light shining through into the rooms behind them. Masks solve this: draw a mask over each window, and those areas stay black while the rest of the wall displays your content.

Common uses:

- **Windows** -- prevent light from shining through glass
- **Doors** -- exclude open doorways
- **Obstacles** -- block areas where objects protrude from the surface
- **Irregular edges** -- clean up the boundaries of your projection area

## Drawing a Mask

1. Select the surface you want to mask
2. Click the **Mask Draw** button in the toolbar above the preview
3. Click on the preview to place points -- each click adds a vertex of the mask polygon
4. Continue clicking to outline the area you want to exclude
5. Close the shape to complete the mask

Tips for drawing:

- Place points carefully along the edges of the area you want to block
- More points give you a more precise boundary
- After drawing, you can drag individual points to adjust their positions

## Enabling and Disabling Masks

Each mask has a toggle to turn it on or off:

- **Enabled** -- the masked area is blacked out
- **Disabled** -- the mask is hidden and the full surface content shows through

This is handy for quickly comparing your projection with and without masks, or for temporarily revealing content in a masked area during a show.

## Multiple Masks Per Surface

You can add as many masks as you need on a single surface. Each mask works independently:

- Add more masks by clicking the **Mask Draw** button again
- Each mask appears as a separate entry in the inspector
- Toggle, edit, or delete each mask on its own
- When masks overlap, the combined area is blacked out

:::tip
If you need to mask several windows on a building, create one mask per window rather than trying to draw a single complex shape. Individual masks are easier to adjust later.
:::
