# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**CineGraph** is a full-stack movie recommendation engine that visualizes its algorithms live. It uses a hybrid collaborative + content-based filtering approach and streams algorithm steps (Floyd-Warshall, Dijkstra, Kruskal MST, Merge Sort, 0/1 Knapsack) to the frontend via Socket.io for real-time visualization.

The complete project specification lives in `Doc/CineGraph_Agent_Blueprint.md`. The frontend implementation plan (design system, component specs, lib implementations) is in `agent/frontend_plan.md`.

## Repository Structure

```
CineGraph/
├── frontend/       # Next.js 16 (App Router) — UI only, zero business logic
├── backend/        # Express + Socket.io — all ML, algorithms, Redis (to be built)
├── agent/          # Implementation plans (not deployed)
│   └── frontend_plan.md
├── Doc/            # Project specs and architecture diagrams
│   └── CineGraph_Agent_Blueprint.md   # Complete build spec
└── data/           # Seed data (movies.json, synthetic_ratings.json)
```

## Commands

### Frontend (`cd frontend`)
```bash
npm run dev      # Start Next.js dev server on port 3000
npm run build    # Production build
npm run lint     # ESLint
```

### Backend (`cd backend`) — not yet scaffolded
```bash
npm run dev      # ts-node-dev src/index.ts, port 3001
npm run build    # tsc
npm run seed     # Run scripts/seedData.ts to populate Redis
```

## Architecture

### Separation of concerns — strict
- **Frontend** (`frontend/`): Pure UI. Next.js App Router. No business logic, no algorithms, no Redis. All data comes from `NEXT_PUBLIC_API_URL` (backend).
- **Backend** (`backend/`): Express + Socket.io. Owns all ML computation, algorithm execution, Redis caching, TMDB API integration.
- **No Next.js API routes** — `app/api/` does not exist.

### Communication
- REST: Frontend → Backend for data fetching (movies, recommendations, ratings)
- Socket.io: Backend → Frontend for algorithm step streaming (`algo:step`, `recommend:ready`, `community:update`)
- Token: Every request carries `X-Session-Token: <uuid>` header. Socket.io sends token in `auth` handshake.

### User identity
Anonymous UUID session — no login. Token written to both cookie (`cg_token`, 30-day expiry, SameSite=Lax) and localStorage. Cookie is authoritative; localStorage is fallback. Backend maps token to Redis key prefix `user:<token>:*`.

## Frontend Design System

**Theme:** Netflix-inspired dark UI with purple brand color (replaces Netflix red).

Key CSS variables (defined in `app/globals.css`):
- `--color-brand: #7C3AED` (Violet-600) — primary actions, active states
- `--color-bg-base: #141414` — page background
- `--color-bg-card: #1A1A1A` — card background
- `--viz-mst-edge: rgba(124,58,237,0.6)` — D3 graph MST edges
- `--viz-dijkstra-path: #A78BFA` — Dijkstra path highlight

**Font:** Inter (via `next/font/google`), not Geist (the scaffold default — replace it).

**D3 components** must be `'use client'` and initialize inside `useEffect` (DOM required).

**Framer Motion** for card animations (Merge Sort steps) and page transitions.

## Backend Key Modules (to be built)

| Path | Purpose |
|---|---|
| `backend/src/algorithms/` | floydWarshall, dijkstra, kruskal, mergeSort, knapsack, greedy |
| `backend/src/ml/` | featureVector, cosineSimilarity, pearsonCorrelation, contentBased, collaborative, hybrid |
| `backend/src/redis/` | Upstash client, ratings, vectors, similarity cache |
| `backend/src/routes/` | movies, recommend, rate, similarity, health |
| `backend/src/socket/socketServer.ts` | Socket.io event handlers + algorithm step streaming |
| `backend/src/tmdb/` | TMDB API wrapper, fetcher, preprocessor |

## Algorithm Constraints (from spec)
- Floyd-Warshall visualization: cap at 20 users (20³ = 8000 steps)
- User similarity graph: max 50 nodes for D3 force layout
- Pearson correlation: requires min 2 co-rated movies between user pairs
- Movie corpus: 500 pre-fetched movies (no live TMDB search during demo)

## Environment Variables

### `frontend/.env.local`
```
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
NEXT_PUBLIC_TMDB_IMAGE_BASE=https://image.tmdb.org/t/p/w500
```

### `backend/.env`
```
PORT=3001
TMDB_API_KEY=<from themoviedb.org — free>
TMDB_BASE_URL=https://api.themoviedb.org/3
UPSTASH_REDIS_REST_URL=<from Upstash>
UPSTASH_REDIS_REST_TOKEN=<from Upstash>
FRONTEND_URL=http://localhost:3000
```

## Current State

The **frontend** is a fresh Next.js scaffold (boilerplate `page.tsx` and `layout.tsx`). No CineGraph components have been built yet.

The **backend** directory does not yet exist — it needs to be scaffolded as a Node.js + Express + TypeScript project.

The full component and page specifications, including exact TypeScript implementations for `lib/session.ts`, `lib/api.ts`, and `lib/socket.ts`, are in `agent/frontend_plan.md`.

## Hosting
- Frontend → Vercel
- Backend → Railway (supports Socket.io, persistent process)
- Redis → Upstash (serverless Redis, REST API)
