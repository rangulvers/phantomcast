---
sidebar_position: 4
title: Troubleshooting
---

# Troubleshooting

Common issues and how to fix them.

## No HDMI Output

**The projector shows nothing even though PhantomCast is running.**

1. Check that your projector is connected and the HDMI input is selected
2. Verify the framebuffer device exists:
   ```bash
   ls -la /dev/fb0
   ```
3. Make sure your user has permission to access the display:
   ```bash
   sudo usermod -a -G video $USER
   ```
   Log out and back in for this to take effect.

## Black Screen on Projector

**PhantomCast is running but the projector is black.**

- Make sure at least one surface is **enabled**
- Check that the surface has a **video assigned** (select one in the inspector)
- Make sure **playback is started** — click the Play button in the toolbar
- Check the preview in the browser — if it's also black, the issue is your configuration, not the display

## Choppy or Laggy Output

**The projection looks stuttery.**

- **Reduce resolution** — if your display runs at 4K, switch to 1080p for better performance
- **Minimize effects** — disable adjustments (brightness, contrast, saturation) you're not actively using
- **Check temperature** — if your system is overheating, it may throttle the CPU. Ensure adequate cooling
- **Fewer surfaces** — each active surface adds processing overhead

## Preview Not Loading

**The web UI opens but the preview area is empty.**

- Confirm the backend is running (you should see the UI load)
- Check you're using the correct IP address and port 8000
- Open browser developer tools (F12) and check for errors
- If using a reverse proxy, ensure it supports streaming responses (MJPEG uses `multipart/x-mixed-replace`)

## Video Won't Play

**A surface has a video assigned but nothing shows.**

- **Check the format** — PhantomCast works best with MP4 files using H.264 video codec
- **Try a different file** — test with a known-good MP4 to rule out codec issues
- Re-encode problem files:
  ```bash
  ffmpeg -i input.mov -c:v libx264 -c:a aac output.mp4
  ```

## Changes Lost After Restart

**Your calibration or settings disappear when you restart.**

- Make sure to **save your project** before shutting down (Settings page > Save Project)
- Check that PhantomCast has write access to the config directory

## Still Stuck?

Open an issue on [GitHub](https://github.com/rangulvers/phantomcast/issues) with:

- Your OS and system info
- What you expected vs. what happened
- Steps to reproduce the problem
