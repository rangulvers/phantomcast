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

from .warp import ProjectConfig, Surface

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

        # Resize to framebuffer dimensions if needed
        if frame.shape[1] != self.width or frame.shape[0] != self.height:
            frame = cv2.resize(frame, (self.width, self.height))

        if self.bpp == 4:
            # BGRA — add alpha channel
            bgra = cv2.cvtColor(frame, cv2.COLOR_BGR2BGRA)
            # Write row by row (line_length may include padding)
            for y in range(self.height):
                offset = y * self._line_length
                row_data = bgra[y].tobytes()
                self._fbmap[offset:offset + self.width * 4] = row_data
        elif self.bpp == 2:
            # RGB565
            r = (frame[:, :, 2] >> 3).astype(np.uint16)
            g = (frame[:, :, 1] >> 2).astype(np.uint16)
            b = (frame[:, :, 0] >> 3).astype(np.uint16)
            rgb565 = (r << 11) | (g << 5) | b
            for y in range(self.height):
                offset = y * self._line_length
                row_data = rgb565[y].tobytes()
                self._fbmap[offset:offset + self.width * 2] = row_data
        elif self.bpp == 3:
            # BGR24
            for y in range(self.height):
                offset = y * self._line_length
                row_data = frame[y].tobytes()
                self._fbmap[offset:offset + self.width * 3] = row_data

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
        self._cap: Optional[cv2.VideoCapture] = None
        self._current_source: str = ""
        self._lock = threading.Lock()

        # Framebuffer output (works headless, no X11)
        self._fb = FramebufferOutput()

        # The latest preview frame (downscaled for MJPEG stream)
        self._preview_frame: Optional[np.ndarray] = None
        self._preview_lock = threading.Lock()

        # Playback state
        self.playing = False
        self.paused = False

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
        if self._cap:
            self._cap.release()
            self._cap = None
        self._fb.close()
        logger.info("Renderer stopped")

    def play(self, source: Optional[str] = None) -> bool:
        """Start playback. If source is given, switch to it."""
        if source:
            return self._load_source(source)
        if self._cap and self._cap.isOpened():
            self.playing = True
            self.paused = False
            return True
        # Try to load first surface's source
        for surface in self.config.surfaces:
            if surface.enabled and surface.source:
                return self._load_source(surface.source)
        return False

    def pause(self) -> None:
        self.paused = True

    def stop_playback(self) -> None:
        self.playing = False
        self.paused = False
        if self._cap:
            self._cap.release()
            self._cap = None

    def _load_source(self, filename: str) -> bool:
        """Load a video file for playback."""
        path = self.content_dir / filename
        if not path.exists():
            logger.error("Source file not found: %s", path)
            return False

        with self._lock:
            if self._cap:
                self._cap.release()
            self._cap = cv2.VideoCapture(str(path))
            if not self._cap.isOpened():
                logger.error("Failed to open video: %s", path)
                self._cap = None
                return False
            self._current_source = filename
            self.playing = True
            self.paused = False
            logger.info("Playing: %s", filename)
            return True

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
            "current_source": self._current_source,
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
        """Main render loop — reads frames, applies warp, outputs to framebuffer + preview."""
        w, h = self.config.resolution

        # Black frame as default
        black = np.zeros((h, w, 3), dtype=np.uint8)
        fps_target = 30
        frame_time = 1.0 / fps_target

        while self._running:
            t0 = time.monotonic()

            if not self.playing or self.paused or self._cap is None:
                # Show black when not playing
                output = black.copy()
                self._output_and_preview(output, w, h)
                elapsed = time.monotonic() - t0
                time.sleep(max(0, frame_time - elapsed))
                continue

            with self._lock:
                ret, frame = self._cap.read()

            if not ret:
                # Video ended — loop or stop
                active_surface = self._get_active_surface()
                if active_surface and active_surface.loop:
                    self._cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                    continue
                else:
                    self.playing = False
                    continue

            # Resize frame to output resolution
            if frame.shape[1] != w or frame.shape[0] != h:
                frame = cv2.resize(frame, (w, h))

            # Apply warp for each enabled surface
            output = black.copy()
            with self._lock:
                for surface in self.config.surfaces:
                    if not surface.enabled:
                        continue
                    warped = surface.warp_frame(frame, (w, h))
                    if surface.opacity < 1.0:
                        output = cv2.addWeighted(output, 1.0, warped, surface.opacity, 0)
                    else:
                        # Use warped pixels where they are non-black
                        mask = cv2.cvtColor(warped, cv2.COLOR_BGR2GRAY) > 0
                        output[mask] = warped[mask]

            self._output_and_preview(output, w, h)

            elapsed = time.monotonic() - t0
            time.sleep(max(0, frame_time - elapsed))

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

    def _get_active_surface(self) -> Optional[Surface]:
        """Get the first enabled surface."""
        for s in self.config.surfaces:
            if s.enabled:
                return s
        return None
