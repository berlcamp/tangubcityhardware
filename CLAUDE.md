# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Tangub City Hardware POS — an offline-first Point of Sale system for a hardware store. Three-tier monorepo:
- **backend/** — NestJS REST API (port 3001), PostgreSQL via Prisma
- **frontend/** — Next.js 14 web UI (port 3000), TypeScript, Tailwind CSS
- **electron/** — Desktop wrapper that spawns the frontend/backend locally or connects to a remote server

## Commands

### Root (run from repo root)
```bash
npm run install:all       # Install all workspace dependencies
npm run dev               # Run backend + frontend concurrently
npm run dev:all           # Run backend + frontend + electron
npm run build:all         # Build frontend + backend
npm run db:generate       # Generate Prisma client
npm run db:migrate        # Run database migrations
npm run db:seed           # Seed database with initial data
npm run electron:build:win   # Build Windows NSIS installer
npm run electron:publish:win # Publish Windows build to GitHub
```

### Backend (from backend/)
```bash
npm run start:dev    # Watch mode
npm run start:prod   # Production
npm run build        # Compile TypeScript
```

### Frontend (from frontend/)
```bash
npm run dev          # Dev server on port 3000
npm run build        # Next.js standalone build
```

### Database
```bash
npx prisma migrate dev     # Create and apply new migration
npx prisma studio          # Visual DB browser
```

## Architecture

### Network Topology
- **Server PC**: PostgreSQL + NestJS (port 3001) managed by PM2
- **Cashier PCs**: Electron app → Next.js (port 3000) → proxy → NestJS (port 3001)
- Server IP is stored in `AppData/Roaming/Tangub City Hardware POS/config.json` on first Electron launch

### API Proxy Pattern
All frontend API calls go through a Next.js catch-all route handler at `frontend/src/app/api/backend/[...path]/route.ts`, which proxies to `BACKEND_URL`. This avoids hard-coding the server IP at build time — the Electron main process sets `BACKEND_URL` as an env var when spawning Next.js.

### Authentication
- JWT (1-day expiry), stored in `js-cookie` + localStorage
- Three roles: `ADMIN`, `MANAGER`, `CASHIER`
- Next.js `middleware.ts` redirects unauthenticated users to `/login`
- Backend uses `JwtAuthGuard` + `RolesGuard` on protected routes

### Key Backend Modules
`AuthModule` → `UsersModule` → `ProductsModule` → `SalesModule` → `InventoryModule` → `SyncModule` → `ReportsModule` → `AuditModule`

Each module follows standard NestJS structure: `*.module.ts`, `*.controller.ts`, `*.service.ts`, `*.dto.ts`.

### Frontend Routes
- `/` — POS cashier interface (product search, cart, checkout)
- `/login` — Authentication
- `/admin` — Admin dashboard (role-protected)
  - `/admin/products`, `/admin/inventory`, `/admin/users`, `/admin/reports`, `/admin/audit`

### Offline-First Design
The `SyncQueue` Prisma model and `SyncModule` handle failed operations with retry logic, allowing sales to continue during server downtime.

### Electron Production Flow
1. First launch shows `setup.html` form to collect server IP
2. Config saved to `config.json`
3. If `serverIp` is localhost: spawns backend locally; otherwise connects to remote
4. Always spawns Next.js frontend locally
5. Bundles `backend/dist/`, `frontend/.next/standalone`, and `backend/node_modules/` via electron-builder

## Environment Variables

**backend/.env**
```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/tangub_hardware_pos"
PORT=3001
```

**frontend/.env.local**
```
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

## Database Schema Key Models

- **Product** → **ProductUnit** (1:many) — supports piece/kilo/meter/box with conversion factors
- **Product** → **Inventory** (1:1) — quantity + low-stock threshold
- **Sale** → **SaleItem** (1:many) — receipt number format `YYYYMMDD-0001`
- **SyncQueue** — offline operation queue
- **AuditLog** — tracks LOGIN/CREATE/UPDATE/DELETE per user
- **InventoryMovement** — all quantity changes (sales, adjustments, transfers)
