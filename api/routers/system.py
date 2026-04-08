"""System health, project management, and configuration endpoints."""

import json
import os
import platform
import shutil
import time
from datetime import datetime
from pathlib import Path

import psutil
from fastapi import APIRouter, Request
from fastapi.responses import Response

from engine.warp import ProjectConfig

router = APIRouter(prefix="/system", tags=["system"])

_start_time = time.time()
_event_log: list[dict] = []


def log_event(level: str, source: str, message: str) -> None:
    """Add an event to the system log (kept in memory, last 200)."""
    _event_log.append({
        "ts": datetime.now().isoformat(timespec="seconds"),
        "level": level,
        "source": source,
        "message": message,
    })
    if len(_event_log) > 200:
        _event_log.pop(0)


# Log startup
log_event("INFO", "SYSTEM", "PhantomCast engine initialized")


@router.get("/health")
def system_health():
    """Real-time system health: CPU, temp, RAM, disk."""
    cpu_percent = psutil.cpu_percent(interval=0.1)
    mem = psutil.virtual_memory()
    disk = shutil.disk_usage("/")

    # CPU temperature (Raspberry Pi)
    temp = None
    try:
        temps = psutil.sensors_temperatures()
        if "cpu_thermal" in temps:
            temp = temps["cpu_thermal"][0].current
        elif temps:
            first = list(temps.values())[0]
            if first:
                temp = first[0].current
    except Exception:
        pass

    # Fallback: read from sysfs
    if temp is None:
        try:
            with open("/sys/class/thermal/thermal_zone0/temp") as f:
                temp = int(f.read().strip()) / 1000.0
        except Exception:
            pass

    uptime = time.time() - _start_time

    return {
        "cpu_percent": round(cpu_percent, 1),
        "cpu_count": psutil.cpu_count(),
        "temperature": round(temp, 1) if temp else None,
        "ram_total_mb": round(mem.total / 1024 / 1024),
        "ram_used_mb": round(mem.used / 1024 / 1024),
        "ram_percent": mem.percent,
        "disk_total_gb": round(disk.total / 1024 / 1024 / 1024, 1),
        "disk_used_gb": round(disk.used / 1024 / 1024 / 1024, 1),
        "disk_percent": round(disk.used / disk.total * 100, 1),
        "uptime_seconds": round(uptime),
        "platform": platform.machine(),
        "hostname": platform.node(),
    }


@router.get("/events")
def system_events(limit: int = 50):
    """Return recent system events."""
    return _event_log[-limit:]


@router.post("/events")
def add_event(level: str = "INFO", source: str = "USER", message: str = ""):
    log_event(level, source, message)
    return {"ok": True}


@router.get("/projects")
def list_projects(request: Request):
    """List saved project configurations."""
    config_dir = Path(request.app.state.config_path).parent
    projects = []
    for f in sorted(config_dir.glob("*.json")):
        try:
            data = json.loads(f.read_text())
            surfaces = data.get("surfaces", [])
            res = data.get("output", {}).get("resolution", [1920, 1080])
            projects.append({
                "filename": f.name,
                "surfaces": len(surfaces),
                "motions": len(data.get("motions", [])),
                "resolution": res,
                "size_bytes": f.stat().st_size,
                "modified": datetime.fromtimestamp(f.stat().st_mtime).isoformat(timespec="seconds"),
            })
        except Exception:
            continue
    return projects


@router.post("/projects/save")
def save_project(name: str, request: Request):
    """Save current config as a named project."""
    config = request.app.state.config
    config_dir = Path(request.app.state.config_path).parent
    filename = name.replace(" ", "_").lower() + ".json"
    path = config_dir / filename
    config.save(path)
    log_event("INFO", "PROJECT", f"Project saved: {filename}")
    return {"saved": filename}


@router.post("/projects/load")
def load_project(filename: str, request: Request):
    """Load a project configuration."""
    config_dir = Path(request.app.state.config_path).parent
    path = config_dir / filename
    if not path.exists():
        return {"error": "Project not found"}

    new_config = ProjectConfig.load(path)
    # Update app state
    request.app.state.config = new_config
    request.app.state.renderer.config = new_config
    # Restart playback with new config
    renderer = request.app.state.renderer
    renderer.stop_playback()
    renderer.play()
    log_event("INFO", "PROJECT", f"Project loaded: {filename}")
    return {"loaded": filename, "surfaces": len(new_config.surfaces)}


@router.get("/export")
def export_config(request: Request):
    """Export full configuration bundle as JSON."""
    config = request.app.state.config
    return Response(
        content=json.dumps(config.to_dict(), indent=2),
        media_type="application/json",
        headers={"Content-Disposition": 'attachment; filename="phantomcast_config.json"'},
    )
