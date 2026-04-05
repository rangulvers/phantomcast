"""Motion recording CRUD endpoints with spline smoothing."""

import json
import uuid
from fastapi import APIRouter, HTTPException, Request, UploadFile, File
from fastapi.responses import JSONResponse
from pydantic import BaseModel

import numpy as np
from scipy.interpolate import CubicSpline

from engine.warp import Motion

router = APIRouter(prefix="/motions", tags=["motions"])


def smooth_points(points: list[list[float]], factor: int = 3) -> list[list[float]]:
    """Smooth a recorded path using cubic spline interpolation.

    Takes raw hand-drawn points and produces a smooth curve with `factor`x more points.
    Preserves original timing feel.
    """
    if len(points) < 4:
        return points

    pts = np.array(points)
    t_raw = pts[:, 2]
    x_raw = pts[:, 0]
    y_raw = pts[:, 1]

    # Fit cubic splines for x(t) and y(t)
    cs_x = CubicSpline(t_raw, x_raw)
    cs_y = CubicSpline(t_raw, y_raw)

    # Generate smooth timestamps (factor x more points)
    t_smooth = np.linspace(t_raw[0], t_raw[-1], len(points) * factor)

    x_smooth = cs_x(t_smooth)
    y_smooth = cs_y(t_smooth)

    return [
        [round(float(x), 1), round(float(y), 1), round(float(t), 4)]
        for x, y, t in zip(x_smooth, y_smooth, t_smooth)
    ]


class MotionCreate(BaseModel):
    name: str
    points: list[list[float]]
    color: list[int] = [0, 255, 136]
    trail_length: float = 0.5
    dot_size: int = 12
    smooth: bool = True


class MotionUpdate(BaseModel):
    name: str | None = None
    enabled: bool | None = None
    color: list[int] | None = None
    trail_length: float | None = None
    dot_size: int | None = None


@router.get("")
def list_motions(request: Request):
    config = request.app.state.config
    return [m.to_dict() for m in config.motions]


@router.post("")
def create_motion(body: MotionCreate, request: Request):
    config = request.app.state.config
    motion_id = f"motion_{uuid.uuid4().hex[:8]}"

    points = body.points
    if body.smooth and len(points) >= 4:
        points = smooth_points(points)

    duration = points[-1][2] if points else 0.0

    motion = Motion(
        id=motion_id,
        name=body.name,
        points=points,
        color=body.color,
        trail_length=body.trail_length,
        dot_size=body.dot_size,
        duration=duration,
    )
    config.motions.append(motion)
    _save_config(request)
    return motion.to_dict()


@router.put("/{motion_id}")
def update_motion(motion_id: str, body: MotionUpdate, request: Request):
    motion = _find_motion(motion_id, request)
    if body.name is not None:
        motion.name = body.name
    if body.enabled is not None:
        motion.enabled = body.enabled
    if body.color is not None:
        motion.color = body.color
    if body.trail_length is not None:
        motion.trail_length = body.trail_length
    if body.dot_size is not None:
        motion.dot_size = body.dot_size
    _save_config(request)
    return motion.to_dict()


@router.delete("/{motion_id}")
def delete_motion(motion_id: str, request: Request):
    config = request.app.state.config
    config.motions = [m for m in config.motions if m.id != motion_id]
    _save_config(request)
    return {"deleted": motion_id}


@router.get("/{motion_id}/export")
def export_motion(motion_id: str, request: Request):
    """Export a single motion as a downloadable JSON file."""
    motion = _find_motion(motion_id, request)
    return JSONResponse(
        content=motion.to_dict(),
        headers={"Content-Disposition": f'attachment; filename="{motion.name}.json"'},
    )


@router.get("/export/all")
def export_all_motions(request: Request):
    """Export all motions as a downloadable JSON file."""
    config = request.app.state.config
    data = [m.to_dict() for m in config.motions]
    return JSONResponse(
        content=data,
        headers={"Content-Disposition": 'attachment; filename="motions.json"'},
    )


@router.post("/import")
async def import_motions(request: Request, file: UploadFile = File(...)):
    """Import motions from a JSON file."""
    config = request.app.state.config
    content = await file.read()
    data = json.loads(content)

    # Handle both single motion and array of motions
    items = data if isinstance(data, list) else [data]
    imported = []
    for item in items:
        # Assign new ID to avoid conflicts
        item["id"] = f"motion_{uuid.uuid4().hex[:8]}"
        motion = Motion.from_dict(item)
        config.motions.append(motion)
        imported.append(motion.to_dict())

    _save_config(request)
    return {"imported": len(imported), "motions": imported}


def _find_motion(motion_id: str, request: Request) -> Motion:
    config = request.app.state.config
    for m in config.motions:
        if m.id == motion_id:
            return m
    raise HTTPException(status_code=404, detail=f"Motion {motion_id} not found")


def _save_config(request: Request) -> None:
    config = request.app.state.config
    config_path = request.app.state.config_path
    config.save(config_path)
