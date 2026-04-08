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

Oriento ships with a production-ready Docker Compose file using pre-built images from GHCR.

**`docker-compose.prod.yml`**
```yaml
services:
  db:
    image: postgres:15-alpine
    container_name: orienteering_db_prod
    restart: always
    env_file:
      - ./db.env.prod
    volumes:
      - postgres_data_prod:/var/lib/postgresql/data

  backend:
    image: ghcr.io/athamour1/orientiring/backend:latest
    container_name: orienteering_backend_prod
    restart: always
    depends_on:
      - db
    ports:
      - "3000:3000"
    env_file:
      - ./backend/.env.prod

  frontend:
    image: ghcr.io/athamour1/orientiring/frontend:latest
    container_name: orienteering_frontend_prod
    restart: always
    ports:
      - "80:80"
    environment:
      - VITE_API_URL=https://your-domain.com

volumes:
  postgres_data_prod:
```

**`db.env.prod`**
```env
POSTGRES_USER=admin
POSTGRES_PASSWORD=CHANGE_ME_DB_PASS
POSTGRES_DB=orienteering
```

**`backend/.env.prod`**
```env
DATABASE_URL=postgresql://admin:CHANGE_ME_DB_PASS@db:5432/orienteering?schema=public
JWT_SECRET=CHANGE_ME_JWT_SECRET_MIN_32_CHARS
ADMIN_USERNAME=admin
ADMIN_PASSWORD=CHANGE_ME_ADMIN_PASS
CORS_ORIGIN=https://your-domain.com
FRONTEND_URL=https://your-domain.com
PORT=3000
```

Then deploy:
```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

> Place Nginx in front to handle HTTPS and proxy both port `80` (frontend) and `3000` (API).

---

## 🏗️ Architecture Notes

- **Cascade deletion** — Deleting an event wipes all associated teams, scans, checkpoints and GPS data.
- **Auto-activation** — A server-side cron job activates events automatically when `startTime` is reached.
- **Per-checkpoint bonuses** — First-scan bonuses are tracked and correctly reflected in leaderboard scores.
- **Hot-reload in Docker** — `CHOKIDAR_USEPOLLING=true` ensures Vite HMR works inside Docker volumes.

---

## 📄 License

MIT — see [LICENSE](LICENSE).
