"""Surface CRUD endpoints for projection mapping calibration."""

import uuid
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from engine.warp import Surface

router = APIRouter(prefix="/surfaces", tags=["surfaces"])


class SurfaceCreate(BaseModel):
    name: str
    source: str = ""
    dst_points: list[list[float]] | None = None


class MaskCreate(BaseModel):
    points: list[list[float]]
    name: str = ""


class SurfaceUpdate(BaseModel):
    name: str | None = None
    surface_type: str | None = None
    source: str | None = None
    enabled: bool | None = None
    loop: bool | None = None
    opacity: float | None = None
    show_grid: bool | None = None
    order: int | None = None
    pos_x: float | None = None
    pos_y: float | None = None
    scale: float | None = None
    rotation: float | None = None
    brightness: float | None = None
    contrast: float | None = None
    saturation: float | None = None
    blend_mode: str | None = None
    effect: str | None = None
    effect_speed: float | None = None
    bezier_handles: list | None = None
    mesh_points: list | None = None
    mesh_size: list[int] | None = None
    dst_points: list[list[float]] | None = None
    masks: list[dict] | None = None


@router.get("")
def list_surfaces(request: Request):
    config = request.app.state.config
    return [s.to_dict() for s in config.surfaces]


@router.post("")
def create_surface(body: SurfaceCreate, request: Request):
    config = request.app.state.config
    surface_id = f"surface_{uuid.uuid4().hex[:8]}"
    surface = Surface(
        id=surface_id,
        name=body.name,
        source=body.source,
        dst_points=body.dst_points or [[0, 0], [1920, 0], [1920, 1080], [0, 1080]],
    )
    config.surfaces.append(surface)
    _save_config(request)
    return surface.to_dict()


@router.get("/{surface_id}")
def get_surface(surface_id: str, request: Request):
    surface = _find_surface(surface_id, request)
    return surface.to_dict()


@router.put("/{surface_id}")
def update_surface(surface_id: str, body: SurfaceUpdate, request: Request):
    surface = _find_surface(surface_id, request)
    renderer = request.app.state.renderer

    if body.name is not None:
        surface.name = body.name
    if body.surface_type is not None:
        surface.surface_type = body.surface_type
    if body.source is not None:
        surface.source = body.source
        renderer.reload_surface_source(surface_id)
    if body.enabled is not None:
        surface.enabled = body.enabled
    if body.loop is not None:
        surface.loop = body.loop
    if body.opacity is not None:
        surface.opacity = body.opacity
    if body.show_grid is not None:
        surface.show_grid = body.show_grid
    if body.order is not None:
        surface.order = body.order
    if body.pos_x is not None:
        surface.pos_x = body.pos_x
    if body.pos_y is not None:
        surface.pos_y = body.pos_y
    if body.scale is not None:
        surface.scale = body.scale
    if body.rotation is not None:
        surface.rotation = body.rotation
    if body.brightness is not None:
        surface.brightness = body.brightness
    if body.contrast is not None:
        surface.contrast = body.contrast
    if body.saturation is not None:
        surface.saturation = body.saturation
    if body.blend_mode is not None:
        surface.blend_mode = body.blend_mode
    if body.effect is not None:
        surface.effect = body.effect
    if body.effect_speed is not None:
        surface.effect_speed = body.effect_speed
    if body.bezier_handles is not None:
        surface.bezier_handles = body.bezier_handles
    if body.mesh_points is not None:
        surface.mesh_points = body.mesh_points
    if body.mesh_size is not None:
        surface.mesh_size = body.mesh_size
    if body.masks is not None:
        surface.masks = body.masks
    if body.dst_points is not None:
        surface.dst_points = body.dst_points
        renderer.update_surface(surface_id, body.dst_points)

    _save_config(request)
    return surface.to_dict()


@router.post("/reorder")
def reorder_surfaces(order: list[str], request: Request):
    """Reorder surfaces by providing a list of surface IDs in desired order."""
    config = request.app.state.config
    lookup = {s.id: s for s in config.surfaces}
    for i, sid in enumerate(order):
        if sid in lookup:
            lookup[sid].order = i
    _save_config(request)
    return [s.to_dict() for s in config.surfaces]


@router.delete("/{surface_id}")
def delete_surface(surface_id: str, request: Request):
    config = request.app.state.config
    config.surfaces = [s for s in config.surfaces if s.id != surface_id]
    _save_config(request)
    return {"deleted": surface_id}


def _find_surface(surface_id: str, request: Request) -> Surface:
    config = request.app.state.config
    for s in config.surfaces:
        if s.id == surface_id:
            return s
    raise HTTPException(status_code=404, detail=f"Surface {surface_id} not found")


def _save_config(request: Request) -> None:
    config = request.app.state.config
    config_path = request.app.state.config_path
    config.save(config_path)
