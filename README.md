# HiveSandbox — Developer Playground  🧱

**Phase 1**: A beautiful web GUI for spinning up isolated microVMs, built on [microsandbox](https://github.com/superradcompany/microsandbox).

![stack](https://img.shields.io/badge/backend-FastAPI-009688?logo=fastapi)
![stack](https://img.shields.io/badge/frontend-Next.js-000000?logo=nextdotjs)
![stack](https://img.shields.io/badge/terminal-xterm.js-000000)
![stack](https://img.shields.io/badge/engine-microsandbox-22c55e)

---

## What is this?

HiveSandbox wraps the `microsandbox` CLI in a polished, Apple-Studio-quality dashboard so you can:

- **Create microVMs** with a click — pick Alpine or Ubuntu, dial in RAM & CPU.
- **Interact via a web terminal** — xterm.js connects to your VM over WebSockets.
- **Manage from a slick sidebar** — green "Running" dots, one-click select, real-time polling.

No config files. No CLI memorization. Just spin up sandboxes and get to work.

---

## Architecture

```
┌──────────────────────┐      WebSocket       ┌──────────────────────┐
│   Next.js Frontend   │ ◄──────────────────► │   FastAPI Backend    │
│   (xterm.js)         │   /api/vms/{id}/     │   (Python)           │
│   (shadcn/ui style)  │      terminal        │                      │
└──────────┬───────────┘                      └──────────┬───────────┘
           │  REST (JSON)                                │  subprocess
           │  GET/POST /api/vms                          │  msb run|exec|stop
           ▼                                             ▼
┌──────────────────────────────────────────────────────────────────────┐
│                        microsandbox CLI (msb)                         │
│                  microVMs with KVM / Apple Hypervisor                 │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Quick Start

### Prerequisites

| Tool | Why | Install |
|------|-----|---------|
| **microsandbox** | VM engine | `curl -fsSL https://install.microsandbox.dev \| sh` |
| **Python 3.10+** | Backend | `apt install python3` or from python.org |
| **Node.js 18+** | Frontend | `nvm install 18` or from nodejs.org |
| **KVM** | Virtualization | `sudo usermod -aG kvm $USER` then re-login |

> **⚠️ Requires Linux with KVM enabled, or macOS with Apple Silicon.**
> If you get `SIGABRT` errors, your user is not in the `kvm` group — run the KVM command above.
./start.sh
```

Opens the backend at **http://localhost:8000** and the frontend at **http://localhost:3000**.

### Manual launch

**Backend:**

```bash
cd api
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

**Frontend:**

```bash
cd frontend
npm install
npm run dev
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Liveness check + msb version |
| `GET` | `/api/vms` | List all sandboxes |
| `POST` | `/api/vms/create` | Create a sandbox `{ distro, ram_mb, cpu_cores }` |
| `POST` | `/api/vms/{id}/start` | Start a stopped sandbox |
| `POST` | `/api/vms/{id}/stop` | Stop a sandbox |
| `WS` | `/api/vms/{id}/terminal` | Bidirectional PTY terminal |
---

## Project Structure

```
hivesandbox/
├── api/
│   ├── main.py              # FastAPI server (all endpoints + WS)
│   ├── requirements.txt     # Python dependencies
│   └── venv/                # (created by start.sh)
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── globals.css  # Dark theme + Tailwind
│   │   │   ├── layout.tsx   # Root layout (Geist fonts, metadata)
│   │   │   └── page.tsx     # Dashboard (sidebar + terminal + modal)
│   │   ├── components/
│   │   │   ├── Sidebar.tsx       # VM list with status indicators
│   │   │   ├── CreateVMModal.tsx # Distro, RAM, CPU picker
│   │   │   └── Terminal.tsx      # xterm.js WebSocket terminal
│   │   └── lib/
│   │       ├── api.ts       # REST + WebSocket helpers
│   │       └── types.ts     # TypeScript interfaces
│   ├── .env.local           # NEXT_PUBLIC_API_URL
│   └── package.json
├── start.sh                 # One-command launcher
└── README.md
```

---

## Roadmap

| Phase | What | Status |
|-------|------|--------|
| **1** | Web GUI + terminal + VM CRUD | ✅ **Done** |
| 2 | Snapshots & restore | 🔜 Planned |
| 3 | AI agent interop & communication | 🔜 Planned |

---

## Contributing

This is an open-source project. We welcome contributions!

1. Fork the repo.
2. Create a feature branch.
3. Keep the code modular, typed, and well-commented.
4. Open a PR with a clear description.

### Design principles

- **Launch early.** Ship useful things fast.
- **Apple/Google quality UI.** Dark mode, smooth animations, thoughtful spacing.
- **Boring where it counts.** No over-engineering. Python + shell, not a microservice mesh.
- **Community-first.** Every file is self-explanatory.

---

## License

Apache 2.0 — same as microsandbox.
