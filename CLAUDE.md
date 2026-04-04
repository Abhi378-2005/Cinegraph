# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**CineGraph** is a full-stack movie recommendation engine that visualizes its algorithms live. It uses hybrid collaborative + content-based filtering and streams algorithm steps (MergeSort, Knapsack, Dijkstra, Floyd-Warshall, Kruskal) to the frontend via Socket.io for real-time visualization.

## Commands

### Frontend (`cd frontend`)
```bash
npm run dev      # Next.js dev server on port 3000
npm run build    # Production build + type-check
npm run lint     # ESLint
npx tsc --noEmit # Type-check only (no compile output)
```

### Backend (`cd backend`)
```bash
npm run dev      # ts-node-dev with hot reload, port 3001
npm run build    # tsc
npm run start    # node dist/src/index.js (after build)
npm test         # Jest (unit tests for algorithms + ML)
npm run seed     # Seed Redis from local data/seed/movies.json
npm run seed:bq  # Seed Redis from BigQuery (production flow)
```

### Backend migration scripts (`cd backend`)
```bash
npm run migrate                 # Full TMDB → BigQuery migration (fresh)
npm run migrate:resume          # Resume interrupted migration
npm run migrate:similarity-only # Recompute feature vectors + similarity only
npm run migrate:validate        # Verify BigQuery row counts and data quality
npm run migrate:dedup           # Remove duplicate rows if needed
npm run migrate:clear-bq        # Drop and recreate migration tables
```

## Architecture

### Separation of concerns — strict
- **Frontend** (`frontend/`): Pure UI. Next.js App Router. No business logic, no algorithms, no Redis.
- **Backend** (`backend/`): Express + Socket.io. All ML, algorithms, Redis, BigQuery, TMDB.
- **No Next.js API routes** — `app/api/` does not exist and must not be created.

### Request flow
1. Frontend sends `POST /recommend` with `X-Session-Token` header → backend returns `{ sessionId }` immediately (fire-and-forget job)
2. Backend runs `getRecommendations` → `mergeSort` → optionally `knapsack` in an async IIFE
3. Each algo step is emitted via Socket.io: `algo:step { sessionId, algorithm, step }`
4. `algo:complete { sessionId, algorithm, totalSteps }` signals the panel can enable Play
5. `recommend:ready { sessionId, recommendations, engine }` delivers the final list

### Socket.io emitter wiring
`socketServer.ts` calls `setEmitter()` on `recommend.ts` after Socket.io initializes. The `emitToUser` function looks up `userId → socketId` via an in-memory `Map`. REST routes call `emitToUser?.()` — if the socket disconnects mid-job, steps are silently dropped.

### Data layer: Redis + BigQuery
- **Redis (Upstash)** is the hot path for everything:
  - `movie:<id>` hash — full movie object
  - `movie:vector:<id>` — feature vector (24h TTL, lazy-loaded from BQ)
  - `user:<token>:ratings` hash — all user ratings
  - `user:<token>:phase` — `'cold' | 'warming' | 'full'`
  - `movies:popular:<genre>` sorted set — genre popularity lists
  - `users:all` set — all user tokens (for collaborative filtering)
- **BigQuery** is the cold/compute path:
  - `movies` table — canonical movie catalogue
  - `movie_features` table — 40-dim feature vectors (computed by SQL job)
  - `movie_similarity` table — top-50 similar movies per movie (VECTOR_SEARCH job)
  - Redis falls back to BQ on cache miss (`redis/movies.ts`, `redis/vectors.ts`)

### Recommendation engines
Phase is derived from rating count: `< 5` = `cold`, `5–19` = `warming`, `≥ 20` = `full`.

| Engine | Logic |
|---|---|
| `cold_start` / phase=cold | Top popular movies for user's preferred genres from Redis sorted sets |
| `content` / phase=warming | Cosine similarity scores from BQ `movie_similarity`, weighted by user's ratings |
| `collaborative` | Pearson correlation against all other users in Redis, top-K neighbour CF |
| `hybrid` | `contentBased` + `collaborativeRecommend` in parallel, round-robin interleaved |

After ranking, `mergeSort` produces the replay steps, then optionally `knapsack` selects a subset within the watch-time budget.

### Feature vectors (40-dim)
Computed entirely in BigQuery SQL (`jobs.ts`): 19 genre one-hots, 5 cast hashes, 1 director hash, 10 keyword TF-IDF scores, vote average, log-popularity, release decade.

### User identity
Anonymous UUID session. Token written to cookie (`cg_token`, 30-day, SameSite=Lax) and localStorage. Cookie is authoritative; localStorage is fallback. Backend reads `X-Session-Token` header on every request.

### Phase transitions
`computeAndSetPhase` in `redis/ratings.ts` is called by the `/rate` route after each rating. Thresholds: 5 ratings → `warming`, 20 ratings → `full`.

## Frontend Design System

**Theme:** Netflix-inspired dark UI with purple brand (`#7C3AED`).

CSS variables are defined in `app/globals.css`. **Never hardcode hex in components** — always use `var(--color-brand)`, `var(--color-text-muted)`, etc. When adding a new color, define it as a CSS var first.

Key tokens:
- `--color-brand: #7C3AED` — primary actions, active states
- `--color-bg-base: #141414` — page background
- `--color-bg-card: #1A1A1A` — card background
- `--color-match: #4ade80` — match score badge, success states
- `--color-knapsack: #a78bfa` — knapsack panel accent
- `--shadow-compare`, `--shadow-merge`, `--shadow-include` — algo viz glows

**Font:** Inter via `next/font/google`. Not Geist.

**D3 components** must be `'use client'` and initialize inside `useEffect` (DOM required).

**Framer Motion** for MergeSort card animations (`layout` + `layoutId` on poster cards) and drawer open/close.

## Frontend Implementation Gotchas

- **`'use client'` must be the absolute first line** — before comments. Next.js enforces this.
- **All imports use `@/` alias** — never relative `./` paths for `lib/` or cross-component imports.
- **No hardcoded backend URLs** — fallback for `NEXT_PUBLIC_API_URL` must be `''`, not `'http://localhost:3001'`.
- **`hasExistingToken()`** must be called before `getOrCreateToken()` on the landing page — `getOrCreateToken()` always creates/returns a token, making the returning-user check useless if called first.
- **TMDB images** require `image.tmdb.org` in `next.config.ts` `remotePatterns`.
- **`posterUrl()` helper** in `lib/formatters.ts` — always use it for TMDB poster paths instead of concatenating `NEXT_PUBLIC_TMDB_IMAGE_BASE` directly.

## AlgoDrawer: How the Visualization Works

The drawer lives at `frontend/components/layout/AlgoDrawer.tsx`. Key patterns to understand:

**SessionId correlation:** `discover/page.tsx` stores a `sessionIdRef` (synced from state) so the stable socket handler reads the latest value without stale closure. AlgoDrawer does the same with `currentSessionIdRef.current = sessionId` on every render.

**Steps go to refs, not state:** `mergeSortStepsRef` and `knapsackStepsRef` are `useRef` arrays. Steps are pushed on every `algo:step` event without triggering re-renders (performance). Only `algo:complete` sets `msTotalSteps`/`ksTotalSteps` state — this is the re-render that enables the Play button.

**Replay engines:** Two independent `useEffect` loops (`[msPlaying, msIndex]` and `[ksPlaying, ksIndex]`) drive `setTimeout` chains that increment the cursor. `currentStep = stepsRef.current[index - 1]`.

**Socket subscriptions use `[]` deps** (registered once on mount) and read `currentSessionIdRef.current` to avoid stale closure issues when sessionId changes between renders.

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
TMDB_API_KEY=<from themoviedb.org>
TMDB_BASE_URL=https://api.themoviedb.org/3
UPSTASH_REDIS_REST_URL=<from Upstash>
UPSTASH_REDIS_REST_TOKEN=<from Upstash>
FRONTEND_URL=http://localhost:3000
GCP_PROJECT_ID=<GCP project>
GCP_DATASET_ID=cinegraph
GCP_LOCATION=US
GOOGLE_APPLICATION_CREDENTIALS=<path to service account JSON>
```

## Hosting
- Frontend → Vercel
- Backend → Railway (persistent process required for Socket.io)
- Redis → Upstash (serverless)
- BigQuery → GCP (feature vectors + similarity, not hot path)

## MCP Tools: code-review-graph

**IMPORTANT: This project has a knowledge graph. ALWAYS use the
code-review-graph MCP tools BEFORE using Grep/Glob/Read to explore
the codebase.** The graph is faster, cheaper (fewer tokens), and gives
you structural context (callers, dependents, test coverage) that file
scanning cannot.

### When to use graph tools FIRST

- **Exploring code**: `semantic_search_nodes` or `query_graph` instead of Grep
- **Understanding impact**: `get_impact_radius` instead of manually tracing imports
- **Code review**: `detect_changes` + `get_review_context` instead of reading entire files
- **Finding relationships**: `query_graph` with callers_of/callees_of/imports_of/tests_for
- **Architecture questions**: `get_architecture_overview` + `list_communities`

Fall back to Grep/Glob/Read **only** when the graph doesn't cover what you need.

### Key Tools

| Tool | Use when |
|------|----------|
| `detect_changes` | Reviewing code changes — gives risk-scored analysis |
| `get_review_context` | Need source snippets for review — token-efficient |
| `get_impact_radius` | Understanding blast radius of a change |
| `get_affected_flows` | Finding which execution paths are impacted |
| `query_graph` | Tracing callers, callees, imports, tests, dependencies |
| `semantic_search_nodes` | Finding functions/classes by name or keyword |
| `get_architecture_overview` | Understanding high-level codebase structure |
| `refactor_tool` | Planning renames, finding dead code |

### Workflow

1. The graph auto-updates on file changes (via hooks).
2. Use `detect_changes` for code review.
3. Use `get_affected_flows` to understand impact.
4. Use `query_graph` pattern="tests_for" to check coverage.
