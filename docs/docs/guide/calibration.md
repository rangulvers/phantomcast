---
sidebar_position: 3
title: Calibrating Your Projection
---

# Calibrating Your Projection

Calibration is where you align what PhantomCast projects with the physical surfaces it hits. Good calibration means your video content sits perfectly on the wall, window, or object you are targeting.

![Calibration in the workspace](/img/screenshots/ui-workspace.png)

## Dragging Control Points

The fastest way to calibrate is by dragging control points directly in the preview:

1. Select a surface (click it in the preview or in the Layers tab)
2. Its control points appear as handles you can grab
3. Click and drag any point to move it
4. Watch the projection update in real time as you adjust

Work one corner at a time, starting at the top-left and moving clockwise. Get the rough shape right first, then make fine adjustments.

## Fine-Tuning with the Inspector

For precision that dragging cannot achieve, use the number inputs in the inspector's **Transform** section:

| Field | What it controls |
|---|---|
| **X** | Horizontal position of the surface |
| **Y** | Vertical position of the surface |
| **Scale** | Size of the surface (zoom in or out) |
| **Rotation** | Angle of the surface in degrees |

Type exact values or use the arrow keys to nudge by small increments. This is especially helpful for aligning edges to exact positions or matching two surfaces precisely.

## Using the Calibration Grid

The grid overlay helps you check whether your alignment is straight and accurate:

1. Click the **Grid** button in the toolbar above the preview
2. A grid pattern appears over your surfaces
3. Straight grid lines on the physical surface mean your calibration is correct
4. Curved or skewed grid lines indicate areas that need adjustment
5. Click the grid button again to hide it when you are done

The grid follows the surface warping, so it is a reliable visual check of your alignment quality.

## Calibration Tips

- **Start with a bright test pattern.** Assign a high-contrast video or a solid white image to your surface so you can clearly see its edges against the physical target.

- **Calibrate in the dark.** Work in the same lighting conditions you plan to use during the actual show. Ambient light makes it harder to see edges precisely.

- **Use the grid to check straight lines.** Enable the calibration grid overlay and look at the physical surface. If the projected grid lines look straight on the wall, your calibration is good.

- **Position your projector first.** Get the projector's native output as close to your target area as possible before adjusting in software. Less digital warping means better image quality.

- **Save when you are done.** Once your calibration looks right, save the project so you can reload it later without repeating the whole process. If the projector gets bumped, you will need to recalibrate -- but your saved project gives you a head start.
