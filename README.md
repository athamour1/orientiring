# 🧭 Oriento

**Oriento** is an open-source orienteering and scavenger hunt management platform built for the modern web. Administrators design, launch and monitor live geospatial scavenger hunts while teams use a native-feeling Progressive Web App to navigate maps, scan QR checkpoints and compete on live leaderboards.

🌐 **[Live Landing Page](https://athamour1.github.io/orientiring/)** &nbsp;|&nbsp; ⭐ **[GitHub](https://github.com/athamour1/orientiring)**

---

## ✨ Features

- **🗺️ Interactive Team Maps** — Real-time Leaflet map with checkpoints, GPS dot, multiple tile layers (street, topo, satellite) and a return-point flag on completion.
- **📸 QR Checkpoint Scanning** — Continuous camera scanning validates checkpoints instantly. Admins download and print all QRs in one click.
- **🏆 Live Leaderboards** — Scores update the moment a team scans via WebSockets. Share a public link with spectators — no login required.
- **📍 Real-time GPS Tracking** — Admin map shows all team positions live with route history and a filterable activity feed.
- **⏱️ Event Timer** — Set start/end times. Events auto-activate at start time, scans are rejected after end time, and a countdown is shown to all teams.
- **🥇 Bonus Point System** — Award extra points to the first team to scan each checkpoint and to the first team to finish the entire hunt.
- **📱 Progressive Web App (PWA)** — Installable directly to home screens on iOS and Android. No app store required.
- **🌗 Dark Mode & i18n** — Full dark mode. Built-in English and Greek localization with per-event language preference for teams.
- **👑 Admin Dashboard** — Create events, manage teams, drag checkpoint markers on a map, view live activity feeds and checkpoint progression all from one place.

---

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| Frontend | Vue 3 + Quasar Framework (Vite) |
| Backend | NestJS (TypeScript) |
| Database | PostgreSQL 15 |
| ORM | Prisma |
| Real-time | Socket.IO |
| Maps | Leaflet |
| Infrastructure | Docker + Docker Compose |

---

## 🚀 Getting Started

The fastest way to boot the stack locally is Docker Compose.

### Prerequisites
- [Docker](https://docs.docker.com/engine/install/) & Docker Compose

### Setup

```bash
# 1. Clone
git clone https://github.com/athamour1/orientiring.git
cd orientiring

# 2. Start everything
docker compose up --build
```

This provisions PostgreSQL, applies Prisma migrations, seeds initial data and boots both the NestJS API and Quasar PWA dev server.

### Access

| Service | URL |
|---|---|
| Frontend (PWA) | http://localhost:9000 |
| Backend API | http://localhost:3000 |

**Default admin credentials:** `admin` / `admin123`

---

## 🚢 Production Deployment

Oriento is designed for Docker-based production deployments.

1. Copy and configure `docker-compose.prod.yml` with your `JWT_SECRET` and `CORS_ORIGIN`.
2. Build production images and push to your registry (e.g. GHCR).
3. Deploy behind an Nginx reverse proxy on your VPS.

---

## 🏗️ Architecture Notes

- **Cascade deletion** — Deleting an event wipes all associated teams, scans, checkpoints and GPS data.
- **Auto-activation** — A server-side cron job activates events automatically when `startTime` is reached.
- **Per-checkpoint bonuses** — First-scan bonuses are tracked and correctly reflected in leaderboard scores.
- **Hot-reload in Docker** — `CHOKIDAR_USEPOLLING=true` ensures Vite HMR works inside Docker volumes.

---

## 📄 License

MIT — see [LICENSE](LICENSE).
