# 📚 Library Management System (LMS)

A modern full-stack Library Management System featuring a FastAPI backend, PostgreSQL database, Redis caching, and a responsive React frontend with automated loan management and role-based access control (Librarian / Staff and Member portals).

---

## 🚀 Remote Deployment & Git Push Guide

### 1. Push Updated Version to Remote GitHub Repository

To sync your latest code and newly designed UI to your remote repository at `https://github.com/fizzaaliawan/LMS.git`:

```bash
# 1. Stage all new updates
git add .

# 2. Commit the changes
git commit -m "feat: updated modern library UI with side-by-side dashboard, illustrated book covers, and remote deployment configs"

# 3. Push to GitHub main branch
git push origin main
```

When you push to `main`, GitHub Actions in `.github/workflows/cd.yml` will automatically build the container images and publish them to GitHub Container Registry (`ghcr.io`).

---

### 2. Run Remotely on Cloud Server (AWS EC2 / VPS / DigitalOcean)

On your remote server (e.g. EC2 instance / VPS):

```bash
# 1. Clone your repository
git clone https://github.com/fizzaaliawan/LMS.git
cd LMS

# 2. Configure environment variables
cp .env.example .env
# Edit .env with your secrets if needed (nano .env)

# 3. Start all services in the background
docker compose -f docker-compose.prod.yml up -d --build
```

- **Frontend Application**: `http://<YOUR_SERVER_IP>:5173`
- **Backend API Docs**: `http://<YOUR_SERVER_IP>:8000/docs`

---

### 3. Access Remotely from Phone or Another Device on Local Network

To view the app on your mobile phone or another computer connected to the same Wi-Fi:

1. In `frontend/vite.config.js`, the dev server is configured with `host: "0.0.0.0"`.
2. Find your local IP address on Windows (`ipconfig` in Command Prompt, e.g. `192.168.1.15`).
3. Open `http://192.168.1.15:5173` in your phone or remote browser!

---

## 💻 Local Development

### Run Backend API & Database with Docker
```bash
docker compose up --build
```

### Run Frontend Locally
```bash
cd frontend
npm install
npm run dev
```

### Run CLI on Windows
```cmd
run-cli.cmd menu
run-cli.cmd list-books
```
