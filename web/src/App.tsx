import { useEffect, useState, useRef, useCallback } from 'react';
import { api, Surface, Motion, SourceFile, Status } from './api';

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

    // Scale factors from projector resolution to preview size
    const scaleX = canvas.width / (status?.resolution[0] ?? 1920);
    const scaleY = canvas.height / (status?.resolution[1] ?? 1080);

    const pts = surface.dst_points.map(([x, y]) => [x * scaleX, y * scaleY]);

    // Draw quad outline
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i][0], pts[i][1]);
    }
    ctx.closePath();
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw diagonals
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    ctx.lineTo(pts[2][0], pts[2][1]);
    ctx.moveTo(pts[1][0], pts[1][1]);
    ctx.lineTo(pts[3][0], pts[3][1]);
    ctx.strokeStyle = 'rgba(0, 255, 136, 0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Draw control points
    const labels = ['TL', 'TR', 'BR', 'BL'];
    pts.forEach(([x, y], i) => {
      ctx.beginPath();
      ctx.arc(x, y, 10, 0, Math.PI * 2);
      ctx.fillStyle = dragging === i ? '#ff4444' : '#00ff88';
      ctx.fill();
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#000';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(labels[i], x, y);
    });
  }, [surface, dragging, status]);

  useEffect(() => {
    drawOverlay();
  }, [drawOverlay]);

  // Redraw on image load
  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    const observer = new ResizeObserver(() => drawOverlay());
    observer.observe(img);
    return () => observer.disconnect();
  }, [drawOverlay]);

  // Mouse/touch handlers for dragging control points
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
      // Start capturing motion path
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
      // Sample at ~30fps to avoid too many points
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
      // Save the recorded motion
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

  // File upload
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await api.sources.upload(file);
    const updated = await api.sources.list();
    setSources(updated);
  };

  // Create new surface
  const handleCreateSurface = async () => {
    const name = `Oberfläche ${surfaces.length + 1}`;
    const source = sources.length > 0 ? sources[0].filename : '';
    const created = await api.surfaces.create(name, source);
    setSurfaces(prev => [...prev, created]);
    setActiveSurface(created.id);
  };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 'bold', color: '#00ff88' }}>👻 PhantomCast</h1>
          <p style={{ fontSize: 12, color: '#888' }}>Projection Mapping Control</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: status?.playing ? '#00ff88' : status?.running ? '#ffaa00' : '#ff4444',
          }} />
          <span style={{ fontSize: 12, color: '#aaa' }}>
            {status?.playing ? 'Playing' : status?.running ? 'Ready' : 'Offline'}
          </span>
        </div>
      </div>

      {/* Preview + Calibration */}
      <div style={{ position: 'relative', marginBottom: 16, background: '#111', borderRadius: 8, overflow: 'hidden' }}>
        <img
          ref={imgRef}
          src="/api/preview.mjpeg"
          alt="Preview"
          style={{ width: '100%', display: 'block' }}
          onLoad={drawOverlay}
        />
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', cursor: recording ? 'cell' : dragging !== null ? 'grabbing' : 'crosshair' }}
        />
      </div>

      {/* Controls */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* Playback */}
        <div style={{ background: '#111', borderRadius: 8, padding: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#ccc' }}>Wiedergabe</h3>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => api.playback.start()} style={btnStyle}>▶ Play</button>
            <button onClick={() => api.playback.pause()} style={btnStyle}>⏸ Pause</button>
            <button onClick={() => api.playback.stop()} style={btnStyle}>⏹ Stop</button>
            <button onClick={() => api.playback.sync()} style={btnStyle}>⟳ Sync</button>
          </div>
          {status?.current_source && (
            <p style={{ fontSize: 11, color: '#888', marginTop: 8 }}>
              Aktuell: {status.current_source}
            </p>
          )}
        </div>

        {/* Surfaces */}
        <div style={{ background: '#111', borderRadius: 8, padding: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#ccc' }}>Oberflächen</h3>
          {surfaces.map(s => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <button
                onClick={() => setActiveSurface(s.id)}
                style={{
                  ...btnStyle,
                  flex: 1,
                  background: activeSurface === s.id ? '#00ff8833' : '#222',
                  borderColor: activeSurface === s.id ? '#00ff88' : '#333',
                }}
              >
                {s.name}
              </button>
              <button
                onClick={async () => {
                  await api.surfaces.delete(s.id);
                  setSurfaces(prev => prev.filter(sf => sf.id !== s.id));
                  if (activeSurface === s.id) {
                    setActiveSurface(surfaces.find(sf => sf.id !== s.id)?.id ?? null);
                  }
                }}
                style={{ ...btnStyle, padding: '8px 10px', color: '#ff4444', borderColor: '#441111' }}
                title="Oberfläche löschen"
              >
                ✕
              </button>
            </div>
          ))}
          <button onClick={handleCreateSurface} style={{ ...btnStyle, width: '100%', marginTop: 8 }}>
            + Neue Oberfläche
          </button>
        </div>
      </div>

      {/* Content & Source Selection */}
      <div style={{ background: '#111', borderRadius: 8, padding: 16, marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#ccc' }}>Content</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {sources.map(s => (
            <button
              key={s.filename}
              onClick={() => {
                if (surface) {
                  api.surfaces.update(surface.id, { source: s.filename });
                  setSurfaces(prev => prev.map(sf =>
                    sf.id === surface.id ? { ...sf, source: s.filename } : sf
                  ));
                }
                api.playback.start(s.filename);
              }}
              style={{
                ...btnStyle,
                background: surface?.source === s.filename ? '#00ff8833' : '#222',
                borderColor: surface?.source === s.filename ? '#00ff88' : '#333',
              }}
            >
              {s.type === 'video' ? '🎬' : '🖼'} {s.filename}
              <span style={{ fontSize: 10, color: '#666', marginLeft: 4 }}>
                ({(s.size_bytes / 1024 / 1024).toFixed(1)}MB)
              </span>
            </button>
          ))}
        </div>
        <label style={{ ...btnStyle, display: 'inline-block', cursor: 'pointer' }}>
          📁 Video hochladen
          <input type="file" accept="video/*,image/*" onChange={handleUpload} style={{ display: 'none' }} />
        </label>
      </div>

      {/* Motions */}
      <div style={{ background: '#111', borderRadius: 8, padding: 16, marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#ccc' }}>Animationen</h3>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <button
            onClick={() => {
              const next = !recording;
              setRecording(next);
              recordingRef.current = next;
              if (next) recordPointsRef.current = [];
            }}
            style={{
              ...btnStyle,
              background: recording ? '#ff444433' : '#222',
              borderColor: recording ? '#ff4444' : '#333',
              color: recording ? '#ff4444' : '#e5e5e5',
            }}
          >
            {recording ? '⏺ Aufnahme läuft — zeichne auf der Vorschau!' : '⏺ Neue Animation aufnehmen'}
          </button>
          <button
            onClick={() => {
              window.open('/api/motions/export/all', '_blank');
            }}
            style={btnStyle}
          >
            💾 Exportieren
          </button>
          <label style={{ ...btnStyle, display: 'inline-block', cursor: 'pointer' }}>
            📂 Importieren
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
            }} style={{ display: 'none' }} />
          </label>
        </div>
        {motions.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {motions.map(m => (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  onClick={async () => {
                    const toggled = !m.enabled;
                    await api.motions.update(m.id, { enabled: toggled });
                    setMotions(prev => prev.map(mo =>
                      mo.id === m.id ? { ...mo, enabled: toggled } : mo
                    ));
                  }}
                  style={{
                    ...btnStyle, flex: 1,
                    background: m.enabled ? '#00ff8833' : '#222',
                    borderColor: m.enabled ? '#00ff88' : '#333',
                  }}
                >
                  {m.name} ({m.duration.toFixed(1)}s, {m.points.length} Punkte)
                </button>
                <button
                  onClick={async () => {
                    await api.motions.delete(m.id);
                    setMotions(prev => prev.filter(mo => mo.id !== m.id));
                  }}
                  style={{ ...btnStyle, padding: '8px 10px', color: '#ff4444', borderColor: '#441111' }}
                  title="Animation löschen"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Surface Details */}
      {surface && (
        <div style={{ background: '#111', borderRadius: 8, padding: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#ccc' }}>
            {surface.name} — Koordinaten
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, fontSize: 11, color: '#aaa' }}>
            {['Oben Links', 'Oben Rechts', 'Unten Rechts', 'Unten Links'].map((label, i) => (
              <div key={i} style={{ background: '#1a1a1a', padding: 8, borderRadius: 4, textAlign: 'center' }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
                {['X', 'Y'].map((axis, ai) => (
                  <div key={axis} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 4 }}>
                    <span>{axis}:</span>
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
                      style={{
                        width: 60, padding: '4px 6px', fontSize: 11,
                        background: '#222', color: '#e5e5e5', border: '1px solid #444',
                        borderRadius: 4, textAlign: 'center',
                      }}
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button
              onClick={() => {
                const toggled = !surface.show_grid;
                api.surfaces.update(surface.id, { show_grid: toggled });
                setSurfaces(prev => prev.map(s =>
                  s.id === surface.id ? { ...s, show_grid: toggled } : s
                ));
              }}
              style={{
                ...btnStyle, flex: 1,
                background: surface.show_grid ? '#00ff8833' : '#222',
                borderColor: surface.show_grid ? '#00ff88' : '#333',
              }}
            >
              {surface.show_grid ? '▦ Raster ausblenden' : '▦ Raster einblenden'}
            </button>
            <button
              onClick={() => {
                const reset = [[0, 0], [1920, 0], [1920, 1080], [0, 1080]];
                api.surfaces.update(surface.id, { dst_points: reset });
                setSurfaces(prev => prev.map(s =>
                  s.id === surface.id ? { ...s, dst_points: reset } : s
                ));
              }}
              style={{ ...btnStyle, flex: 1 }}
            >
              🔄 Kalibrierung zurücksetzen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  padding: '8px 16px',
  fontSize: 13,
  background: '#222',
  color: '#e5e5e5',
  border: '1px solid #333',
  borderRadius: 6,
  cursor: 'pointer',
};
