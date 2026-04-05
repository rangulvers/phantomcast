"""Content file management endpoints."""

import shutil
from pathlib import Path

from fastapi import APIRouter, HTTPException, Request, UploadFile, File

router = APIRouter(prefix="/sources", tags=["sources"])

ALLOWED_EXTENSIONS = {".mp4", ".webm", ".mkv", ".avi", ".mov", ".gif", ".png", ".jpg", ".jpeg"}


@router.get("")
def list_sources(request: Request):
    content_dir: Path = request.app.state.content_dir
    files = []
    for f in sorted(content_dir.iterdir()):
        if f.is_file() and f.suffix.lower() in ALLOWED_EXTENSIONS:
            files.append({
                "filename": f.name,
                "size_bytes": f.stat().st_size,
                "type": "video" if f.suffix.lower() in {".mp4", ".webm", ".mkv", ".avi", ".mov"} else "image",
            })
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
