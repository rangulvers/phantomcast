"""Video playback and projection rendering engine.

Runs in a separate thread: reads video frames, applies warp,
outputs to HDMI via Linux framebuffer (/dev/fb0) — no X11 needed.
Also provides downscaled MJPEG preview frames for the web UI.

Works fully headless over SSH — the browser UI is the only control surface.
"""

import logging
import mmap
import os
import struct
import subprocess
import threading
import time
from pathlib import Path
from typing import Optional

import cv2
import numpy as np

from .warp import Motion, ProjectConfig, Surface

logger = logging.getLogger(__name__)


class FramebufferOutput:
    """Direct framebuffer writer for HDMI output without X11/Wayland."""

    def __init__(self, device: str = "/dev/fb0"):
        self.device = device
        self._fb = None
        self._fbmap = None
        self.width = 0
        self.height = 0
        self.bpp = 0  # bytes per pixel
        self._line_length = 0
        self._available = False

    def open(self) -> bool:
        """Open framebuffer and read screen dimensions."""
        try:
            # Read framebuffer info via fbset or /sys
            vinfo = self._read_fb_info()
            if not vinfo:
                logger.warning("Could not read framebuffer info — display output disabled")
                return False

            self.width, self.height, self.bpp, self._line_length = vinfo
            logger.info("Framebuffer: %dx%d, %d bpp, line_length=%d", self.width, self.height, self.bpp * 8, self._line_length)

            self._fb = open(self.device, "r+b")
            size = self._line_length * self.height
            self._fbmap = mmap.mmap(self._fb.fileno(), size, mmap.MAP_SHARED, mmap.PROT_WRITE | mmap.PROT_READ)
            self._available = True
            return True
        except (PermissionError, FileNotFoundError, OSError) as e:
            logger.warning("Framebuffer not available (%s) — display output disabled, preview-only mode", e)
            return False

    def write_frame(self, frame: np.ndarray) -> None:
        """Write a BGR frame to the framebuffer."""
        if not self._available or self._fbmap is None:
            return

        row_bytes = self.width * self.bpp
        needs_resize = frame.shape[1] != self.width or frame.shape[0] != self.height

        if self.bpp == 4:
            # BGRA — convert before resize (cheaper at lower res)
            pixels = cv2.cvtColor(frame, cv2.COLOR_BGR2BGRA)
            if needs_resize:
                pixels = cv2.resize(pixels, (self.width, self.height), interpolation=cv2.INTER_NEAREST)
        elif self.bpp == 2:
            # RGB565 — use OpenCV native conversion, then upscale
            pixels = cv2.cvtColor(frame, cv2.COLOR_BGR2BGR565)
            if needs_resize:
                pixels = cv2.resize(pixels, (self.width, self.height), interpolation=cv2.INTER_NEAREST)
        elif self.bpp == 3:
            pixels = frame
            if needs_resize:
                pixels = cv2.resize(pixels, (self.width, self.height), interpolation=cv2.INTER_NEAREST)
        else:
            return

        data = pixels.tobytes()
        if self._line_length == row_bytes:
            self._fbmap[:self.height * row_bytes] = data
        else:
            for y in range(self.height):
                offset = y * self._line_length
                row_start = y * row_bytes
                self._fbmap[offset:offset + row_bytes] = data[row_start:row_start + row_bytes]

    def close(self) -> None:
        if self._fbmap:
            self._fbmap.close()
        if self._fb:
            self._fb.close()
        self._available = False

    def _read_fb_info(self) -> Optional[tuple[int, int, int, int]]:
        """Read framebuffer dimensions from /sys/class/graphics/fb0/."""
        sys_path = f"/sys/class/graphics/{os.path.basename(self.device)}"
        try:
            # Try reading from sysfs
            with open(f"{sys_path}/virtual_size") as f:
                parts = f.read().strip().split(",")
                w, h = int(parts[0]), int(parts[1])
            with open(f"{sys_path}/bits_per_pixel") as f:
                bits = int(f.read().strip())
            with open(f"{sys_path}/stride") as f:
                line_length = int(f.read().strip())
        except (FileNotFoundError, ValueError, IndexError):
            # Fallback: try fbset
            try:
                out = subprocess.check_output(["fbset", "-s", "-fb", self.device], text=True, stderr=subprocess.DEVNULL)
                w = h = bits = line_length = 0
                for line in out.splitlines():
                    line = line.strip()
                    if "geometry" in line:
                        parts = line.split()
                        w, h = int(parts[1]), int(parts[2])
                        bits = int(parts[5])
                    if "LineLength" in line:
                        line_length = int(line.split()[-1])
                if not line_length:
                    line_length = w * (bits // 8)
            except (subprocess.CalledProcessError, FileNotFoundError, ValueError):
                return None

        if w == 0 or h == 0:
            return None

        bpp = bits // 8
        if not line_length:
            line_length = w * bpp
        return w, h, bpp, line_length


class Renderer:
    """Manages video playback with quad-warp projection output."""

    def __init__(self, config: ProjectConfig, content_dir: Path):
        self.config = config
        self.content_dir = content_dir
        self._running = False
        self._thread: Optional[threading.Thread] = None
        self._lock = threading.Lock()

        # Per-surface video captures: surface_id -> VideoCapture
        self._caps: dict[str, cv2.VideoCapture] = {}

        # Framebuffer output (works headless, no X11)
        self._fb = FramebufferOutput()

        # The latest preview frame (downscaled for MJPEG stream)
        self._preview_frame: Optional[np.ndarray] = None
        self._preview_lock = threading.Lock()

        # Playback state
        self.playing = False
        self.paused = False
        self._motion_start_time: float = 0.0

    def start(self) -> None:
        """Start the rendering loop in a background thread."""
        if self._running:
            return

        # Try to open framebuffer for direct HDMI output
        fb_ok = self._fb.open()
        if fb_ok:
            logger.info("Framebuffer output active — HDMI will show projection")
        else:
            logger.info("No framebuffer — running in preview-only mode (web UI still works)")

        self._running = True
        self._thread = threading.Thread(target=self._render_loop, daemon=True)
        self._thread.start()
        logger.info("Renderer started")

    def stop(self) -> None:
        """Stop the rendering loop."""
        self._running = False
        if self._thread:
            self._thread.join(timeout=5)
        with self._lock:
            for cap in self._caps.values():
                cap.release()
            self._caps.clear()
        self._fb.close()
        logger.info("Renderer stopped")

    def play(self, source: Optional[str] = None) -> bool:
        """Start playback. If source is given, load it for the first matching surface."""
        if source:
            # Find surface that uses this source, or the first enabled surface
            with self._lock:
                for surface in self.config.surfaces:
                    if surface.enabled and (surface.source == source or not surface.source):
                        surface.source = source
                        self._open_surface_source(surface)
                        break
                else:
                    # No match — load on first enabled surface
                    for surface in self.config.surfaces:
                        if surface.enabled:
                            surface.source = source
                            self._open_surface_source(surface)
                            break
        else:
            # Open all surfaces that have a source but no capture yet
            with self._lock:
                for surface in self.config.surfaces:
                    if surface.enabled and surface.source and surface.id not in self._caps:
                        self._open_surface_source(surface)

        self.playing = True
        self.paused = False
        return True

    def sync_all(self) -> None:
        """Reset all surface video captures to frame 0 for synchronized playback."""
        with self._lock:
            for cap in self._caps.values():
                cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
        logger.info("All surfaces synced to frame 0")

    def pause(self) -> None:
        self.paused = True

    def stop_playback(self) -> None:
        self.playing = False
        self.paused = False
        with self._lock:
            for cap in self._caps.values():
                cap.release()
            self._caps.clear()

    def _open_surface_source(self, surface: Surface) -> bool:
        """Open a video capture for a specific surface. Must hold self._lock."""
        if not surface.source:
            return False
        path = self.content_dir / surface.source
        if not path.exists():
            logger.error("Source file not found: %s", path)
            return False

        # Release existing capture for this surface
        if surface.id in self._caps:
            self._caps[surface.id].release()

        cap = cv2.VideoCapture(str(path))
        if not cap.isOpened():
            logger.error("Failed to open video: %s", path)
            return False

        self._caps[surface.id] = cap
        logger.info("Surface %s playing: %s", surface.id, surface.source)
        return True

    def reload_surface_source(self, surface_id: str) -> bool:
        """Reload video capture when a surface's source changes."""
        with self._lock:
            for surface in self.config.surfaces:
                if surface.id == surface_id:
                    return self._open_surface_source(surface)
        return False

    def get_preview_jpeg(self, quality: int = 60) -> Optional[bytes]:
        """Get the current preview frame as JPEG bytes."""
        with self._preview_lock:
            frame = self._preview_frame
        if frame is None:
            return None
        _, jpg = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, quality])
        return jpg.tobytes()

    def get_status(self) -> dict:
        """Return current renderer status."""
        return {
            "running": self._running,
            "playing": self.playing,
            "paused": self.paused,
            "current_source": ", ".join(s.source for s in self.config.surfaces if s.enabled and s.source),
            "resolution": list(self.config.resolution),
            "surfaces": len(self.config.surfaces),
            "framebuffer": self._fb._available,
        }

    def update_surface(self, surface_id: str, dst_points: list[list[float]]) -> bool:
        """Update a surface's destination points (called from API during calibration)."""
        with self._lock:
            for surface in self.config.surfaces:
                if surface.id == surface_id:
                    surface.dst_points = dst_points
                    logger.info("Surface %s updated", surface_id)
                    return True
        return False

    def _render_loop(self) -> None:
        """Main render loop — reads per-surface frames, applies warp, composites output."""
        w, h = self.config.resolution

        # Black frame as default
        black = np.zeros((h, w, 3), dtype=np.uint8)
        fps_target = 30
        frame_time = 1.0 / fps_target

        while self._running:
            t0 = time.monotonic()

            output = black.copy()

            with self._lock:
                for surface in self.config.surfaces:
                    if not surface.enabled:
                        continue

                    # Read this surface's video frame
                    frame = None
                    if self.playing and not self.paused and surface.id in self._caps:
                        cap = self._caps[surface.id]
                        ret, frame = cap.read()
                        if not ret:
                            if surface.loop:
                                cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                                ret, frame = cap.read()
                            if not ret:
                                frame = None

                        if frame is not None and (frame.shape[1] != w or frame.shape[0] != h):
                            frame = cv2.resize(frame, (w, h))

                    # Determine what to render for this surface
                    if surface.show_grid:
                        grid_frame = frame.copy() if frame is not None else np.zeros((h, w, 3), dtype=np.uint8)
                        self._draw_grid(grid_frame, surface)
                        warped = surface.warp_frame(grid_frame, (w, h))
                    elif frame is not None:
                        warped = surface.warp_frame(frame, (w, h))
                    else:
                        continue

                    # Composite onto output
                    if surface.opacity < 1.0:
                        output = cv2.addWeighted(output, 1.0, warped, surface.opacity, 0)
                    else:
                        mask = cv2.cvtColor(warped, cv2.COLOR_BGR2GRAY) > 0
                        output[mask] = warped[mask]

            # Draw motion trails on output (projector space)
            with self._lock:
                for motion in self.config.motions:
                    if motion.enabled and motion.points and motion.duration > 0:
                        self._draw_motion(output, motion, t0)

            self._output_and_preview(output, w, h)

            elapsed = time.monotonic() - t0
            time.sleep(max(0, frame_time - elapsed))

    def _draw_motion(self, frame: np.ndarray, motion: Motion, now: float) -> None:
        """Draw a motion trail animation on the output frame."""
        if not self._motion_start_time:
            self._motion_start_time = now

        elapsed = (now - self._motion_start_time) % motion.duration
        color = tuple(motion.color)
        trail_t = motion.trail_length

        for i in range(len(motion.points) - 1):
            x1, y1, t1 = motion.points[i]
            x2, y2, t2 = motion.points[i + 1]

            # Draw trail segments within the trail window
            if t2 < elapsed - trail_t or t1 > elapsed:
                continue

            # Calculate opacity based on age
            age = elapsed - t2
            if age < 0:
                # This segment includes the current head position
                # Interpolate head position
                frac = (elapsed - t1) / max(t2 - t1, 0.001)
                frac = max(0.0, min(1.0, frac))
                hx = int(x1 + (x2 - x1) * frac)
                hy = int(y1 + (y2 - y1) * frac)
                # Draw head dot (bright)
                cv2.circle(frame, (hx, hy), motion.dot_size, color, -1, cv2.LINE_AA)
                # Glow
                cv2.circle(frame, (hx, hy), motion.dot_size * 2, color, 1, cv2.LINE_AA)
                # Draw segment up to head
                cv2.line(frame, (int(x1), int(y1)), (hx, hy), color, max(2, motion.dot_size // 2), cv2.LINE_AA)
            else:
                # Trail segment — fade based on age
                alpha = max(0.0, 1.0 - age / trail_t)
                faded = tuple(int(c * alpha) for c in color)
                thickness = max(1, int(motion.dot_size // 2 * alpha))
                cv2.line(frame, (int(x1), int(y1)), (int(x2), int(y2)), faded, thickness, cv2.LINE_AA)

    def _output_and_preview(self, output: np.ndarray, w: int, h: int) -> None:
        """Write to framebuffer (HDMI) and update preview frame."""
        # Write to HDMI via framebuffer
        self._fb.write_frame(output)

        # Downscale for preview (640px wide)
        preview_w = 640
        preview_h = int(h * (preview_w / w))
        preview = cv2.resize(output, (preview_w, preview_h))
        with self._preview_lock:
            self._preview_frame = preview

    @staticmethod
    def _draw_grid(frame: np.ndarray, surface: "Surface", cols: int = 8, rows: int = 6) -> None:
        """Draw a calibration grid on the frame. Works as standalone test pattern or overlay."""
        h, w = frame.shape[:2]
        color = (0, 255, 136)  # green
        thickness = 2

        # Vertical lines
        for i in range(1, cols):
            x = int(w * i / cols)
            cv2.line(frame, (x, 0), (x, h), color, thickness)
        # Horizontal lines
        for i in range(1, rows):
            y = int(h * i / rows)
            cv2.line(frame, (0, y), (w, y), color, thickness)
        # Border (bright white for visibility on walls)
        cv2.rectangle(frame, (2, 2), (w - 3, h - 3), (255, 255, 255), 3)
        # Center crosshair
        cx, cy = w // 2, h // 2
        cv2.line(frame, (cx - 60, cy), (cx + 60, cy), (0, 200, 255), 2)
        cv2.line(frame, (cx, cy - 60), (cx, cy + 60), (0, 200, 255), 2)
        # Corner markers
        for px, py in [(0, 0), (w, 0), (w, h), (0, h)]:
            cv2.circle(frame, (min(px, w - 1), min(py, h - 1)), 15, (255, 255, 255), -1)

    def _get_active_surface(self) -> Optional[Surface]:
        """Get the first enabled surface."""
        for s in self.config.surfaces:
            if s.enabled:
                return s
        return None
