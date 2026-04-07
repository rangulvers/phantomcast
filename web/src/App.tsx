import { useEffect, useState, useRef, useCallback } from 'react';
import { api, Surface, Motion, SourceFile, Status } from './api';
import './styles.css';

export function App() {
  const [status, setStatus] = useState<Status | null>(null);
  const [surfaces, setSurfaces] = useState<Surface[]>([]);
  const [sources, setSources] = useState<SourceFile[]>([]);
  const [motions, setMotions] = useState<Motion[]>([]);
  const [activeSurface, setActiveSurface] = useState<string | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);

  // Motion recording state
  const [recording, setRecording] = useState(false);
  const recordingRef = useRef(false);
  const recordPointsRef = useRef<number[][]>([]);
  const recordStartRef = useRef<number>(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const dragPointsRef = useRef<number[][] | null>(null);

  // Load initial data
  useEffect(() => {
    api.status().then(setStatus).catch(() => {});
    api.surfaces.list().then(s => {
      setSurfaces(s);
      if (s.length > 0) setActiveSurface(s[0].id);
    });
    api.sources.list().then(setSources);
    api.motions.list().then(setMotions).catch(() => {});
  }, []);

  // Poll status
  useEffect(() => {
    const interval = setInterval(() => {
      api.status().then(setStatus).catch(() => {});
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const surface = surfaces.find(s => s.id === activeSurface);

  // Draw control points on canvas overlay
  const drawOverlay = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !surface) return;

    canvas.width = img.clientWidth;
    canvas.height = img.clientHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const scaleX = canvas.width / (status?.resolution[0] ?? 1920);
    const scaleY = canvas.height / (status?.resolution[1] ?? 1080);
    const pts = surface.dst_points.map(([x, y]) => [x * scaleX, y * scaleY]);

    // Quad fill (subtle)
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.fillStyle = 'rgba(0, 230, 118, 0.04)';
    ctx.fill();

    // Quad outline
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.strokeStyle = '#00e676';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Diagonals
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    ctx.lineTo(pts[2][0], pts[2][1]);
    ctx.moveTo(pts[1][0], pts[1][1]);
    ctx.lineTo(pts[3][0], pts[3][1]);
    ctx.strokeStyle = 'rgba(0, 230, 118, 0.15)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Control points
    const labels = ['TL', 'TR', 'BR', 'BL'];
    pts.forEach(([x, y], i) => {
      // Outer ring
      ctx.beginPath();
      ctx.arc(x, y, 12, 0, Math.PI * 2);
      ctx.fillStyle = dragging === i ? 'rgba(255, 68, 102, 0.3)' : 'rgba(0, 230, 118, 0.2)';
      ctx.fill();

      // Inner dot
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.fillStyle = dragging === i ? '#ff4466' : '#00e676';
      ctx.fill();

      // Label
      ctx.fillStyle = '#000';
      ctx.font = 'bold 8px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(labels[i], x, y);
    });
  }, [surface, dragging, status]);

  useEffect(() => { drawOverlay(); }, [drawOverlay]);

  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    const observer = new ResizeObserver(() => drawOverlay());
    observer.observe(img);
    return () => observer.disconnect();
  }, [drawOverlay]);

  // Pointer handlers
  const getPointIndex = (clientX: number, clientY: number): number | null => {
    const canvas = canvasRef.current;
    if (!canvas || !surface || !status) return null;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const scaleX = canvas.width / status.resolution[0];
    const scaleY = canvas.height / status.resolution[1];
    for (let i = 0; i < surface.dst_points.length; i++) {
      const px = surface.dst_points[i][0] * scaleX;
      const py = surface.dst_points[i][1] * scaleY;
      if (Math.hypot(x - px, y - py) < 20) return i;
    }
    return null;
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (recordingRef.current) {
      e.currentTarget.setPointerCapture(e.pointerId);
      const canvas = canvasRef.current;
      if (!canvas || !status) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = status.resolution[0] / canvas.clientWidth;
      const scaleY = status.resolution[1] / canvas.clientHeight;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;
      recordStartRef.current = performance.now();
      recordPointsRef.current = [[Math.round(x), Math.round(y), 0]];
      return;
    }
    const idx = getPointIndex(e.clientX, e.clientY);
    if (idx !== null) {
      setDragging(idx);
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (recordingRef.current && recordPointsRef.current.length > 0) {
      const canvas = canvasRef.current;
      if (!canvas || !status) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = status.resolution[0] / canvas.clientWidth;
      const scaleY = status.resolution[1] / canvas.clientHeight;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;
      const t = (performance.now() - recordStartRef.current) / 1000;
      const last = recordPointsRef.current[recordPointsRef.current.length - 1];
      if (t - last[2] >= 0.033) {
        recordPointsRef.current.push([Math.round(x), Math.round(y), parseFloat(t.toFixed(3))]);
      }
      return;
    }
    if (dragging === null || !surface || !status) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const scaleX = status.resolution[0] / canvas.width;
    const scaleY = status.resolution[1] / canvas.height;
    const newPoints = surface.dst_points.map((p, i) =>
      i === dragging ? [Math.round(x * scaleX), Math.round(y * scaleY)] : [...p]
    );
    dragPointsRef.current = newPoints;
    setSurfaces(prev => prev.map(s =>
      s.id === surface.id ? { ...s, dst_points: newPoints } : s
    ));
  };

  const handlePointerUp = async () => {
    if (recordingRef.current && recordPointsRef.current.length > 1) {
      const pts = recordPointsRef.current;
      const name = `Motion ${motions.length + 1}`;
      const created = await api.motions.create({ name, points: pts });
      setMotions(prev => [...prev, created]);
      recordPointsRef.current = [];
      recordingRef.current = false;
      setRecording(false);
      return;
    }
    if (dragging !== null && surface && dragPointsRef.current) {
      api.surfaces.update(surface.id, { dst_points: dragPointsRef.current });
    }
    dragPointsRef.current = null;
    setDragging(null);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await api.sources.upload(file);
    const updated = await api.sources.list();
    setSources(updated);
  };

  const handleCreateSurface = async () => {
    const name = `Surface ${surfaces.length + 1}`;
    const source = sources.length > 0 ? sources[0].filename : '';
    const created = await api.surfaces.create(name, source);
    setSurfaces(prev => [...prev, created]);
    setActiveSurface(created.id);
  };

  const statusLabel = status?.playing ? 'Playing' : status?.running ? 'Ready' : 'Offline';
  const statusClass = status?.playing ? 'playing' : status?.running ? 'ready' : 'offline';

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-brand">
          <span className="header-logo">PhantomCast</span>
          <span className="header-sub">Projection Mapping</span>
        </div>
        <div className="header-status">
          <span className={`status-dot ${statusClass}`} />
          <span>{statusLabel}</span>
          {status?.resolution && (
            <span style={{ color: 'var(--text-muted)', marginLeft: 8, fontSize: 11, fontFamily: 'monospace' }}>
              {status.resolution[0]}x{status.resolution[1]}
            </span>
          )}
        </div>
      </header>

      {/* Sidebar */}
      <aside className="sidebar">
        {/* Playback */}
        <div className="sidebar-section">
          <h3>Playback</h3>
          <div className="btn-group" style={{ marginBottom: 8 }}>
            <button className="btn" onClick={() => api.playback.start()}>Play</button>
            <button className="btn" onClick={() => api.playback.pause()}>Pause</button>
            <button className="btn" onClick={() => api.playback.stop()}>Stop</button>
            <button className="btn" onClick={() => api.playback.sync()}>Sync</button>
          </div>
          {status?.current_source && (
            <div style={{ fontSize: 10, color: 'var(--text-muted)', padding: '4px 0' }}>
              {status.current_source}
            </div>
          )}
        </div>

        {/* Surfaces */}
        <div className="sidebar-section">
          <h3>Surfaces</h3>
          {surfaces.map(s => (
            <div key={s.id} className="surface-item">
              <button
                className={`btn ${activeSurface === s.id ? 'btn-active' : ''}`}
                onClick={() => setActiveSurface(s.id)}
              >
                <span style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: s.enabled ? 'var(--accent)' : 'var(--text-muted)',
                  flexShrink: 0,
                }} />
                {s.name}
              </button>
              <button
                className="btn btn-icon btn-danger"
                onClick={async () => {
                  await api.surfaces.delete(s.id);
                  setSurfaces(prev => prev.filter(sf => sf.id !== s.id));
                  if (activeSurface === s.id) {
                    setActiveSurface(surfaces.find(sf => sf.id !== s.id)?.id ?? null);
                  }
                }}
                title="Delete"
              >
                ×
              </button>
            </div>
          ))}
          <button className="btn btn-full" onClick={handleCreateSurface} style={{ marginTop: 6 }}>
            + New Surface
          </button>
        </div>

        {/* Content */}
        <div className="sidebar-section">
          <h3>Content</h3>
          <div className="content-grid">
            {sources.map(s => (
              <div key={s.filename} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <button
                  className={`btn content-item ${surface?.source === s.filename ? 'btn-active' : ''}`}
                  style={{ flex: 1, justifyContent: 'flex-start' }}
                  onClick={() => {
                    if (surface) {
                      api.surfaces.update(surface.id, { source: s.filename });
                      setSurfaces(prev => prev.map(sf =>
                        sf.id === surface.id ? { ...sf, source: s.filename } : sf
                      ));
                    }
                    api.playback.start(s.filename);
                  }}
                >
                  {s.filename}
                  <span className="file-size">
                    {(s.size_bytes / 1024 / 1024).toFixed(1)}M
                  </span>
                </button>
                <button
                  className="btn btn-icon btn-danger"
                  onClick={async () => {
                    await api.sources.delete(s.filename);
                    setSources(prev => prev.filter(sf => sf.filename !== s.filename));
                  }}
                  title="Delete"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <label className="btn upload-label" style={{ marginTop: 8 }}>
            + Upload
            <input type="file" accept="video/*,image/*" onChange={handleUpload} />
          </label>
        </div>

        {/* Motions */}
        <div className="sidebar-section">
          <h3>Animations</h3>
          <button
            className={`btn btn-full ${recording ? 'btn-record active' : 'btn-record'}`}
            onClick={() => {
              const next = !recording;
              setRecording(next);
              recordingRef.current = next;
              if (next) recordPointsRef.current = [];
            }}
          >
            {recording ? 'Recording...' : 'Record'}
          </button>
          {motions.length > 0 && (
            <div className="motion-list" style={{ marginTop: 8 }}>
              {motions.map(m => (
                <div key={m.id} className="motion-item">
                  <button
                    className={`btn ${m.enabled ? 'btn-active' : ''}`}
                    style={{ flex: 1, justifyContent: 'flex-start', fontSize: 11 }}
                    onClick={async () => {
                      const toggled = !m.enabled;
                      await api.motions.update(m.id, { enabled: toggled });
                      setMotions(prev => prev.map(mo =>
                        mo.id === m.id ? { ...mo, enabled: toggled } : mo
                      ));
                    }}
                  >
                    {m.name}
                    <span className="motion-meta">{m.duration.toFixed(1)}s</span>
                  </button>
                  <button
                    className="btn btn-icon btn-danger"
                    onClick={async () => {
                      await api.motions.delete(m.id);
                      setMotions(prev => prev.filter(mo => mo.id !== m.id));
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
            <button className="btn" style={{ flex: 1, fontSize: 11 }}
              onClick={() => window.open('/api/motions/export/all', '_blank')}
            >
              Export
            </button>
            <label className="btn upload-label" style={{ flex: 1, fontSize: 11, justifyContent: 'center' }}>
              Import
              <input type="file" accept=".json" onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const form = new FormData();
                form.append('file', file);
                const res = await fetch('/api/motions/import', { method: 'POST', body: form });
                if (res.ok) {
                  const data = await res.json();
                  setMotions(prev => [...prev, ...data.motions]);
                }
                e.target.value = '';
              }} />
            </label>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main">
        {/* Preview */}
        <div className="preview-container">
          <img
            ref={imgRef}
            src="/api/preview.mjpeg"
            alt="Preview"
            onLoad={drawOverlay}
          />
          <canvas
            ref={canvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            style={{ cursor: recording ? 'cell' : dragging !== null ? 'grabbing' : 'crosshair' }}
          />
          <div className="preview-badge">LIVE</div>
          {recording && <div className="preview-recording-badge">REC</div>}
        </div>

        {/* Surface Details */}
        {surface && (
          <div className="card">
            <div className="card-title">
              <span className="card-title-icon">◆</span>
              {surface.name} — Calibration
            </div>

            {/* Coordinates */}
            <div className="coord-grid">
              {['Top Left', 'Top Right', 'Bottom Right', 'Bottom Left'].map((label, i) => (
                <div key={i} className="coord-cell">
                  <div className="coord-label">{label}</div>
                  {['X', 'Y'].map((axis, ai) => (
                    <div key={axis} className="coord-input-row">
                      <span>{axis}</span>
                      <input
                        type="number"
                        value={surface.dst_points[i]?.[ai] ?? 0}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          const newPoints = surface.dst_points.map((p, pi) =>
                            pi === i ? (ai === 0 ? [val, p[1]] : [p[0], val]) : [...p]
                          );
                          setSurfaces(prev => prev.map(s =>
                            s.id === surface.id ? { ...s, dst_points: newPoints } : s
                          ));
                          api.surfaces.update(surface.id, { dst_points: newPoints });
                        }}
                      />
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="actions-bar" style={{ marginTop: 14 }}>
              <button
                className={`btn ${surface.show_grid ? 'btn-active' : ''}`}
                onClick={() => {
                  const toggled = !surface.show_grid;
                  api.surfaces.update(surface.id, { show_grid: toggled });
                  setSurfaces(prev => prev.map(s =>
                    s.id === surface.id ? { ...s, show_grid: toggled } : s
                  ));
                }}
              >
                {surface.show_grid ? 'Hide Grid' : 'Show Grid'}
              </button>
              <button
                className="btn"
                onClick={() => {
                  const reset = [[0, 0], [1920, 0], [1920, 1080], [0, 1080]];
                  api.surfaces.update(surface.id, { dst_points: reset });
                  setSurfaces(prev => prev.map(s =>
                    s.id === surface.id ? { ...s, dst_points: reset } : s
                  ));
                }}
              >
                Reset Calibration
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
