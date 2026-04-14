# CineGraph — Complete Project Documentation

> Full-stack movie recommendation engine with live algorithm visualization.
> Built as a DS/ML portfolio project.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [System Architecture](#3-system-architecture)
4. [Data Layer — Redis](#4-data-layer--redis)
5. [Data Layer — BigQuery](#5-data-layer--bigquery)
6. [Feature Vectors (40-dim)](#6-feature-vectors-40-dim)
7. [Recommendation Engines](#7-recommendation-engines)
8. [Sorting & Selection Algorithms](#8-sorting--selection-algorithms)
9. [Graph Algorithms](#9-graph-algorithms)
10. [Algorithm Visualizer](#10-algorithm-visualizer)
11. [Complete User Flow](#11-complete-user-flow)
12. [API Reference](#12-api-reference)
13. [Socket.io Events](#13-socketio-events)
14. [Hosting & Deployment](#14-hosting--deployment)

---

## 1. Project Overview

CineGraph is a movie recommendation web app that:

- Recommends movies using three ML approaches (content-based, collaborative filtering, hybrid)
- **Streams the internal algorithm steps live** to the browser so users can watch the algorithms work in real time
- Visualizes 5 algorithms: MergeSort, 0/1 Knapsack, Dijkstra, Kruskal MST, Floyd-Warshall
- Adapts its recommendation strategy based on how many movies the user has rated (cold → warming → full)

The defining feature is the **algorithm visualizer** — every recommendation request runs the algorithms on the server and emits each step over a WebSocket connection. The frontend replays those steps as animations.

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4 |
| Visualization | D3.js v7 (force graphs, SVG), Framer Motion (card animations) |
| Real-time | Socket.io (WebSocket streaming of algorithm steps) |
| Backend | Node.js, Express, TypeScript |
| Cache / Hot path | Upstash Redis (REST API) |
| Cold path / ML storage | Google BigQuery (feature vectors, similarity scores) |
| Movie data | TMDB API (500 pre-fetched movies) |
| Hosting | Vercel (frontend), Railway (backend), Upstash (Redis), GCP (BigQuery) |

---

## 3. System Architecture

```
Browser (Next.js)
     │
     ├─── HTTP POST /recommend ──────────────────────► Express Backend
     │         (returns sessionId immediately)              │
     │                                                      │ async:
     │◄─── Socket.io algo:step {sessionId, step} ◄──────── │ 1. getRecommendations()
     │◄─── Socket.io algo:complete ◄──────────────────────  │ 2. mergeSort(recs)
     │◄─── Socket.io recommend:ready {recs} ◄──────────────  │ 3. knapsack(recs, budget)
     │                                                      │
     ├─── HTTP POST /graph/compute ─────────────────────► Express Backend
     │         (returns graphSessionId)                     │
     │◄─── Socket.io graph:step ◄─────────────────────────  │ 4. kruskal(matrix)
     │◄─── Socket.io graph:complete ◄─────────────────────  │ 5. floydWarshall(matrix)
     │                                                      │ 6. dijkstra(matrix)
     │
     └─── Backend reads from:
               Redis  ── hot path (movie data, ratings, vectors, phase)
               BigQuery ── cold path (feature vectors on miss, similarity scores)
```

### Separation of Concerns

- **Frontend** (`frontend/`): Pure UI. No ML logic, no Redis, no algorithms. Receives data via HTTP + Socket.io.
- **Backend** (`backend/`): All ML, algorithms, Redis, BigQuery. Exposes REST + Socket.io.
- **No Next.js API routes** — `app/api/` does not exist.

### User Identity

Every user is an anonymous UUID (no login required).
- Generated on first visit by `getOrCreateToken()` in `frontend/lib/session.ts`
- Stored in a `cg_token` cookie (30-day, SameSite=Lax) and `localStorage`
- Cookie is authoritative; localStorage is fallback
- Sent to backend as `X-Session-Token` header on every request

---

## 4. Data Layer — Redis

Redis (Upstash) is the **hot path** — everything the server needs during a live request is cached here.

### Key Schema

| Key pattern | Type | Contents |
|---|---|---|
| `movie:<id>` | Hash | Full movie object (title, genres, cast, director, posterPath, etc.) |
| `movie:vector:<id>` | String (JSON) | 40-dim feature vector (24h TTL, lazy-loaded from BQ on miss) |
| `user:<token>:ratings` | Hash | `{ movieId: rating }` — all ratings for a user |
| `user:<token>:phase` | String | `'cold'` \| `'warming'` \| `'full'` |
| `movies:popular:<genre>` | Sorted Set | Movie IDs scored by popularity for that genre |
| `users:all` | Set | All user session tokens (needed for collaborative filtering) |

### Phase System

Phase is computed from rating count and stored in Redis after every rating:

| Rating Count | Phase | Recommendation Strategy |
|---|---|---|
| 0 – 4 | `cold` | Cold start — popularity-based |
| 5 – 19 | `warming` | Content-based — movie similarity |
| 20+ | `full` | Hybrid — content + collaborative |

Phase is recomputed in `computeAndSetPhase()` inside `redis/ratings.ts` every time the `/rate` endpoint is called.

### Cache Miss Strategy

If `movie:vector:<id>` is missing from Redis:
1. Query BigQuery `movie_features` table for the vector
2. Store it in Redis with a 24-hour TTL
3. Return it to the caller

This lazy-loading pattern keeps Redis lean while still serving vectors fast on repeat access.

---

## 5. Data Layer — BigQuery

BigQuery is the **cold path** — pre-computed ML data that the hot path falls back to.

### Tables

#### `movies`
Canonical movie catalogue. Populated once from the TMDB migration script.

| Column | Type | Description |
|---|---|---|
| `movie_id` | INTEGER | TMDB movie ID |
| `title` | STRING | Movie title |
| `genres` | STRING (REPEATED) | List of genre strings |
| `cast_names` | STRING (REPEATED) | Top billed cast |
| `director` | STRING | Director name |
| `keywords` | STRING (REPEATED) | TMDB keyword tags |
| `vote_average` | FLOAT64 | TMDB vote average (0–10) |
| `popularity` | FLOAT64 | TMDB popularity score |
| `runtime` | INTEGER | Runtime in minutes |
| `release_year` | INTEGER | Year of release |

#### `movie_features`
40-dimensional feature vectors, one row per movie.

| Column | Type | Description |
|---|---|---|
| `movie_id` | INTEGER | Foreign key to movies |
| `feature_vector` | FLOAT64 (REPEATED) | 40-dim vector (see Section 6) |
| `feature_version` | INTEGER | Schema version for invalidation |

#### `movie_similarity`
Top-50 most similar movies for every movie, pre-computed using cosine similarity on the feature vectors.

| Column | Type | Description |
|---|---|---|
| `movie_id` | INTEGER | Source movie |
| `similar_movie_id` | INTEGER | Similar movie |
| `similarity_score` | FLOAT64 | Cosine similarity (0–1) |
| `rank` | INTEGER | Rank among the 50 (1 = most similar) |

This table is the backbone of **content-based filtering** — querying it is O(1) per movie.

#### `user_ratings`
Persistent backup of all user ratings (Redis is source of truth for live queries).

---

## 6. Feature Vectors (40-dim)

Every movie is encoded as a 40-dimensional float vector for similarity computation. Built by `buildFeatureVector()` in `backend/src/ml/featureVector.ts`.

| Dimensions | Feature | Encoding |
|---|---|---|
| 0 – 18 | Genre membership | One-hot across 19 TMDB genres (Action, Drama, Horror, …) |
| 19 – 23 | Top 5 cast members | djb2 hash of each name → normalized 0–1 float |
| 24 | Director | djb2 hash → normalized 0–1 float |
| 25 – 34 | Top 10 keywords | TF-IDF weight normalized to ~0–1 |
| 35 | Vote average | `vote_average / 10` |
| 36 | Popularity | `log(popularity + 1) / maxLogPop` |
| 37 | Release decade | `(year − 1970) / 10 * 0.1` (1970=0.1, 2020=0.6) |
| 38 | Runtime | `runtime / 240` (clamped to 1) |
| 39 | Vote count tier | 0.25 (<100), 0.5 (<1000), 0.75 (<10k), 1.0 (≥10k) |

### Why this encoding?

- **Genre one-hot**: Most important signal. Movies in the same genre cluster tightly.
- **Cast/director hashing**: Preserves identity without a lookup table. Same person → same float, different person → different float. Crude but fast.
- **TF-IDF keywords**: Rare keywords (e.g. "time-loop") are more informative than common ones (e.g. "love"). IDF weighting captures this.
- **Popularity + vote count**: Separates mainstream from arthouse. Prevents obscure films with similar keywords from scoring too high.

### Cosine Similarity

Two movies' similarity is `cos(θ) = (A · B) / (|A| × |B|)` — the dot product of their vectors divided by the product of their magnitudes. Output is 0–1. Pre-computed for every pair in BigQuery and stored in `movie_similarity`.

---

## 7. Recommendation Engines

All engines live in `backend/src/ml/`. The entry point is `getRecommendations()` in `hybrid.ts`.

### 7.1 Cold Start (`cold_start` / phase = cold)

**Triggered when:** fewer than 5 ratings.

**Logic:**
1. Read user's preferred genres from Redis (`user:<token>:preferred_genres`) — set during onboarding genre picker
2. For each genre, fetch the top 20 most popular movie IDs from the Redis sorted set `movies:popular:<genre>`
3. Hydrate each ID into a full movie object
4. Score = `voteAverage × 0.7 + 0.3`
5. Return top 20

No ML. Pure popularity ranking filtered by genre preference.

---

### 7.2 Content-Based (`content` / phase = warming)

**Triggered when:** 5–19 ratings.

**Logic:**
```
for each movie the user has rated:
    weight = userRating / 5          (e.g. 5★ → weight 1.0, 2★ → weight 0.4)
    candidates = BigQuery.getTopSimilar(movieId, 50)
    for each candidate:
        candidateScore += similarity × weight

sort candidates by total score
return top 20 (excluding already-rated movies)
```

The key insight: **weighted accumulation**. A candidate gets a high score if it's similar to multiple movies you rated highly. Rating a movie 5★ contributes more signal than 2★.

**Data path:** Reads from BigQuery `movie_similarity` table. One query per rated movie. Results cached in Redis implicitly via the movie hash.

---

### 7.3 Collaborative Filtering (`collaborative` / phase = full)

**Triggered when:** 20+ ratings (or explicitly selected).

**Logic:**
```
1. Fetch ratings for ALL other users from Redis
2. Compute Pearson correlation between current user and each other user
3. Keep top K=10 most similar users (positive correlation only)
4. For each movie those users rated (that current user hasn't):
       predictedRating = userMeanRating + Σ(sim × (neighborRating − neighborMean)) / Σ|sim|
5. Sort by predicted rating, return top 20
```

**Pearson correlation** measures how similarly two users rate the same movies — not just whether they like the same movies, but whether they agree on *which ones are better than others*. Two users who both give everything 5★ have low correlation; two who agree on relative rankings have high correlation.

**The prediction formula** is the standard user-user CF formula:
- `userMeanRating`: corrects for the fact that some users rate everything highly
- `sim × (neighborRating − neighborMean)`: neighbor's rating relative to their own average, weighted by how similar they are to you
- Summing over all K neighbors and normalizing by `Σ|sim|`

**Limitation:** Requires other users with overlapping ratings. Works poorly with few users in Redis.

---

### 7.4 Hybrid (`hybrid` / phase = full)

**Triggered when:** 20+ ratings with engine = hybrid (default).

**Logic:**
```
Run content-based AND collaborative in PARALLEL (Promise.all)
Round-robin interleave the results:
    [content[0], collab[0], content[1], collab[1], …]
Deduplicate by movie ID
Return top 20, all tagged engine: 'hybrid'
```

Interleaving (not score-blending) means neither engine dominates. The final list alternates between "movies similar to what you liked" and "movies your taste-neighbors liked."

---

## 8. Sorting & Selection Algorithms

These run on the **recommendation results** after the ML engine produces them, and stream their steps to the frontend for visualization.

### 8.1 MergeSort

**Purpose:** Rank the recommendations by score (highest first).

**Why MergeSort and not Array.sort?** Because MergeSort produces a clear, step-by-step trace that's visually compelling — splits, comparisons, and merges are all distinct events. `Array.sort` is a black box.

**Implementation** (`backend/src/algorithms/mergeSort.ts`):

```
mergeSort(recommendations[]):
    if length ≤ 1: return
    split into left half and right half
        → emit step { type: 'split', leftIndex, rightIndex }
    recursively sort left
    recursively sort right
    merge(left, right):
        compare left[i].score vs right[j].score
            → emit step { type: 'compare', leftIndex, rightIndex }
        place the higher-scored item
            → emit step { type: 'place', leftIndex, rightIndex }
        when a subarray is fully merged:
            → emit step { type: 'merge', leftIndex, rightIndex }
```

Each step includes the **full current array state** so the frontend can re-render the movie poster cards in their new positions. Framer Motion's `layout` + `layoutId` props animate the cards smoothly between positions.

**Complexity:** O(n log n) time, O(n) space. For n=20 recommendations, produces ~120–150 steps.

---

### 8.2 0/1 Knapsack

**Purpose:** If the user sets a **watch time budget** (e.g. "I have 3 hours"), select the subset of recommendations that maximizes total match score without exceeding the time limit.

**Formulation:**
- Items = recommended movies
- Weight = `movie.runtime` (minutes, defaulting to 90)
- Value = `Math.round(score × 10)` — integer for exact DP
- Capacity = `budgetMinutes` (capped at 600)

**Implementation** (`backend/src/algorithms/knapsack.ts`):

```
Build DP table: dp[i][w] = max value using first i items within w minutes

for i = 1 to n:
    for w = 0 to budget:
        if weight[i] ≤ w:
            dp[i][w] = max(dp[i-1][w], dp[i-1][w-weight[i]] + value[i])
            decision = 'include' or 'exclude'
        else:
            dp[i][w] = dp[i-1][w]
            decision = 'exclude'
        emit step { row: i, col: w, value: dp[i][w], decision }
        emit snapshot every 50 rows (to keep step count manageable)

Backtrack from dp[n][budget] to find selected movies
```

**Complexity:** O(n × budget) time and space. For n=20 movies, budget=180 minutes → ~3,600 DP cells.

**Visualization:** The frontend renders a heatmap grid of the DP table — rows = movies, columns = budget values. Each cell lights up as it's filled. The "include" cells glow green; "exclude" cells are dimmer.

---

## 9. Graph Algorithms

These run on the **user-similarity graph** — a weighted graph where nodes are users and edge weights are their Pearson similarity scores. Triggered by `POST /graph/compute`.

### Building the Similarity Matrix

```
1. Fetch all user IDs from Redis `users:all` (capped at 20)
2. For each pair (i, j):
       sim = max(0, pearsonCorrelation(ratingsI, ratingsJ))
       matrix[i][j] = matrix[j][i] = sim
3. Diagonal = 1 (each user is perfectly similar to themselves)
```

Edge weight in graph algorithms = `1 − similarity` (lower weight = more similar, so shortest path = most similar path).

---

### 9.1 Kruskal's MST

**Purpose:** Detect user communities — groups of users who share similar taste.

**Algorithm:**
```
1. Build all edges (i, j) where similarity > 0.5 (weight ≤ 0.5)
2. Sort edges by weight ascending (most similar pairs first)
3. Union-Find with path compression + union by rank:
   for each edge (u, v, weight):
       emit step { type: 'consider', edge, communities }
       if find(u) ≠ find(v):                    ← no cycle
           union(u, v)
           mstEdges.push(edge)
           emit step { type: 'add', edge, communities }
       else:
           emit step { type: 'reject', edge, communities }
```

**Output:** MST edges + community groups (connected components after MST).

**In the visualizer:** The D3 graph highlights each edge as it's considered (orange), accepted (green), or rejected (red). Community chips on the right panel show groups forming in real time.

**Complexity:** O(E log E) where E = edges. With 20 users, max 190 edges.

---

### 9.2 Dijkstra's Shortest Path

**Purpose:** Find the "taste path" between the current user and their closest taste neighbor — the chain of users connecting them through similarity.

**Algorithm:**
```
Edge weight = 1 − similarity (low weight = high similarity)
source = current user's index in the matrix
target = user with highest similarity to source

Min-heap priority queue:
    dist[source] = 0, all others = ∞
    while heap not empty:
        u = pop lowest dist node
        if visited: skip (lazy deletion)
        mark visited
        emit step { visitedUserId, distance, frontier, path }
        if u == target: break
        for each neighbor v:
            if dist[u] + weight(u,v) < dist[v]:
                update dist[v], prev[v]
                push (v, new dist) to heap

Reconstruct path by following prev[] back from target
```

**Output:** Shortest path array (user IDs), total distance.

**In the visualizer:** Visited nodes pulse brand purple. The current shortest path chain grows as a sequence of user-ID pills. On the D3 graph, the path lights up in purple.

**Complexity:** O((V + E) log V) with the min-heap. Very fast for 20 users.

---

### 9.3 Floyd-Warshall

**Purpose:** Compute **indirect similarity** — how similar are two users who don't share many rated movies, but both share ratings with a third user?

**Algorithm (similarity propagation variant):**
```
Start with the direct similarity matrix

for k = 0 to n-1:          ← intermediate user
    for i = 0 to n-1:      ← source user
        for j = 0 to n-1:  ← target user
            indirect = dist[i][k] * dist[k][j]
            if indirect > dist[i][j]:
                dist[i][j] = indirect    ← propagate through k
                emit snapshot step (every 100th update)
```

**Key difference from standard Floyd-Warshall:** Instead of minimizing distance (`min(dist[i][j], dist[i][k] + dist[k][j])`), this **maximizes similarity** via multiplication (`max(dist[i][j], dist[i][k] × dist[k][j])`). Multiplying similarities chains them: if A is 80% similar to B, and B is 70% similar to C, then A is indirectly ~56% similar to C through B.

**Why emit only snapshot steps?** The triple nested loop generates up to `20³ = 8,000` updates. Emitting every one would flood the socket. Instead, only steps with `matrixSnapshot` (every 100th update) are streamed — ~80 events total.

**Output:** Updated similarity matrix with indirect connections filled in.

**In the visualizer:** An n×n heatmap where cell `[i][j]` color represents similarity value (dark = 0, brand purple = 1). Active cell pulses with a bright outline.

**Complexity:** O(n³). Capped at n=20 users.

---

## 10. Algorithm Visualizer

### Discover Page (`/discover`) — MergeSort + Knapsack

The AlgoDrawer is a slide-out panel fixed to the right side of the screen.

**Data flow:**
1. User clicks "Get Recommendations" → `POST /recommend` → returns `{ sessionId }` immediately
2. Backend runs `getRecommendations()` asynchronously
3. Backend runs `mergeSort(recs)` — emits each step via `algo:step { sessionId, algorithm: 'mergeSort', step }`
4. Backend emits `algo:complete { sessionId, algorithm: 'mergeSort', totalSteps }`
5. If budget was set, backend runs `knapsack(sorted, budget)` — same emit pattern
6. Backend emits `recommend:ready { sessionId, recommendations }` — final movie list delivered

**Frontend buffering (no re-renders during streaming):**
- Steps pushed into `useRef` arrays (`mergeSortStepsRef`, `knapsackStepsRef`) — no state updates
- `algo:complete` sets `msTotalSteps` / `ksTotalSteps` state → triggers one re-render that enables the Play button

**Replay engine:**
```
useEffect([msPlaying, msIndex]):
    if not playing: return
    if index >= totalSteps: stop
    currentStep = stepsRef.current[index - 1]
    render currentStep
    setTimeout(() => setMsIndex(i + 1), replaySpeedMs)
    return () => clearTimeout
```

Two independent replay engines — one for MergeSort, one for Knapsack. Each has its own Play/Pause state and speed controls (60–300ms per step).

**MergeSort visualization:**
- Movie poster cards rendered in a row
- Framer Motion `layout` + `layoutId` props animate cards to new positions
- `compare` step: two cards scale up + glow purple
- `merge` step: merged subarray glows green

**Knapsack visualization:**
- Two-phase layout:
  - Phase 1: DP table heatmap (rows = movies, columns = budget values), active cell highlights
  - Phase 2: Selected movie cards animate in with green glow

---

### Graph Page (`/graph`) — Floyd-Warshall + Dijkstra + Kruskal

**Data flow:**
1. Page mounts → `POST /graph/compute` → returns `{ graphSessionId }`
2. Backend builds similarity matrix → runs Kruskal → Floyd-Warshall → Dijkstra
3. Streams `graph:step { graphSessionId, algorithm, step }` for each
4. Emits `graph:complete { graphSessionId, userIds, similarityMatrix, mstEdges, communities, dijkstraPath, dijkstraTarget }`

**D3 Force-Directed Graph (left panel):**
- Nodes = users, sized by rating count, colored by Kruskal community
- Edges = similarity > 0.3, opacity = strength, MST edges thicker
- D3 force simulation: repulsion (`forceManyBody`) + attraction (`forceLink`) + centering + collision
- Draggable nodes, zoom/pan
- Rebuilds simulation only when `userIds`, `mstEdges`, or `communities` change
- **Click a node** → fetches `GET /profile/:userId/top-movies` → shows 3 movie thumbnails animating out from the node

**Algorithm reactions (live during replay):**
- **Kruskal replay**: D3 highlights the edge being considered/added/rejected
- **Dijkstra replay**: Visited node pulses brand purple, path nodes glow lighter purple
- **Floyd-Warshall replay**: Node pair `(i, j)` pulses briefly on each snapshot update

**Three tabbed panels (right side):**

| Tab | What it shows |
|---|---|
| Kruskal MST | Scrolling edge log (CONSIDER / ADD / REJECT badges), community chips merging in real time |
| Dijkstra Path | Source → target header, growing path pill chain, frontier priority queue |
| Floyd-Warshall | n×n heatmap, progress bar, k/i/j status label |

---

## 11. Complete User Flow

### First Visit (0 ratings)

```
1. Browser loads /
2. frontend/lib/session.ts: generateToken() creates UUID → sets cookie + localStorage
3. Page detects no existing token → new user
4. GenrePicker modal shown → user selects 3 genres
5. POST /recommend { engine: 'cold_start', genres: ['Action', 'Horror', ...] }
   → setPreferredGenres(userId, genres) stored in Redis
   → getRecommendations() → phase='cold' → getTopPopularForGenres()
   → mergeSort(recs) → emits algo:step × N
   → algo:complete
   → recommend:ready { recommendations: [...20 movies] }
6. Frontend receives recommend:ready → renders movie rows grouped by genre
7. AlgoDrawer Play button enabled → user can watch MergeSort replay
```

### Returning User — Warming Phase (5–19 ratings)

```
1. Browser loads → session token found in cookie
2. GET /profile → { phase: 'warming', ratingsCount: 7, ratedMovies: [...] }
3. User visits /discover
4. POST /recommend { engine: 'content' }
   → getRecommendations() → phase='warming' → contentBasedRecommend()
   → for each rated movie: BigQuery getTopSimilar(movieId, 50)
   → accumulate weighted similarity scores
   → mergeSort(recs) → knapsack(recs, budget) if budget set
   → recommend:ready
5. Movie poster clicked → GET /movies/:id → shows detail page with similar movies
6. User rates movie → POST /rate { movieId, rating }
   → setRating() in Redis
   → computeAndSetPhase() → if count hits 20, phase becomes 'full'
```

### Power User — Full Phase (20+ ratings)

```
1. POST /recommend { engine: 'hybrid' }
   → getRecommendations() → phase='full', engine='hybrid'
   → parallel: contentBasedRecommend() + collaborativeRecommend()
   → round-robin interleave results
   → mergeSort → recommend:ready
2. User visits /graph
   → POST /graph/compute
   → Backend: getAllUserIds() → buildSimilarityMatrix()
   → kruskal(matrix): detects communities, streams steps
   → floydWarshall(matrix): propagates indirect similarity, streams snapshots
   → dijkstra(matrix, currentUserIdx, closestNeighborIdx): finds taste path, streams steps
   → graph:complete { userIds, similarityMatrix, mstEdges, communities, dijkstraPath }
   → D3 graph renders with community-colored nodes
   → User clicks a node → satellite movie thumbnails appear
   → User clicks Play on Kruskal tab → watches communities form edge by edge
```

---

### Data Flow Diagram (Recommendation Request)

```
User clicks "Get Recs"
        │
        ▼
POST /recommend { engine, budget }          ← HTTP
        │
        ▼
  Returns { sessionId } immediately         ← HTTP response
        │
        └──── async IIFE starts ────────────────────────────────────┐
                                                                     │
              getRecommendations(userId, engine)                     │
              ┌────────────────────────────────────────┐            │
              │ phase='cold'   → getTopPopularForGenres │            │
              │ phase='warming'→ contentBasedRecommend  │            │
              │ phase='full'   → hybrid (both parallel) │            │
              └────────────────────────────────────────┘            │
                          │                                          │
                          ▼                                          │
              mergeSort(recommendations)                             │
              emits algo:step × N  ──────────────────► Socket.io ──►│ Browser
              emits algo:complete  ──────────────────► Socket.io ──►│ AlgoDrawer
                          │                                          │ enables Play
                          ▼                                          │
              knapsack(sorted, budget)  ← only if budget set        │
              emits algo:step × N  ──────────────────► Socket.io ──►│
              emits algo:complete  ──────────────────► Socket.io ──►│
                          │                                          │
                          ▼                                          │
              emits recommend:ready { recs }  ──────► Socket.io ──►│ Movies render
```

---

## 12. API Reference

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/health` | None | Redis ping + uptime |
| `GET` | `/movies/:id` | Token | Movie detail + top-50 similar |
| `GET` | `/movies/search?q=` | Token | Full-text search |
| `POST` | `/recommend` | Token | Start recommendation job → `{ sessionId }` |
| `POST` | `/rate` | Token | Rate a movie 1–5 → `{ newPhase, ratingsCount }` |
| `GET` | `/profile` | Token | Phase, rating count, all rated movies |
| `GET` | `/profile/:userId/top-movies` | None | Top 3 rated movies for any user (graph node expansion) |
| `POST` | `/graph/compute` | Token | Start graph computation → `{ graphSessionId }` |
| `GET` | `/similarity` | Token | User similarity scores (debug) |

All authenticated endpoints require `X-Session-Token: <uuid>` header.

---

## 13. Socket.io Events

### Client → Server

| Event | Payload | Purpose |
|---|---|---|
| `recommend:start` | `{ engine, budget }` | Log start (informational) |
| `tastepath:find` | `{ sourceUserId, targetUserId }` | Run Dijkstra between two users (legacy) |

### Server → Client

| Event | Payload | Trigger |
|---|---|---|
| `algo:step` | `{ sessionId, algorithm, step }` | Each MergeSort / Knapsack step |
| `algo:complete` | `{ sessionId, algorithm, totalSteps }` | Algorithm finished |
| `recommend:ready` | `{ sessionId, recommendations, engine }` | Final recommendations ready |
| `recommend:error` | `{ message }` | Backend job failed |
| `graph:step` | `{ graphSessionId, algorithm, step }` | Each Kruskal / Floyd / Dijkstra step |
| `graph:complete` | `{ graphSessionId, userIds, similarityMatrix, mstEdges, communities, dijkstraPath, dijkstraTarget }` | Graph computation done |

### Auth

Socket.io connection requires `auth: { token: <uuid> }` in the handshake. The server maps `userId → socketId` in an in-memory `Map`. All emissions use `io.to(socketId).emit()` — events are routed to the specific user's socket only.

---

## 14. Hosting & Deployment

| Service | Platform | Why |
|---|---|---|
| Frontend | Vercel | Next.js native, CDN, automatic deploys |
| Backend | Railway | Persistent Node.js process required for Socket.io (serverless would kill the connection) |
| Redis | Upstash | Serverless Redis via REST API — no persistent connection required |
| BigQuery | Google Cloud Platform | Large-scale SQL for feature vectors and similarity pre-computation |

### Why Railway for the backend?

Socket.io requires a **persistent WebSocket connection**. Serverless platforms (Vercel Functions, AWS Lambda) kill the process after each request — WebSocket connections are impossible. Railway keeps the Node.js process alive.

### Environment Variables

**Backend (`backend/.env`):**
```
PORT=3001
TMDB_API_KEY=                         # from themoviedb.org
UPSTASH_REDIS_REST_URL=               # from Upstash console
UPSTASH_REDIS_REST_TOKEN=             # from Upstash console
FRONTEND_URL=http://localhost:3000    # for CORS
GCP_PROJECT_ID=                       # GCP project
GCP_DATASET_ID=cinegraph
GOOGLE_APPLICATION_CREDENTIALS=      # path to service account JSON
```

**Frontend (`frontend/.env.local`):**
```
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
NEXT_PUBLIC_TMDB_IMAGE_BASE=https://image.tmdb.org/t/p/w500
```
