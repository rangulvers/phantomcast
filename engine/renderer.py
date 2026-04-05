"""Video playback and projection rendering engine.

Runs in a separate thread/process: reads video frames, applies warp,
outputs to fullscreen SDL window on the HDMI-connected projector,
and provides downscaled MJPEG preview frames for the web UI.
"""

import logging
import threading
import time
from pathlib import Path
from typing import Optional

import cv2
import numpy as np

from .warp import ProjectConfig, Surface

logger = logging.getLogger(__name__)


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

        # The latest warped output frame (full resolution)
        self._output_frame: Optional[np.ndarray] = None
        # The latest preview frame (downscaled for MJPEG stream)
        self._preview_frame: Optional[np.ndarray] = None
        self._preview_lock = threading.Lock()

        # Playback state
        self.playing = False
        self.paused = False

        # SDL window name
        self._window_name = "PhantomCast Output"

    def start(self) -> None:
        """Start the rendering loop in a background thread."""
        if self._running:
            return
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
        cv2.destroyAllWindows()
        logger.info("Renderer stopped")

    def play(self, source: Optional[str] = None) -> bool:
        """Start playback. If source is given, switch to it."""
        if source:
            return self._load_source(source)
        if self._cap and self._cap.isOpened():
            self.playing = True
            self.paused = False
            return True
        # Try to load first surface's source or first playlist item
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
        """Main render loop — reads frames, applies warp, displays output."""
        w, h = self.config.resolution

        # Create fullscreen window for projector output
        if self.config.fullscreen:
            cv2.namedWindow(self._window_name, cv2.WINDOW_NORMAL)
            cv2.setWindowProperty(self._window_name, cv2.WND_PROP_FULLSCREEN, cv2.WINDOW_FULLSCREEN)

        # Black frame as default
        black = np.zeros((h, w, 3), dtype=np.uint8)
        fps_target = 30
        frame_time = 1.0 / fps_target

        while self._running:
            t0 = time.monotonic()

            if not self.playing or self.paused or self._cap is None:
                # Show black when not playing
                output = black.copy()
                self._show_and_preview(output, w, h)
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

            self._show_and_preview(output, w, h)

            elapsed = time.monotonic() - t0
            time.sleep(max(0, frame_time - elapsed))

        cv2.destroyAllWindows()

    def _show_and_preview(self, output: np.ndarray, w: int, h: int) -> None:
        """Display on projector window and update preview frame."""
        cv2.imshow(self._window_name, output)
        cv2.waitKey(1)

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
