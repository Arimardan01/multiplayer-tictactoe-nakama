# 🎮 Multiplayer Tic-Tac-Toe with Nakama

A production-ready, multiplayer Tic-Tac-Toe game with **server-authoritative architecture** using [Nakama](https://heroiclabs.com/nakama/) as the backend infrastructure.

![React](https://img.shields.io/badge/React-18-61DAFB?style=flat&logo=react)
![Nakama](https://img.shields.io/badge/Nakama-3.22.0-blueviolet?style=flat)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat&logo=docker)
![TypeScript](https://img.shields.io/badge/TypeScript-Server-3178C6?style=flat&logo=typescript)

---

## 📋 Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Setup & Installation](#setup--installation)
- [Running Locally](#running-locally)
- [How to Test Multiplayer](#how-to-test-multiplayer)
- [Project Structure](#project-structure)
- [API/Server Configuration](#apiserver-configuration)
- [Design Decisions](#design-decisions)
- [Deployment](#deployment)

---

## ✨ Features

### Core
- **Server-Authoritative Game Logic** — All game state managed server-side; every move is validated before being applied
- **Anti-Cheat** — Clients cannot manipulate game state; server rejects invalid moves
- **Real-time Multiplayer** — WebSocket-based game state synchronization via Nakama
- **Matchmaking System** — Find or create matches with automatic pairing
- **Responsive Mobile-First UI** — Optimized for mobile devices with premium dark theme

### Bonus Features
- **🏆 Leaderboard System** — Global rankings with W/L/D stats, win streaks, and cumulative scores
- **⏱️ Timer-Based Mode** — 30-second turn timers with automatic forfeit on timeout
- **🔄 Concurrent Games** — Multiple isolated game sessions running simultaneously
- **📱 Dynamic Matching** — Mode-based matchmaking (Classic vs Timed)

---

## 🏗️ Architecture

```
┌─────────────────────────────────┐
│         React Frontend          │
│   (Vite + @heroiclabs/nakama-js)│
│         Port 3000               │
└──────────┬──────────────────────┘
           │ WebSocket / HTTP
           ▼
┌─────────────────────────────────┐
│        Nakama Server            │
│  (TypeScript Runtime Modules)   │
│  gRPC: 7349 | HTTP: 7350       │
│  Console: 7351                  │
└──────────┬──────────────────────┘
           │
           ▼
┌─────────────────────────────────┐
│        PostgreSQL 16            │
│       Port 5432                 │
└─────────────────────────────────┘
```

### Server-Authoritative Flow

1. Client sends a MOVE opcode with desired position
2. Server validates: correct player's turn, cell is empty, game is active
3. Server applies the move and checks win/draw conditions
4. Server broadcasts the validated state to ALL connected clients
5. On game end, server updates player stats and leaderboard

---

## 🛠️ Tech Stack

| Component | Technology |
|-----------|-----------|
| Frontend | React 18, Vite 5, Vanilla CSS |
| Backend Runtime | Nakama 3.22.0 (TypeScript) |
| Database | PostgreSQL 16 |
| Real-time | Nakama WebSocket API |
| Client SDK | @heroiclabs/nakama-js |
| Infrastructure | Docker Compose |
| Typography | Outfit (Google Fonts) |

---

## 🚀 Setup & Installation

### Prerequisites

- **Docker Desktop** (v20+) with Docker Compose
- **Node.js** (v18+) and npm
- **Git**

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd tic-tac-toe
```

### 2. Start the Backend (Nakama + PostgreSQL)

```bash
docker compose up --build -d
```

This will:
- Start PostgreSQL on port 5432
- Build the TypeScript server modules
- Start Nakama on ports 7349 (gRPC), 7350 (HTTP), 7351 (Console)
- Run database migrations automatically

**Verify Nakama is running:**
- Nakama Console: [http://localhost:7351](http://localhost:7351) (default credentials: `admin`/`password`)
- Nakama API: [http://localhost:7350](http://localhost:7350)

### 3. Start the Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend will be available at [http://localhost:3000](http://localhost:3000).

---

## 🎮 How to Test Multiplayer

### Option 1: Two Browser Tabs
1. Open `http://localhost:3000` in **Tab 1**
2. Open `http://localhost:3000` in **Tab 2** (or use Incognito)
3. Enter different nicknames in each tab
4. Click "Find Match" in both tabs (same mode)
5. Play the game!

### Option 2: Two Devices on Same Network
1. Find your machine's local IP (e.g., `192.168.1.100`)
2. Open `http://192.168.1.100:3000` on both devices
3. Enter different nicknames and find a match

### Testing Timer Mode
1. Select "Timed" mode in both clients
2. Once matched, observe the 30-second countdown
3. Let the timer expire to see automatic forfeit

---

## 📁 Project Structure

```
tic-tac-toe/
├── docker-compose.yml          # Docker services config
├── README.md
├── .gitignore
│
├── nakama/                     # Server-side code
│   ├── Dockerfile              # Multi-stage build for TS compilation
│   ├── package.json
│   ├── tsconfig.json
│   ├── local.yml               # Nakama server configuration
│   └── src/
│       ├── messages.ts          # Shared types, enums, interfaces
│       ├── match_handler.ts     # Server-authoritative game logic
│       ├── match_rpc.ts         # RPC: find_match, get_leaderboard
│       └── main.ts              # InitModule entry point
│
└── frontend/                   # Client-side code
    ├── package.json
    ├── vite.config.js
    ├── index.html
    └── src/
        ├── main.jsx
        ├── App.jsx              # Main app with state management
        ├── index.css            # Design system & responsive styles
        ├── nakamaClient.js      # Nakama client configuration
        └── components/
            ├── NicknameModal.jsx
            ├── Matchmaking.jsx
            ├── GameBoard.jsx
            ├── GameResult.jsx
            └── Leaderboard.jsx
```

---

## ⚙️ API/Server Configuration

### Nakama Configuration (`nakama/local.yml`)

| Setting | Value | Description |
|---------|-------|-------------|
| `runtime.js_entrypoint` | `build/index.js` | Compiled TypeScript module |
| `session.token_expiry_sec` | 7200 | Session tokens last 2 hours |
| `logger.level` | DEBUG | Log level for development |

### RPC Endpoints

| RPC ID | Description | Payload |
|--------|-------------|---------|
| `find_match` | Find or create a match | `{"fast": boolean}` |
| `get_leaderboard` | Get global leaderboard | `{}` |

### Match OpCodes

| Code | Name | Direction | Description |
|------|------|-----------|-------------|
| 1 | START | Server → Client | Game started with board & player info |
| 2 | UPDATE | Server → Client | Board state update after valid move |
| 3 | DONE | Server → Client | Game over with winner info |
| 4 | MOVE | Client → Server | Player's move (position 0-8) |
| 5 | REJECTED | Server → Client | Invalid move rejected |
| 6 | OPPONENT_LEFT | Server → Client | Opponent disconnected |

### Ports

| Port | Service | Description |
|------|---------|-------------|
| 3000 | Frontend | Vite dev server |
| 7349 | Nakama gRPC | gRPC API |
| 7350 | Nakama HTTP | REST API + WebSocket |
| 7351 | Nakama Console | Admin dashboard |
| 5432 | PostgreSQL | Database |

---

## 🎨 Design Decisions

1. **Server-Authoritative Architecture**: All game logic runs on the Nakama server to prevent cheating. Clients are "dumb terminals" that only send move intents and render validated state.

2. **RPC-based Matchmaking**: Uses `nk.matchList()` to find open matches with label-based filtering (mode), falling back to `nk.matchCreate()` when none exist. This is simpler and more reliable than the matchmaker queue for 1v1 games.

3. **TypeScript Runtime**: Chosen over Go/Lua for type safety and easier development. Compiled to a single JS bundle loaded by Nakama's JavaScript VM.

4. **Storage-backed Stats**: Player W/L/D stats stored separately in Nakama storage (public read, server-only write) alongside the leaderboard for richer data display.

5. **Mobile-First Design**: CSS uses a max-width container (420px) with responsive breakpoints, touch-friendly button sizes, and viewport-locked scaling for mobile play.

6. **Tick-based Timers**: Turn timers use Nakama's match loop tick rate (5 ticks/second) for precise server-side countdown, ensuring clients cannot manipulate time.

---

## 🚢 Deployment

> *Deployment instructions will be added later.*

### Quick Notes for Future Deployment
- **Nakama**: Deploy to AWS/GCP/Azure using Docker or Kubernetes
- **Frontend**: Deploy to Vercel, Netlify, or any static hosting
- **Update** `nakamaClient.js` with production server URL
- **Configure** SSL/TLS for production WebSocket connections

---

## 📄 License

MIT
