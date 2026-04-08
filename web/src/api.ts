const BASE = '/api';

async function fetchJson<T>(path: string, opts?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, opts);
  } catch (err) {
    console.error(`[API] Network error: ${path}`, err);
    throw new Error(`Network error: ${path}`);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error(`[API] ${res.status} ${path}: ${body}`);
    throw new Error(`API error ${res.status}: ${path}`);
  }
  return res.json();
}

export interface Surface {
  id: string;
  name: string;
  surface_type: string;
  enabled: boolean;
  source: string;
  loop: boolean;
  opacity: number;
  show_grid: boolean;
  order: number;
  pos_x: number;
  pos_y: number;
  scale: number;
  rotation: number;
  brightness: number;
  contrast: number;
  saturation: number;
  blend_mode: string;
  effect: string;
  effect_speed: number;
  masks: MaskDef[];
  bezier_handles: number[][] | null;
  mesh_points: number[][][] | null;
  mesh_size: number[];
  src_points: number[][];
  dst_points: number[][];
}

export interface MaskDef {
  id: string;
  name: string;
  points: number[][];
  enabled: boolean;
}

export interface SourceFile {
  filename: string;
  size_bytes: number;
  type: 'video' | 'image';
  width?: number;
  height?: number;
  fps?: number;
  duration?: number;
  frames?: number;
  codec?: string;
}

export interface SystemHealth {
  cpu_percent: number;
  cpu_count: number;
  temperature: number | null;
  ram_total_mb: number;
  ram_used_mb: number;
  ram_percent: number;
  disk_total_gb: number;
  disk_used_gb: number;
  disk_percent: number;
  uptime_seconds: number;
  platform: string;
  hostname: string;
}

export interface SystemEvent {
  ts: string;
  level: string;
  source: string;
  message: string;
}

export interface ProjectInfo {
  filename: string;
  surfaces: number;
  motions: number;
  resolution: number[];
  size_bytes: number;
  modified: string;
}

export interface Status {
  name: string;
  version: string;
  running: boolean;
  playing: boolean;
  paused: boolean;
  current_source: string;
  resolution: number[];
  surfaces: number;
}

export interface Motion {
  id: string;
  name: string;
  points: number[][];
  color: number[];
  trail_length: number;
  dot_size: number;
  enabled: boolean;
  duration: number;
}

export const api = {
  status: () => fetchJson<Status>('/status'),

  surfaces: {
    list: () => fetchJson<Surface[]>('/surfaces'),
    create: (name: string, source?: string) =>
      fetchJson<Surface>('/surfaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, source: source ?? '' }),
      }),
    update: (id: string, data: Partial<Surface>) =>
      fetchJson<Surface>(`/surfaces/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      fetchJson<{ deleted: string }>(`/surfaces/${id}`, { method: 'DELETE' }),
    reorder: (ids: string[]) =>
      fetchJson<Surface[]>('/surfaces/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ids),
      }),
  },

  sources: {
    list: () => fetchJson<SourceFile[]>('/sources'),
    upload: async (file: File) => {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`${BASE}/sources/upload`, { method: 'POST', body: form });
      if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
      return res.json();
    },
    delete: (filename: string) =>
      fetchJson<{ deleted: string }>(`/sources/${encodeURIComponent(filename)}`, { method: 'DELETE' }),
  },

  playback: {
    start: (source?: string) =>
      fetchJson<{ playing: boolean }>('/playback/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: source ?? null }),
      }),
    stop: () => fetchJson<{ playing: boolean }>('/playback/stop', { method: 'POST' }),
    pause: () => fetchJson<{ paused: boolean }>('/playback/pause', { method: 'POST' }),
    resume: () => fetchJson<{ playing: boolean }>('/playback/resume', { method: 'POST' }),
    sync: () => fetchJson<{ synced: boolean }>('/playback/sync', { method: 'POST' }),
  },

  motions: {
    list: () => fetchJson<Motion[]>('/motions'),
    create: (data: { name: string; points: number[][]; color?: number[]; trail_length?: number; dot_size?: number }) =>
      fetchJson<Motion>('/motions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Partial<Motion>) =>
      fetchJson<Motion>(`/motions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      fetchJson<{ deleted: string }>(`/motions/${id}`, { method: 'DELETE' }),
  },

  system: {
    health: () => fetchJson<SystemHealth>('/system/health'),
    events: (limit = 50) => fetchJson<SystemEvent[]>(`/system/events?limit=${limit}`),
    projects: () => fetchJson<ProjectInfo[]>('/system/projects'),
    saveProject: (name: string) =>
      fetchJson<{ saved: string }>(`/system/projects/save?name=${encodeURIComponent(name)}`, { method: 'POST' }),
    loadProject: (filename: string) =>
      fetchJson<{ loaded: string }>(`/system/projects/load?filename=${encodeURIComponent(filename)}`, { method: 'POST' }),
    exportConfig: () => { window.open(`${BASE}/system/export`, '_blank'); },
  },

  previewUrl: `${BASE}/preview.mjpeg`,
};
