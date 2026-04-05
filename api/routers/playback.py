"""Playback control endpoints."""

from fastapi import APIRouter, Request
from pydantic import BaseModel

from engine.renderer import Renderer

router = APIRouter(prefix="/playback", tags=["playback"])


class PlayRequest(BaseModel):
    source: str | None = None


@router.post("/start")
def start_playback(body: PlayRequest, request: Request):
    renderer: Renderer = request.app.state.renderer
    success = renderer.play(body.source)
    return {"playing": success, "source": body.source}


@router.post("/stop")
def stop_playback(request: Request):
    renderer: Renderer = request.app.state.renderer
    renderer.stop_playback()
    return {"playing": False}


@router.post("/pause")
def pause_playback(request: Request):
    renderer: Renderer = request.app.state.renderer
    renderer.pause()
    return {"paused": True}


@router.post("/resume")
def resume_playback(request: Request):
    renderer: Renderer = request.app.state.renderer
    renderer.paused = False
    renderer.playing = True
    return {"playing": True, "paused": False}


@router.post("/sync")
def sync_playback(request: Request):
    renderer: Renderer = request.app.state.renderer
    renderer.sync_all()
    return {"synced": True}
