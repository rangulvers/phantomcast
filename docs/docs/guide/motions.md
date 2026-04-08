---
sidebar_position: 7
title: Motion Trails
---

# Motion Trails

Motion trails are animated glowing paths that travel across your projection. A bright dot moves along a path you define, leaving a fading trail behind it. Use them for decorative effects, directing attention, or adding dynamic movement to a static scene.

## Recording a Motion Path

1. Click the **Record Motion** button in the toolbar above the preview
2. The preview enters recording mode
3. **Click** in the preview to place individual path points, or **click and drag** to draw a continuous path
4. The path captures your movement in real time -- drawing faster produces faster playback
5. Click the **Stop** button when your path is complete

That is all it takes. Your motion trail is saved and starts playing immediately.

## Playback

Once recorded, the motion trail loops continuously:

- A glowing dot travels along the path you drew
- A fading trail follows behind the dot
- The animation speed matches how fast you drew the original path
- Multiple motion trails can play at the same time

## Customizing Appearance

Each motion trail has settings you can adjust:

### Color

Set the color of the dot and its trailing glow. Pick a color that fits your projection theme -- a cool blue for a haunted look, warm orange for fire effects, green for an eerie atmosphere.

### Dot Size

Controls how large the leading dot appears. Bigger dots create bolder, more visible trails.

### Trail Length

Controls how far behind the dot the glow extends. A long trail creates a dramatic sweeping effect. A short trail gives a tighter, more subtle look.

## Automatic Path Smoothing

You do not need to worry about drawing a perfectly smooth path. PhantomCast automatically smooths your recorded paths using spline interpolation:

- Shaky hand movements become graceful curves
- Jagged click-by-click paths turn into fluid animations
- The overall shape of your path is preserved -- only the noise is removed

This happens automatically when the motion is saved. No settings to configure.

## Managing Motion Trails

- Motion trails appear in the inspector and can be toggled on or off individually
- Delete a motion trail if you no longer need it
- All motion trails are saved as part of your project, so they persist when you save and reload
