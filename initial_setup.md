# Tangub City Hardware POS — Initial Setup Guide

## Architecture Overview

| Component | Runs on | Managed by |
|---|---|---|
| PostgreSQL | Server PC | PostgreSQL service (auto) |
| NestJS backend | Server PC | PM2 (auto-starts on boot) |
| Next.js frontend | Each cashier PC | Electron (spawned on launch) |
| Electron app | Each cashier PC | User opens it |

---

## On the Windows 11 Server PC

### Step 1 — Install required software
Download and install these:
- **Node.js** (v20 LTS) — nodejs.org
- **PostgreSQL** (v16) — postgresql.org/download/windows
  - During install, set a password for the `postgres` user (e.g. `postgres`)
  - Keep default port `5432`

### Step 2 — Copy the backend files
Copy the entire `backend/` folder to the server PC. Easiest ways:
- USB drive
- Shared network folder
- Git clone (if the repo is on GitHub)

Place it somewhere like `C:\tangub-pos\backend\`

### Step 3 — Set up the database
Open **pgAdmin** (installed with PostgreSQL) and create a database named `tangubcityhardware`.

Or via command line:
```bash
psql -U postgres -c "CREATE DATABASE tangubcityhardware;"
```

### Step 4 — Install dependencies and build
Open **Command Prompt** in the backend folder:
```bash
cd C:\tangub-pos\backend
npm install
npm run build
```

### Step 5 — Create `ecosystem.config.js`
Create this file inside `C:\tangub-pos\backend\`:
```js
module.exports = {
  apps: [{
    name: 'tangub-backend',
    script: 'dist/main.js',
    env: {
      NODE_ENV: 'production',
      PORT: 3001,
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/tangubcityhardware',
    },
  }],
};
```

### Step 6 — Run database migration and seed
```bash
npx prisma migrate deploy
npx prisma db seed
```

### Step 7 — Install PM2 and start the backend
```bash
npm install -g pm2
npm install -g pm2-windows-startup
pm2 start ecosystem.config.js
pm2-windows-startup install
pm2 save
```

### Step 8 — Open port 3001 in Windows Firewall
Run this in Command Prompt **as Administrator**:
```bash
netsh advfirewall firewall add rule name="Tangub POS Backend" dir=in action=allow protocol=TCP localport=3001
```

### Step 9 — Find the server's local IP
```bash
ipconfig
```
Look for **IPv4 Address** under your network adapter — something like `192.168.1.100`. Write this down — cashiers will need it.

---

## On each Cashier PC

Install the Electron app. On **first launch**, the setup screen appears:

```
Server IP Address
[ 192.168.1.100  ]
[ Connect & Start ]
```

Enter the server's IP from Step 9. The setting is saved — it won't ask again.

To reset the server IP (e.g. if the server IP changes), delete this file on the cashier PC:
```
C:\Users\<username>\AppData\Roaming\Tangub City Hardware POS\config.json
```

---

## Useful PM2 Commands (on the server PC)

```bash
pm2 status                    # Check if backend is running
pm2 logs tangub-backend       # View live logs
pm2 restart tangub-backend    # Restart after changes
pm2 stop tangub-backend       # Stop the backend
```

---

## Building the Electron Installer (on development machine)

```bash
# One command builds frontend + backend + packages the installer
npm run electron:build:win
```

Output: `electron/dist/Tangub City Hardware POS Setup 1.0.0.exe`
