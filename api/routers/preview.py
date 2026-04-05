"""MJPEG preview stream endpoint."""

import asyncio

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

from engine.renderer import Renderer

router = APIRouter(tags=["preview"])


@router.get("/preview.mjpeg")
async def mjpeg_preview(request: Request):
    """Stream the current projection output as MJPEG for the calibration UI."""
    renderer: Renderer = request.app.state.renderer

    async def generate():
        while True:
            jpg = renderer.get_preview_jpeg(quality=65)
            if jpg:
                yield (
                    b"--frame\r\n"
                    b"Content-Type: image/jpeg\r\n"
                    b"Content-Length: " + str(len(jpg)).encode() + b"\r\n"
                    b"\r\n" + jpg + b"\r\n"
                )
            await asyncio.sleep(0.1)  # ~10 fps preview

    return StreamingResponse(
        generate(),
        media_type="multipart/x-mixed-replace; boundary=frame",
    )
