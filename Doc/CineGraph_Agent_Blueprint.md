# CineGraph — Movie Recommendation Engine (Agent Build Blueprint)

> **Purpose:** Hand this to a coding agent as the complete specification to build CineGraph from scratch. Every component, algorithm, API contract, data model, ML concept, and file is described below. This is a Data Science + DSA hybrid project targeting DS/ML roles.
>
> **Architecture:** Separated frontend + backend (non-monolithic). The frontend is a Next.js app that communicates with an independent Express/Node.js backend via REST API and Socket.io. No Next.js API routes are used for business logic.

---

## 1. Project Overview

**Name:** CineGraph  
**Tagline:** *Watch algorithms discover what you'll love next.*  
**Type:** Full-stack Movie Recommendation System with live algorithm visualization  
**Core thesis:** A production-grade recommendation engine that makes its internals transparent — users see the graph similarity matrix building, the community clusters forming, the ranking sort executing. The algorithms and the ML concepts are both the product.

### Why It Stands Out
- Uses a **real dataset** — TMDB API (500k+ movies, ratings, genres, cast, keywords)
- Implements **both** content-based AND collaborative filtering — the hybrid approach used by Netflix/Spotify
- Every algorithm step is **visualized live** — Floyd-Warshall matrix, MST community graph, Dijkstra path between users
- Covers **entire DSA syllabus** while introducing real ML/DS concepts (cosine similarity, cold start, feature vectors)
- Fully hosted with live demo — interviewers can test it with their own movie preferences

---

## 2. The Three Recommendation Engines

### Engine 1: Content-Based Filtering
**"Movies similar to ones you liked"**

Each movie is represented as a **feature vector**:
- Genre one-hot encoding (28 TMDB genres)
- Top 5 cast members (encoded)
- Director (encoded)
- Keywords/tags (TF-IDF weighted)
- Average rating, popularity score, release decade

Similarity between two movies = **Cosine Similarity** of their feature vectors.

**DSA algorithm used:** This similarity matrix is computed for all pairs using a Floyd-Warshall-style O(n²) pass. The similarity matrix is a D3 heatmap showing which movies cluster together. Merge Sort ranks recommendations by similarity score.

**Visual:** User selects a movie → similarity scores compute live → sorted result cards animate in via Merge Sort visualization.

---

### Engine 2: Collaborative Filtering (Graph-Based)
**"Users who liked what you liked, also liked..."**

Users are nodes in a graph. Edge weight between two users = their rating similarity score (Pearson correlation or cosine similarity on their rating vectors).

**DSA algorithms used:**
- **Floyd-Warshall**: Computes all-pairs user similarity — the "degree of connection" between every user pair. Visualized as a live n×n heatmap updating.
- **Dijkstra**: Finds the closest "taste path" between the current user and any other user — the 6-degrees-of-separation for movie taste.
- **Kruskal's / Prim's MST**: Detects user communities — groups of users with highly similar taste. Each community cluster gets a color on the graph visualization. MST connects users with highest similarity edges.
- **Greedy Top-K**: Once similar users are found, greedily selects the top-K movies rated highly by those users but not yet seen by the current user.

**Visual:** Interactive node-link graph (D3 force layout) where users are nodes. MST edges glow. Dijkstra path between current user and a selected "taste twin" animates.

---

### Engine 3: Hybrid + Cold Start
**"Smart recommendations for new users"**

Cold start problem: new users have no rating history. Solution:
- **Phase 1 (Cold Start):** Greedy algorithm picks top-rated movies by genre preference (user selects 3 genres on signup). Ranks by weighted score: `(vote_average × 0.7) + (popularity_normalized × 0.3)`.
- **Phase 2 (Warming Up):** After 5+ ratings, switches to content-based filtering.
- **Phase 3 (Full):** After 20+ ratings, activates collaborative filtering.

**DSA algorithm used:** 0/1 Knapsack — user sets a "watch time budget" (e.g. 4 hours). Knapsack selects the optimal set of movies maximizing total predicted rating within the time budget. DP table visualized live.

---

## 3. Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | Next.js 16 (App Router) + TypeScript | App shell, SSR pages, UI only |
| Styling | Tailwind CSS v4 | Utility-first responsive design |
| Graph visualization | D3.js (force layout) | User similarity graph, MST, Dijkstra path |
| Matrix visualization | D3.js (heatmap) | Floyd-Warshall similarity matrix |
| Animation | Framer Motion | Result card ranking animation (Merge Sort) |
| Real-time | Socket.io client | Receive algorithm step streams from backend |
| Backend runtime | Node.js + Express + TypeScript | REST API + Socket.io server |
| Algorithms & ML | TypeScript (in backend) | Feature vectors, cosine similarity, CF, all DSA |
| Data source | TMDB API (free tier) | Movies, ratings, genres, cast, keywords |
| Cache + storage | Redis (Upstash) | User ratings, similarity matrices, session data |
| Frontend host | Vercel | Zero-config Next.js deploy |
| Backend host | Railway | Express + Socket.io + Redis computation |

---

## 4. Repository Structure

```
cinegraph/
├── frontend/                           # Next.js 16 app (UI only, no business logic)
│   ├── app/
│   │   ├── page.tsx                    # Landing — genre picker (cold start)
│   │   ├── discover/page.tsx           # Main recommendation feed
│   │   ├── graph/page.tsx              # User similarity graph explorer
│   │   ├── movie/[id]/page.tsx         # Movie detail + similar movies
│   │   └── layout.tsx
│   ├── components/
│   │   ├── MovieCard.tsx               # Movie poster, title, rating, match %
│   │   ├── RecommendationFeed.tsx      # Merge-sort animated result list
│   │   ├── SimilarityMatrix.tsx        # D3 Floyd-Warshall heatmap
│   │   ├── UserGraph.tsx               # D3 force layout — user similarity graph
│   │   ├── MSTOverlay.tsx              # MST edges on user graph
│   │   ├── DijkstraPath.tsx            # Dijkstra taste-path animation
│   │   ├── KnapsackPanel.tsx           # 0/1 Knapsack DP table for watch budget
│   │   ├── AlgoExplainer.tsx           # Inline explanation of active algorithm
│   │   ├── GenrePicker.tsx             # Cold start onboarding (3 genre picks)
│   │   ├── RatingStars.tsx             # 1-5 star rating input
│   │   ├── EngineSelector.tsx          # Toggle: Content / Collaborative / Hybrid
│   │   └── StatsPanel.tsx              # Accuracy metrics, coverage, diversity
│   ├── lib/                            # UI-only helpers (NO business logic / ML / algos)
│   │   ├── api.ts                      # HTTP client — calls backend REST endpoints
│   │   ├── socket.ts                   # Socket.io client wrapper
│   │   ├── session.ts                  # Anonymous UUID session (localStorage)
│   │   ├── formatters.ts               # Date, runtime, score display helpers
│   │   └── types.ts                    # Shared TypeScript interfaces (mirror of backend)
│   ├── public/
│   ├── package.json
│   ├── next.config.ts
│   └── tsconfig.json
│
├── backend/                            # Express + Socket.io server (all ML/DSA here)
│   ├── src/
│   │   ├── algorithms/
│   │   │   ├── floydWarshall.ts        # All-pairs similarity with step recording
│   │   │   ├── dijkstra.ts             # Taste-path finding with step recording
│   │   │   ├── kruskal.ts              # Community detection MST
│   │   │   ├── prim.ts                 # Alternative MST for comparison
│   │   │   ├── mergeSort.ts            # Recommendation ranking with steps
│   │   │   ├── knapsack.ts             # Watch-budget optimizer
│   │   │   └── greedy.ts              # Cold start top-K selector
│   │   ├── ml/
│   │   │   ├── featureVector.ts        # Build movie feature vectors from TMDB data
│   │   │   ├── cosineSimilarity.ts     # Cosine similarity between vectors
│   │   │   ├── pearsonCorrelation.ts   # User rating correlation
│   │   │   ├── contentBased.ts         # Content-based recommendation engine
│   │   │   ├── collaborative.ts        # Collaborative filtering engine
│   │   │   └── hybrid.ts               # Hybrid engine + cold start logic
│   │   ├── redis/
│   │   │   ├── client.ts               # Upstash Redis client
│   │   │   ├── ratings.ts              # Store/retrieve user ratings
│   │   │   ├── vectors.ts              # Cache movie feature vectors
│   │   │   └── similarity.ts           # Cache computed similarity matrices
│   │   ├── routes/
│   │   │   ├── movies.ts               # GET /movies/search, GET /movies/:id
│   │   │   ├── recommend.ts            # POST /recommend
│   │   │   ├── rate.ts                 # POST /rate
│   │   │   ├── similarity.ts           # GET /similarity
│   │   │   └── health.ts               # GET /health
│   │   ├── socket/
│   │   │   └── socketServer.ts         # Socket.io event handlers + algo step streaming
│   │   ├── tmdb/
│   │   │   ├── client.ts               # TMDB API wrapper
│   │   │   ├── fetcher.ts              # Fetch movie details, genres, credits
│   │   │   └── preprocessor.ts         # Clean + normalize TMDB data
│   │   ├── types.ts                    # All shared TypeScript interfaces
│   │   └── index.ts                    # Express entry point
│   ├── package.json
│   └── tsconfig.json
│
├── data/
│   └── seed/
│       ├── movies.json                 # Pre-fetched 500 popular movies
│       └── synthetic_ratings.json     # 50 synthetic users × 200 ratings each
│
├── scripts/
│   └── seedData.ts                     # Populate Redis with seed data (run from root)
│
├── agent/                              # Agent planning documents (not deployed)
│   ├── frontend_plan.md                # Frontend implementation plan
│   └── backend_plan.md                 # Backend implementation plan (future)
│
└── README.md
```

---

## 5. Core Data Models

> **Note:** These interfaces are defined in `backend/src/types.ts` and mirrored in `frontend/lib/types.ts`.

### Movie
```typescript
interface Movie {
  id: number;                    // TMDB movie ID
  title: string;
  overview: string;
  posterPath: string;
  releaseYear: number;
  genres: string[];              // e.g. ["Action", "Thriller"]
  cast: string[];                // top 5 actor names
  director: string;
  keywords: string[];            // TMDB keywords
  voteAverage: number;           // 0-10
  voteCount: number;
  popularity: number;
  runtime: number;               // minutes
  featureVector?: number[];      // computed, length ~50
}
```

### User
```typescript
interface User {
  id: string;                    // session-based or generated UUID
  preferredGenres: string[];     // from cold start onboarding
  ratings: Record<number, number>; // movieId → rating (1-5)
  phase: 'cold' | 'warming' | 'full'; // recommendation phase
  ratingCount: number;
}
```

### SimilarityMatrix
```typescript
interface SimilarityMatrix {
  type: 'movie' | 'user';
  ids: (number | string)[];      // movie IDs or user IDs
  matrix: number[][];            // matrix[i][j] = similarity 0-1
  algorithm: string;             // how it was computed
  computedAt: number;
}
```

### Recommendation
```typescript
interface Recommendation {
  movie: Movie;
  score: number;                 // predicted rating 0-5
  matchPercent: number;          // 0-100
  reason: string;                // e.g. "Liked by 3 users with similar taste"
  engine: 'content' | 'collaborative' | 'hybrid' | 'cold_start';
  similarUsers?: string[];       // for collaborative
  similarMovies?: number[];      // for content-based
}
```

### AlgorithmStep (for streaming via Socket.io)
```typescript
interface FloydStep {
  k: number; i: number; j: number;
  oldVal: number; newVal: number;
  updated: boolean;
  matrixSnapshot: number[][];
}

interface DijkstraStep {
  visitedUserId: string;
  distance: number;
  frontier: string[];
  path: string[];
}

interface MSTStep {
  algorithm: 'kruskal' | 'prim';
  type: 'add' | 'reject' | 'consider';
  edge: { u: string; v: string; weight: number };
  communities: string[][];       // current Union-Find components
  totalCost: number;
}

interface MergeSortStep {
  type: 'split' | 'merge' | 'compare' | 'place';
  array: Recommendation[];       // snapshot
  leftIndex: number;
  rightIndex: number;
}

interface KnapsackStep {
  row: number;                   // current movie index
  col: number;                   // current capacity
  value: number;                 // dp[row][col]
  decision: 'include' | 'exclude';
  dpSnapshot: number[][];
}
```

---

## 6. Algorithm Specifications

> **All algorithm files live in `backend/src/algorithms/`.**

### 6.1 Floyd-Warshall (User Similarity Matrix)
**File:** `backend/src/algorithms/floydWarshall.ts`  
**Input:** n×n raw similarity matrix (Pearson correlation between user rating vectors)  
**Output:** Refined all-pairs similarity + step array for visualization  

The "Floyd-Warshall on similarity" works differently from shortest-path: instead of minimizing distance, we propagate similarity through intermediate users. If user A is similar to user B, and user B is similar to user C, then A and C have an indirect connection even if they've rated different movies.

```typescript
// Transitive similarity propagation
for k (each intermediate user):
  for i (each source user):
    for j (each target user):
      transitiveScore = similarity[i][k] * similarity[k][j]
      if transitiveScore > similarity[i][j]:
        similarity[i][j] = transitiveScore
        emit FloydStep with updated cell
```

**Cap at 20 users** for live visualization (20³ = 8000 steps — manageable).

### 6.2 Dijkstra (Taste Path)
**File:** `backend/src/algorithms/dijkstra.ts`  
**Input:** User similarity graph (edge weight = 1 - similarity, so closer = lower weight)  
**Output:** Shortest taste-path from current user to a target user  

Used to answer: "How many 'taste hops' between you and this user? Who bridges you?"

```typescript
// Edge weight = 1 - similarity (convert similarity to distance)
// Find path: currentUser → targetUser
// Each hop = "this user bridges your taste"
function dijkstraTastePath(
  users: User[],
  similarityMatrix: number[][],
  sourceId: string,
  targetId: string
): { path: string[]; distance: number; steps: DijkstraStep[] }
```

### 6.3 Kruskal's MST (Community Detection)
**File:** `backend/src/algorithms/kruskal.ts`  
**Input:** User similarity graph  
**Output:** MST edges defining user communities  

The MST of the user similarity graph (using 1-similarity as edge weight) connects users by their strongest taste relationships. Connected components of the MST after threshold pruning = taste communities.

```typescript
// 1. Build all edges: (userId_i, userId_j, 1 - similarity[i][j])
// 2. Sort edges by weight ascending (most similar pairs first)
// 3. Kruskal's with Union-Find — add edge if no cycle
// 4. Prune edges with weight > 0.5 (similarity < 0.5)
// 5. Remaining connected components = taste communities
```

### 6.4 Merge Sort (Recommendation Ranking)
**File:** `backend/src/algorithms/mergeSort.ts`  
**Input:** Array of Recommendation objects  
**Output:** Sorted by score descending + step array  

Records every comparison and merge operation so the UI can animate result cards physically reordering.

### 6.5 0/1 Knapsack (Watch Budget)
**File:** `backend/src/algorithms/knapsack.ts`  
**Input:** Recommended movies (weight = runtime, value = predicted rating × 10)  
**Capacity:** User's watch time budget in minutes (e.g. 240 = 4 hours)  

```typescript
// Standard 0/1 DP Knapsack
// dp[i][w] = max total rating for first i movies within w minutes
// Emit KnapsackStep for every cell computed
function knapsack(
  movies: Recommendation[],
  budgetMinutes: number
): { selectedMovies: Recommendation[]; totalScore: number; steps: KnapsackStep[] }
```

---

## 7. ML Pipeline

> **All ML files live in `backend/src/ml/`.**

### 7.1 Feature Vector Construction
**File:** `backend/src/ml/featureVector.ts`

For each movie, build a ~50-dimensional feature vector:

```
[0-27]   Genre encoding (28 genres, one-hot)
[28-32]  Top 5 cast (hashed to 0-1 using consistent hash)
[33]     Director (hashed)
[34-43]  Top 10 keywords (TF-IDF weighted presence)
[44]     Normalized vote_average (÷ 10)
[45]     Normalized popularity (log-scaled, ÷ max)
[46]     Release decade (1970s=0.1, 1980s=0.2, ..., 2020s=0.6)
[47]     Runtime normalized (÷ 240)
[48]     Vote count tier (0.25/0.5/0.75/1.0)
```

### 7.2 Cosine Similarity
**File:** `backend/src/ml/cosineSimilarity.ts`

```typescript
function cosineSimilarity(a: number[], b: number[]): number {
  const dot = a.reduce((sum, ai, i) => sum + ai * b[i], 0);
  const magA = Math.sqrt(a.reduce((sum, ai) => sum + ai * ai, 0));
  const magB = Math.sqrt(b.reduce((sum, bi) => sum + bi * bi, 0));
  return dot / (magA * magB);
}
```

### 7.3 Pearson Correlation (User Similarity)
**File:** `backend/src/ml/pearsonCorrelation.ts`

Measures how similarly two users rate movies they've both seen.

```typescript
function pearsonCorrelation(
  ratingsA: Record<number, number>,
  ratingsB: Record<number, number>
): number {
  // Find co-rated movies
  const coRated = Object.keys(ratingsA).filter(id => ratingsB[id]);
  if (coRated.length < 2) return 0;  // not enough overlap
  // Compute mean-centered correlation
  const meanA = avg(coRated.map(id => ratingsA[id]));
  const meanB = avg(coRated.map(id => ratingsB[id]));
  // ... standard Pearson formula
}
```

### 7.4 Predicted Rating Formula
For collaborative filtering, predicted rating for user U on movie M:

```
predicted(U, M) = mean_rating(U) + 
  Σ(similarity(U, N) × (rating(N, M) - mean_rating(N))) 
  ─────────────────────────────────────────────────────
              Σ |similarity(U, N)|

where N = top-K most similar users who have rated M
```

---

## 8. Redis Schema

> **Redis is owned and accessed exclusively by the backend. The frontend never talks to Redis.**

```
# Movie feature vectors (cached after first compute)
SET movie:vector:<tmdbId>    JSON.stringify(number[])    EX 86400

# Movie metadata
HSET movie:<tmdbId>    title <t>    genres <g>    runtime <r>    poster <p>

# User ratings
HSET user:<userId>:ratings    <movieId> <rating>    ...

# User phase
SET user:<userId>:phase    "cold" | "warming" | "full"

# Similarity matrix cache (per user set)
SET sim:users:<hash>    JSON.stringify(number[][])    EX 3600

# Movie similarity cache
SET sim:movies:<hash>    JSON.stringify(number[][])    EX 86400

# Recommendation cache
SET rec:<userId>:<engine>    JSON.stringify(Recommendation[])    EX 1800

# User communities (MST result)
SET communities:<hash>    JSON.stringify(string[][])    EX 3600

# Popular movies (cold start)
ZADD popular:all    <score> <movieId>
ZADD popular:<genre>    <score> <movieId>
```

---

## 9. Backend API Routes (Express)

> **Base URL:** `http://localhost:3001` (dev) / Railway URL (prod)  
> **All routes are in `backend/src/routes/`.**

### POST /rate
```typescript
// Request
{ movieId: number; rating: number; userId: string }
// Response
{ success: boolean; newPhase: string; ratingsCount: number }
```

### POST /recommend
```typescript
// Request
{ userId: string; engine: 'content' | 'collaborative' | 'hybrid'; budget?: number }
// Response
{ sessionId: string }  // Socket.io session — results stream via socket
```

### GET /similarity?type=user&userId=<id>
```typescript
// Response
{ matrix: number[][]; userIds: string[]; sessionId: string }
// Matrix streams via Socket.io as Floyd-Warshall steps
```

### GET /movies/search?q=<query>
```typescript
// KMP-based search through cached movie titles
// Response
{ movies: Movie[] }
```

### GET /movies/:id
```typescript
// Response
{ movie: Movie; similar: Movie[] }
```

### GET /health
```typescript
// Response
{ status: 'ok'; redis: boolean; uptime: number }
```

---

## 10. Socket.io Events

> **The Socket.io server runs inside `backend/src/socket/socketServer.ts`.**  
> **The frontend connects using the `lib/socket.ts` client wrapper.**

### Server → Client
```typescript
'algo:step': { algorithm: string; step: FloydStep | DijkstraStep | MSTStep | MergeSortStep | KnapsackStep }
'algo:complete': { algorithm: string; durationMs: number; totalSteps: number }
'recommend:ready': { recommendations: Recommendation[]; engine: string }
'community:update': { communities: string[][]; mstEdges: { u: string; v: string }[] }
```

### Client → Server
```typescript
'recommend:start': { userId: string; engine: string; budget?: number }
'similarity:compute': { userIds: string[] }
'tastepath:find': { sourceUserId: string; targetUserId: string }
```

---

## 11. Frontend: Pages & Components

> **The frontend contains ZERO business logic. All computation happens on the backend.**  
> **Frontend responsibilities:** render UI, call backend API via `lib/api.ts`, receive socket events via `lib/socket.ts`.**

### Page 1: Landing / Onboarding (`/`)
- Cold start: User picks 3 favourite genres from a visual grid (movie poster backgrounds)
- "What's your watch mood?" — sets initial content filter
- Creates anonymous session (UUID stored in localStorage via `lib/session.ts`)
- On submit → `POST /recommend` with `engine: 'cold_start'`

### Page 2: Discover (`/discover`)
```
+------------------------------------------+
| [Engine: Content | Collaborative | Hybrid]|
| [Watch Budget: 2hr] [Sort: Best Match v]  |
+------------------------------------------+
| [MovieCard][MovieCard][MovieCard]         |
| [MovieCard][MovieCard][MovieCard]         |
| ... (Merge Sort animation on load)        |
+------------------------------------------+
| ALGO PANEL (bottom drawer)               |
| [Knapsack DP table] | [Sort steps] | [?] |
+------------------------------------------+
```

### Page 3: Graph Explorer (`/graph`)
- Full-screen D3 force layout of user similarity graph
- MST edges highlighted (Kruskal animation on load)
- Click user node → Dijkstra animates taste path to current user
- Community clusters color-coded
- Hover node → shows their top 5 movies

### Page 4: Movie Detail (`/movie/[id]`)
- Movie info + trailer link
- "Similar Movies" section — cosine similarity ranked, animated
- "Users who loved this" — shows graph neighbors
- Rate this movie (1-5 stars) → `POST /rate` → updates recommendation engine live

### Frontend `lib/` — UI Helpers Only
```
lib/
├── api.ts          # All fetch() calls to backend: getRecommendations(), rateMovie(), searchMovies(), etc.
├── socket.ts       # Socket.io client: connect(), on('algo:step'), emit('recommend:start'), etc.
├── session.ts      # getOrCreateUserId() — UUID in localStorage
├── formatters.ts   # formatRuntime(mins), formatYear(date), formatScore(0-5) display helpers
└── types.ts        # TypeScript interfaces mirrored from backend/src/types.ts
```

---

## 12. Seed Data Strategy

Do NOT rely solely on real user data for the graph visualization — it won't exist in a new deployment.

Generate **50 synthetic users** with realistic rating patterns:
- 10 "Action fans" — rate action/thriller movies 4-5 stars
- 10 "Drama lovers" — rate drama/romance 4-5 stars
- 10 "Sci-fi nerds" — rate sci-fi/fantasy 4-5 stars
- 10 "Horror enthusiasts" — rate horror 4-5 stars
- 10 "Mixed taste" — varied ratings across genres

This ensures the graph visualization always has interesting structure (clear clusters, visible community separation). Real user ratings add on top.

Script: `scripts/seedData.ts` (run from root, targets backend Redis)  
Pre-fetched: `data/seed/movies.json` (500 movies from TMDB popular endpoint)

---

## 13. Environment Variables

### Frontend (`frontend/.env.local`)
```bash
NEXT_PUBLIC_API_URL=http://localhost:3001        # Backend REST base URL
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001     # Backend Socket.io URL
NEXT_PUBLIC_TMDB_IMAGE_BASE=https://image.tmdb.org/t/p/w500
```

### Backend (`backend/.env`)
```bash
PORT=3001
TMDB_API_KEY=<from themoviedb.org — free>
TMDB_BASE_URL=https://api.themoviedb.org/3
UPSTASH_REDIS_REST_URL=<from Upstash>
UPSTASH_REDIS_REST_TOKEN=<from Upstash>
FRONTEND_URL=http://localhost:3000              # For CORS
```

TMDB API is completely free — just register at themoviedb.org.

---

## 14. 8-Week Build Timeline

| Week | Goal | Deliverable |
|---|---|---|
| 1 | Foundation + data | Next.js + Express setup, TMDB integration in backend, 500 movies fetched, Redis seeded, `MovieCard` component |
| 2 | Feature vectors + content-based | `featureVector.ts`, `cosineSimilarity.ts`, content-based engine, REST `/recommend`, basic `/discover` page |
| 3 | Merge Sort animation | `mergeSort.ts` with step recording, Socket.io step streaming, `RecommendationFeed` animated |
| 4 | User ratings + cold start | Rating system, Redis user storage, cold start Greedy engine, phase transitions |
| 5 | Collaborative filtering | Pearson correlation, Floyd-Warshall similarity, Socket.io `SimilarityMatrix` heatmap |
| 6 | Graph visualization + MST | D3 force layout `UserGraph`, Kruskal community detection, `MSTOverlay`, `/graph` page |
| 7 | Dijkstra taste path + Knapsack | Dijkstra animation on graph, `KnapsackPanel` with DP table, watch budget feature |
| 8 | Hybrid engine + polish + deploy | Hybrid recommender, cold-start onboarding flow, Vercel (frontend) + Railway (backend) deploy, README |

---

## 15. DS/ML Interview Talking Points

When describing this project in interviews, use these framings:

**"How does the recommendation engine work?"**
> "I implemented a hybrid collaborative + content-based filtering system. Content-based uses cosine similarity on 50-dimensional feature vectors I built from TMDB metadata. Collaborative filtering uses Pearson correlation between user rating vectors to build a similarity graph, then applies a Floyd-Warshall-inspired transitive similarity propagation to find indirect taste connections."

**"How did you handle the cold start problem?"**
> "New users go through three phases. Cold start uses a greedy weighted scoring algorithm on genre preferences. After 5 ratings, content-based activates. After 20 ratings, the full collaborative graph kicks in."

**"What's the architecture?"**
> "Separated frontend and backend. The Next.js frontend is purely UI — zero business logic. The Express backend owns all ML computation, algorithm execution, Redis caching, and TMDB integration. They communicate via REST for data fetching and Socket.io for real-time algorithm step streaming."

**"What would you improve with more time?"**
> "Matrix factorization (SVD) instead of memory-based CF, adding implicit feedback signals like hover time, and an A/B testing framework to compare engine variants."

---

## 16. Scope Constraints

- Floyd-Warshall visualization: cap at 20 users (20³ = 8000 steps)
- Movie corpus: 500 movies pre-fetched (no live TMDB search on demo — use cached data)
- User graph: max 50 nodes for readable D3 force layout
- Collaborative filtering: requires min 2 co-rated movies between user pairs for Pearson
- No real authentication — anonymous sessions via UUID in localStorage
- Mobile: feed and movie detail work; graph explorer is desktop-only
- **No Next.js API routes** — all backend logic in Express at `localhost:3001`
