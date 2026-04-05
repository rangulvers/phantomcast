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


class SurfaceUpdate(BaseModel):
    name: str | None = None
    source: str | None = None
    enabled: bool | None = None
    loop: bool | None = None
    opacity: float | None = None
    show_grid: bool | None = None
    dst_points: list[list[float]] | None = None


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
    if body.dst_points is not None:
        surface.dst_points = body.dst_points
        renderer.update_surface(surface_id, body.dst_points)

    _save_config(request)
    return surface.to_dict()


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
