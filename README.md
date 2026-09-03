# 📚 Library Management System (LMS)

[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.111+-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18+-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://reactjs.org)
[![Vite](https://img.shields.io/badge/Vite-5+-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com)

A modern, production-grade **Library Management System** featuring a high-performance **FastAPI** backend with layered architecture, **PostgreSQL** relational database, **Redis** caching, automated background jobs, and a responsive **React** frontend with dual role-based portals (Librarian / Staff & Member).

---

## ✨ Key Features & Highlights

### 🎨 Modern & Responsive Frontend (React + Vite)
- **Side-by-Side Dashboard Layout**: "Recommended for You" and "Quick Actions" side by side in a clean 2-column grid.
- **Illustrated Vector Book Covers**: Procedural & handcrafted SVG artwork with 1:1.48 portrait book proportions (*Dune, Foundation, Neuromancer, 1984, Sapiens*, and dynamic procedural genres).
- **Dual Role-Based Portals**:
  - **Member Portal**: Search & filter catalog, self-reserve books, active loans tracker, reading history, and saved favorites.
  - **Staff / Librarian Portal**: Complete catalog management (Add/Remove books), member registry, circulation control, active loan returns, and automated overdue reports.
- **Centered Modal Dialogs**: Full-screen backdrop dialogs for book details, active loans, borrowing history, and favorites.
- **Real-Time Live Notifications**: Server-Sent Events (SSE) notification bell for overdue alerts and return confirmations.
- **Curated Design Palette**: Warm Cream (`#f7f3ea`), Navy (`#0b1a30`), clean white cards, and `Plus Jakarta Sans` typography.

### ⚙️ Backend Architecture (FastAPI & Python 3.11+)
- **Layered Clean Architecture**:
  - `app/api/routes/`: REST endpoints for `auth`, `books`, `loans`, `members`, `notifications`, `sse`, and `jobs`.
  - `app/models/`: SQLAlchemy 2.0 ORM models (`User`, `Book`, `Member`, `Loan`, `Notification`).
  - `app/repositories/`: Clean Repository pattern for database queries.
  - `app/services/`: Business logic layer with Redis caching.
  - `app/core/security.py`: JWT authentication with bcrypt password hashing.
  - `app/jobs.py`: Background job runner for automated overdue tracking.
- **Database Migrations**: Alembic schema versioning with PostgreSQL 16.
- **CLI Management**: Interactive and standalone Windows CLI (`run-cli.cmd`).

---

## 📁 Repository Structure

```
LMS/
├── backend/                  # FastAPI backend application
│   ├── app/
│   │   ├── api/              # API routes, auth dependencies, and schemas
│   │   ├── config/           # App configuration & environment settings
│   │   ├── core/             # JWT security & encryption
│   │   ├── database/         # DB engine & session management
│   │   ├── models/           # SQLAlchemy ORM models
│   │   ├── repositories/     # Database repository layer
│   │   ├── services/         # Business logic layer
│   │   ├── utils/            # Redis cache & SSE managers
│   │   ├── jobs.py           # Background scheduler & overdue jobs
│   │   └── main.py           # CLI application entrypoint
│   ├── tests/                # Automated pytest suite
│   ├── Dockerfile            # Backend container definition
│   └── pyproject.toml        # Dependencies and project metadata
├── database/                 # Database migrations & alembic config
│   ├── migrations/           # Alembic migration versions
│   └── alembic.ini           # Alembic configuration
├── frontend/                 # React 18 + Vite frontend
│   ├── src/
│   │   ├── components/       # Catalog, Login, NotificationBell
│   │   ├── api.js            # API client with auto host discovery
│   │   ├── App.jsx           # Main application root
│   │   └── index.css         # Design system & utility classes
│   ├── Dockerfile            # Frontend container definition
│   └── vite.config.js        # Vite config (host: 0.0.0.0 for remote access)
├── .github/workflows/        # CI/CD pipelines (ci.yml, cd.yml)
├── docker-compose.yml        # Local development multi-container orchestration
├── docker-compose.prod.yml   # Production container orchestration with GHCR
├── run-cli.cmd               # Windows CLI launcher
└── README.md                 # Project documentation
```

---

## 🚀 Quickstart & Local Development

### Prerequisites
- [Docker & Docker Compose](https://www.docker.com/) OR
- [Python 3.11+](https://www.python.org/) and [Node.js 20+](https://nodejs.org/)

### 1. Run Everything with Docker Compose (Recommended)
```bash
# Start PostgreSQL, Redis, Backend API, and Frontend in one command
docker compose up --build
```
- **Frontend**: [http://localhost:5173](http://localhost:5173)
- **API Documentation (Swagger)**: [http://localhost:8000/docs](http://localhost:8000/docs)

---

### 2. Run Manually (Local Dev)

#### A. Backend
```bash
cd backend
# Create virtual environment and install dependencies
uv sync || pip install -e .
# Start FastAPI backend
uvicorn app.api.main:app --host 0.0.0.0 --port 8000 --reload
```

#### B. Frontend
```bash
cd frontend
npm install
npm run dev
```

#### C. Windows CLI
```cmd
# Launch interactive menu
run-cli.cmd menu

# Standalone commands
run-cli.cmd list-books
run-cli.cmd add-book --title "Dune" --author "Frank Herbert" --isbn 9780441013593
```

---

## 🌐 Remote Deployment & Cloud Setup

### 1. Deploy on Remote Cloud Server (AWS EC2 / VPS / DigitalOcean)

On your remote server:
```bash
# 1. Clone repository
git clone https://github.com/fizzaaliawan/LMS.git
cd LMS

# 2. Setup environment configuration
cp .env.example .env
# Edit .env with your secrets if needed (nano .env)

# 3. Launch production containers
docker compose -f docker-compose.prod.yml up -d --build
```
- **Live App**: `http://<YOUR_SERVER_IP>:5173`
- **Live API**: `http://<YOUR_SERVER_IP>:8000/docs`

---

### 2. Mobile & LAN Access

The frontend is pre-configured with `host: "0.0.0.0"`.
1. Find your machine's local IP address (`ipconfig` on Windows, e.g. `192.168.1.15`).
2. Open `http://192.168.1.15:5173` in any mobile phone, tablet, or laptop connected to the same Wi-Fi.

---

## 🧪 Testing

Run backend test suite with pytest:
```bash
cd backend
pytest
```

---

## 📜 License
This project is open-source and available under the [MIT License](LICENSE).
