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
    # Source rectangle corners (content space)
    src_points: list[list[float]] = field(default_factory=lambda: [
        [0, 0], [1920, 0], [1920, 1080], [0, 1080]
    ])
    # Destination quad corners (projector space, user-adjustable)
    dst_points: list[list[float]] = field(default_factory=lambda: [
        [0, 0], [1920, 0], [1920, 1080], [0, 1080]
    ])

    def compute_homography(self) -> np.ndarray:
        """Compute the 3x3 homography matrix from src to dst points."""
        src = np.array(self.src_points, dtype=np.float32)
        dst = np.array(self.dst_points, dtype=np.float32)
        H, _ = cv2.findHomography(src, dst)
        return H

    def warp_frame(self, frame: np.ndarray, output_size: tuple[int, int]) -> np.ndarray:
        """Apply homography warp to a video frame."""
        H = self.compute_homography()
        return cv2.warpPerspective(frame, H, output_size, flags=cv2.INTER_LINEAR)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "enabled": self.enabled,
            "source": self.source,
            "loop": self.loop,
            "opacity": self.opacity,
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
            src_points=data.get("src_points", [[0, 0], [1920, 0], [1920, 1080], [0, 1080]]),
            dst_points=data.get("dst_points", [[0, 0], [1920, 0], [1920, 1080], [0, 1080]]),
        )


@dataclass
class ProjectConfig:
    """Top-level projection configuration."""
    resolution: tuple[int, int] = (1920, 1080)
    fullscreen: bool = True
    surfaces: list[Surface] = field(default_factory=list)
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
