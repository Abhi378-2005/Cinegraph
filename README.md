<div align="center">

<img src="banner.svg" alt="CineGraph" width="800"/>

CineGraph is a full-stack movie recommendation engine that makes its internals transparent. Every recommendation request streams live algorithm steps to the browser over WebSockets — watch Floyd-Warshall build a similarity matrix, Dijkstra trace a taste path between users, Merge Sort rank results, and Knapsack select your optimal watch list in real time.

---

![Next.js](https://img.shields.io/badge/Next.js_16-000000?style=flat-square&logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React_19-20232A?style=flat-square&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=nodedotjs&logoColor=white)
![Socket.io](https://img.shields.io/badge/Socket.io-010101?style=flat-square&logo=socketdotio&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-DC382D?style=flat-square&logo=redis&logoColor=white)
![BigQuery](https://img.shields.io/badge/BigQuery-4285F4?style=flat-square&logo=googlebigquery&logoColor=white)
![D3.js](https://img.shields.io/badge/D3.js-F9A03C?style=flat-square&logo=d3dotjs&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_v4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white)

</div>

---

## What Makes It Different

Most recommendation projects return a list. CineGraph shows you the work — every sort pass, every matrix pivot, every graph edge as they happen. The algorithms and the ML are both the product.

- Real dataset — TMDB API, 20k movies with genres, cast, keywords, ratings
- Both content-based and collaborative filtering — the hybrid approach used by Netflix and Spotify
- Every algorithm step visualized live over WebSockets, replayable at adjustable speed
- Covers graph algorithms, dynamic programming, and ML concepts end-to-end
- No login required — anonymous UUID sessions, works instantly

---

## Recommendation Engines

CineGraph adapts its strategy based on how many movies you have rated.

| Phase | Threshold | Engine |
|---|---|---|
| Cold Start | 0 – 4 ratings | Greedy genre-weighted ranking |
| Warming Up | 5 – 19 ratings | Content-based — cosine similarity on 40-dim feature vectors |
| Full | 20+ ratings | Hybrid — content-based + collaborative, round-robin interleaved |

**Content-based filtering**
Each movie is encoded as a 40-dimensional feature vector — 19 genre one-hots, 5 cast hashes, 1 director hash, 10 keyword TF-IDF scores, vote average, log-popularity, and release decade. Recommendations are ranked by cosine similarity to movies you rated highly.

**Collaborative filtering**
Users are nodes in a graph. Edge weight = Pearson correlation between rating vectors. Top-K nearest neighbours vote on movies you haven't seen.

**Hybrid engine**
Both engines run in parallel and results are interleaved round-robin. Falls back to content-based if collaborative data is sparse.

**Cold start**
Genre preferences picked on arrival feed a greedy scorer: `(vote_average × 0.7) + (popularity_normalized × 0.3)`.

**Watch Budget (Knapsack)**
Set a time budget in hours. The 0/1 Knapsack DP selects the optimal subset of recommendations that maximises your predicted enjoyment within the budget.

---

## Algorithm Visualizer

Every recommendation request emits steps over Socket.io. The frontend buffers them in refs — no re-renders during streaming — then replays them as animations at adjustable speed.

| Algorithm | Complexity | Visualization |
|---|---|---|
| **Merge Sort** | O(n log n) | Poster cards animate into sorted order via Framer Motion `layoutId` transitions |
| **0/1 Knapsack** | O(n × W) | DP table replay — cells light up as the optimizer fills each row |
| **Floyd-Warshall** | O(V³) | Live n×n heatmap with purple crosshair on the active pivot row and column |
| **Dijkstra** | O((V+E) log V) | Shortest taste-path traces edge-by-edge on the user graph with a glow filter |
| **Kruskal MST** | O(E log E) | Edges appear in weight order, community clusters rendered in distinct colors |
| **Greedy** | O(n log n) | Cold-start top-K pass visible in the recommendation drawer |

---

## Pages

| Route | Description |
|---|---|
| `/` | Genre picker — cold start onboarding |
| `/discover` | Recommendation feed with engine badge, match % scores, and algorithm drawer |
| `/graph` | Interactive user similarity graph — Floyd-Warshall, Dijkstra, and Kruskal tabs |
| `/movie/[id]` | Movie detail — poster, overview, cast, and similar movies |
| `/architecture` | Live React Flow diagram of the full system with animated data-flow edges |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Browser                                                     │
│                                                             │
│  Next.js 16 (App Router)          Socket.io client         │
│  ┌──────────────────┐             ┌───────────────────┐    │
│  │  /discover       │  REST API   │  algo:step        │    │
│  │  /graph          │ ──────────► │  graph:step       │    │
│  │  /architecture   │ ◄────────── │  recommend:ready  │    │
│  │  /movie/[id]     │             └───────────────────┘    │
│  └──────────────────┘                                       │
└───────────────────────────────┬─────────────────────────────┘
                                │  HTTP + WebSocket
                                ▼
┌─────────────────────────────────────────────────────────────┐
│  Express + Socket.io                                        │
│                                                             │
│  ML Engines            Algorithms         Socket Emitter    │
│  ┌──────────────┐    ┌──────────────┐   ┌──────────────┐  │
│  │ cold_start   │    │ mergeSort    │   │ emitToUser() │  │
│  │ content      │    │ knapsack     │   │ sessionId-   │  │
│  │ collaborative│    │ dijkstra     │   │ gated step   │  │
│  │ hybrid       │    │ floydWarshall│   │ streaming    │  │
│  └──────────────┘    │ kruskal      │   └──────────────┘  │
│                      │ greedy       │                       │
│                      └──────────────┘                       │
└──────────────────────────┬──────────────────────────────────┘
                           │
             ┌─────────────┴──────────────┐
             ▼                            ▼
┌────────────────────┐      ┌─────────────────────────┐
│  Upstash Redis     │      │  Google BigQuery         │
│                    │      │                          │
│  movie:<id> hash   │      │  movies                  │
│  user:<t>:ratings  │      │  movie_features (40-dim) │
│  movies:popular:*  │      │  movie_similarity        │
│  user:<t>:phase    │      │  (top-50 per movie via   │
│  users:all set     │      │   VECTOR_SEARCH job)     │
└────────────────────┘      └─────────────────────────┘
```

See [`Doc/CineGraph-ArchiDiag.png`](Doc/CineGraph-ArchiDiag.png) for the full visual diagram.

**Request flow**

1. Frontend sends `POST /recommend` with `X-Session-Token` → backend returns `{ sessionId }` immediately
2. Async job runs `getRecommendations` → `mergeSort` → optionally `knapsack`
3. Each step emits `algo:step { sessionId, algorithm, step }` over Socket.io
4. `algo:complete` enables the Play button in the drawer
5. `recommend:ready` delivers the final ranked list

**Data layer**

Redis is the hot path — movie hashes, user ratings, popular-by-genre sorted sets, and feature vector cache (24 h TTL). BigQuery is the cold path — 40-dim feature vectors and top-50 similarity pairs per movie computed by a `VECTOR_SEARCH` SQL job. On a cache miss the backend fetches from BigQuery and backfills Redis.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 · React 19 · TypeScript |
| Styling | Tailwind CSS v4 |
| Graph & matrix visualization | D3.js v7 |
| Card animations | Framer Motion |
| Architecture diagram | React Flow |
| Real-time streaming | Socket.io |
| Backend | Node.js · Express · TypeScript |
| Cache / hot path | Upstash Redis (REST API) |
| Cold storage / ML | Google BigQuery |
| Movie data | TMDB API |
| Containerization | Docker · docker-compose |
| Frontend hosting | Vercel |
| Backend hosting | Railway |

---

## Project Structure

```
cinegraph/
├── frontend/
│   ├── app/
│   │   ├── page.tsx                    # Landing — genre picker
│   │   ├── discover/page.tsx           # Recommendation feed + AlgoDrawer
│   │   ├── graph/page.tsx              # User similarity graph explorer
│   │   ├── architecture/page.tsx       # Interactive system diagram
│   │   └── movie/[id]/page.tsx         # Movie detail page
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AlgoDrawer.tsx          # Algorithm replay viewer
│   │   │   ├── Navbar.tsx              # Search bar + profile drawer
│   │   │   ├── ProfileDrawer.tsx       # Ratings history + phase indicator
│   │   │   ├── SearchBar.tsx           # Debounced live search
│   │   │   └── SpeedControls.tsx       # Shared replay speed controls
│   │   ├── graph/
│   │   │   ├── D3UserGraph.tsx         # D3 force-directed user graph
│   │   │   ├── DijkstraPanel.tsx       # Path chain + distance bar
│   │   │   ├── FloydWarshallPanel.tsx  # Heatmap + crosshair + update badge
│   │   │   └── KruskalPanel.tsx        # MST edge list replay
│   │   ├── movies/
│   │   │   ├── MovieCard.tsx           # Poster card with match % badge
│   │   │   └── MovieRow.tsx            # Horizontal scroll row
│   │   ├── architecture/
│   │   │   ├── ArchitectureFlow.tsx    # React Flow canvas
│   │   │   ├── NodeDetailDrawer.tsx    # Slide-in node detail panel
│   │   │   └── edges/AnimatedEdge.tsx  # Travelling-dot animated edges
│   │   └── recommendation/
│   │       └── WatchBudget.tsx         # Knapsack budget toggle + slider
│   └── lib/
│       ├── api.ts                      # HTTP client — all backend calls
│       ├── socket.ts                   # Socket.io client wrapper
│       ├── session.ts                  # Anonymous UUID session management
│       ├── formatters.ts               # posterUrl(), runtime, score helpers
│       └── types.ts                    # Shared TypeScript interfaces
│
├── backend/
│   └── src/
│       ├── algorithms/
│       │   ├── mergeSort.ts            # Ranked sort with step recording
│       │   ├── knapsack.ts             # 0/1 DP with step recording
│       │   ├── dijkstra.ts             # Shortest taste-path with step recording
│       │   ├── floydWarshall.ts        # All-pairs similarity with step recording
│       │   ├── kruskal.ts              # MST community detection with step recording
│       │   └── greedy.ts               # Cold start top-K selector
│       ├── ml/
│       │   ├── hybrid.ts               # Engine orchestrator + phase detection
│       │   ├── contentBased.ts         # Cosine similarity recommendations
│       │   └── collaborative.ts        # Pearson CF recommendations
│       ├── bigquery/                   # BQ client, feature vector + similarity queries
│       ├── redis/                      # User ratings, phase, vectors, movie cache
│       ├── routes/                     # recommend · rate · movies · graph · profile
│       ├── socket/socketServer.ts      # Socket.io + emitToUser wiring
│       └── tmdb/                       # TMDB API client + preprocessor
│
├── data/seed/                          # Pre-fetched seed data (movies + ratings)
├── docs/deployment.md                  # Full deployment guide
└── docker-compose.yml                  # Local Docker stack
```

---

## Local Development Setup

### Prerequisites

- Node.js 20+
- [Upstash Redis](https://upstash.com) database — free tier works
- [TMDB API key](https://www.themoviedb.org/settings/api) — free
- GCP project with BigQuery enabled + service account JSON key

### 1 — Clone and install

```bash
git clone https://github.com/Tanendra77/CineGraph.git
cd CineGraph

cd frontend && npm install && cd ..
cd backend  && npm install && cd ..
```

### 2 — Configure environment variables

Create `backend/.env` (use `backend/.env.example` as the template):

```env
PORT=3001
TMDB_API_KEY=your_tmdb_key
TMDB_BASE_URL=https://api.themoviedb.org/3

UPSTASH_REDIS_REST_URL=https://your-db.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_token

FRONTEND_URL=http://localhost:3000

GCP_PROJECT_ID=your_project
GCP_DATASET_ID=cinegraph
GCP_LOCATION=US
GOOGLE_APPLICATION_CREDENTIALS=./secrets/your-service-account.json
```

Place your GCP service account JSON in `backend/secrets/`.

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
NEXT_PUBLIC_TMDB_IMAGE_BASE=https://image.tmdb.org/t/p/w500
```

### 3 — Seed Redis

```bash
cd backend
npm run seed       # from local data/seed/movies.json — fast, no BigQuery needed
# or
npm run seed:bq    # from BigQuery — requires full BQ setup
```

### 4 — Start dev servers

```bash
# Terminal 1
cd backend && npm run dev    # Express on :3001, hot reload

# Terminal 2
cd frontend && npm run dev   # Next.js on :3000, hot reload
```

Open [http://localhost:3000](http://localhost:3000).

### 5 — BigQuery migration (optional)

Required only if you want the full 20k-movie dataset:

```bash
cd backend
npm run migrate              # Full TMDB → BigQuery pipeline (~2–3 hours)
npm run migrate:resume       # Resume an interrupted migration
npm run migrate:validate     # Verify row counts and data quality
npm run seed:bq              # Backfill Redis from BigQuery
```

Expected after `migrate:validate`:

| Table | Rows |
|---|---|
| `movies` | ~20,000 |
| `movie_features` | ~20,000 |
| `movie_similarity` | ~1,000,000 |

---

## Docker

```bash
# Fill in backend/.env and frontend/.env first

docker-compose build
docker-compose up
```

Frontend build args (`NEXT_PUBLIC_*`) are sourced from the environment at build time. Runtime vars (`PORT`, `HOSTNAME`) are read from `frontend/.env`.

---

## Tests

```bash
cd backend && npm test
```

Jest unit tests cover all six algorithms and the ML similarity functions.

---

## Deployment

See [`docs/deployment.md`](docs/deployment.md) for the complete guide:

- Frontend → Vercel (root directory, environment variables)
- Backend → Railway or VM via Docker
- BigQuery pre-flight migration steps

---

## Anonymous Sessions

No sign-up required. On first visit a UUID token is written to a cookie (`cg_token`, 30-day, SameSite=Lax) and `localStorage`. The cookie is authoritative; localStorage is the fallback. Every API request sends `X-Session-Token: <uuid>`. Ratings, phase, and preferences are all keyed by token in Redis.

---

## License

MIT
