"""Quad warp engine using OpenCV homography transforms."""

import json
import logging
import math
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import cv2
import numpy as np

logger = logging.getLogger(__name__)


@dataclass
class Surface:
    """A projection surface with configurable warp type."""
    id: str
    name: str
    surface_type: str = "quad"  # quad, triangle, bezier, mesh
    enabled: bool = True
    source: str = ""
    loop: bool = True
    opacity: float = 1.0
    show_grid: bool = False
    order: int = 0  # layer order (lower = rendered first)
    # Transform
    pos_x: float = 0.0
    pos_y: float = 0.0
    scale: float = 1.0
    rotation: float = 0.0  # degrees
    # Image adjustments
    brightness: float = 0.0
    contrast: float = 0.0
    saturation: float = 0.0
    # Blend mode for compositing
    blend_mode: str = "normal"
    # Effect layer
    effect: str = "none"
    effect_speed: float = 1.0
    # Source rectangle corners (content space)
    src_points: list[list[float]] = field(default_factory=lambda: [
        [0, 0], [1920, 0], [1920, 1080], [0, 1080]
    ])
    # Destination quad corners (projector space, user-adjustable)
    dst_points: list[list[float]] = field(default_factory=lambda: [
        [0, 0], [1920, 0], [1920, 1080], [0, 1080]
    ])
    # Bezier control handles: one per dst_point, [handle_in_x, handle_in_y, handle_out_x, handle_out_y]
    bezier_handles: list[list[float]] | None = None
    # Mesh warp: grid of control points for curved surfaces
    mesh_points: list[list[list[float]]] | None = None
    mesh_size: list[int] = field(default_factory=lambda: [4, 4])
    # Exclusion masks
    masks: list[dict] = field(default_factory=list)
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

    def _apply_transform(self, points: list[list[float]]) -> list[list[float]]:
        """Apply pos/scale/rotation transform to a set of points."""
        if self.pos_x == 0 and self.pos_y == 0 and self.scale == 1.0 and self.rotation == 0:
            return points
        pts = np.array(points, dtype=np.float64)
        center = pts.mean(axis=0)

        # Scale around center
        if self.scale != 1.0:
            pts = center + (pts - center) * self.scale

        # Rotate around center
        if self.rotation != 0:
            angle = math.radians(self.rotation)
            cos_a, sin_a = math.cos(angle), math.sin(angle)
            centered = pts - center
            rotated = np.column_stack([
                centered[:, 0] * cos_a - centered[:, 1] * sin_a,
                centered[:, 0] * sin_a + centered[:, 1] * cos_a
            ])
            pts = rotated + center

        # Translate
        pts[:, 0] += self.pos_x
        pts[:, 1] += self.pos_y

        return pts.tolist()

    def _get_transformed_dst(self) -> list[list[float]]:
        """Get dst_points with pos/scale/rotation transform applied."""
        return self._apply_transform(self.dst_points)

    def warp_frame(self, frame: np.ndarray, output_size: tuple[int, int]) -> np.ndarray:
        """Apply warp based on surface_type."""
        if self.surface_type == "mesh" and self.mesh_points is not None:
            return self._mesh_warp(frame, output_size)
        if self.surface_type == "bezier" and self.bezier_handles is not None:
            return self._bezier_warp(frame, output_size)
        if self.surface_type == "triangle":
            return self._triangle_warp(frame, output_size)
        # Default: quad homography (with transform applied)
        transformed = self._get_transformed_dst()
        src = np.array(self.src_points, dtype=np.float32)
        dst = np.array(transformed, dtype=np.float32)
        H, _ = cv2.findHomography(src, dst)
        if H is None:
            return np.zeros((output_size[1], output_size[0], 3), dtype=np.uint8)
        return cv2.warpPerspective(frame, H, output_size, flags=cv2.INTER_NEAREST)

    def _triangle_warp(self, frame: np.ndarray, output_size: tuple[int, int]) -> np.ndarray:
        """Warp using affine transform for 3-point (triangle) surfaces."""
        src_pts = np.array(self.src_points[:3], dtype=np.float32)
        dst_pts = np.array(self._apply_transform(self.dst_points[:3]), dtype=np.float32)
        M = cv2.getAffineTransform(src_pts, dst_pts)
        warped = cv2.warpAffine(frame, M, output_size, flags=cv2.INTER_NEAREST)
        # Mask to triangle
        mask = np.zeros((output_size[1], output_size[0]), dtype=np.uint8)
        cv2.fillConvexPoly(mask, dst_pts.astype(np.int32), 255)
        out = np.zeros((output_size[1], output_size[0], 3), dtype=np.uint8)
        cv2.copyTo(warped, mask, out)
        return out

    def _bezier_warp(self, frame: np.ndarray, output_size: tuple[int, int]) -> np.ndarray:
        """Warp with bezier-interpolated edges by subdividing into a mesh."""
        # Generate mesh from bezier curves by sampling edge points
        dst = self.dst_points
        handles = self.bezier_handles
        if not handles or len(handles) != len(dst):
            # Fallback to quad
            H = self.compute_homography()
            return cv2.warpPerspective(frame, H, output_size, flags=cv2.INTER_NEAREST)

        # Sample bezier edges into a grid
        n_samples = 8  # points per edge
        edges = []
        for i in range(len(dst)):
            j = (i + 1) % len(dst)
            p0 = np.array(dst[i])
            p3 = np.array(dst[j])
            # Handle out from p0, handle in to p3
            h = handles[i]
            p1 = p0 + np.array([h[2], h[3]])  # handle_out
            h2 = handles[j]
            p2 = p3 + np.array([h2[0], h2[1]])  # handle_in
            # Cubic bezier sampling
            edge_pts = []
            for t_idx in range(n_samples + 1):
                t = t_idx / n_samples
                pt = (1-t)**3 * p0 + 3*(1-t)**2*t * p1 + 3*(1-t)*t**2 * p2 + t**3 * p3
                edge_pts.append(pt.tolist())
            edges.append(edge_pts)

        # Build mesh from the 4 bezier edges (top, right, bottom, left)
        fh, fw = frame.shape[:2]
        out = np.zeros((output_size[1], output_size[0], 3), dtype=np.uint8)

        rows = n_samples + 1
        cols = n_samples + 1
        mesh = []
        top = edges[0] if len(edges) > 0 else []
        right = edges[1] if len(edges) > 1 else []
        bottom = list(reversed(edges[2])) if len(edges) > 2 else []
        left = list(reversed(edges[3])) if len(edges) > 3 else []

        for r in range(rows):
            row = []
            v = r / (rows - 1)
            for c in range(cols):
                u = c / (cols - 1)
                # Bilinear interpolation from 4 edges
                top_pt = np.array(top[c]) if c < len(top) else np.array(top[-1])
                bot_pt = np.array(bottom[c]) if c < len(bottom) else np.array(bottom[-1])
                left_pt = np.array(left[r]) if r < len(left) else np.array(left[-1])
                right_pt = np.array(right[r]) if r < len(right) else np.array(right[-1])

                pt = (1-v) * top_pt + v * bot_pt + (1-u) * left_pt + u * right_pt \
                     - ((1-u)*(1-v)*np.array(dst[0]) + u*(1-v)*np.array(dst[1]) + u*v*np.array(dst[2]) + (1-u)*v*np.array(dst[3]))
                row.append(pt.tolist())
            mesh.append(row)

        # Warp each cell
        for r in range(rows - 1):
            for c in range(cols - 1):
                sx1 = int(c * fw / (cols - 1))
                sy1 = int(r * fh / (rows - 1))
                sx2 = int((c + 1) * fw / (cols - 1))
                sy2 = int((r + 1) * fh / (rows - 1))

                src_quad = np.array([[sx1, sy1], [sx2, sy1], [sx2, sy2], [sx1, sy2]], dtype=np.float32)
                dst_quad = np.array([mesh[r][c], mesh[r][c+1], mesh[r+1][c+1], mesh[r+1][c]], dtype=np.float32)

                H, _ = cv2.findHomography(src_quad, dst_quad)
                if H is None:
                    continue
                warped = cv2.warpPerspective(frame, H, output_size, flags=cv2.INTER_NEAREST)
                cell_mask = np.zeros((output_size[1], output_size[0]), dtype=np.uint8)
                cv2.fillConvexPoly(cell_mask, dst_quad.astype(np.int32), 255)
                cv2.copyTo(warped, cell_mask, out)

        return out

    def _mesh_warp(self, frame: np.ndarray, output_size: tuple[int, int]) -> np.ndarray:
        """Apply mesh (piecewise) warp using a grid of control points."""
        rows, cols = self.mesh_size
        mesh = self.mesh_points
        if not mesh or len(mesh) < 2 or len(mesh[0]) < 2:
            H = self.compute_homography()
            return cv2.warpPerspective(frame, H, output_size, flags=cv2.INTER_NEAREST)

        h, w = frame.shape[:2]
        out = np.zeros((output_size[1], output_size[0], 3), dtype=np.uint8)

        # For each quad cell in the mesh, warp that portion
        for r in range(len(mesh) - 1):
            for c in range(len(mesh[0]) - 1):
                # Source quad (regular grid in content space)
                sx1 = int(c * w / (len(mesh[0]) - 1))
                sy1 = int(r * h / (len(mesh) - 1))
                sx2 = int((c + 1) * w / (len(mesh[0]) - 1))
                sy2 = int((r + 1) * h / (len(mesh) - 1))

                src_quad = np.array([
                    [sx1, sy1], [sx2, sy1], [sx2, sy2], [sx1, sy2]
                ], dtype=np.float32)

                dst_quad = np.array([
                    mesh[r][c], mesh[r][c + 1],
                    mesh[r + 1][c + 1], mesh[r + 1][c]
                ], dtype=np.float32)

                H, _ = cv2.findHomography(src_quad, dst_quad)
                if H is None:
                    continue
                warped = cv2.warpPerspective(frame, H, output_size, flags=cv2.INTER_NEAREST)
                # Mask to only this cell
                cell_mask = np.zeros((output_size[1], output_size[0]), dtype=np.uint8)
                cv2.fillConvexPoly(cell_mask, dst_quad.astype(np.int32), 255)
                cv2.copyTo(warped, cell_mask, out)

        return out

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "surface_type": self.surface_type,
            "enabled": self.enabled,
            "source": self.source,
            "loop": self.loop,
            "opacity": self.opacity,
            "show_grid": self.show_grid,
            "order": self.order,
            "pos_x": self.pos_x,
            "pos_y": self.pos_y,
            "scale": self.scale,
            "rotation": self.rotation,
            "brightness": self.brightness,
            "contrast": self.contrast,
            "saturation": self.saturation,
            "blend_mode": self.blend_mode,
            "effect": self.effect,
            "effect_speed": self.effect_speed,
            "masks": self.masks,
            "bezier_handles": self.bezier_handles,
            "mesh_points": self.mesh_points,
            "mesh_size": self.mesh_size,
            "src_points": self.src_points,
            "dst_points": self.dst_points,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "Surface":
        return cls(
            id=data["id"],
            name=data.get("name", data["id"]),
            surface_type=data.get("surface_type", "quad"),
            enabled=data.get("enabled", True),
            source=data.get("source", ""),
            loop=data.get("loop", True),
            opacity=data.get("opacity", 1.0),
            show_grid=data.get("show_grid", False),
            order=data.get("order", 0),
            pos_x=data.get("pos_x", 0.0),
            pos_y=data.get("pos_y", 0.0),
            scale=data.get("scale", 1.0),
            rotation=data.get("rotation", 0.0),
            brightness=data.get("brightness", 0.0),
            contrast=data.get("contrast", 0.0),
            saturation=data.get("saturation", 0.0),
            blend_mode=data.get("blend_mode", "normal"),
            effect=data.get("effect", "none"),
            effect_speed=data.get("effect_speed", 1.0),
            masks=data.get("masks", []),
            bezier_handles=data.get("bezier_handles"),
            mesh_points=data.get("mesh_points"),
            mesh_size=data.get("mesh_size", [4, 4]),
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
