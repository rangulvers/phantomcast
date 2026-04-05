"""PhantomCast API — projection mapping control server."""

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from engine.warp import ProjectConfig
from engine.renderer import Renderer
from .routers import surfaces, sources, playback, preview

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent.parent
CONFIG_PATH = BASE_DIR / "config" / "surfaces.json"
CONTENT_DIR = BASE_DIR / "data" / "content"
STATIC_DIR = BASE_DIR / "web" / "dist"


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load config and start renderer on startup."""
    CONTENT_DIR.mkdir(parents=True, exist_ok=True)

    config = ProjectConfig.load(CONFIG_PATH)
    renderer = Renderer(config, CONTENT_DIR)

    # Store on app state for routers
    app.state.config = config
    app.state.config_path = CONFIG_PATH
    app.state.renderer = renderer
    app.state.content_dir = CONTENT_DIR

    # Start rendering engine
    renderer.start()

    # Auto-play if there's content configured
    if config.surfaces and any(s.source for s in config.surfaces):
        renderer.play()

    yield

    renderer.stop()
    config.save(CONFIG_PATH)


app = FastAPI(
    title="PhantomCast API",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(surfaces.router, prefix="/api")
app.include_router(sources.router, prefix="/api")
app.include_router(playback.router, prefix="/api")
app.include_router(preview.router, prefix="/api")


@app.get("/api/status")
def status():
    renderer: Renderer = app.state.renderer
    return {
        "name": "PhantomCast",
        "version": "0.1.0",
        **renderer.get_status(),
    }


# Serve React SPA
if STATIC_DIR.exists():
    app.mount("/assets", StaticFiles(directory=str(STATIC_DIR / "assets")), name="static")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        file_path = (STATIC_DIR / full_path).resolve()
        if file_path.is_file():
            try:
                file_path.relative_to(STATIC_DIR.resolve())
                return FileResponse(str(file_path))
            except ValueError:
                pass
        return FileResponse(str(STATIC_DIR / "index.html"))
