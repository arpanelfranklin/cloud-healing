# SelfHeal Monitoring Agent

Lightweight Node.js monitoring agent. Zero npm dependencies — pure built-in modules only.

## Requirements
- Node.js >= 18 (uses built-in `fetch`)
- Network access to the SelfHeal backend

## Quick Start

```bash
# Minimal (uses hostname as server name, localhost backend)
node agent.js

# Custom server name + remote backend
SERVER_NAME=api-gateway-prod \
BACKEND_URL=http://your-backend:5000 \
REGION=us-east-1 \
node agent.js
```

## Environment Variables

| Variable           | Default                   | Description                          |
|--------------------|---------------------------|--------------------------------------|
| `BACKEND_URL`      | `http://localhost:8000`   | SelfHeal backend base URL            |
| `SERVER_NAME`      | `os.hostname()`           | Name shown in the dashboard          |
| `REGION`           | `local`                   | Cloud region label                   |
| `METRICS_INTERVAL` | `5000`                    | Milliseconds between metric pushes   |
| `COMMAND_INTERVAL` | `5000`                    | Milliseconds between command polls   |

## What the Agent Does

1. **Startup** — registers itself at `POST /api/servers/register-server`
2. **Every 5s** — collects CPU (delta), memory %, uptime, optional error logs and sends to `POST /api/metrics`
3. **On critical response** — executes AI-recommended healing action locally
4. **Every 5s** — polls `GET /api/commands/:server_id` for manually dispatched commands

## Healing Actions

| Action            | What It Does                                      |
|-------------------|---------------------------------------------------|
| `restart_service` | Simulates graceful restart (replace with `systemctl restart myapp`) |
| `kill_process`    | Kills highest CPU process (safe: excludes agent PID) |
| `scale_up`        | Logs scale-up command (replace with your orchestrator API call) |
| `stress_cpu`      | Detached run of `stress-cpu.js` (see `STRESS_CPU_SECONDS`, default 20s) |
| `process_crash`   | Spawns a child that logs `FATAL` to stderr and exits 1 (safe simulation) |

## Running as a Background Service (Linux systemd)

```ini
# /etc/systemd/system/selfheal-agent.service
[Unit]
Description=SelfHeal Monitoring Agent
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/selfheal-agent
ExecStart=/usr/bin/node agent.js
Environment=BACKEND_URL=http://your-backend:5000
Environment=SERVER_NAME=my-server-1
Environment=REGION=us-east-1
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable selfheal-agent
sudo systemctl start selfheal-agent
sudo journalctl -u selfheal-agent -f   # view live logs
```
