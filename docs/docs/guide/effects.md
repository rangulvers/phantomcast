---
sidebar_position: 5
title: Effects & Adjustments
---

# Effects & Adjustments

Every surface has its own set of visual adjustments, effects, and blend mode controls. You find all of these in the inspector panel's **Properties** tab when a surface is selected.

## Adjustments

The **Adjustments** section gives you sliders to tweak the look of each surface:

| Slider | Range | What it does |
|---|---|---|
| **Brightness** | -100 to 100 | Makes the image lighter or darker. 0 is the default (no change). |
| **Contrast** | -100 to 100 | Controls the difference between light and dark areas. Higher values make lights lighter and darks darker. |
| **Saturation** | -100 to 100 | Controls color intensity. Drag left for desaturated/grayscale, right for vivid colors. |
| **Opacity** | 0% to 100% | Controls transparency. At 0% the surface is invisible; at 100% it is fully solid. |

All adjustments update in real time -- slide and watch the preview change as you go.

## Blend Modes

Blend modes control how a surface mixes with the surfaces behind it. Choose a mode from the **Blend Mode** dropdown:

| Mode | Effect |
|---|---|
| **Normal** | Standard rendering, no blending. This is the default. |
| **Additive** | Adds pixel brightness together. Creates a glowing, brightening effect -- great for ghostly or light-based visuals. |
| **Multiply** | Multiplies pixel values, making the result darker. Useful for shadow overlays. |
| **Screen** | The opposite of multiply -- lightens the image. Similar to projecting two lights onto the same spot. |

## Effects

The **Effects** section lets you apply animated effects to a surface:

| Effect | What it does |
|---|---|
| **Strobe** | Rapidly flashes the surface on and off |
| **Color Shift** | Continuously rotates through hue changes |
| **Fade In** | Gradually fades the surface in from black |
| **Fade Out** | Gradually fades the surface out to black |

Each effect has a **Speed** slider that controls how fast the animation runs. To remove an effect, set it back to "None."

### Applying an Effect

1. Select a surface in the workspace
2. In the inspector, scroll to the **Effects** section
3. Choose an effect from the dropdown
4. Adjust the **Speed** slider to taste
5. The effect starts immediately in the preview

## Practical Tips

- **Ghost effects**: Set the blend mode to **Additive** and lower the opacity. This makes the surface glow and blend into whatever is behind it -- perfect for ghostly apparitions.

- **Subtle overlays**: Use **Screen** mode with reduced opacity to layer a texture over another surface without making it too dark.

- **Use Strobe sparingly**: The strobe effect is intense. A slow strobe speed creates a dramatic flickering effect; a fast speed can be overwhelming. Consider your audience.

- **Combine adjustments and effects**: Drop the saturation to create a desaturated, eerie look, then add a slow Color Shift for an unsettling color pulse.

- **Fade transitions**: Use Fade In and Fade Out to smoothly introduce or remove a surface during a live show.
