"""Quad warp engine using OpenCV homography transforms."""

import json
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import cv2
import numpy as np

logger = logging.getLogger(__name__)


@dataclass
class Surface:
    """A single projection surface with quad warp configuration."""
    id: str
    name: str
    enabled: bool = True
    source: str = ""
    loop: bool = True
    opacity: float = 1.0
    show_grid: bool = False
    # Source rectangle corners (content space)
    src_points: list[list[float]] = field(default_factory=lambda: [
        [0, 0], [1920, 0], [1920, 1080], [0, 1080]
    ])
    # Destination quad corners (projector space, user-adjustable)
    dst_points: list[list[float]] = field(default_factory=lambda: [
        [0, 0], [1920, 0], [1920, 1080], [0, 1080]
    ])
    # Cached homography (recomputed only when points change)
    _cached_H: Optional[np.ndarray] = field(default=None, repr=False)
    _cached_src_key: Optional[tuple] = field(default=None, repr=False)
    _cached_dst_key: Optional[tuple] = field(default=None, repr=False)

    def compute_homography(self) -> np.ndarray:
        """Compute the 3x3 homography matrix from src to dst points (cached)."""
        src_key = tuple(tuple(p) for p in self.src_points)
        dst_key = tuple(tuple(p) for p in self.dst_points)
        if self._cached_H is not None and self._cached_src_key == src_key and self._cached_dst_key == dst_key:
            return self._cached_H
        src = np.array(self.src_points, dtype=np.float32)
        dst = np.array(self.dst_points, dtype=np.float32)
        H, _ = cv2.findHomography(src, dst)
        self._cached_H = H
        self._cached_src_key = src_key
        self._cached_dst_key = dst_key
        return H

    def warp_frame(self, frame: np.ndarray, output_size: tuple[int, int]) -> np.ndarray:
        """Apply homography warp to a video frame."""
        H = self.compute_homography()
        return cv2.warpPerspective(frame, H, output_size, flags=cv2.INTER_NEAREST)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "enabled": self.enabled,
            "source": self.source,
            "loop": self.loop,
            "opacity": self.opacity,
            "show_grid": self.show_grid,
            "src_points": self.src_points,
            "dst_points": self.dst_points,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "Surface":
        return cls(
            id=data["id"],
            name=data.get("name", data["id"]),
            enabled=data.get("enabled", True),
            source=data.get("source", ""),
            loop=data.get("loop", True),
            opacity=data.get("opacity", 1.0),
            show_grid=data.get("show_grid", False),
            src_points=data.get("src_points", [[0, 0], [1920, 0], [1920, 1080], [0, 1080]]),
            dst_points=data.get("dst_points", [[0, 0], [1920, 0], [1920, 1080], [0, 1080]]),
        )


@dataclass
class Motion:
    """A recorded motion path that plays back as a glowing trail animation."""
    id: str
    name: str
    # Points: list of [x, y, t] — x,y in projector-space pixels, t in seconds from start
    points: list[list[float]] = field(default_factory=list)
    color: list[int] = field(default_factory=lambda: [0, 255, 136])  # BGR
    trail_length: float = 0.5  # seconds of trail to show
    dot_size: int = 12
    enabled: bool = True
    duration: float = 0.0  # auto-calculated from points

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "points": self.points,
            "color": self.color,
            "trail_length": self.trail_length,
            "dot_size": self.dot_size,
            "enabled": self.enabled,
            "duration": self.duration,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "Motion":
        return cls(
            id=data["id"],
            name=data.get("name", data["id"]),
            points=data.get("points", []),
            color=data.get("color", [0, 255, 136]),
            trail_length=data.get("trail_length", 0.5),
            dot_size=data.get("dot_size", 12),
            enabled=data.get("enabled", True),
            duration=data.get("duration", 0.0),
        )


@dataclass
class ProjectConfig:
    """Top-level projection configuration."""
    resolution: tuple[int, int] = (1920, 1080)
    fullscreen: bool = True
    surfaces: list[Surface] = field(default_factory=list)
    motions: list[Motion] = field(default_factory=list)
    playlist_enabled: bool = False
    playlist_interval: int = 30
    playlist_items: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "version": 1,
            "output": {
                "resolution": list(self.resolution),
                "fullscreen": self.fullscreen,
            },
            "surfaces": [s.to_dict() for s in self.surfaces],
            "motions": [m.to_dict() for m in self.motions],
            "playlist": {
                "enabled": self.playlist_enabled,
                "interval_seconds": self.playlist_interval,
                "items": self.playlist_items,
            },
        }

    @classmethod
    def from_dict(cls, data: dict) -> "ProjectConfig":
        output = data.get("output", {})
        playlist = data.get("playlist", {})
        res = output.get("resolution", [1920, 1080])
        return cls(
            resolution=(res[0], res[1]),
            fullscreen=output.get("fullscreen", True),
            surfaces=[Surface.from_dict(s) for s in data.get("surfaces", [])],
            motions=[Motion.from_dict(m) for m in data.get("motions", [])],
            playlist_enabled=playlist.get("enabled", False),
            playlist_interval=playlist.get("interval_seconds", 30),
            playlist_items=playlist.get("items", []),
        )

    def save(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(self.to_dict(), indent=2, ensure_ascii=False))
        logger.info("Config saved to %s", path)

    @classmethod
    def load(cls, path: Path) -> "ProjectConfig":
        if path.exists():
            data = json.loads(path.read_text())
            logger.info("Config loaded from %s", path)
            return cls.from_dict(data)
        logger.info("No config at %s, using defaults", path)
        return cls()
