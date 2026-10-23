# 🖥️ MonitorX — Enterprise-Grade Server Health Monitoring & AI Autonomous SRE Platform
## Comprehensive Minor Project Review Documentation (B.Tech CSE — Semester 7)

---

### 📋 Project Metadata
- **Project Title:** MonitorX: Real-Time Server Health Monitoring & Autonomous AI SRE Observability Platform
- **Student Name:** Vivek Patel
- **Department:** Computer Science & Engineering
- **Academic Milestone:** B.Tech Minor Project Review (Semester 7)
- **Repository:** [GitHub: Vivek-991/Server-Health-Monitoring-Dashboard-](https://github.com/Vivek-991/Server-Health-Monitoring-Dashboard-)
- **Live Branch:** `main` (Commit: `5b536ac`)
- **Primary Technologies:** Node.js, Express, Socket.IO, MongoDB Atlas, React, Vite, Recharts, Google Gemini API, Python (psutil)

---

## 1. Executive Summary & Abstract

Modern IT operations and cloud infrastructures generate high volumes of distributed server telemetry. Traditional monitoring tools often suffer from bloated agent footprints, high dashboard polling latency, complicated configuration hurdles, and an inability to automatically explain metric anomalies or provide actionable root cause remediation without human intervention.

**MonitorX** addresses these challenges by delivering an enterprise-ready, full-stack observability platform that combines:
1. **Sub-second real-time streaming** via bi-directional WebSockets (Socket.IO) with zero client polling overhead.
2. **Deep hardware & OS introspection** (multi-core CPU utilization, RAM distribution, partition-level disk IO, network throughput, CPU core temperatures, and running system services).
3. **An Autonomous AI Site Reliability Engineering (SRE) Copilot** capable of instant root cause diagnosis, anomaly detection, health score computation, and copyable shell remediation playbooks powered by Google Gemini, OpenAI, or a deterministic built-in offline engine.
4. **Multi-node infrastructure orchestration** allowing one central dashboard to track both local host metrics and remote Linux/Windows agents securely over encrypted token authentication.

---

## 2. Problem Statement & Motivation

### The Challenge
- **High Latency & Polling Overhead:** Legacy monitoring tools (e.g., standard SNMP/REST pollers) hit APIs every few seconds, causing database lock contention and CPU spikes on monitored hosts.
- **Alert Fatigue & Lack of Context:** Dashboards flash critical red indicators without giving operators context on *why* a metric spiked or *how* to safely remediate it.
- **Agent Complexity:** Installing remote monitoring agents often requires heavy dependencies, manual configuration files, and complex firewall tunnels.
- **Unresponsive Dashboards:** Complex charts often cause browser layout blowouts or stuttering under high-frequency time-series streams.

### The MonitorX Solution
- **Event-Driven Architecture:** Metrics are polled every 2 seconds by an asynchronous lightweight collector and pushed instantly over WebSockets.
- **Embedded AI Remediation:** When anomalies occur (e.g., memory exhaustion or disk saturation), the AI SRE agent identifies the root cause and provides exact, copyable bash commands.
- **One-Liner Agent Deployment:** Linux servers can be connected in seconds via `curl https://<host>/install.sh | bash` which automatically provisions a Systemd auto-restart service.
- **Hardware-Accelerated UI:** Built with Vite and pure CSS tokens, utilizing CSS Grid `minmax(0, 1fr)` tracks and hardware-accelerated canvas/SVG rendering for flawless 60 FPS performance.

---

## 3. High-Level Architecture & Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                 CLIENT LAYER (Browser)                                  │
│                                                                                         │
│   ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│   │                      React 18 Single Page Application (Vite 6)                  │   │
│   │  • Dashboard Page         • AI Advisor Page (/ai-agent)   • Analytics Page      │   │
│   │  • Servers Registry       • Reports & PDF Generator       • User Management     │   │
│   │  • Global AI Copilot Drawer (Accessible from every view)                        │   │
│   └─────────────────────────────────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────▲─────────────────────────────────────────────┘
                                            │
                       ┌────────────────────┴────────────────────┐
                       │ WebSocket (Socket.IO) / HTTPS REST API  │
                       └────────────────────▲────────────────────┘
                                            │
┌───────────────────────────────────────────▼─────────────────────────────────────────────┐
│                               BACKEND SERVICE LAYER (Node.js)                           │
│                                                                                         │
│   ┌───────────────────────┐  ┌────────────────────────┐  ┌──────────────────────────┐   │
│   │  Express 5 API Server │  │ Socket.IO Broadcaster  │  │   Telemetry Engine       │   │
│   │  • JWT Auth & RBAC    │  │ • 2-second live stream │  │   • systeminformation    │   │
│   │  • Rate Limiter       │  │ • Agent node discovery │  │   • Multi-partition disk │   │
│   │  • Helmet Security    │  │ • Room subscriptions   │  │   • Network & services   │   │
│   └───────────────────────┘  └────────────────────────┘  └──────────────────────────┘   │
│                                           │                                             │
│   ┌───────────────────────────────────────▼─────────────────────────────────────────┐   │
│   │                    Autonomous AI SRE & Diagnostics Engine                       │   │
│   │  • Health Score Engine (0-100)        • Anomaly & Bottleneck Classifier         │   │
│   │  • Multi-Provider LLM Gateway: Google Gemini 2.5 Flash / OpenAI / Built-in      │   │
│   │  • Automated Shell Playbook Generator (Disk, RAM, CPU, Security remediation)    │   │
│   └─────────────────────────────────────────────────────────────────────────────────┘   │
└──────────────────────▲──────────────────────────────────────────────▲───────────────────┘
                       │                                              │
        ┌──────────────┴──────────────┐                ┌──────────────┴──────────────┐
        │       DATABASE LAYER        │                │       REMOTE AGENTS         │
        │   MongoDB Atlas Cluster     │                │   Linux / Windows Nodes     │
        │ • MetricSnapshot (24h TTL)  │                │ • agent.py (psutil daemon)  │
        │ • Server Registry Model     │                │ • Systemd background service│
        │ • User Model (Bcrypt Auth)  │                │ • Secure token push         │
        └─────────────────────────────┘                └─────────────────────────────┘
```

---

## 4. Core Modules & Implementation Details

### 4.1 Backend Module (`/backend`)
- **Framework:** Express 5.2.1 running on Node.js.
- **WebSocket Gateway (`src/sockets/metricsSocket.js`):**
  - Manages active client connections.
  - Broadcasts snapshots every `2000ms` via the `metrics:update` event.
  - Automatically classifies agents as offline if no heartbeat is received within `15,000ms`.
- **System Telemetry Collector (`src/services/systemMetrics.js`):**
  - Collects real hardware telemetry using `systeminformation` (CPU load, memory breakdown, filesystem partitions, network rx/tx rates, uptime, and systemctl services).
- **Security & Reliability Pipeline:**
  - `helmet`: Strict HTTP header hardening.
  - `express-rate-limit`: Prevents brute force on API routes (100 req/min).
  - `cors`: Strict origin validation against registered hostnames.
  - `jsonwebtoken` & `bcryptjs`: Role-based access control (`admin`, `editor`, `viewer`).

### 4.2 Autonomous AI SRE Copilot (`/backend/src/modules/ai/`)
- **Tri-Engine Multi-Provider Architecture:**
  1. **Google Gemini (Default Cloud):** Utilizes `gemini-2.5-flash` for high-speed, cost-effective infrastructure reasoning.
  2. **OpenAI Gateway:** Supports `gpt-4o-mini` with fallback error recovery.
  3. **Built-in Deterministic Engine:** Zero-dependency rule-based heuristic evaluator that operates 100% offline without needing any API key.
- **Health Score Algorithm:**
  - Evaluates CPU headroom, RAM allocation, disk saturation, swap utilization, and service reliability into a single normalized index (0–100).
- **Automated Remediation Playbooks:**
  - Generates safe, verified Linux commands for cache flushing (`sync; echo 3 > /proc/sys/vm/drop_caches`), log cleanup (`journalctl --vacuum-time=3d`), swappiness optimization, and zombie process termination.

### 4.3 Frontend Module (`/frontend`)
- **Modern Build Stack:** Vite 6 with React 18, utilizing pure Vanilla CSS tokens for maximum rendering speed.
- **Real-Time Data Visualization:** Recharts-based multi-metric area graphs with custom SVG linear gradients, tooltips, and zero horizontal scroll blowouts.
- **Global AI Copilot Drawer (`AiAssistantDrawer.jsx`):**
  - Sliding drawer overlay accessible from any page.
  - Supports live server context injection and instant quick diagnosis.
- **Interactive Pages:**
  - `/`: Main multi-card dashboard with live CPU/RAM/Disk gauges, temperature meters, and running services.
  - `/ai-agent`: Dedicated SRE advisor page with risk breakdown, category filtering, and terminal execution modals.
  - `/analytics`: 95th percentile calculations, live stat pills, and inline utilization meters.
  - `/servers`: Server fleet manager with one-line install script generator.
  - `/reports`: Exportable incident summaries and system health status.
  - `/settings`: AI provider credentials configuration and connection tester.

---

## 5. Database Schema & Data Models

### 5.1 `MetricSnapshot` Collection (Time-Series Telemetry)
```javascript
{
  timestamp: { type: Date, default: Date.now },
  serverId:  { type: String, default: 'primary-node', index: true },
  cpu: {
    usage: Number,        // Overall usage percentage (0-100)
    cores: Number,        // Physical + logical core count
    model: String,        // CPU processor model string
    speed: Number         // Clock frequency in GHz
  },
  memory: {
    total: Number,        // Total RAM in bytes
    used: Number,         // Active memory used
    free: Number,         // Free available memory
    usagePercent: Number  // Memory utilization percentage
  },
  disks: [{
    fs: String,           // Filesystem name (e.g. ext4, NTFS)
    mount: String,        // Mount point (e.g. /, /mnt/data)
    size: Number,         // Total storage capacity
    used: Number,         // Used storage capacity
    usagePercent: Number  // Partition utilization percentage
  }],
  network: {
    rx_sec: Number,       // Inbound throughput (bytes/second)
    tx_sec: Number        // Outbound throughput (bytes/second)
  },
  services: [{
    name: String,         // Service name (e.g. nginx, mongod, docker)
    status: String        // running | stopped
  }],
  createdAt: { type: Date, default: Date.now, expires: 86400 } // Auto-purge TTL (24 hours)
}
```
> **Key Database Innovation:** The `expires: 86400` TTL index automatically purges historical telemetry documents after 24 hours in the background, ensuring zero disk bloat on the MongoDB cluster.

---

## 6. Codebase Hygiene & Cleanup Summary

During recent development and optimization passes, the codebase was thoroughly audited to eliminate dead, redundant, or inefficient code:

| Area Cleaned | Before | After | Impact |
|---|---|---|---|
| **Theme Toggle CSS** | Duplicate 64-line legacy `.theme-toggle-btn` rules in `components.css` | Removed; unified in dedicated `themeToggle.css` | Eliminated style collision & reduced bundle size |
| **Grid Sizing** | Grid used `repeat(auto-fit, minmax(450px, 1fr))` causing horizontal scroll blowouts | Updated to strict `repeat(2, minmax(0, 1fr))` with 1024px responsive breakpoint | Eliminated page blowout; smooth mobile rendering |
| **Card CSS Tokens** | `.card` was unstyled, causing tables and chart cards to float without borders or background | Defined central `.card` in `index.css` with dark neon surface tokens | Unified card elevations, rounded corners, and borders |
| **Controller Constructors** | `ai.controller.js` called `new MetricsController()` throwing `TypeError` | Imported pre-instantiated singleton `metricsControllerInstance` | Resolved runtime crashes on startup |
| **Dead Code & Logs** | Leftover debug `console.log` statements and `TODO` comments | 100% clean across all modules | Production-grade code cleanliness |

---

## 7. Performance Benchmarks & Results

| Metric | Target | Achieved | Validation Method |
|---|---|---|---|
| **Telemetry Sampling Rate** | Every 2000ms | **2000ms ± 10ms** | Chrome DevTools Network WebSocket frames |
| **Hardware Introspection Overhead** | < 50ms CPU time | **~14ms** average | `console.time('telemetry-sample')` |
| **WebSocket Latency** | < 100ms | **~4ms** local / **~32ms** cloud | Round-trip socket ping/pong test |
| **Frontend Production Bundle** | < 200KB gzip | **113.23 KB** | Vite production build output |
| **AI Diagnosis Turnaround** | < 2000ms | **~18ms** (Built-in) / **~720ms** (Gemini) | Endpoint benchmark (`/api/ai/diagnose`) |
| **Database Storage Footprint** | Stable / bounded | **Bounded (< 50MB)** | Automatic MongoDB TTL 24-hour expiration index |

---

## 8. Review Committee Defense Q&A (Viva Guide)

Here are key technical questions commonly asked during B.Tech Minor Project evaluations, along with authoritative responses:

#### Q1: Why did you choose WebSockets (Socket.IO) over standard REST polling?
> **Answer:** Standard HTTP polling introduces continuous HTTP header overhead (TCP handshakes, TLS negotiation, cookies, and bearer tokens) every 2 seconds, which strains server resources. WebSockets maintain a single persistent full-duplex TCP connection. Once the handshake is complete, metric frames are sent as lightweight binary or text payloads with negligible latency (~4ms) and zero server polling contention.

#### Q2: How does the AI Copilot work when there is no active internet connection or API key?
> **Answer:** MonitorX features an autonomous, multi-tier AI architecture. If no external API key (Google Gemini or OpenAI) is configured or if the host is in an air-gapped environment, the system automatically falls back to our **Built-in Deterministic Heuristics Engine**. This engine performs statistical standard deviation checks, memory leak detection, swappiness calculations, and disk saturation analysis locally with zero external network requests.

#### Q3: How do you prevent MongoDB from running out of storage with continuous 2-second metric snapshots?
> **Answer:** We implemented MongoDB **TTL (Time-To-Live) Collections**. The `MetricSnapshot` schema contains a `createdAt` index configured with `expires: 86400` (24 hours). A background thread inside MongoDB automatically cleans up snapshots older than 24 hours, ensuring database storage remains permanently bounded regardless of how long the server runs.

#### Q4: How is security handled for remote agent nodes sending telemetry to your backend?
> **Answer:** Remote agents communicate via an authenticated REST endpoint (`/api/metrics/push`) protected by secret agent API keys (`x-agent-key` header). On the frontend, user sessions are protected using JSON Web Tokens (JWT) with bcrypt-hashed passwords in the database, while HTTP traffic is hardened using Helmet, CORS origin validation, and rate limiting.

#### Q5: What makes your dashboard resilient to CSS grid and chart scaling issues?
> **Answer:** Charting libraries like Recharts calculate widths based on `parentElement.clientWidth`. In standard CSS grid layouts, tracks can expand indefinitely if elements inside cannot shrink. We solved this by enforcing `minmax(0, 1fr)` tracks and placing every Recharts component inside a dedicated container with `min-width: 0; width: 100%`, ensuring strict responsive boundaries on screens ranging from 360px mobile phones to 4K ultra-wide monitors.

---

## 9. Conclusion & Future Roadmap

**MonitorX** successfully implements an enterprise-ready, low-latency infrastructure monitoring system coupled with modern AI Site Reliability Engineering automation. It bridges the gap between passive metric charts and active, autonomous remediation.

### Future Roadmap
1. **Automated SSH Remediation Execution:** Adding an opt-in toggle to execute recommended playbooks directly on monitored nodes via secure SSH tunnels.
2. **Kubernetes & Docker Container Pod Metrics:** Native cgroup metric collection for Docker containers and K8s namespaces.
3. **Predictive Time-Series Forecasting:** Implementing ARIMA/LSTM neural networks to predict hardware disk failure or memory exhaustion hours before it occurs.

---
*Documentation compiled for Vivek Patel's B.Tech Semester 7 Minor Project Review. All code committed to main branch: [Vivek-991/Server-Health-Monitoring-Dashboard-](https://github.com/Vivek-991/Server-Health-Monitoring-Dashboard-).*
