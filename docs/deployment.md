# CineGraph Deployment Guide

**Frontend** → Vercel  
**Backend** → VM (Docker container)  
**Redis** → Upstash (serverless, no deployment needed)  
**BigQuery** → GCP (no deployment needed)

---

## Pre-flight: migration to 20,000 movies

Run this **before** deploying. The production dataset must be in BigQuery and Redis before the app goes live.

```bash
cd backend

# 1. Run full migration (targets TMDB + BQ pipeline)
npm run migrate

# 2. If it gets interrupted, resume from the last checkpoint
npm run migrate:resume

# 3. After migration completes, validate row counts and data quality
npm run migrate:validate

# 4. Seed Redis from BigQuery (loads popular-movies sorted sets + movie hashes)
npm run seed:bq
```

Expected counts after migrate:validate succeeds:
- `movies` table: ~20,000 rows
- `movie_features` table: ~20,000 rows  
- `movie_similarity` table: ~1,000,000 rows (top-50 per movie)

---

## 1. Frontend — Vercel

### One-time setup

1. Push the repo to GitHub (if not already done):
   ```bash
   git push origin feature/backend
   # Merge to main when ready, or point Vercel at feature/backend for staging
   ```

2. Go to [vercel.com](https://vercel.com) → **New Project** → import the repo.

3. Set the **Root Directory** to `frontend`.

4. Vercel auto-detects Next.js. Framework preset: **Next.js**. No changes needed.

5. Add environment variables in Vercel dashboard → Settings → Environment Variables:

   | Variable | Value |
   |---|---|
   | `NEXT_PUBLIC_API_URL` | `https://your-backend-domain.com` |
   | `NEXT_PUBLIC_SOCKET_URL` | `https://your-backend-domain.com` |
   | `NEXT_PUBLIC_TMDB_IMAGE_BASE` | `https://image.tmdb.org/t/p/w500` |

6. Deploy. Vercel builds and deploys automatically on every push to the target branch.

### Redeploy after config change

```bash
# Just push — Vercel picks it up automatically
git push origin main
```

---

## 2. Backend — VM (Podman)

> **Podman note:** All commands use `podman`. It is a drop-in replacement for `docker` — every flag and argument is identical.

### Requirements on the VM

- Podman 4+
- At least 512 MB RAM (1 GB recommended)
- Port 3001 open in firewall (or 80/443 with a reverse proxy)

---

### Step A — Build the image on your dev machine

```bash
# From repo root
cd backend
podman build -t cinegraph-backend:latest .
```

### Step B — Transfer the image to the VM

**Option 1 — save/copy/load (no registry needed):**

```bash
# On dev machine: export the image to a tar file
podman save cinegraph-backend:latest -o cinegraph-backend.tar

# Copy to VM
scp cinegraph-backend.tar user@your-vm-ip:/opt/cinegraph/

# On the VM: load the image
podman load -i /opt/cinegraph/cinegraph-backend.tar
```

**Option 2 — push to a registry (Docker Hub / GHCR):**

```bash
# On dev machine
podman tag cinegraph-backend:latest docker.io/yourusername/cinegraph-backend:latest
podman push docker.io/yourusername/cinegraph-backend:latest

# On the VM
podman pull docker.io/yourusername/cinegraph-backend:latest
podman tag docker.io/yourusername/cinegraph-backend:latest cinegraph-backend:latest
```

---

### Step C — Prepare files on the VM

**1. Create the env file** at `/opt/cinegraph/.env` (never commit this):

```env
# Server
PORT=3001
FRONTEND_URL=https://your-vercel-app.vercel.app

# Upstash Redis
# Get from: https://console.upstash.com → your database → REST API tab
UPSTASH_REDIS_REST_URL=https://xxxxxxxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=AXXXXxxxxxxxxxxxxxxxxxxxxxxxxxx

# Google Cloud / BigQuery
# Get GCP_PROJECT_ID from: GCP Console → select project → top bar shows "my-project-id"
GCP_PROJECT_ID=your-gcp-project-id
GCP_DATASET_ID=cinegraph
GCP_LOCATION=US

# Path INSIDE the container where the JSON key will be mounted (do not change this)
GOOGLE_APPLICATION_CREDENTIALS=/run/secrets/gcp-key.json
```

**2. Copy the GCP service account JSON key to the VM** (never bake it into the image):

```bash
# On dev machine — copy key to VM
scp path/to/your-service-account-key.json user@your-vm-ip:/opt/cinegraph/gcp-key.json

# On the VM — restrict permissions
chmod 600 /opt/cinegraph/gcp-key.json
```

> **Where to get the JSON key:** GCP Console → IAM & Admin → Service Accounts → select your service account → Keys tab → Add Key → Create new key → JSON. The downloaded file is your key.

> **Required BigQuery roles on the service account:** `BigQuery Data Editor` + `BigQuery Job User` (or `BigQuery Admin` for convenience).

---

### Step D — Run the container

```bash
podman run -d \
  --name cinegraph-backend \
  --restart unless-stopped \
  -p 3001:3001 \
  --env-file /opt/cinegraph/.env \
  -v /opt/cinegraph/gcp-key.json:/run/secrets/gcp-key.json:ro \
  cinegraph-backend:latest
```

> **Custom port:** Change `PORT=3001` in `.env` and update the `-p` flag accordingly (e.g., `-p 8080:8080` with `PORT=8080`).

### Verify it's healthy

```bash
curl http://localhost:3001/health
# Expected: {"status":"ok","redis":true,"uptime":...}

podman logs cinegraph-backend --tail 50
```

### Update the backend (swap with zero downtime)

```bash
# Rebuild + re-transfer image (Steps A → B above), then on the VM:
podman stop cinegraph-backend
podman rm cinegraph-backend
podman run -d \
  --name cinegraph-backend \
  --restart unless-stopped \
  -p 3001:3001 \
  --env-file /opt/cinegraph/.env \
  -v /opt/cinegraph/gcp-key.json:/run/secrets/gcp-key.json:ro \
  cinegraph-backend:latest
```

### (Optional) Reverse proxy with nginx

If you want HTTPS on port 443 instead of exposing 3001 directly:

```nginx
server {
    listen 443 ssl;
    server_name api.yourdomain.com;

    ssl_certificate     /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;

        # Required for Socket.io
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

> **Socket.io note:** The `Upgrade` / `Connection` headers above are required for WebSocket connections. Without them, Socket.io falls back to long-polling and latency spikes.

---

## 3. Post-deployment checklist

- [ ] `GET /health` returns `{"status":"ok","redis":true}`
- [ ] Frontend loads at Vercel URL, no CORS errors in console
- [ ] Rate a movie → `/rate` returns 200, phase updates
- [ ] Trigger recommendations → Socket.io events arrive, algo panels animate
- [ ] Graph page loads — nodes visible, Dijkstra/Floyd/Kruskal tabs work
- [ ] TMDB poster images load (confirms `image.tmdb.org` is in `next.config.ts` remotePatterns)

---

## 4. Environment variables reference

### Backend (`/opt/cinegraph/.env` on VM)

| Variable | Required | Description |
|---|---|---|
| `PORT` | No (default 3001) | HTTP listen port |
| `FRONTEND_URL` | Yes | Vercel app URL for CORS origin |
| `UPSTASH_REDIS_REST_URL` | Yes | Upstash REST endpoint |
| `UPSTASH_REDIS_REST_TOKEN` | Yes | Upstash token |
| `GCP_PROJECT_ID` | Yes | GCP project ID |
| `GCP_DATASET_ID` | Yes | BigQuery dataset (default: `cinegraph`) |
| `GCP_LOCATION` | Yes | BigQuery location (`US`) |
| `GOOGLE_APPLICATION_CREDENTIALS` | Yes | Path to GCP key JSON inside container |
| `TMDB_API_KEY` | Yes (migration only) | Not needed at runtime — only for migration scripts |

### Frontend (Vercel environment variables)

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | Backend base URL (no trailing slash) |
| `NEXT_PUBLIC_SOCKET_URL` | Backend Socket.io URL (same as API URL) |
| `NEXT_PUBLIC_TMDB_IMAGE_BASE` | `https://image.tmdb.org/t/p/w500` |
