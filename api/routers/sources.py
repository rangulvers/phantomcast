"""Content file management endpoints."""

import shutil
from pathlib import Path

import cv2
from fastapi import APIRouter, HTTPException, Request, UploadFile, File
from fastapi.responses import Response

router = APIRouter(prefix="/sources", tags=["sources"])

ALLOWED_EXTENSIONS = {".mp4", ".webm", ".mkv", ".avi", ".mov", ".gif", ".png", ".jpg", ".jpeg"}


VIDEO_EXTS = {".mp4", ".webm", ".mkv", ".avi", ".mov"}


def _get_video_metadata(path: Path) -> dict:
    """Extract video metadata using OpenCV."""
    try:
        cap = cv2.VideoCapture(str(path))
        if not cap.isOpened():
            return {}
        w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        fps = round(cap.get(cv2.CAP_PROP_FPS), 2)
        frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        duration = round(frames / fps, 1) if fps > 0 else 0
        fourcc_int = int(cap.get(cv2.CAP_PROP_FOURCC))
        codec = "".join(chr((fourcc_int >> 8 * i) & 0xFF) for i in range(4)) if fourcc_int else "unknown"
        cap.release()
        return {
            "width": w,
            "height": h,
            "fps": fps,
            "duration": duration,
            "frames": frames,
            "codec": codec.strip('\x00'),
        }
    except Exception:
        return {}


@router.get("")
def list_sources(request: Request):
    content_dir: Path = request.app.state.content_dir
    files = []
    for f in sorted(content_dir.iterdir()):
        if f.is_file() and f.suffix.lower() in ALLOWED_EXTENSIONS:
            is_video = f.suffix.lower() in VIDEO_EXTS
            entry = {
                "filename": f.name,
                "size_bytes": f.stat().st_size,
                "type": "video" if is_video else "image",
            }
            if is_video:
                entry.update(_get_video_metadata(f))
            files.append(entry)
    return files


@router.post("/upload")
async def upload_source(request: Request, file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {ext}")

    content_dir: Path = request.app.state.content_dir
    dest = content_dir / file.filename

    with open(dest, "wb") as f:
        shutil.copyfileobj(file.file, f)

    return {
        "filename": file.filename,
        "size_bytes": dest.stat().st_size,
    }


@router.get("/{filename}/thumbnail")
def get_thumbnail(filename: str, request: Request):
    """Generate a thumbnail from the first frame of a video or from an image."""
    content_dir: Path = request.app.state.content_dir
    path = (content_dir / filename).resolve()

    if not str(path).startswith(str(content_dir.resolve())):
        raise HTTPException(status_code=400, detail="Invalid filename")
    if not path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    ext = path.suffix.lower()
    if ext in {".mp4", ".webm", ".mkv", ".avi", ".mov"}:
        cap = cv2.VideoCapture(str(path))
        ret, frame = cap.read()
        cap.release()
        if not ret:
            raise HTTPException(status_code=500, detail="Could not read video frame")
    elif ext in {".png", ".jpg", ".jpeg", ".gif"}:
        frame = cv2.imread(str(path))
        if frame is None:
            raise HTTPException(status_code=500, detail="Could not read image")
    else:
        raise HTTPException(status_code=400, detail="Unsupported file type")

    # Resize to thumbnail
    thumb_w = 160
    h, w = frame.shape[:2]
    thumb_h = int(h * thumb_w / w)
    thumb = cv2.resize(frame, (thumb_w, thumb_h))
    _, jpg = cv2.imencode('.jpg', thumb, [cv2.IMWRITE_JPEG_QUALITY, 70])
    return Response(content=jpg.tobytes(), media_type="image/jpeg")


@router.delete("/{filename}")
def delete_source(filename: str, request: Request):
    content_dir: Path = request.app.state.content_dir
    path = (content_dir / filename).resolve()

    # Ensure path stays inside content_dir
    if not str(path).startswith(str(content_dir.resolve())):
        raise HTTPException(status_code=400, detail="Invalid filename")

    if not path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    path.unlink()
    return {"deleted": filename}
