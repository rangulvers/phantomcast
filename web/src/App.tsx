import { useEffect, useState, useRef, useCallback } from 'react';
import { api, Surface, Motion, MaskDef, SourceFile, Status, SystemHealth, SystemEvent, ProjectInfo } from './api';
import './styles.css';

type Page = 'dashboard' | 'workspace' | 'media' | 'settings';

export function App() {
  const [page, setPage] = useState<Page>('workspace');
  const [status, setStatus] = useState<Status | null>(null);
  const [surfaces, setSurfaces] = useState<Surface[]>([]);
  const [sources, setSources] = useState<SourceFile[]>([]);
  const [motions, setMotions] = useState<Motion[]>([]);
  const [activeSurface, setActiveSurface] = useState<string | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const [inspectorTab, setInspectorTab] = useState<'properties' | 'layers'>('properties');

  // Dashboard state
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [events, setEvents] = useState<SystemEvent[]>([]);
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [mediaSearch, setMediaSearch] = useState('');

  // Motion recording state
  const [recording, setRecording] = useState(false);
  const recordingRef = useRef(false);
  const recordPointsRef = useRef<number[][]>([]);
  const recordStartRef = useRef<number>(0);

  // Mask drawing state
  const [maskMode, setMaskMode] = useState(false);
  const maskModeRef = useRef(false);
  const maskStartRef = useRef<number[] | null>(null);
  const maskCurrentRef = useRef<number[] | null>(null);

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

  useEffect(() => {
    const interval = setInterval(() => {
      api.status().then(setStatus).catch(() => {});
      if (page === 'dashboard') {
        api.system.health().then(setHealth).catch(() => {});
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [page]);

  // Load dashboard data when switching to it
  useEffect(() => {
    if (page === 'dashboard') {
      api.system.health().then(setHealth).catch(() => {});
      api.system.events().then(setEvents).catch(() => {});
      api.system.projects().then(setProjects).catch(() => {});
    }
  }, [page]);

  const surface = surfaces.find(s => s.id === activeSurface);

  // ─── Canvas Overlay ───
  const drawOverlay = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !surface) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, rect.width, rect.height);

    const scaleX = rect.width / (status?.resolution[0] ?? 1920);
    const scaleY = rect.height / (status?.resolution[1] ?? 1080);
    const pts = surface.dst_points.map(([x, y]) => [x * scaleX, y * scaleY]);

    // Quad fill
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.fillStyle = 'rgba(0, 240, 255, 0.03)';
    ctx.fill();

    // Quad outline
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.strokeStyle = '#00F0FF';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Diagonals
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]); ctx.lineTo(pts[2][0], pts[2][1]);
    ctx.moveTo(pts[1][0], pts[1][1]); ctx.lineTo(pts[3][0], pts[3][1]);
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.12)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Control points
    const labels = ['TL', 'TR', 'BR', 'BL'];
    pts.forEach(([x, y], i) => {
      ctx.beginPath();
      ctx.arc(x, y, 10, 0, Math.PI * 2);
      ctx.fillStyle = dragging === i ? 'rgba(157, 0, 255, 0.3)' : 'rgba(0, 240, 255, 0.15)';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fillStyle = dragging === i ? '#9D00FF' : '#00F0FF';
      ctx.fill();
      ctx.fillStyle = '#000';
      ctx.font = `bold 7px 'JetBrains Mono', monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(labels[i], x, y);
    });

    // Masks
    if (surface.masks) {
      surface.masks.forEach(m => {
        if (!m.enabled || m.points.length < 3) return;
        const mpts = m.points.map(([x, y]) => [x * scaleX, y * scaleY]);
        ctx.beginPath();
        ctx.moveTo(mpts[0][0], mpts[0][1]);
        for (let i = 1; i < mpts.length; i++) ctx.lineTo(mpts[i][0], mpts[i][1]);
        ctx.closePath();
        ctx.fillStyle = 'rgba(255, 68, 102, 0.2)';
        ctx.fill();
        ctx.strokeStyle = '#ff4466';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
      });
    }

    // In-progress mask
    if (maskStartRef.current && maskCurrentRef.current) {
      const [sx, sy] = maskStartRef.current.map((v, i) => v * (i === 0 ? scaleX : scaleY));
      const [ex, ey] = maskCurrentRef.current.map((v, i) => v * (i === 0 ? scaleX : scaleY));
      ctx.beginPath();
      ctx.rect(Math.min(sx, ex), Math.min(sy, ey), Math.abs(ex - sx), Math.abs(ey - sy));
      ctx.fillStyle = 'rgba(255, 68, 102, 0.12)';
      ctx.fill();
      ctx.strokeStyle = '#ff4466';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }, [surface, dragging, status]);

  useEffect(() => { drawOverlay(); }, [drawOverlay]);
  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    const observer = new ResizeObserver(() => drawOverlay());
    observer.observe(img);
    return () => observer.disconnect();
  }, [drawOverlay]);

  // ─── Coordinate Helpers ───
  const toProjectorCoords = (e: React.PointerEvent): [number, number] | null => {
    const canvas = canvasRef.current;
    if (!canvas || !status) return null;
    const rect = canvas.getBoundingClientRect();
    const cssX = e.clientX - rect.left;
    const cssY = e.clientY - rect.top;
    return [Math.round(cssX * status.resolution[0] / rect.width), Math.round(cssY * status.resolution[1] / rect.height)];
  };

  const getPointIndex = (clientX: number, clientY: number): number | null => {
    const canvas = canvasRef.current;
    if (!canvas || !surface || !status) return null;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const scaleX = rect.width / status.resolution[0];
    const scaleY = rect.height / status.resolution[1];
    for (let i = 0; i < surface.dst_points.length; i++) {
      const px = surface.dst_points[i][0] * scaleX;
      const py = surface.dst_points[i][1] * scaleY;
      if (Math.hypot(x - px, y - py) < 20) return i;
    }
    return null;
  };

  // ─── Pointer Handlers ───
  const handlePointerDown = (e: React.PointerEvent) => {
    const proj = toProjectorCoords(e);
    if (!proj) return;

    if (maskModeRef.current) {
      e.currentTarget.setPointerCapture(e.pointerId);
      maskStartRef.current = proj;
      maskCurrentRef.current = proj;
      return;
    }
    if (recordingRef.current) {
      e.currentTarget.setPointerCapture(e.pointerId);
      recordStartRef.current = performance.now();
      recordPointsRef.current = [[proj[0], proj[1], 0]];
      return;
    }
    const idx = getPointIndex(e.clientX, e.clientY);
    if (idx !== null) {
      setDragging(idx);
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (maskModeRef.current && maskStartRef.current) {
      const proj = toProjectorCoords(e);
      if (!proj) return;
      maskCurrentRef.current = proj;
      drawOverlay();
      return;
    }
    if (recordingRef.current && recordPointsRef.current.length > 0) {
      const proj = toProjectorCoords(e);
      if (!proj) return;
      const t = (performance.now() - recordStartRef.current) / 1000;
      const last = recordPointsRef.current[recordPointsRef.current.length - 1];
      if (t - last[2] >= 0.033) recordPointsRef.current.push([proj[0], proj[1], parseFloat(t.toFixed(3))]);
      return;
    }
    if (dragging === null || !surface || !status) return;
    const proj = toProjectorCoords(e);
    if (!proj) return;
    const newPoints = surface.dst_points.map((p, i) => i === dragging ? proj : [...p]);
    dragPointsRef.current = newPoints;
    setSurfaces(prev => prev.map(s => s.id === surface.id ? { ...s, dst_points: newPoints } : s));
  };

  const handlePointerUp = async () => {
    if (maskModeRef.current && maskStartRef.current && maskCurrentRef.current && surface) {
      const [sx, sy] = maskStartRef.current;
      const [ex, ey] = maskCurrentRef.current;
      if (Math.abs(ex - sx) > 10 && Math.abs(ey - sy) > 10) {
        const x1 = Math.min(sx, ex), y1 = Math.min(sy, ey);
        const x2 = Math.max(sx, ex), y2 = Math.max(sy, ey);
        const newMask: MaskDef = { id: `mask_${Date.now().toString(36)}`, name: `Mask ${(surface.masks?.length ?? 0) + 1}`, points: [[x1, y1], [x2, y1], [x2, y2], [x1, y2]], enabled: true };
        const updatedMasks = [...(surface.masks || []), newMask];
        await api.surfaces.update(surface.id, { masks: updatedMasks } as any);
        setSurfaces(prev => prev.map(s => s.id === surface.id ? { ...s, masks: updatedMasks } : s));
      }
      maskStartRef.current = null; maskCurrentRef.current = null;
      maskModeRef.current = false; setMaskMode(false);
      drawOverlay();
      return;
    }
    if (recordingRef.current && recordPointsRef.current.length > 1) {
      const created = await api.motions.create({ name: `Motion ${motions.length + 1}`, points: recordPointsRef.current });
      setMotions(prev => [...prev, created]);
      recordPointsRef.current = []; recordingRef.current = false; setRecording(false);
      return;
    }
    if (dragging !== null && surface && dragPointsRef.current) {
      api.surfaces.update(surface.id, { dst_points: dragPointsRef.current });
    }
    dragPointsRef.current = null; setDragging(null);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await api.sources.upload(file);
    setSources(await api.sources.list());
  };

  const handleCreateSurface = async () => {
    const created = await api.surfaces.create(`Surface ${surfaces.length + 1}`, sources.length > 0 ? sources[0].filename : '');
    setSurfaces(prev => [...prev, created]);
    setActiveSurface(created.id);
  };

  const updateSurface = (field: string, value: any) => {
    if (!surface) return;
    api.surfaces.update(surface.id, { [field]: value } as any);
    setSurfaces(prev => prev.map(s => s.id === surface.id ? { ...s, [field]: value } : s));
  };

  const statusLabel = status?.playing ? 'PLAYING' : status?.running ? 'READY' : 'OFFLINE';
  const statusClass = status?.playing ? 'ok' : status?.running ? 'warn' : 'err';

  return (
    <div className="app">
      {/* ═══ Top Navigation ═══ */}
      <nav className="topnav">
        <span className="topnav-brand"><img src="/logo.png" alt="" className="topnav-logo" />PhantomCast</span>
        <div className="topnav-tabs">
          {(['dashboard', 'workspace', 'media', 'settings'] as Page[]).map(p => (
            <button key={p} className={`topnav-tab ${page === p ? 'active' : ''}`} onClick={() => setPage(p)}>
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
        <div className="topnav-spacer" />
        <div className="topnav-actions">
          <div className="topnav-status">
            <span className={`statusbar-dot ${statusClass}`} />
            {statusLabel}
          </div>
          <button className={`btn-live ${status?.playing ? 'active' : ''}`} onClick={() => status?.playing ? api.playback.stop() : api.playback.start()}>
            {status?.playing ? 'Live Output' : 'Go Live'}
          </button>
        </div>
      </nav>

      {/* ═══ Left Icon Sidebar ═══ */}
      <aside className="icon-sidebar">
        {[
          { id: 'dashboard' as Page, icon: '◉', label: 'Dash' },
          { id: 'workspace' as Page, icon: '⬡', label: 'Work' },
          { id: 'media' as Page, icon: '◫', label: 'Media' },
          { id: 'settings' as Page, icon: '⚙', label: 'Set' },
        ].map(item => (
          <button key={item.id} className={`icon-sidebar-btn ${page === item.id ? 'active' : ''}`} onClick={() => setPage(item.id)}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <span>{item.icon}</span>
              <span className="icon-sidebar-label">{item.label}</span>
            </div>
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button className="icon-sidebar-btn" onClick={() => api.playback.sync()} title="Sync">⟳</button>
      </aside>

      {/* ═══ Main Content ═══ */}
      <main className="main-content">
        {page === 'dashboard' && (
          <div>
            <div className="page-header">
              <h2 className="page-title">Project Overview</h2>
              <p className="page-subtitle">
                Managing {surfaces.length} surfaces across {sources.length} media assets
              </p>
            </div>

            {/* System Health */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
              {[
                { label: 'CPU', value: health ? `${health.cpu_percent}%` : '—', color: (health?.cpu_percent ?? 0) > 80 ? 'var(--danger)' : 'var(--primary)' },
                { label: 'Temperature', value: health?.temperature ? `${health.temperature}°C` : '—', color: (health?.temperature ?? 0) > 70 ? 'var(--danger)' : 'var(--primary)' },
                { label: 'RAM', value: health ? `${health.ram_percent}%` : '—', color: (health?.ram_percent ?? 0) > 85 ? 'var(--danger)' : 'var(--primary)' },
                { label: 'Disk', value: health ? `${health.disk_percent}%` : '—', color: (health?.disk_percent ?? 0) > 90 ? 'var(--danger)' : 'var(--primary)' },
              ].map(s => (
                <div key={s.label} className="card" style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 9, fontFamily: 'var(--font-heading)', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', marginBottom: 6 }}>{s.label}</div>
                  <div style={{ fontSize: 22, fontFamily: 'var(--font-heading)', fontWeight: 700, color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>

            <div className="settings-grid" style={{ marginBottom: 16 }}>
              {/* Projects */}
              <div className="card">
                <div className="card-title">Saved Projects</div>
                {projects.map(p => (
                  <div key={p.filename} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <button className="btn" style={{ flex: 1, justifyContent: 'flex-start', fontSize: 11 }}
                      onClick={() => api.system.loadProject(p.filename).then(() => { api.surfaces.list().then(setSurfaces); api.motions.list().then(setMotions); })}>
                      {p.filename.replace('.json', '')}
                      <span className="motion-meta">{p.surfaces}s / {p.motions}m</span>
                    </button>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                  <button className="btn btn-secondary" style={{ flex: 1, fontSize: 10 }}
                    onClick={() => { const name = prompt('Project name:'); if (name) api.system.saveProject(name).then(() => api.system.projects().then(setProjects)); }}>
                    Save Current
                  </button>
                  <button className="btn btn-outlined" style={{ flex: 1, fontSize: 10 }} onClick={() => api.system.exportConfig()}>
                    Export Bundle
                  </button>
                </div>
              </div>

              {/* Quick Info */}
              <div className="card">
                <div className="card-title">System Info</div>
                {[
                  { l: 'Hostname', v: health?.hostname ?? '—' },
                  { l: 'Platform', v: health?.platform ?? '—' },
                  { l: 'RAM', v: health ? `${health.ram_used_mb} / ${health.ram_total_mb} MB` : '—' },
                  { l: 'Disk', v: health ? `${health.disk_used_gb} / ${health.disk_total_gb} GB` : '—' },
                  { l: 'Uptime', v: health ? `${Math.floor(health.uptime_seconds / 3600)}h ${Math.floor((health.uptime_seconds % 3600) / 60)}m` : '—' },
                  { l: 'Surfaces', v: `${surfaces.length}` },
                  { l: 'Resolution', v: status?.resolution?.join(' × ') ?? '—' },
                ].map(r => (
                  <div key={r.l} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--border-subtle)', fontSize: 11 }}>
                    <span style={{ color: 'var(--text-muted)' }}>{r.l}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}>{r.v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Event Log */}
            <div className="card">
              <div className="card-title">System Event Log</div>
              <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                {events.length === 0 && <div className="empty-state">No events recorded</div>}
                {events.slice().reverse().map((e, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, padding: '4px 0', borderBottom: '1px solid var(--border-subtle)', fontSize: 10 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', width: 65, flexShrink: 0 }}>
                      {e.ts.split('T')[1]}
                    </span>
                    <span style={{
                      fontFamily: 'var(--font-mono)', width: 50, flexShrink: 0, fontWeight: 600,
                      color: e.level === 'WARN' ? 'var(--tertiary)' : e.level === 'ERROR' ? 'var(--danger)' : 'var(--text-muted)'
                    }}>{e.source}</span>
                    <span style={{ color: 'var(--text-secondary)' }}>{e.message}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {page === 'workspace' && (<>
          {/* Toolbar */}
          <div className="toolbar">
            <div className="btn-group">
              <button className={`btn ${status?.playing && !status?.paused ? 'active' : ''}`} onClick={() => api.playback.start()} title="Play (Space)">▶</button>
              <button className={`btn ${status?.paused ? 'active' : ''}`} onClick={() => api.playback.pause()} title="Pause">⏸</button>
              <button className="btn" onClick={() => api.playback.stop()} title="Stop">⏹</button>
            </div>
            <div className="toolbar-divider" />
            {/* Surface type selector */}
            <div className="btn-group">
              {([
                { type: 'quad', icon: '◇', tip: 'Quad (4-point perspective)' },
                { type: 'triangle', icon: '△', tip: 'Triangle (3-point affine)' },
                { type: 'bezier', icon: '◠', tip: 'Bezier (curved edges)' },
                { type: 'mesh', icon: '⊞', tip: 'Mesh (grid warp)' },
              ] as const).map(({ type, icon, tip }) => (
                <button key={type} className={`btn ${surface?.surface_type === type ? 'active' : ''}`}
                  onClick={() => { if (surface) updateSurface('surface_type', type); }}
                  title={tip}>
                  {icon}
                </button>
              ))}
            </div>
            <div className="toolbar-divider" />
            <button className={`btn ${recording ? 'btn-record active' : ''}`}
              onClick={() => { const n = !recording; setRecording(n); recordingRef.current = n; if (n) { recordPointsRef.current = []; setMaskMode(false); maskModeRef.current = false; } }}
              title="Record motion path">
              {recording ? '● REC' : '● Record'}
            </button>
            <button className={`btn ${maskMode ? 'btn-record active' : ''}`}
              onClick={() => { const n = !maskMode; setMaskMode(n); maskModeRef.current = n; if (n) { setRecording(false); recordingRef.current = false; } }}
              title="Draw exclusion mask">
              {maskMode ? '▬ Drawing' : '▬ Mask'}
            </button>
            <div className="toolbar-divider" />
            <button className="btn" onClick={handleCreateSurface} title="Add new surface">+ Surface</button>
            <div className="toolbar-divider" />
            <button className={`btn ${surface?.show_grid ? 'btn-active' : 'btn-outlined'}`}
              onClick={() => { if (surface) updateSurface('show_grid', !surface.show_grid); }}
              title="Toggle calibration grid">
              Grid
            </button>
          </div>

          {/* Breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', padding: '0 2px' }}>
            <span>SCENE</span>
            <span style={{ color: 'var(--border)' }}>›</span>
            <span>PROJECTOR 01</span>
            <span style={{ color: 'var(--border)' }}>›</span>
            <span style={{ color: surface ? 'var(--primary)' : 'var(--text-dim)' }}>
              {surface ? `${surface.name.toUpperCase()} (${(surface.surface_type ?? 'quad').toUpperCase()})` : 'NO SELECTION'}
            </span>
          </div>

          {/* Preview */}
          <div className="preview-container">
            <img ref={imgRef} src="/api/preview.mjpeg" alt="Preview" onLoad={drawOverlay} />
            <canvas ref={canvasRef} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp}
              style={{ cursor: maskMode ? 'crosshair' : recording ? 'cell' : dragging !== null ? 'grabbing' : 'default' }} />
            <div className="preview-badge">{status?.playing ? 'LIVE' : 'IDLE'}</div>
            {recording && <div className="preview-recording-badge">● REC</div>}
            {maskMode && <div className="preview-recording-badge">▬ MASK</div>}
            {/* Bottom info bar */}
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
              padding: '16px 12px 6px',
              display: 'flex', justifyContent: 'space-between',
              fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.3px',
            }}>
              <span>OUTPUT {status?.resolution?.join('×') ?? '—'}</span>
              <span>{surfaces.length} SURFACE{surfaces.length !== 1 ? 'S' : ''}</span>
              <span>{surface ? surface.name : '—'}</span>
            </div>
          </div>

          {/* Layers Panel */}
          <div className="layers-panel">
            <div className="layers-header">
              <span className="layers-header-title">Layers ({surfaces.length})</span>
              <div style={{ display: 'flex', gap: 2 }}>
                <button className="btn btn-icon btn-sm" onClick={() => api.playback.sync()} title="Sync all layers">⟳</button>
                <button className="btn btn-icon btn-sm" onClick={handleCreateSurface} title="Add surface">+</button>
              </div>
            </div>
            {surfaces.length === 0 && (
              <div className="empty-state" style={{ padding: 16 }}>
                No surfaces yet. Click + to create one.
              </div>
            )}
            {[...surfaces].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map((s) => (
              <div key={s.id} className={`layer-item ${activeSurface === s.id ? 'active' : ''}`} onClick={() => setActiveSurface(s.id)}>
                {/* Visibility toggle */}
                <button className="btn btn-icon" style={{ padding: '0 3px', fontSize: 10, border: 'none', background: 'none', color: s.enabled ? 'var(--success)' : 'var(--text-dim)' }}
                  onClick={(e) => { e.stopPropagation(); updateSurface.call(null, ...['enabled', !s.enabled] as [string, any]); /* need per-surface */ api.surfaces.update(s.id, { enabled: !s.enabled }); setSurfaces(prev => prev.map(sf => sf.id === s.id ? { ...sf, enabled: !sf.enabled } : sf)); }}
                  title={s.enabled ? 'Visible' : 'Hidden'}>
                  {s.enabled ? '◉' : '○'}
                </button>
                <span className="layer-dot" style={{ background: activeSurface === s.id ? 'var(--primary)' : 'var(--secondary)' }} />
                <span className="layer-name">{s.name}</span>
                <span className="layer-type">{s.surface_type ?? 'quad'}</span>
                <button className="btn btn-icon" style={{ padding: '0 4px', fontSize: 8, border: 'none', background: 'none', color: 'var(--text-dim)' }} title="Move up"
                  onClick={async (e) => {
                    e.stopPropagation();
                    const sorted = [...surfaces].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
                    const i = sorted.findIndex(x => x.id === s.id);
                    if (i > 0) { [sorted[i], sorted[i-1]] = [sorted[i-1], sorted[i]]; }
                    await api.surfaces.reorder(sorted.map(x => x.id));
                    sorted.forEach((x, j) => x.order = j);
                    setSurfaces([...sorted]);
                  }}>▲</button>
                <button className="btn btn-icon" style={{ padding: '0 4px', fontSize: 8, border: 'none', background: 'none', color: 'var(--text-dim)' }} title="Move down"
                  onClick={async (e) => {
                    e.stopPropagation();
                    const sorted = [...surfaces].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
                    const i = sorted.findIndex(x => x.id === s.id);
                    if (i < sorted.length - 1) { [sorted[i], sorted[i+1]] = [sorted[i+1], sorted[i]]; }
                    await api.surfaces.reorder(sorted.map(x => x.id));
                    sorted.forEach((x, j) => x.order = j);
                    setSurfaces([...sorted]);
                  }}>▼</button>
                <button className="btn btn-icon btn-danger" style={{ padding: '0 4px', fontSize: 9, border: 'none', background: 'none' }}
                  onClick={async (e) => { e.stopPropagation(); await api.surfaces.delete(s.id); setSurfaces(prev => prev.filter(sf => sf.id !== s.id)); if (activeSurface === s.id) setActiveSurface(surfaces.find(sf => sf.id !== s.id)?.id ?? null); }}
                  title="Delete surface">
                  ×
                </button>
              </div>
            ))}
          </div>
        </>)}

        {page === 'media' && (
          <div>
            <div className="page-header">
              <h2 className="page-title">Media Library</h2>
              <p className="page-subtitle">Manage video assets, mapping sequences, and content</p>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <input
                type="text" placeholder="Search assets..."
                value={mediaSearch} onChange={(e) => setMediaSearch(e.target.value)}
                style={{ flex: 1, padding: '7px 12px', fontSize: 12, fontFamily: 'var(--font-body)', background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}
              />
              <label className="btn btn-secondary upload-label">
                + Upload
                <input type="file" accept="video/*,image/*" onChange={handleUpload} />
              </label>
            </div>
            {sources.length === 0 ? (
              <label className="upload-area" style={{ display: 'block' }}>
                <div className="upload-icon">◫</div>
                <div className="upload-text">Upload Video Assets</div>
                <div className="upload-hint">Drag and drop ProRes, H.264, or MP4 files here</div>
                <input type="file" accept="video/*,image/*" onChange={handleUpload} style={{ display: 'none' }} />
              </label>
            ) : (
              <div className="media-grid">
                {sources.filter(s => !mediaSearch || s.filename.toLowerCase().includes(mediaSearch.toLowerCase())).map(s => (
                  <div key={s.filename} className="media-card">
                    <div style={{ position: 'relative' }}>
                      <img src={`/api/sources/${encodeURIComponent(s.filename)}/thumbnail`} alt="" className="media-card-thumb"
                        onError={(e) => { (e.target as HTMLImageElement).style.background = 'var(--bg-input)'; }} />
                      {s.duration && (
                        <span style={{ position: 'absolute', bottom: 4, right: 4, background: 'rgba(0,0,0,0.75)', padding: '1px 5px', borderRadius: 3, fontFamily: 'var(--font-mono)', fontSize: 9, color: '#fff' }}>
                          {Math.floor(s.duration / 60)}:{String(Math.floor(s.duration % 60)).padStart(2, '0')}
                        </span>
                      )}
                    </div>
                    <div className="media-card-body">
                      <div className="media-card-name">{s.filename}</div>
                      <div style={{ display: 'flex', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                        {s.width && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-dim)', background: 'var(--bg-input)', padding: '1px 4px', borderRadius: 2 }}>{s.width}×{s.height}</span>}
                        {s.fps && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-dim)', background: 'var(--bg-input)', padding: '1px 4px', borderRadius: 2 }}>{s.fps} FPS</span>}
                        {s.codec && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-dim)', background: 'var(--bg-input)', padding: '1px 4px', borderRadius: 2 }}>{s.codec}</span>}
                      </div>
                      <div className="media-card-meta">
                        <span className="media-card-size">{(s.size_bytes / 1024 / 1024).toFixed(1)} MB</span>
                        <button className="btn btn-icon btn-danger btn-sm"
                          onClick={async () => { await api.sources.delete(s.filename); setSources(prev => prev.filter(sf => sf.filename !== s.filename)); }}>×</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {page === 'settings' && (
          <div>
            <div className="page-header">
              <h2 className="page-title">Configuration</h2>
              <p className="page-subtitle">Projector setup and system settings</p>
            </div>
            <div className="settings-grid">
              <div className="card">
                <div className="card-title">Projector Setup</div>
                {[
                  { l: 'Target Resolution', v: status?.resolution?.join(' × ') ?? '—' },
                  { l: 'Frame Rate', v: '30.00 FPS' },
                  { l: 'Orientation', v: 'Landscape' },
                  { l: 'Surfaces', v: `${surfaces.length}` },
                  { l: 'Framebuffer', v: (status as any)?.framebuffer ? 'Active' : 'Inactive', c: (status as any)?.framebuffer ? 'var(--success)' : 'var(--danger)' },
                ].map(r => (
                  <div key={r.l} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--border-subtle)', fontSize: 11 }}>
                    <span style={{ color: 'var(--text-muted)' }}>{r.l}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: (r as any).c ?? 'var(--text-primary)' }}>{r.v}</span>
                  </div>
                ))}
              </div>
              <div className="card">
                <div className="card-title">Master Color</div>
                {surface ? (
                  <>
                    {(['brightness', 'contrast', 'saturation'] as const).map(prop => (
                      <div key={prop} className="slider-row" style={{ marginBottom: 4 }}>
                        <span className="slider-label">{prop}</span>
                        <input type="range" min="-100" max="100" step="5" value={(surface as any)[prop] ?? 0} style={{ flex: 1 }}
                          onChange={(e) => updateSurface(prop, parseFloat(e.target.value))} />
                        <span className="slider-value">{(surface as any)[prop] ?? 0}</span>
                      </div>
                    ))}
                  </>
                ) : <div className="empty-state">Select a surface first</div>}
              </div>
              <div className="card">
                <div className="card-title">Configuration</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <button className="btn btn-secondary btn-full" onClick={() => api.system.exportConfig()}>Export Config Bundle</button>
                  <button className="btn btn-outlined btn-full" onClick={() => {
                    const name = prompt('Save project as:');
                    if (name) api.system.saveProject(name);
                  }}>Save Project</button>
                  <button className="btn btn-outlined btn-full" onClick={() => {
                    surfaces.forEach(s => {
                      api.surfaces.update(s.id, { dst_points: [[0,0],[1920,0],[1920,1080],[0,1080]], brightness: 0, contrast: 0, saturation: 0 } as any);
                    });
                    setSurfaces(prev => prev.map(s => ({ ...s, dst_points: [[0,0],[1920,0],[1920,1080],[0,1080]], brightness: 0, contrast: 0, saturation: 0 })));
                  }}>Reset All Calibration</button>
                </div>
              </div>
              <div className="card">
                <div className="card-title">Animations</div>
                {motions.map(m => (
                  <div key={m.id} className="motion-item" style={{ marginBottom: 4 }}>
                    <button className={`btn ${m.enabled ? 'btn-active' : ''}`} style={{ flex: 1, justifyContent: 'flex-start', fontSize: 11 }}
                      onClick={async () => { const t = !m.enabled; await api.motions.update(m.id, { enabled: t }); setMotions(prev => prev.map(mo => mo.id === m.id ? { ...mo, enabled: t } : mo)); }}>
                      {m.name}<span className="motion-meta">{m.duration.toFixed(1)}s</span>
                    </button>
                    <button className="btn btn-icon btn-danger" onClick={async () => { await api.motions.delete(m.id); setMotions(prev => prev.filter(mo => mo.id !== m.id)); }}>×</button>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                  <button className="btn" style={{ flex: 1 }} onClick={() => window.open('/api/motions/export/all', '_blank')}>Export</button>
                  <label className="btn upload-label" style={{ flex: 1, justifyContent: 'center' }}>
                    Import
                    <input type="file" accept=".json" onChange={async (e) => {
                      const file = e.target.files?.[0]; if (!file) return;
                      const form = new FormData(); form.append('file', file);
                      const res = await fetch('/api/motions/import', { method: 'POST', body: form });
                      if (res.ok) { const data = await res.json(); setMotions(prev => [...prev, ...data.motions]); }
                      e.target.value = '';
                    }} />
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ═══ Right Inspector Panel ═══ */}
      <aside className="inspector">
        <div className="inspector-header">
          <div className="inspector-title">Inspector</div>
          <div className="inspector-tabs">
            <button className={`inspector-tab ${inspectorTab === 'properties' ? 'active' : ''}`} onClick={() => setInspectorTab('properties')}>Properties</button>
            <button className={`inspector-tab ${inspectorTab === 'layers' ? 'active' : ''}`} onClick={() => setInspectorTab('layers')}>Layers</button>
          </div>
        </div>
        <div className="inspector-body">
          {inspectorTab === 'properties' && surface ? (<>
            <div className="inspector-section">
              <div className="inspector-section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{surface.name}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-dim)', background: 'var(--bg-input)', padding: '1px 6px', borderRadius: 3, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {surface.surface_type ?? 'quad'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button className="btn btn-outlined btn-sm" style={{ flex: 1 }}
                  onClick={() => updateSurface('dst_points', [[0, 0], [1920, 0], [1920, 1080], [0, 1080]])}>
                  Reset Points
                </button>
                <button className={`btn btn-sm ${surface.enabled ? 'btn-active' : 'btn-outlined'}`} style={{ flex: 1 }}
                  onClick={() => updateSurface('enabled', !surface.enabled)}>
                  {surface.enabled ? 'Enabled' : 'Disabled'}
                </button>
              </div>
              {/* Opacity */}
              <div className="slider-row" style={{ marginTop: 4 }}>
                <span className="slider-label">Opacity</span>
                <input type="range" min="0" max="1" step="0.05" value={surface.opacity ?? 1} style={{ flex: 1 }}
                  onChange={(e) => updateSurface('opacity', parseFloat(e.target.value))} />
                <span className="slider-value">{Math.round((surface.opacity ?? 1) * 100)}%</span>
              </div>
            </div>

            <div className="inspector-section">
              <div className="inspector-section-title">Transform</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                {[
                  { label: 'Pos X', field: 'pos_x', min: -1920, max: 1920, step: 1 },
                  { label: 'Pos Y', field: 'pos_y', min: -1080, max: 1080, step: 1 },
                  { label: 'Scale', field: 'scale', min: 0.1, max: 5, step: 0.05 },
                  { label: 'Rotation', field: 'rotation', min: -180, max: 180, step: 1 },
                ].map(({ label, field, min, max, step }) => (
                  <div key={field} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 35, fontFamily: 'var(--font-mono)' }}>{label}</span>
                    <input type="number" min={min} max={max} step={step}
                      value={(surface as any)[field] ?? (field === 'scale' ? 1 : 0)}
                      onChange={(e) => updateSurface(field, parseFloat(e.target.value) || 0)}
                      style={{ flex: 1, width: 'auto' }} />
                  </div>
                ))}
              </div>
            </div>

            {/* Mesh Warp Toggle */}
            {surface.surface_type === 'mesh' && (
              <div className="inspector-section">
                <div className="inspector-section-title">Mesh Warp</div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {[3, 4, 5, 6].map(size => (
                    <button key={size} className={`btn ${surface.mesh_size?.[0] === size ? 'btn-active' : ''}`}
                      style={{ flex: 1, fontSize: 10 }}
                      onClick={() => {
                        // Generate default grid
                        const rows = size, cols = size;
                        const grid: number[][][] = [];
                        for (let r = 0; r < rows; r++) {
                          const row: number[][] = [];
                          for (let c = 0; c < cols; c++) {
                            row.push([
                              Math.round(c * 1920 / (cols - 1)),
                              Math.round(r * 1080 / (rows - 1))
                            ]);
                          }
                          grid.push(row);
                        }
                        updateSurface('mesh_size', [rows, cols]);
                        updateSurface('mesh_points', grid);
                      }}>
                      {size}×{size}
                    </button>
                  ))}
                </div>
                <p style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 4 }}>
                  Grid resolution for curved surface warp
                </p>
              </div>
            )}

            <div className="inspector-section">
              <div className="inspector-section-title">Media Assignment</div>
              <select value={surface.source} style={{ width: '100%' }}
                onChange={(e) => { updateSurface('source', e.target.value); api.playback.start(e.target.value); }}>
                <option value="">None</option>
                {sources.map(s => <option key={s.filename} value={s.filename}>{s.filename}</option>)}
              </select>
            </div>

            <div className="inspector-section">
              <div className="inspector-section-title">Control Points</div>
              <div className="coord-grid">
                {['TL', 'TR', 'BR', 'BL'].map((label, i) => (
                  <div key={i} className="coord-cell">
                    <div className="coord-label">{label}</div>
                    {['X', 'Y'].map((axis, ai) => (
                      <div key={axis} className="coord-input-row">
                        <span>{axis}</span>
                        <input type="number" value={surface.dst_points[i]?.[ai] ?? 0}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            const np = surface.dst_points.map((p, pi) => pi === i ? (ai === 0 ? [val, p[1]] : [p[0], val]) : [...p]);
                            setSurfaces(prev => prev.map(s => s.id === surface.id ? { ...s, dst_points: np } : s));
                            api.surfaces.update(surface.id, { dst_points: np });
                          }} />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            <div className="inspector-section">
              <div className="inspector-section-title">Adjustments</div>
              {(['brightness', 'contrast', 'saturation'] as const).map(prop => (
                <div key={prop} className="slider-row">
                  <span className="slider-label">{prop}</span>
                  <input type="range" min="-100" max="100" step="5" value={(surface as any)[prop] ?? 0} style={{ flex: 1 }}
                    onChange={(e) => updateSurface(prop, parseFloat(e.target.value))} />
                  <span className="slider-value">{(surface as any)[prop] ?? 0}</span>
                </div>
              ))}
            </div>

            <div className="inspector-section">
              <div className="inspector-section-title">Effects</div>
              <div className="slider-row">
                <span className="slider-label">Blend</span>
                <select value={surface.blend_mode ?? 'normal'} style={{ flex: 1 }} onChange={(e) => updateSurface('blend_mode', e.target.value)}>
                  <option value="normal">Normal</option>
                  <option value="additive">Additive</option>
                  <option value="multiply">Multiply</option>
                  <option value="screen">Screen</option>
                </select>
              </div>
              <div className="slider-row">
                <span className="slider-label">Effect</span>
                <select value={surface.effect ?? 'none'} style={{ flex: 1 }} onChange={(e) => updateSurface('effect', e.target.value)}>
                  <option value="none">None</option>
                  <option value="fade_in">Fade In</option>
                  <option value="fade_out">Fade Out</option>
                  <option value="color_shift">Color Shift</option>
                  <option value="strobe">Strobe</option>
                </select>
              </div>
              <div className="slider-row">
                <span className="slider-label">Speed</span>
                <input type="range" min="0.1" max="5" step="0.1" value={surface.effect_speed ?? 1} style={{ flex: 1 }}
                  onChange={(e) => updateSurface('effect_speed', parseFloat(e.target.value))} />
                <span className="slider-value">{(surface.effect_speed ?? 1).toFixed(1)}x</span>
              </div>
            </div>

            {surface.masks && surface.masks.length > 0 && (
              <div className="inspector-section">
                <div className="inspector-section-title" style={{ color: 'var(--danger)' }}>Exclusion Masks</div>
                {surface.masks.map(m => (
                  <div key={m.id} className="motion-item">
                    <button className={`btn ${m.enabled ? 'btn-active' : ''}`} style={{ flex: 1, fontSize: 10, justifyContent: 'flex-start' }}
                      onClick={async () => {
                        const updated = surface.masks.map(mk => mk.id === m.id ? { ...mk, enabled: !mk.enabled } : mk);
                        await api.surfaces.update(surface.id, { masks: updated } as any);
                        setSurfaces(prev => prev.map(s => s.id === surface.id ? { ...s, masks: updated } : s));
                      }}>{m.name}</button>
                    <button className="btn btn-icon btn-danger" style={{ padding: '2px 6px', fontSize: 10 }}
                      onClick={async () => {
                        const updated = surface.masks.filter(mk => mk.id !== m.id);
                        await api.surfaces.update(surface.id, { masks: updated } as any);
                        setSurfaces(prev => prev.map(s => s.id === surface.id ? { ...s, masks: updated } : s));
                      }}>×</button>
                  </div>
                ))}
              </div>
            )}
          </>) : inspectorTab === 'layers' ? (
            <div className="inspector-section">
              <div className="inspector-section-title">All Surfaces</div>
              {surfaces.map(s => (
                <div key={s.id} className="layer-item" style={{ borderRadius: 'var(--radius-sm)', marginBottom: 2 }}
                  onClick={() => { setActiveSurface(s.id); setInspectorTab('properties'); }}>
                  <span className="layer-dot" style={{ background: s.enabled ? 'var(--primary)' : 'var(--text-muted)' }} />
                  <span className="layer-name" style={{ fontSize: 11 }}>{s.name}</span>
                  <span className="layer-type">{s.surface_type ?? 'quad'}</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', padding: 20 }}>
              Select a surface to view properties
            </div>
          )}
        </div>
      </aside>

      {/* ═══ Status Bar ═══ */}
      <div className="statusbar">
        <div className="statusbar-item">
          <span className={`statusbar-dot ${statusClass}`} />
          <span>{status?.running ? 'SYSTEM READY' : 'OFFLINE'}</span>
        </div>
        <div className="statusbar-item">
          PROJECT: PHANTOMCAST
        </div>
        <div className="statusbar-spacer" />
        {status?.current_source && (
          <div className="statusbar-item">NOW: {status.current_source}</div>
        )}
        <div className="statusbar-item">
          {status?.resolution?.join('×') ?? '—'}
        </div>
        <div className="statusbar-item">
          {surfaces.length} surfaces
        </div>
      </div>
    </div>
  );
}
