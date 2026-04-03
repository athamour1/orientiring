# 🧭 Oriento

**Oriento** is a comprehensive, open-source Orienteering and Scavenger Hunt management platform built for the modern web. It enables game administrators to seamlessly design, launch, and monitor live geospatial scavenger hunts while providing participating teams with a native-feeling Progressive Web App (PWA) to navigate maps, scan QR codes, and compete on live leaderboards.

![Oriento Banner](./frontend/public/icons/favicon-128x128.png) <!-- Update with a real banner if available! -->

## ✨ Features

- **🗺️ Interactive Team Navigation**: Real-time Leaflet map integration displaying custom boundaries and active checkpoints.
- **📸 Built-in QR Scanner**: Seamless device camera API utilizing context-aware scanning capabilities for checkpoint validation.
- **🏆 Live Leaderboards**: Real-time score aggregation, visible both privately to teams and securely via dynamic public share links.
- **📱 Progressive Web App (PWA)**: Installable directly to user home screens natively on iOS/Android, equipped with offline service worker infrastructure.
- **🌍 Internationalization (i18n)**: Out-of-the-box native localization support for both **English** (en-US) and **Greek** (el).
- **🌗 Dark Mode Compatibility**: Fluid UI rendering that beautifully adapts across the entire application interface to match user system presets.
- **👑 Admin Orchestration**: Full event management dashboard supporting draft planning, draft launches, team password-generation, and full live telemetry monitoring of all active teams.

---

## 🛠️ Technology Stack

- **Frontend**: [Vue 3](https://vuejs.org/) + [Quasar Framework](https://quasar.dev/) (Vite)
- **Backend**: [NestJS](https://nestjs.com/) (Express/TypeScript)
- **Database**: [PostgreSQL 15](https://www.postgresql.org/)
- **ORM**: [Prisma](https://www.prisma.io/)
- **Infrastructure**: Fully Dockerized & ready for GitHub Container Registry (GHCR) deployments.

---

## 🚀 Getting Started (Local Development)

The fastest way to boot the ecosystem locally is using Docker Compose.

### Prerequisites
- [Docker](https://docs.docker.com/engine/install/) & Docker Compose
- Node.js `22.x` (if venturing outside the container wrapper)

### Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/oriento.git
   cd oriento
   ```

2. **Spin up the environment:**
   ```bash
   docker compose up --build
   ```
   *This command provisions the PostgreSQL database, applies Prisma migrations, injects initial seed data, and boots both the NestJS server and Quasar dev environments.*

3. **Access the application:**
   - **Frontend (PWA Mode):** [http://localhost:9000](http://localhost:9000)
   - **Backend API:** [http://localhost:3000](http://localhost:3000)

**Default Admin Credentials:**
- **Username:** `admin`
- **Password:** `admin123`

---

## 🚢 Production Deployment

Oriento is designed for scalable production deployment using modern container registries like GHCR. 

1. Ensure the `docker-compose.prod.yml` file is configured with your secure `JWT_SECRET` and appropriate domain `CORS_ORIGIN`.
2. Generate optimized production images via Docker build commands referencing the internal `Dockerfile` mappings for both Frontend and Backend.
3. Deploy securely to your VPS utilizing Nginx for reverse-proxy routing.

*See [`ghcr_deployment_guide.md`](./ghcr_deployment_guide.md) (if present) for granular step-by-step CI/CD pipeline strategies.*

---

## 🏗️ Architecture Nuances

- **Database Cascade Deletion**: Deleting an Event natively propagates a hard cascade wipe to the PostgreSQL cluster—successfully destroying all associated temporary teams, logs, scans, and telemetry dots attached to that hunt ID to ensure completely sanitized game resets.
- **Install Prompt State Tracking**: The platform natively tracks and persists manual dismissals of the PWA install prompt utilizing localized `sessionStorage`, guaranteeing players and audiences are not spammed.
- **Hot-Reloading Over Docker**: The `CHOKIDAR_USEPOLLING=true` flag is explicitly forced through the Dev Compose build to ensure Vite hot-reloading smoothly penetrates Docker volume limits.

---

## 📄 License
This project is completely open source and available under the [MIT License](LICENSE).
