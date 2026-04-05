# PhantomCast — Raspberry Pi Projection Mapping System

## Product Requirements Document (PRD)

**Project Name:** PhantomCast
**Status:** Planning
**Author:** macoso
**Created:** 2026-04-05
**Target:** Halloween 2026 (first deployment)

---

## 1. Vision

PhantomCast verwandelt einen Raspberry Pi 5 + Beamer in ein eigenständiges Projection-Mapping-System mit Web-UI. Content (Video, Animationen, Effekte) wird auf physische Objekte — Hausfassaden, Fenster, Türen — gemappt und in Echtzeit verzerrt. Kalibrierung und Steuerung erfolgen bequem über den Browser vom Handy oder Laptop.

---

## 2. Problem Statement

Projection Mapping ist normalerweise teuer (MadMapper: 349€, Resolume: 799€) und erfordert einen leistungsstarken PC. Für saisonale Anwendungen wie Halloween-Dekorationen oder Gartenpartys ist das überdimensioniert. Es gibt keine gute, kostenlose Lösung, die:
- Auf einem Raspberry Pi läuft
- Eine Web-UI zur Kalibrierung hat
- Einfach genug für Hobbyisten ist
- Headless im Dauerbetrieb funktioniert

---

## 3. Target Users

- Hobbyisten mit Halloween/Weihnachts-Dekoration
- Maker/DIY-Community
- Kleine Veranstaltungen (Gartenpartys, Vereinsfeste)
- Künstlerische Installationen im kleinen Maßstab

---

## 4. Core Features (MVP)

### 4.1 Quad Warp Mapping
- Mindestens 1 Oberfläche mit 4 Eckpunkten (Quad)
- Drag-and-Drop der Eckpunkte im Browser-UI
- Echtzeit-Vorschau der Verzerrung
- Homography-Berechnung auf dem Pi
- GPU-beschleunigte Darstellung via OpenGL ES / GStreamer

### 4.2 Web-basierte Kalibrierungs-UI
- React Frontend, erreichbar unter `http://phantomcast.local:8000`
- Live-Vorschau des Beamer-Outputs im Browser (MJPEG Stream)
- Draggable Control Points auf der Vorschau
- Speichern/Laden von Kalibrierungen (JSON)
- Responsive Design (Handy + Desktop)

### 4.3 Content Management
- Video-Dateien hochladen und verwalten (MP4, WebM)
- Abspielen in Schleife
- Playlist-Funktion (mehrere Videos rotieren)
- Start/Stop/Pause über Web-UI

### 4.4 Headless Betrieb
- Autostart bei Boot via systemd
- Letzte Kalibrierung wird automatisch geladen
- Kein Monitor/Tastatur nötig nach Setup
- Status-LED oder API-Endpoint für Health-Check

---

## 5. Extended Features (Post-MVP)

### 5.1 Multi-Surface Mapping
- Mehrere unabhängige Oberflächen (z.B. Tür + Fenster + Wand)
- Jede Oberfläche hat eigenen Content und eigene Kalibrierung
- Grid/Mesh Warp mit mehr als 4 Kontrollpunkten

### 5.2 Live-Quellen
- Pi Camera als Live-Quelle
- RTSP/Netzwerk-Streams
- Generierte Animationen (GLSL Shader)

### 5.3 Scheduling & Automation
- Zeitsteuerung: automatisch ein/aus zu bestimmten Uhrzeiten
- Kalender-Integration (z.B. "nur an Halloween-Woche")
- Helligkeitsanpassung basierend auf Umgebungslicht (optional, Sensor)

### 5.4 Content Library
- Vorinstallierte Halloween/Weihnachts-Effekte
- AtmosFX-kompatible Formate
- Einfache Textüberlagerungen

### 5.5 Multi-Projector
- Synchronisation mehrerer PhantomCast-Einheiten
- Edge Blending für überlappende Projektoren

---

## 6. Technical Architecture

### 6.1 System Overview

```
┌──────────────────────────────────────────┐
│              Raspberry Pi 5              │
│                                          │
│  ┌─────────────┐    ┌────────────────┐   │
│  │  FastAPI     │◄──►│  React Web UI  │   │
│  │  Backend     │    │  (port 8000)   │   │
│  │  /api/*      │    │                │   │
│  └──────┬───────┘    └────────────────┘   │
│         │                                 │
│  ┌──────▼───────┐                         │
│  │  Rendering   │    ┌────────────────┐   │
│  │  Engine      │───►│  HDMI Output   │──►│ Beamer
│  │  GStreamer +  │    │  (fullscreen)  │   │
│  │  OpenGL ES   │    └────────────────┘   │
│  └──────────────┘                         │
│                                           │
│  ┌──────────────┐                         │
│  │  Config      │  surfaces.json          │
│  │  Storage     │  playlists.json         │
│  └──────────────┘                         │
└──────────────────────────────────────────┘
         ▲
         │ WiFi / Ethernet
    ┌────┴─────┐
    │  Browser │  (Handy / Laptop)
    │  UI      │
    └──────────┘
```

### 6.2 Tech Stack

| Layer | Technologie | Begründung |
|-------|------------|------------|
| Backend | Python 3.12 + FastAPI | Gleiche Sprache wie hp_info_portal, async-fähig |
| Rendering | GStreamer + OpenGL ES | GPU-beschleunigt, Hardware-Decode, Shader-Warp |
| Warp-Berechnung | OpenCV (cv2.findHomography) | Bewährt, schnell, NumPy-kompatibel |
| Frontend | React + TypeScript + Vite | Gleicher Stack wie hp_info_portal |
| Warp-UI | Three.js oder PixiJS pixi-projection | GPU-beschleunigte Mesh-Darstellung im Browser |
| Preview-Stream | MJPEG über HTTP | Einfach, keine WebRTC-Komplexität, 5-10fps reicht |
| Config-Speicher | JSON-Dateien | Einfach, kein DB nötig |
| Prozess-Management | systemd | Standard Linux, Autostart |
| mDNS | avahi-daemon | phantomcast.local erreichbar |

### 6.3 API Endpoints

```
GET  /api/status              System-Status (uptime, aktive Oberfläche, FPS)
GET  /api/surfaces             Liste aller Oberflächen
POST /api/surfaces             Neue Oberfläche anlegen
PUT  /api/surfaces/{id}        Oberfläche aktualisieren (Control Points)
DEL  /api/surfaces/{id}        Oberfläche löschen

GET  /api/sources              Liste aller Content-Dateien
POST /api/sources/upload       Datei hochladen
DEL  /api/sources/{filename}   Datei löschen

POST /api/playback/start       Abspielen starten
POST /api/playback/stop        Abspielen stoppen
POST /api/playback/next        Nächstes Video in Playlist

GET  /api/preview.mjpeg        Live-Vorschau als MJPEG-Stream

GET  /api/config               Aktuelle Konfiguration
PUT  /api/config               Konfiguration aktualisieren
```

### 6.4 Data Model — surfaces.json

```json
{
  "version": 1,
  "output": {
    "resolution": [1920, 1080],
    "hdmi_port": 0,
    "fullscreen": true
  },
  "surfaces": [
    {
      "id": "facade_main",
      "name": "Hauswand",
      "enabled": true,
      "type": "quad",
      "source": "halloween_ghost.mp4",
      "loop": true,
      "src_points": [[0, 0], [1920, 0], [1920, 1080], [0, 1080]],
      "dst_points": [[210, 80], [890, 120], [850, 920], [190, 880]],
      "opacity": 1.0,
      "blend_mode": "normal"
    }
  ],
  "playlist": {
    "enabled": false,
    "interval_seconds": 30,
    "items": ["halloween_ghost.mp4", "pumpkin_face.mp4"]
  }
}
```

---

## 7. Hardware Requirements

### Minimum
| Komponente | Spezifikation | Vorhanden? |
|------------|--------------|------------|
| Raspberry Pi 5 | 8GB RAM | ✅ Ja |
| Active Cooler | Pi 5 Lüfter | ✅ Ja |
| MicroSD | 64GB A2 | ✅ Ja |
| USB-C Netzteil | 27W offiziell | ✅ Ja |
| Micro-HDMI Kabel | HDMI 2.0, 3m | ✅ Ja |
| Beamer | 3.000+ Lumen | ✅ Ja |

### Optional (Outdoor)
| Komponente | Spezifikation | Kosten |
|------------|--------------|--------|
| IP65 Gehäuse | Sixfab oder DIY | ~45€ |
| Verlängerungskabel | Outdoor, 10m | ~15€ |
| Projector-Mount | Wand-/Stativhalterung | ~30€ |

---

## 8. Beamer-Empfehlungen

| Modell | Lumen | Typ | Preis | Einsatz |
|--------|-------|-----|-------|---------|
| Optoma HD146X | 3.600 | DLP | ~400€ | Kleine Fassade, Nacht |
| BenQ LU710 | 4.000 | Laser | ~1.200€ | Mittlere Fassade |
| Epson EB-L200F | 4.500 | Laser | ~1.800€ | Große Fassade, Dämmerung |

Für Halloween-Nachtprojektionen reichen 3.000-4.000 Lumen auf einer hellen Hauswand (max. 3-4m breit bei 4-5m Abstand).

---

## 9. Risiken & Mitigationen

| Risiko | Impact | Mitigation |
|--------|--------|-----------|
| GPU-Performance Pi 5 nicht ausreichend | Hoch | 1080p statt 4K; GStreamer GPU-Pipeline; Map Club als Fallback |
| GStreamer + OpenGL ES Shader-Integration komplex | Mittel | Splash als Alternative Rendering Engine |
| Outdoor-Wetter (Regen, Kälte) | Mittel | IP65 Gehäuse; Beamer unter Dach/Vordach |
| Kalibrierung geht bei Projektorverschiebung verloren | Niedrig | Feste Montage; Quick-Recalibrate Button |
| Content-Erstellung aufwendig | Niedrig | AtmosFX kaufen; Community-Content |

---

## 10. Projektplan

### Phase 1 — Prototyp (2 Wochen)
- [ ] Pi 5 mit Beamer verbinden, Video fullscreen abspielen
- [ ] FastAPI Backend mit Surface CRUD + JSON Persistence
- [ ] OpenCV Quad-Warp: 4 Control Points → Homography → warpPerspective
- [ ] MJPEG Preview Stream Endpoint
- [ ] React UI mit draggable Control Points auf Canvas
- [ ] Erstes Mapping auf eine flache Oberfläche testen

### Phase 2 — GPU-Beschleunigung (1 Woche)
- [ ] GStreamer Pipeline mit OpenGL ES Shader für Warp
- [ ] Oder: Splash Integration als Rendering Backend
- [ ] 30+ FPS bei 1080p erreichen
- [ ] systemd Service für Autostart

### Phase 3 — Content & Polish (1 Woche)
- [ ] File Upload über Web-UI
- [ ] Playlist-Funktion
- [ ] Halloween-Content beschaffen (AtmosFX oder eigene)
- [ ] Outdoor-Test an Hauswand
- [ ] mDNS Setup (phantomcast.local)
- [ ] Mobile-optimiertes UI

### Phase 4 — Erweiterte Features (nach Halloween)
- [ ] Multi-Surface Support
- [ ] Grid/Mesh Warp (mehr als 4 Punkte)
- [ ] Live-Kamera Support
- [ ] Scheduling (zeitgesteuertes Ein/Aus)
- [ ] GLSL Shader-Effekte
- [ ] Multi-Projector Sync

---

## 11. Geklärte Fragen (Stand 2026-04-05)

1. **Beamer:** Vorhanden, 3.000+ Lumen, leistungsstark ✅
2. **Oberflächen:** Hauswand, Fenster, Garage, Innenraum — flexibel je nach Einsatz ✅
3. **Content:** AtmosFX Videos + eigene Inhalte ✅
4. **Budget:** Offen (Hardware vorhanden, Software-Fokus) ✅
5. **Micro-HDMI:** Vorhanden ✅
6. **Plattform:** Muss auf Raspberry Pi laufen (kein PC) ✅

---

## 12. Referenzen & Inspiration

- [Splash](https://splashmapper.xyz) — Open-Source, läuft auf Pi 5
- [Map Club](https://map.club) — Browser-basiert, kostenlos, sofort nutzbar
- [ofxPiMapper](https://ofxpimapper.com) — Klassiker für Pi (aber veraltet)
- [PocketVJ](https://projection-mapping.org/pocketvj/) — Pi + Web-Panel
- [AtmosFX](https://atmosfx.com) — Fertige Halloween/Weihnachts-Projektionsinhalte
- [Three.js Projection Mapping Tutorial (Codrops)](https://tympanus.net/codrops/2025/08/28/interactive-video-projection-mapping-with-three-js/)
- [SparkFun: Projection Mapping in Python](https://learn.sparkfun.com/tutorials/computer-vision-and-projection-mapping-in-python/all)
