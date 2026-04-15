# CineGraph

> **Watch algorithms discover what you'll love next.**

CineGraph is a full-stack movie recommendation engine that makes its internals transparent. Every recommendation request runs live algorithms on the server and streams each step to the browser over WebSockets — so you can watch Floyd-Warshall build a similarity matrix, Dijkstra trace a "taste path" between users, Merge Sort rank results, and Knapsack select your optimal watch list in real time.

Built as a DS/ML portfolio project covering the full spectrum: content-based filtering, collaborative filtering, hybrid engines, graph algorithms, and dynamic programming — all visualized.

---

## Live Demo

| Surface | URL |
|---|---|
| Frontend | _Vercel deploy URL_ |
| Backend | _Railway deploy URL_ |

---

## Features

### Three Recommendation Engines

| Phase | Engine | Triggers at |
|---|---|---|
| Cold start | Greedy genre-weighted ranking | 0–4 ratings |
| Warming up | Content-based (cosine similarity on 40-dim feature vectors) | 5–19 ratings |
| Full | Hybrid — content-based + collaborative filtering, round-robin interleaved | 20+ ratings |

- **Content-based:** Each movie is a 40-dimensional feature vector (19 genre one-hots, 5 cast hashes, 1 director hash, 10 keyword TF-IDF scores, vote average, log-popularity, release decade). Recommendation = cosine similarity to movies you rated highly.
- **Collaborative:** Pearson correlation between your rating vector and every other user's. Top-K neighbours vote on unseen movies.
- **Hybrid:** Both engines run in parallel; results are interleaved round-robin.
- **Cold start:** Genre preferences → greedy weighted score `(vote_average × 0.7) + (popularity × 0.3)`.

### Algorithm Visualizer (Live Streaming)

Every recommendation request emits algorithm steps over Socket.io. The frontend buffers them in refs and replays them as animations at adjustable speed.

| Algorithm | Visualization |
|---|---|
| **Merge Sort** | Animated card sort — poster cards swap positions with Framer Motion `layoutId` transitions |
| **0/1 Knapsack** | DP table replay — cells light up as the budget optimizer fills the table |
| **Floyd-Warshall** | n×n heatmap — matrix cells update live with purple crosshair highlighting the active pivot row/column |
| **Dijkstra** | Force-directed user graph — shortest taste-path animates edge-by-edge with glow filter |
| **Kruskal MST** | Edge list replay — minimum spanning tree edges appear in weight order, community clusters colored |

### Graph Explorer (`/graph`)

- D3 force-directed graph of all users — node size by rating count, edges weighted by rating similarity
- Pulsing "YOU" ring on the current user's node
- Three algorithm tabs: Floyd-Warshall heatmap, Dijkstra path chain, Kruskal MST edge list
- Independent replay engines per tab with speed controls

### Other Pages

- **Discover (`/discover`)** — recommendation feed with engine badge, match % scores, and "How were these picked?" drawer
- **Movie Detail (`/movie/[id]`)** — poster, overview, cast, and similar movies
- **Architecture (`/architecture`)** — interactive React Flow diagram of the full system with animated data-flow edges
- **Watch Budget** — optional Knapsack mode: set a time budget (hours) and get the optimal selection

### Search

- Debounced live search via Navbar — BigQuery-backed, cached in Redis
- Genre chip filters on the dropdown
- Stale-fetch prevention with generation counter

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Browser                                                     │
│                                                             │
│  Next.js 16 (App Router)          Socket.io client         │
│  ┌──────────────────┐             ┌───────────────────┐    │
│  │  /discover       │  REST API   │  algo:step events │    │
│  │  /graph          │ ──────────► │  graph:step events│    │
│  │  /architecture   │ ◄────────── │  recommend:ready  │    │
│  │  /movie/[id]     │             └───────────────────┘    │
│  └──────────────────┘                                       │
└───────────────────────────────┬─────────────────────────────┘
                                │ HTTP + WS
                                ▼
┌─────────────────────────────────────────────────────────────┐
│  Express + Socket.io (Railway)                              │
│                                                             │
│  Routes: /recommend  /rate  /movies  /graph/compute        │
│                                                             │
│  ML Engine           Algorithms          Socket Emitter     │
│  ┌──────────────┐   ┌──────────────┐   ┌───────────────┐  │
│  │ content-based│   │ mergeSort    │   │ emitToUser()  │  │
│  │ collaborative│   │ knapsack     │   │ sessionId-    │  │
│  │ hybrid       │   │ dijkstra     │   │ gated step    │  │
│  │ cold_start   │   │ floydWarshall│   │ streaming     │  │
│  └──────────────┘   │ kruskal      │   └───────────────┘  │
│                     │ greedy       │                        │
│                     └──────────────┘                        │
└───────────────────────────┬─────────────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              ▼                           ▼
┌─────────────────────┐     ┌────────────────────────┐
│  Upstash Redis      │     │  Google BigQuery        │
│                     │     │                         │
│  movie:<id> hash    │     │  movies table           │
│  user:<t>:ratings   │     │  movie_features (40-dim)│
│  movies:popular:*   │     │  movie_similarity       │
│  user:<t>:phase     │     │  (top-50 per movie,     │
│  users:all set      │     │   VECTOR_SEARCH job)    │
└─────────────────────┘     └────────────────────────┘
```

See `Doc/CineGraph-ArchiDiag.png` for the full visual diagram.

### Request Flow

1. Frontend sends `POST /recommend` with `X-Session-Token` header → backend returns `{ sessionId }` immediately
2. Async IIFE runs `getRecommendations` → `mergeSort` → optionally `knapsack`
3. Each step is emitted: `algo:step { sessionId, algorithm, step }`
4. `algo:complete` enables the Play button on the drawer
5. `recommend:ready` delivers the final list

### Data Flow: Redis + BigQuery

- **Redis** (hot path) — all user data, movie hashes, popular-by-genre sorted sets, feature vector cache (24h TTL)
- **BigQuery** (cold/compute path) — 40-dim feature vectors, top-50 similarity pairs per movie computed by `VECTOR_SEARCH` SQL job
- On cache miss, backend falls back to BigQuery and backfills Redis

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, React 19, TypeScript |
| Styling | Tailwind CSS v4 |
| Graph / matrix viz | D3.js v7 |
| Card animations | Framer Motion |
| Architecture diagram | React Flow |
| Real-time | Socket.io |
| Backend | Node.js, Express, TypeScript |
| Cache | Upstash Redis (REST) |
| Cold storage / ML | Google BigQuery |
| Movie data | TMDB API |
| Hosting | Vercel (frontend) · Railway (backend) |

---

## Project Structure

```
cinegraph/
├── frontend/
│   ├── app/
│   │   ├── page.tsx                  # Landing — genre picker (cold start onboarding)
│   │   ├── discover/page.tsx         # Recommendation feed + AlgoDrawer
│   │   ├── graph/page.tsx            # User similarity graph explorer
│   │   ├── architecture/page.tsx     # Interactive system architecture diagram
│   │   └── movie/[id]/page.tsx       # Movie detail page
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AlgoDrawer.tsx        # Algorithm replay viewer (MergeSort + Knapsack)
│   │   │   ├── Navbar.tsx            # Search bar + profile drawer
│   │   │   ├── ProfileDrawer.tsx     # Ratings history + phase indicator
│   │   │   ├── SearchBar.tsx         # Debounced search with genre filter
│   │   │   └── SpeedControls.tsx     # Shared replay speed buttons
│   │   ├── graph/
│   │   │   ├── D3UserGraph.tsx       # D3 force-directed user similarity graph
│   │   │   ├── DijkstraPanel.tsx     # Path chain + distance bar
│   │   │   ├── FloydWarshallPanel.tsx# Heatmap + crosshair + biggest-update badge
│   │   │   └── KruskalPanel.tsx      # MST edge list replay
│   │   ├── movies/
│   │   │   ├── MovieCard.tsx         # Poster card with match % badge
│   │   │   └── MovieRow.tsx          # Horizontal scroll row
│   │   ├── architecture/
│   │   │   ├── ArchitectureFlow.tsx  # React Flow canvas
│   │   │   ├── NodeDetailDrawer.tsx  # Slide-in node detail panel
│   │   │   └── edges/AnimatedEdge.tsx# Travelling-dot animated edges
│   │   └── recommendation/
│   │       └── WatchBudget.tsx       # Knapsack budget toggle + slider
│   └── lib/
│       ├── api.ts                    # HTTP client (all backend calls)
│       ├── socket.ts                 # Socket.io client wrapper
│       ├── session.ts                # Anonymous UUID session management
│       ├── formatters.ts             # posterUrl(), runtime, score helpers
│       └── types.ts                  # Shared TypeScript interfaces
│
├── backend/
│   └── src/
│       ├── algorithms/
│       │   ├── mergeSort.ts          # Ranked sort with step recording
│       │   ├── knapsack.ts           # 0/1 DP with step recording
│       │   ├── dijkstra.ts           # Shortest taste-path with step recording
│       │   ├── floydWarshall.ts      # All-pairs similarity with step recording
│       │   ├── kruskal.ts            # MST community detection with step recording
│       │   └── greedy.ts             # Cold start top-K selector
│       ├── ml/
│       │   ├── hybrid.ts             # Engine orchestrator + phase detection
│       │   ├── contentBased.ts       # Cosine similarity recommendations
│       │   └── collaborative.ts      # Pearson CF recommendations
│       ├── bigquery/                 # BQ client, feature vector + similarity queries
│       ├── redis/                    # User ratings, phase, vectors, movie cache
│       ├── routes/                   # recommend, rate, movies, graph, profile
│       ├── socket/socketServer.ts    # Socket.io + emitToUser wiring
│       └── tmdb/                     # TMDB API client + preprocessor
│
├── data/seed/                        # Pre-fetched seed data
├── docs/deployment.md                # VM + Vercel + Railway deployment guide
└── docker-compose.yml                # Local Docker stack (backend + frontend)
```

---

## Local Development Setup

### Prerequisites

- Node.js 20+
- An [Upstash Redis](https://upstash.com) database (free tier works)
- A [TMDB API key](https://www.themoviedb.org/settings/api) (free)
- A GCP project with BigQuery enabled + a service account JSON key

### 1. Clone and install

```bash
git clone https://github.com/Tanendra77/CineGraph.git
cd CineGraph

# Install frontend deps
cd frontend && npm install && cd ..

# Install backend deps
cd backend && npm install && cd ..
```

### 2. Configure environment variables

**`backend/.env`** (copy from `backend/.env.example`):

```env
PORT=3001
TMDB_API_KEY=your_tmdb_key
TMDB_BASE_URL=https://api.themoviedb.org/3

UPSTASH_REDIS_REST_URL=https://your-upstash-url.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_upstash_token

FRONTEND_URL=http://localhost:3000

GCP_PROJECT_ID=your_gcp_project
GCP_DATASET_ID=cinegraph
GCP_LOCATION=US
GOOGLE_APPLICATION_CREDENTIALS=./secrets/your-service-account.json
```

Place your GCP service account JSON in `backend/secrets/`.

**`frontend/.env.local`**:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
NEXT_PUBLIC_TMDB_IMAGE_BASE=https://image.tmdb.org/t/p/w500
```

### 3. Seed Redis

```bash
cd backend
npm run seed        # Seed from local data/seed/movies.json (quick, no BQ needed)
# or
npm run seed:bq     # Seed from BigQuery (requires BQ setup)
```

### 4. Start dev servers

Open two terminals:

```bash
# Terminal 1 — backend (port 3001, hot reload)
cd backend && npm run dev

# Terminal 2 — frontend (port 3000, hot reload)
cd frontend && npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 5. (Optional) BigQuery migration

To run the full 20k-movie dataset migration from TMDB → BigQuery:

```bash
cd backend
npm run migrate             # Full migration (~2–3 hours for 20k movies)
npm run migrate:resume      # Resume if interrupted
npm run migrate:validate    # Check row counts and data quality
npm run seed:bq             # Load BigQuery data into Redis
```

---

## Docker (Local Stack)

```bash
# Copy and fill in the env files first (see step 2 above)

docker-compose build
docker-compose up
```

The compose file starts both services. Frontend build args (`NEXT_PUBLIC_*`) are read from the environment or shell. Runtime vars (e.g. `PORT`) are read from `frontend/.env`.

---

## Running Tests

```bash
cd backend && npm test
```

Jest unit tests cover all six algorithms (`mergeSort`, `knapsack`, `dijkstra`, `floydWarshall`, `kruskal`) and the ML similarity functions.

---

## Deployment

See [`docs/deployment.md`](docs/deployment.md) for the full guide covering:

- Frontend → Vercel (environment variables, root directory config)
- Backend → Railway or VM via Docker
- BigQuery pre-flight migration steps

---

## Algorithm Reference

| Algorithm | File | Complexity | Role in CineGraph |
|---|---|---|---|
| Merge Sort | `algorithms/mergeSort.ts` | O(n log n) | Ranks recommendations by score |
| 0/1 Knapsack | `algorithms/knapsack.ts` | O(n × W) | Selects optimal movie set within watch-time budget |
| Dijkstra | `algorithms/dijkstra.ts` | O((V+E) log V) | Finds closest "taste twin" in user graph |
| Floyd-Warshall | `algorithms/floydWarshall.ts` | O(V³) | All-pairs user similarity for collaborative filtering |
| Kruskal MST | `algorithms/kruskal.ts` | O(E log E) | Detects user taste communities |
| Greedy | `algorithms/greedy.ts` | O(n log n) | Cold-start genre-weighted top-K selection |

---

## Anonymous Sessions

CineGraph uses anonymous UUID sessions — no sign-up required.

- A UUID token is written to a cookie (`cg_token`, 30-day, SameSite=Lax) and `localStorage` on first visit
- The cookie is authoritative; localStorage is the fallback
- Every API request sends `X-Session-Token: <uuid>` in the header
- Ratings, phase, and preferences are keyed by token in Redis

---

## License

MIT
