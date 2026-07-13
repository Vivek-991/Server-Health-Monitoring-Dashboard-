<h1 align="center">🖥️ Server Health Monitoring Dashboard</h1>

<p align="center">
  A real-time server health monitoring dashboard that collects and visualizes live system metrics — CPU, RAM, Disk, Network, Temperature, and running Services — using a Node.js backend and a React frontend, connected over WebSockets.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=white" />
  <img src="https://img.shields.io/badge/Node.js-20-339933?style=for-the-badge&logo=node.js&logoColor=white" />
  <img src="https://img.shields.io/badge/Socket.IO-4-010101?style=for-the-badge&logo=socket.io&logoColor=white" />
  <img src="https://img.shields.io/badge/MongoDB-7-47A248?style=for-the-badge&logo=mongodb&logoColor=white" />
  <img src="https://img.shields.io/badge/Express-4-000000?style=for-the-badge&logo=express&logoColor=white" />
</p>

---

## 📸 Features

| Feature | Description |
|---|---|
| ⚡ Real-time Metrics | Live updates every **2 seconds** via Socket.IO |
| 🖥️ CPU Monitoring | Usage %, core count, clock speed, and model |
| 💾 RAM Monitoring | Total, used, free memory and usage percentage |
| 💿 Disk Monitoring | Per-partition usage with mount points |
| 🌐 Network Monitoring | RX/TX bytes and per-second bandwidth |
| 🌡️ Temperature | CPU core temperatures (where supported) |
| ⏱️ Uptime | System uptime in days/hours/minutes |
| 📊 Performance Charts | Historical line charts for CPU, RAM, Disk & Network |
| 🔧 Services | Live list of system services and their running status |
| 🗄️ Persistence | Snapshots stored in MongoDB, auto-purged after 24 hours |

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    Browser (React App)                   │
│  Dashboard → Charts → Cards → useMetrics() hook         │
│               ↕  Socket.IO client                        │
└──────────────────────────────────────────────────────────┘
                          │ WebSocket
┌──────────────────────────────────────────────────────────┐
│              Backend (Node.js / Express)                 │
│  server.js → Socket.IO → metricsSocket.js               │
│                 ↓ every 2 seconds                        │
│          systemMetrics.js (systeminformation)            │
│                 ↓ fire-and-forget                        │
│           MongoDB (MetricSnapshot model)                 │
└──────────────────────────────────────────────────────────┘
```

> **Key insight:** The backend reads metrics from the machine it runs on. Deploy it to a Linux VPS and it will show that server's real hardware stats.

---

## 📁 Project Structure

```
Server-Health-Monitoring-Dashboard-/
├── backend/
│   ├── src/
│   │   ├── config/         # MongoDB connection
│   │   ├── controllers/    # metricsController.js
│   │   ├── middlewares/    # errorHandler.js
│   │   ├── models/         # MetricSnapshot.js (Mongoose schema)
│   │   ├── routes/         # metricsRoutes.js
│   │   ├── services/       # systemMetrics.js (data collection)
│   │   ├── sockets/        # metricsSocket.js (Socket.IO broadcast)
│   │   └── utils/          # logger.js
│   ├── .env
│   ├── .gitignore
│   ├── package.json
│   └── server.js
│
└── frontend/
    ├── src/
    │   ├── api/            # Axios / API helpers
    │   ├── components/
    │   │   ├── cards/      # MetricCard, UptimeCard, ServicesCard,
    │   │   │               # TemperatureCard, SystemLoadCard
    │   │   ├── charts/     # CpuChart, RamChart, DiskChart, NetworkChart
    │   │   └── common/     # Navbar, Sidebar, Loader
    │   ├── context/        # MetricsContext (global state)
    │   ├── hooks/          # useMetrics.js
    │   ├── pages/          # Dashboard.jsx
    │   ├── styles/         # index.css, components.css, dashboard.css
    │   └── utils/          # formatters.js
    ├── .gitignore
    └── package.json
```

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [npm](https://www.npmjs.com/) v9+
- [MongoDB](https://www.mongodb.com/) (local) **or** a free [MongoDB Atlas](https://cloud.mongodb.com) cluster

---

### 1. Clone the Repository

```bash
git clone https://github.com/Vivek-991/Server-Health-Monitoring-Dashboard-.git
cd Server-Health-Monitoring-Dashboard-
```

---

### 2. Backend Setup

```bash
cd backend
npm install
```

Create a `.env` file in the `backend/` directory:

```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/serverhealth
NODE_ENV=development
CLIENT_URL=http://localhost:3000
```

> **Using MongoDB Atlas?** Replace `MONGO_URI` with your Atlas connection string:
> ```env
> MONGO_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/serverhealth
> ```

Start the backend:

```bash
# Development (auto-restart on changes)
npm run dev

# Production
npm start
```

The API will be available at `http://localhost:5000`.

---

### 3. Frontend Setup

```bash
cd ../frontend
npm install
npm start
```

Open **http://localhost:3000** in your browser. The dashboard will connect automatically via Socket.IO.

---

## ⚙️ Environment Variables

### Backend (`backend/.env`)

| Variable | Default | Description |
|---|---|---|
| `PORT` | `5000` | Port the Express server listens on |
| `MONGO_URI` | `mongodb://localhost:27017/serverhealth` | MongoDB connection string |
| `NODE_ENV` | `development` | Environment (`development` / `production`) |
| `CLIENT_URL` | `http://localhost:3000` | Allowed CORS origin for the frontend |

---

## 🌐 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Health ping — confirms API is running |
| `GET` | `/api/metrics/live` | Returns the latest metric snapshot (REST) |

### Real-time (Socket.IO)

| Event | Direction | Description |
|---|---|---|
| `metrics:update` | Server → Client | Emitted every 2 seconds with full snapshot |
| `metrics:error` | Server → Client | Emitted when metric collection fails |

---

## 🚢 Deploying to a Real Server

To monitor a real server (VPS / cloud instance), deploy the **backend** on that machine:

```bash
# On your Linux server
git clone https://github.com/Vivek-991/Server-Health-Monitoring-Dashboard-.git
cd Server-Health-Monitoring-Dashboard-/backend
npm install

# Install PM2 to keep the server alive
npm install -g pm2
pm2 start server.js --name health-backend
pm2 save && pm2 startup
```

Update `backend/.env`:
```env
CLIENT_URL=http://YOUR_SERVER_IP_OR_DOMAIN
NODE_ENV=production
```

Build and serve the frontend:
```bash
cd ../frontend
npm run build
npm install -g serve
serve -s build -l 80
```

The dashboard will now display your **VPS's** real CPU, RAM, disk, and service metrics.

---

## 🛠️ Tech Stack

### Backend
| Package | Purpose |
|---|---|
| `express` | HTTP server & REST API |
| `socket.io` | Real-time WebSocket broadcast |
| `mongoose` | MongoDB ODM |
| `systeminformation` | Cross-platform hardware metrics |
| `dotenv` | Environment variable management |
| `nodemon` | Development auto-restart |
| `winston` | Structured logging |

### Frontend
| Package | Purpose |
|---|---|
| `react` | UI library |
| `react-router-dom` | Client-side routing |
| `socket.io-client` | WebSocket connection to backend |
| `recharts` | Performance charts |
| `axios` | HTTP client |

---

## 🙋 Author

**Vivek Patel**  
📧 B.Tech — Minor Project, Semester 7  
🔗 [GitHub](https://github.com/Vivek-991)

---

## 📄 License

This project is licensed under the **ISC License**.
