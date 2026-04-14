# CineGraph Backend Design

**Date:** 2026-03-04
**Scope:** Complete `backend/` implementation — Express + TypeScript + Upstash Redis + Socket.io, all DSA algorithms from scratch, ML layer, REST API, seed pipeline.

## Decisions Made

| Question | Decision |
|---|---|
| Build strategy | Option A — layered bottom-up |
| Redis | Upstash (REST-based) via `@upstash/redis` SDK, credentials from env |
| TMDB | API key from env; seed script writes `data/seed/movies.json` as local backup |
| DSA algorithms | All implemented from scratch — no algorithm libraries |
| Priority | Recommendations flowing first (routes + socket), graph algorithms second |
| Synthetic data | 50 pre-generated users in `data/seed/synthetic_ratings.json` |
| Step streaming | 16ms interval cap (~60fps) to avoid browser flooding |

## Build Order (Layered)

```
1.  Scaffold: package.json, tsconfig, Express entry, .env.example, backend/src/types.ts
2.  Redis client: Upstash connection + ping health check
3.  TMDB client: axios wrapper + movie fetcher + preprocessor
4.  Seed script: TMDB → data/seed/movies.json → Redis (movies + vectors + popular sets + synthetic ratings)
5.  ML layer: featureVector → cosineSimilarity → pearsonCorrelation → contentBased → collaborative → hybrid
6.  DSA algorithms: mergeSort → greedy → knapsack → floydWarshall → dijkstra → kruskal
7.  REST routes: /health → /movies → /rate → /recommend → /similarity
8.  Socket.io server: step streaming for all algorithms
```

Frontend receives real data after step 7. Steps 5–6 unlock graph page + algo drawer.

---

## Section 1: Foundation

### Dependencies
```bash
# Runtime
npm install express cors dotenv axios socket.io @upstash/redis zod

# Dev
npm install -D typescript ts-node-dev @types/express @types/cors @types/node
```

### `tsconfig.json`
- `"target": "ES2020"`, `"module": "commonjs"`, `"outDir": "dist"`, `"rootDir": "src"`, `"strict": true`

### `backend/src/index.ts` — Express entry
- Creates HTTP server, mounts Express app, attaches Socket.io
- Loads `dotenv` before any other import
- `PORT` from env (default 3001)
- CORS: `FRONTEND_URL` env var whitelisted on Express + Socket.io

### `backend/.env.example`
```
PORT=3001
TMDB_API_KEY=
TMDB_BASE_URL=https://api.themoviedb.org/3
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
FRONTEND_URL=http://localhost:3000
```

### `npm` scripts
```json
"dev": "ts-node-dev --respawn --transpile-only src/index.ts",
"build": "tsc",
"start": "node dist/index.js",
"seed": "ts-node-dev --transpile-only scripts/seedData.ts"
```

---

## Section 2: Data Pipeline

### `backend/src/tmdb/client.ts`
- axios instance: `baseURL = TMDB_BASE_URL`, `params: { api_key: TMDB_API_KEY }` injected globally

### `backend/src/tmdb/fetcher.ts`
- `fetchPopularMovies(pages = 20)` — GET `/movie/popular` × 20 pages (500 movies)
- `fetchMovieCredits(id)` — GET `/movie/:id/credits` → top-5 cast + director
- `fetchMovieKeywords(id)` — GET `/movie/:id/keywords`
- Rate limiting: 250ms delay between requests (TMDB free tier = 40 req/s)

### `backend/src/tmdb/preprocessor.ts`
- `preprocessMovie(raw)` — maps TMDB snake_case → camelCase `Movie` shape
- Genre IDs → genre names via TMDB genre map
- Guards: missing runtime defaults to 0, missing poster defaults to `''`

### `scripts/seedData.ts`
```
1. If data/seed/movies.json exists → skip TMDB fetch (use local file)
2. Else → fetch 500 movies from TMDB → write data/seed/movies.json
3. For each movie: build feature vector → SET movie:vector:<id>
4. HSET movie:<id> with title, genres, runtime, poster, overview, etc.
5. ZADD popular:all score=(vote_avg×0.7 + pop_norm×0.3) member=movieId
6. ZADD popular:<genre> for each genre
7. Load data/seed/synthetic_ratings.json → HSET user:<id>:ratings + SET user:<id>:phase
```

### `data/seed/synthetic_ratings.json`
50 users, ~200 ratings each, genre-biased:
- `synth_001–010`: Action/Thriller fans
- `synth_011–020`: Drama/Romance fans
- `synth_021–030`: Sci-Fi/Fantasy fans
- `synth_031–040`: Horror fans
- `synth_041–050`: Mixed taste

---

## Section 3: ML Layer

All files in `backend/src/ml/`. Pure functions, no ML libraries.

### `featureVector.ts`
49-dimensional vector per movie:
```
[0-27]  Genre one-hot (28 TMDB genres, fixed order)
[28-32] Top 5 cast names (djb2 hash → mod 1000 / 1000)
[33]    Director (same hash)
[34-43] Top 10 keywords (TF-IDF weight = tf × log(N/df))
[44]    vote_average / 10
[45]    log(popularity + 1) / log(max_popularity + 1)
[46]    (releaseYear - 1970) / 60  (clamped 0-1)
[47]    runtime / 240 (clamped 0-1)
[48]    vote count tier: <100=0.25, <1000=0.5, <10000=0.75, else=1.0
```
Result cached in Redis `movie:vector:<id>`.

### `cosineSimilarity.ts`
```typescript
function cosineSimilarity(a: number[], b: number[]): number
// dot(a,b) / (|a| × |b|), returns 0 if either magnitude is 0
```

### `pearsonCorrelation.ts`
```typescript
function pearsonCorrelation(
  ratingsA: Record<number, number>,
  ratingsB: Record<number, number>
): number
// Returns 0 if < 2 co-rated movies
// Mean-centered: r = Σ(a_i - ā)(b_i - b̄) / sqrt(Σ(a_i-ā)² × Σ(b_i-b̄)²)
```

### `contentBased.ts`
```typescript
async function contentBasedRecommend(userId: string, topN = 20): Promise<Recommendation[]>
// 1. Load user ratings from Redis
// 2. Load feature vectors of rated movies
// 3. Build taste profile = weighted avg of vectors (weight = rating/5)
// 4. Cosine similarity between profile and all other movie vectors
// 5. Filter out already-rated movies
// 6. Return top-N as Recommendation[]
```

### `collaborative.ts`
```typescript
async function collaborativeRecommend(userId: string, topN = 20): Promise<Recommendation[]>
// 1. Load all users' ratings from Redis
// 2. Pearson correlation between current user and each other user
// 3. Top-K similar users (K=10)
// 4. For each unseen movie: predicted = mean(U) + Σ sim(U,N)×(r(N,M)-mean(N)) / Σ|sim(U,N)|
// 5. Return top-N sorted by predicted rating
```

### `hybrid.ts`
```typescript
async function hybridRecommend(
  userId: string,
  engine: 'content' | 'collaborative' | 'hybrid' | 'cold_start',
  budget?: number
): Promise<{ recommendations: Recommendation[]; steps: AlgoStep[] }>
// Routes to correct engine based on engine param + user phase
// If budget provided: runs knapsack on top of engine results
// Returns both final recommendations + all algorithm steps
```

---

## Section 4: DSA Algorithms (from scratch)

All files in `backend/src/algorithms/`. Every data structure hand-implemented.

### `mergeSort.ts`
```typescript
function mergeSort(items: Recommendation[]): { sorted: Recommendation[]; steps: MergeSortStep[] }
// Standard merge sort, records split/compare/merge/place at every operation
// Comparator: score descending
```

### `greedy.ts`
```typescript
function greedyTopK(
  movies: Movie[],
  preferredGenres: string[],
  topN: number
): Recommendation[]
// Score = (vote_average × 0.7) + (popularity_normalized × 0.3)
// Filter by genre overlap first, then sort by score
// No step recording (instant computation)
```

### `knapsack.ts`
```typescript
function knapsack(
  movies: Recommendation[],
  budgetMinutes: number
): { selected: Recommendation[]; totalScore: number; steps: KnapsackStep[] }
// Standard 0/1 DP: dp[i][w] = max score for first i movies within w minutes
// Weight = movie.runtime, value = recommendation.score × 10
// Records every dp[i][w] cell as KnapsackStep
// Backtrack from dp[n][budget] to find selected movies
```

### `floydWarshall.ts`
```typescript
function floydWarshall(
  similarityMatrix: number[][],
  userIds: string[]
): { matrix: number[][]; steps: FloydStep[] }
// Transitive similarity: sim[i][j] = max(sim[i][j], sim[i][k] × sim[k][j])
// Capped at 20 users (20³ = 8000 steps max)
// Records FloydStep on every cell update
```

### `dijkstra.ts`
```typescript
function dijkstra(
  similarityMatrix: number[][],
  userIds: string[],
  sourceIdx: number,
  targetIdx: number
): { path: string[]; distance: number; steps: DijkstraStep[] }
// Min-heap priority queue implemented as binary heap array
// Edge weight = 1 - similarity[i][j]
// Records DijkstraStep at every node extraction from heap
```

### `kruskal.ts`
```typescript
function kruskal(
  similarityMatrix: number[][],
  userIds: string[]
): { mstEdges: Edge[]; communities: string[][]; steps: MSTStep[] }
// Union-Find with path compression + union by rank (hand-implemented)
// Build all edges, sort by weight ascending (most similar first)
// Add edge if no cycle (Union-Find find() returns different roots)
// Prune edges with weight > 0.5 (similarity < 0.5)
// Records MSTStep for every edge considered (add/reject/consider)
```

---

## Section 5: REST Routes + Socket.io

### Routes (`backend/src/routes/`)

**`health.ts`** — `GET /health`
```typescript
{ status: 'ok'; redis: boolean; uptime: number }
```

**`movies.ts`** — `GET /movies/search?q=`, `GET /movies/:id`
- Search: KMP algorithm through cached movie titles; returns `{ movies: Movie[] }`
- Detail: fetch movie from Redis + compute top-6 similar via cosine; returns `{ movie, similar }`

**`rate.ts`** — `POST /rate`
- Body: `{ movieId: number; rating: number }` (userId from `X-Session-Token`)
- Validates rating 1–5 with zod
- HSET rating in Redis, recompute phase (cold < 5 ratings, warming < 20, full ≥ 20)
- Returns `{ success, newPhase, ratingsCount }`

**`recommend.ts`** — `POST /recommend`
- Body: `{ engine, budget?, genres? }` (userId from `X-Session-Token`)
- Generates `sessionId = crypto.randomUUID()`
- Kicks off async recommendation job (does NOT await)
- Returns `{ sessionId }` immediately
- Async job: run engine → mergeSort → knapsack (if budget) → stream steps via socket → emit `recommend:ready`

**`similarity.ts`** — `GET /similarity?type=user`
- Generates sessionId, kicks off Floyd-Warshall async
- Returns `{ sessionId }` immediately
- Async job: build Pearson matrix → floydWarshall → stream steps → emit `algo:complete`

### Socket.io (`backend/src/socket/socketServer.ts`)

- Attaches to Express HTTP server: `new Server(httpServer, { cors: { origin: FRONTEND_URL } })`
- Auth middleware: `socket.handshake.auth.token` must be non-empty string
- On connect: join room `socket.id` (used as channel for session results)

**Client → Server:**
```typescript
'recommend:start'    → { engine, budget? } → run hybrid engine → stream steps
'similarity:compute' → { userIds }         → run Floyd-Warshall → stream steps
'tastepath:find'     → { sourceUserId, targetUserId } → run Dijkstra → stream steps
```

**Streaming helper:**
```typescript
async function streamSteps(socket, sessionId, steps, event = 'algo:step') {
  for (const step of steps) {
    socket.to(sessionId).emit(event, step);
    await delay(16); // ~60fps cap
  }
}
```

**Server → Client:**
```typescript
'algo:step'        → { algorithm, step }
'algo:complete'    → { algorithm, durationMs, totalSteps }
'recommend:ready'  → { recommendations, engine }
'community:update' → { communities, mstEdges }
```

---

## Key Constraints

- Floyd-Warshall capped at 20 users (20³ = 8000 steps)
- User graph max 50 nodes for D3 force layout
- Pearson requires min 2 co-rated movies — returns 0 otherwise
- Movie corpus: 500 movies, no live TMDB search during demo
- All Redis access via Upstash REST SDK — no `ioredis`, no local Redis process
- No Next.js API routes — Express only
- `X-Session-Token` header required on all REST calls; socket auth token required on connect
