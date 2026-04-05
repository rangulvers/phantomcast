const BASE = '/api';

async function fetchJson<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, opts);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export interface Surface {
  id: string;
  name: string;
  enabled: boolean;
  source: string;
  loop: boolean;
  opacity: number;
  src_points: number[][];
  dst_points: number[][];
}

export interface SourceFile {
  filename: string;
  size_bytes: number;
  type: 'video' | 'image';
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
  },

  previewUrl: `${BASE}/preview.mjpeg`,
};
