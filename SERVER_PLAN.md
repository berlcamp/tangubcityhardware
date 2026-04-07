# Hybrid Cloud Sync: Add Railway Backup to Existing LAN Setup

## Context

The POS already works well: Cashier #1 runs PostgreSQL + NestJS locally, other cashiers connect to it over LAN. The user wants to **add Railway cloud sync on top** — the server cashier's backend pushes data to Railway for cloud backup and remote admin access. No changes to how cashiers connect. Internet speed or outages have zero impact on POS operations.

```
                    ┌──────────────┐
                    │   Railway    │  (cloud backup + remote admin)
                    │  Cloud DB   │
                    └──────┬───────┘
                           │ background sync
                    ┌──────┴───────┐
                    │  Cashier #1  │  (server + cashier, runs NestJS + PG)
                    └──┬────────┬──┘
                       │ LAN    │ LAN
                 ┌─────┴──┐ ┌──┴─────┐
                 │Cashier 2│ │Cashier 3│
                 └─────────┘ └─────────┘
```

---

## Phase 1: Health Endpoint + Railway Dockerfile

**New file:** `backend/src/health/health.controller.ts`
- `GET /api/health` → returns `{ status: 'ok', timestamp }` (no auth required)
- Register in `health.module.ts`, import in `app.module.ts`

**New file:** `backend/Dockerfile`
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/prisma ./prisma
EXPOSE 3001
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
```

**New file:** `backend/.dockerignore`

**Railway env vars:** `DATABASE_URL` (from PG plugin), `PORT`, `JWT_SECRET`, `NODE_ENV=production`, `CLOUD_MODE=true`, `SYNC_API_KEY=<shared-secret>`

---

## Phase 2: Cloud Sync Endpoints (Railway-side only)

These endpoints are only active when `CLOUD_MODE=true` (i.e., on Railway). The local server uses them as targets.

**New file:** `backend/src/sync/cloud-sync.controller.ts`
- `POST /api/sync/push` — accepts `{ items: [{ tableName, recordId, operation, payload }] }`, upserts each to cloud DB via Prisma, returns per-item success/failure
- `GET /api/sync/changes?since=<ISO>&tables=<csv>` — returns records where `updatedAt > since`, grouped by table (for pulling product/price updates from cloud to local)
- Guarded by `X-Sync-Api-Key` header validation

**New file:** `backend/src/sync/cloud-sync.guard.ts`
- Validates `X-Sync-Api-Key` matches `process.env.SYNC_API_KEY`

**Modify:** `backend/src/sync/sync.module.ts` — conditionally register `CloudSyncController` when `CLOUD_MODE=true`

---

## Phase 3: Schema Changes

**Modify:** `backend/prisma/schema.prisma`

Add `updatedAt` to models missing it (needed for pull sync `changes?since=` query):
- `Sale` — add `updatedAt DateTime @updatedAt @map("updated_at")`
- `Customer` — add `updatedAt DateTime @updatedAt @map("updated_at")`
- `SaleReturn` — add `updatedAt DateTime @updatedAt @map("updated_at")`

Add new model for tracking pull sync state:
```prisma
model SyncMetadata {
  id           String   @id @default("singleton")
  lastPullAt   DateTime @default(now()) @map("last_pull_at")
  updatedAt    DateTime @updatedAt @map("updated_at")
  @@map("sync_metadata")
}
```

Run migration: `npx prisma migrate dev --name add-cloud-sync-fields`

---

## Phase 4: Connectivity Service

**New file:** `backend/src/sync/connectivity.service.ts`
- Reads `CLOUD_URL` from env
- `@Cron(EVERY_10_SECONDS)` pings `${CLOUD_URL}/api/health` with 5s timeout
- Debounced state: requires 3 consecutive failures → offline, 2 successes → online (handles slow internet)
- Exposes `isCloudReachable`, `isCloudConfigured`, `lastCheck`

**Modify:** `backend/src/sync/sync.controller.ts`
- Add `GET /api/sync/connectivity` endpoint exposing cloud reachability

**Modify:** `backend/src/sync/sync.module.ts` — register `ConnectivityService`

---

## Phase 5: Refactor Sync Service (Supabase → Railway HTTP Push)

**Modify:** `backend/src/sync/sync.service.ts`
- Remove `@supabase/supabase-js` import and Supabase client
- Inject `ConnectivityService`, use `isCloudReachable` instead of DNS check
- Replace Supabase upsert loop with single HTTP POST to `${CLOUD_URL}/api/sync/push`:
  ```typescript
  const res = await fetch(`${this.cloudUrl}/api/sync/push`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Sync-Api-Key': this.syncApiKey },
    body: JSON.stringify({ items: batch }),
    signal: AbortSignal.timeout(15000),
  });
  ```
- Mark items synced/failed based on per-item response from cloud
- Update `getStatus()` to return `cloudConfigured` instead of `supabaseConfigured`

**Modify:** `backend/src/common/sync.helper.ts` — update JSDoc comment (Supabase → cloud), logic stays the same

**Remove dependency:** `npm uninstall @supabase/supabase-js` from backend

---

## Phase 6: Pull Sync (Cloud → Local)

**New file:** `backend/src/sync/pull-sync.service.ts`
- `@Cron(EVERY_MINUTE)` — skips if `!connectivity.isCloudReachable` or `!CLOUD_URL`
- Fetches `GET ${CLOUD_URL}/api/sync/changes?since=${lastPull}&tables=products,product_units,inventory,users,customers`
- Applies to local DB via Prisma upserts inside a transaction
- Does NOT call `addToSyncQueue()` for pulled records (prevents infinite sync loop)
- Updates `SyncMetadata.lastPullAt`

**Use case:** Admin updates product prices via Railway cloud dashboard → pull sync brings them to the local server → all cashiers see updated prices immediately (they query the same local DB)

---

## Phase 7: Electron Config for Cloud URL

**Modify:** `electron/setup.html`
- Add collapsible "Cloud Sync (Optional)" section below existing server IP input
- Two new fields: "Cloud Server URL" (text) and "Sync API Key" (password)
- Both optional — blank means offline-only mode (current behavior)

**Modify:** `electron/preload.js` — update `submit` to send `{ serverIp, cloudUrl, syncApiKey }` object

**Modify:** `electron/main.js`
- `ipcMain.once('setup-submit')` handler saves full config object
- `startServers()` passes `CLOUD_URL` and `SYNC_API_KEY` as env vars to backend process:
  ```js
  backendProcess = spawnNode(getResourcePath("backend", "dist", "main.js"), {
    ...existingEnv,
    CLOUD_URL: config.cloudUrl || "",
    SYNC_API_KEY: config.syncApiKey || "",
  });
  ```
- Only applies when `isLocalServer(serverIp)` — remote cashiers don't need cloud config

---

## Phase 8: UI Sync Status Indicator

**New file:** `frontend/src/components/SyncStatusIndicator.tsx`
- Polls `GET /api/sync/status` + `GET /api/sync/connectivity` every 10s
- States:
  - Green dot — cloud connected, all synced
  - Yellow dot — cloud connected, N items pending
  - Red dot — cloud offline, N items queued
  - Gray dot — cloud not configured
- Click → popover with: pending/failed counts, last sync time, "Sync Now" and "Retry Failed" buttons

**Modify:** `frontend/src/lib/api.ts` — add:
```typescript
sync: {
  status: () => request<any>('/sync/status'),
  connectivity: () => request<any>('/sync/connectivity'),
  retry: () => request<any>('/sync/retry', { method: 'POST' }),
  syncNow: () => request<any>('/sync/now', { method: 'POST' }),
},
```

**Modify:** `frontend/src/app/page.tsx` — add `<SyncStatusIndicator />` to POS screen
**Modify:** `frontend/src/app/admin/layout.tsx` — add `<SyncStatusIndicator />` to admin sidebar

---

## Key Files Summary

| File | Action |
|------|--------|
| `backend/Dockerfile` | Create |
| `backend/.dockerignore` | Create |
| `backend/src/health/health.controller.ts` | Create |
| `backend/src/health/health.module.ts` | Create |
| `backend/src/sync/cloud-sync.controller.ts` | Create |
| `backend/src/sync/cloud-sync.guard.ts` | Create |
| `backend/src/sync/connectivity.service.ts` | Create |
| `backend/src/sync/pull-sync.service.ts` | Create |
| `backend/src/sync/sync.service.ts` | Modify (replace Supabase) |
| `backend/src/sync/sync.controller.ts` | Modify (add connectivity endpoint) |
| `backend/src/sync/sync.module.ts` | Modify (register new providers) |
| `backend/src/common/sync.helper.ts` | Modify (update comment) |
| `backend/src/app.module.ts` | Modify (add HealthModule) |
| `backend/prisma/schema.prisma` | Modify (updatedAt fields, SyncMetadata) |
| `electron/main.js` | Modify (pass cloud env vars) |
| `electron/setup.html` | Modify (cloud URL fields) |
| `electron/preload.js` | Modify (config object) |
| `frontend/src/components/SyncStatusIndicator.tsx` | Create |
| `frontend/src/lib/api.ts` | Modify (sync endpoints) |
| `frontend/src/app/page.tsx` | Modify (add indicator) |
| `frontend/src/app/admin/layout.tsx` | Modify (add indicator) |

---

## Verification

1. Deploy backend to Railway with `CLOUD_MODE=true` → verify `GET /api/health` returns 200
2. Set `CLOUD_URL` on local backend → verify connectivity service detects Railway (green status)
3. Create a sale locally → verify it appears in SyncQueue → verify it pushes to Railway DB
4. Disconnect internet → create sales → verify they queue locally → reconnect → verify backlog flushes
5. Update a product price directly on Railway DB → verify pull sync brings it to local within 60s
6. Check UI indicator shows correct states (green/yellow/red/gray)
7. Verify remote cashiers (non-server) are completely unaffected by cloud sync
