# Architecture Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an interactive `/architecture` page with a React Flow swimlane diagram showing all CineGraph components, animated data-flow edges, a node detail drawer, and per-flow highlighting on edge click.

**Architecture:** React Flow v11 canvas with 4 swimlane rows (User → Frontend → Backend → Data), ~30 nodes, ~50 directed edges grouped into 8 named flows. Selecting a node opens a right-side detail drawer; clicking an edge highlights the full flow it belongs to. Staggered CSS fade-in on load.

**Tech Stack:** `reactflow` v11, Next.js App Router, TypeScript, CSS animations (`@keyframes`). No additional libraries.

---

### Task 1: Install reactflow + route shell + Navbar link

**Files:**
- Create: `frontend/app/architecture/page.tsx`
- Modify: `frontend/components/layout/Navbar.tsx` (line 24 — `NAV_LINKS`)
- Run: install `reactflow`

- [ ] **Step 1: Install reactflow**

```bash
cd frontend && npm install reactflow
```

Expected: `"reactflow"` appears in `frontend/package.json` dependencies.

- [ ] **Step 2: Create route page**

Create `frontend/app/architecture/page.tsx`:

```tsx
'use client';
// frontend/app/architecture/page.tsx

import { ArchitectureFlow } from '@/components/architecture/ArchitectureFlow';

export default function ArchitecturePage() {
  return (
    <div className="w-screen h-screen" style={{ backgroundColor: 'var(--color-bg-base)' }}>
      <ArchitectureFlow />
    </div>
  );
}
```

- [ ] **Step 3: Add Architecture to Navbar**

In `frontend/components/layout/Navbar.tsx`, find `NAV_LINKS` (line 24) and change it to:

```ts
const NAV_LINKS = [
  { href: '/discover', label: 'Discover' },
  { href: '/graph', label: 'Graph' },
  { href: '/architecture', label: 'Architecture' },
];
```

- [ ] **Step 4: Type-check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: Exactly one error — `Cannot find module '@/components/architecture/ArchitectureFlow'`. That component doesn't exist yet; this error is expected and will be fixed in Task 7.

- [ ] **Step 5: Commit**

```bash
cd D:/Project/CineGraph && git add frontend/app/architecture/page.tsx frontend/components/layout/Navbar.tsx frontend/package.json frontend/package-lock.json && git commit -m "feat(architecture): add /architecture route, Navbar link, install reactflow"
```

---

### Task 2: Graph data — nodes and edges (`graphData.ts`)

**Files:**
- Create: `frontend/components/architecture/data/graphData.ts`

Defines all ~30 nodes with x/y positions for the 4-row swimlane layout and all ~50 edges grouped into named flow groups.

- [ ] **Step 1: Create `graphData.ts`**

Create `frontend/components/architecture/data/graphData.ts`:

```ts
// frontend/components/architecture/data/graphData.ts
import type { Node, Edge } from 'reactflow';

export type LayerType = 'user' | 'frontend' | 'backend' | 'data';

export interface NodeData {
  label: string;
  layer: LayerType;
  sublabel?: string;
  isSelected?: boolean; // managed by ArchitectureFlow, read by ComponentNode
}

export interface EdgeData {
  flowGroup: string;
  variant?: 'default' | 'dashed' | 'bold';
}

// ─── Layout constants ─────────────────────────────────────────────────────────
const Y = {
  user:      60,
  frontend:  220,
  beRoutes:  400,
  beAlgo:    560,
  beEngines: 720,
  data:      880,
};
const X0 = 190; // first node column (label occupies 0–170)
const DX = 215; // horizontal step between nodes

// ─── Nodes ───────────────────────────────────────────────────────────────────
export const initialNodes: Node<NodeData>[] = [
  // ── Layer labels (non-interactive) ──────────────────────────────────────
  { id: 'label-user',     type: 'layerLabel', position: { x: 10, y: Y.user },     data: { label: 'USER',     layer: 'user' } },
  { id: 'label-frontend', type: 'layerLabel', position: { x: 10, y: Y.frontend }, data: { label: 'FRONTEND', layer: 'frontend' } },
  { id: 'label-backend',  type: 'layerLabel', position: { x: 10, y: Y.beRoutes }, data: { label: 'BACKEND',  layer: 'backend' } },
  { id: 'label-data',     type: 'layerLabel', position: { x: 10, y: Y.data },     data: { label: 'DATA',     layer: 'data' } },

  // ── User layer ───────────────────────────────────────────────────────────
  { id: 'user-search',   type: 'component', position: { x: X0,          y: Y.user }, data: { label: 'Search Bar',   layer: 'user', sublabel: 'Navbar' } },
  { id: 'user-discover', type: 'component', position: { x: X0 + DX,     y: Y.user }, data: { label: 'Discover',     layer: 'user', sublabel: '/discover' } },
  { id: 'user-movie',    type: 'component', position: { x: X0 + DX * 2, y: Y.user }, data: { label: 'Movie Page',   layer: 'user', sublabel: '/movie/[id]' } },
  { id: 'user-graph',    type: 'component', position: { x: X0 + DX * 3, y: Y.user }, data: { label: 'Graph Page',   layer: 'user', sublabel: '/graph' } },

  // ── Frontend layer ───────────────────────────────────────────────────────
  { id: 'fe-searchbar',  type: 'component', position: { x: X0,          y: Y.frontend }, data: { label: 'SearchBar',     layer: 'frontend', sublabel: 'SearchBar.tsx' } },
  { id: 'fe-algoDrawer', type: 'component', position: { x: X0 + DX,     y: Y.frontend }, data: { label: 'AlgoDrawer',    layer: 'frontend', sublabel: 'AlgoDrawer.tsx' } },
  { id: 'fe-d3graph',    type: 'component', position: { x: X0 + DX * 2, y: Y.frontend }, data: { label: 'D3UserGraph',   layer: 'frontend', sublabel: 'D3UserGraph.tsx' } },
  { id: 'fe-profile',    type: 'component', position: { x: X0 + DX * 3, y: Y.frontend }, data: { label: 'ProfileDrawer', layer: 'frontend', sublabel: 'ProfileDrawer.tsx' } },

  // ── Backend — routes + socket ────────────────────────────────────────────
  { id: 'be-moviesRoute',    type: 'component', position: { x: X0,          y: Y.beRoutes }, data: { label: 'Movies Route',    layer: 'backend', sublabel: '/movies/*' } },
  { id: 'be-recommendRoute', type: 'component', position: { x: X0 + DX,     y: Y.beRoutes }, data: { label: 'Recommend Route', layer: 'backend', sublabel: 'POST /recommend' } },
  { id: 'be-rateRoute',      type: 'component', position: { x: X0 + DX * 2, y: Y.beRoutes }, data: { label: 'Rate Route',      layer: 'backend', sublabel: 'POST /rate' } },
  { id: 'be-graphRoute',     type: 'component', position: { x: X0 + DX * 3, y: Y.beRoutes }, data: { label: 'Graph Route',     layer: 'backend', sublabel: 'POST /graph/compute' } },
  { id: 'be-profileRoute',   type: 'component', position: { x: X0 + DX * 4, y: Y.beRoutes }, data: { label: 'Profile Route',   layer: 'backend', sublabel: 'GET /profile' } },
  { id: 'be-socket',         type: 'component', position: { x: X0 + DX * 5, y: Y.beRoutes }, data: { label: 'Socket.io Server', layer: 'backend', sublabel: 'socketServer.ts' } },

  // ── Backend — algorithms ─────────────────────────────────────────────────
  { id: 'be-mergeSort', type: 'component', position: { x: X0,          y: Y.beAlgo }, data: { label: 'MergeSort',      layer: 'backend', sublabel: 'O(n log n)' } },
  { id: 'be-knapsack',  type: 'component', position: { x: X0 + DX,     y: Y.beAlgo }, data: { label: 'Knapsack 0/1',   layer: 'backend', sublabel: 'O(n × budget)' } },
  { id: 'be-dijkstra',  type: 'component', position: { x: X0 + DX * 2, y: Y.beAlgo }, data: { label: 'Dijkstra',       layer: 'backend', sublabel: 'O((V+E) log V)' } },
  { id: 'be-floyd',     type: 'component', position: { x: X0 + DX * 3, y: Y.beAlgo }, data: { label: 'Floyd-Warshall', layer: 'backend', sublabel: 'O(V³)' } },
  { id: 'be-kruskal',   type: 'component', position: { x: X0 + DX * 4, y: Y.beAlgo }, data: { label: 'Kruskal MST',    layer: 'backend', sublabel: 'O(E log E)' } },

  // ── Backend — ML engines ─────────────────────────────────────────────────
  { id: 'be-content',   type: 'component', position: { x: X0,          y: Y.beEngines }, data: { label: 'Content Engine',  layer: 'backend', sublabel: 'phase: warming' } },
  { id: 'be-collab',    type: 'component', position: { x: X0 + DX,     y: Y.beEngines }, data: { label: 'Collab Engine',   layer: 'backend', sublabel: 'Pearson CF' } },
  { id: 'be-hybrid',    type: 'component', position: { x: X0 + DX * 2, y: Y.beEngines }, data: { label: 'Hybrid Engine',   layer: 'backend', sublabel: 'content + collab' } },
  { id: 'be-coldStart', type: 'component', position: { x: X0 + DX * 3, y: Y.beEngines }, data: { label: 'Cold Start',      layer: 'backend', sublabel: 'genre popularity' } },

  // ── Data layer ───────────────────────────────────────────────────────────
  { id: 'data-redis',    type: 'component', position: { x: X0,          y: Y.data }, data: { label: 'Redis',    layer: 'data', sublabel: 'Upstash (hot path)' } },
  { id: 'data-bigquery', type: 'component', position: { x: X0 + DX,     y: Y.data }, data: { label: 'BigQuery', layer: 'data', sublabel: 'GCP (cold/compute)' } },
  { id: 'data-tmdb',     type: 'component', position: { x: X0 + DX * 2, y: Y.data }, data: { label: 'TMDB API', layer: 'data', sublabel: 'Seeding source' } },
];

// ─── Edge helper ─────────────────────────────────────────────────────────────
function e(
  id: string,
  source: string,
  target: string,
  flowGroup: string,
  opts: { variant?: EdgeData['variant']; label?: string } = {}
): Edge<EdgeData> {
  return {
    id,
    source,
    target,
    type: 'animated',
    label: opts.label,
    data: { flowGroup, variant: opts.variant ?? 'default' },
  };
}

// ─── Edges ───────────────────────────────────────────────────────────────────
export const initialEdges: Edge<EdgeData>[] = [
  // ── Search flow ──────────────────────────────────────────────────────────
  e('s1', 'user-search',   'fe-searchbar',   'search'),
  e('s2', 'fe-searchbar',  'be-moviesRoute', 'search', { label: 'GET /movies/search' }),
  e('s3', 'be-moviesRoute','data-redis',     'search', { label: 'search:<q>:<g>' }),
  e('s4', 'data-redis',    'data-bigquery',  'search', { variant: 'dashed', label: 'MISS → LIKE query' }),
  e('s5', 'data-bigquery', 'data-redis',     'search', { variant: 'dashed', label: 'SETEX 3600s' }),
  e('s6', 'fe-searchbar',  'be-moviesRoute', 'search', { label: 'GET /movies/genres' }),
  e('s7', 'be-moviesRoute','data-redis',     'search', { label: 'movies:genres' }),
  e('s8', 'data-redis',    'data-bigquery',  'search', { variant: 'dashed', label: 'MISS → DISTINCT genres' }),
  e('s9', 'data-bigquery', 'data-redis',     'search', { variant: 'dashed', label: 'SETEX 86400s' }),

  // ── Movie detail flow ─────────────────────────────────────────────────────
  e('m1', 'user-movie',    'be-moviesRoute', 'movie-detail', { label: 'GET /movies/:id' }),
  e('m2', 'be-moviesRoute','data-redis',     'movie-detail', { label: 'movie:<id>' }),
  e('m3', 'data-redis',    'data-bigquery',  'movie-detail', { variant: 'dashed', label: 'MISS fallback' }),
  e('m4', 'be-moviesRoute','data-bigquery',  'movie-detail', { variant: 'bold', label: 'movie_similarity (always direct)' }),

  // ── Recommendation flow ───────────────────────────────────────────────────
  e('r1',  'user-discover',     'be-recommendRoute', 'recommend', { label: 'POST /recommend' }),
  e('r2',  'be-recommendRoute', 'be-content',        'recommend'),
  e('r3',  'be-recommendRoute', 'be-collab',         'recommend'),
  e('r4',  'be-recommendRoute', 'be-hybrid',         'recommend'),
  e('r5',  'be-recommendRoute', 'be-coldStart',      'recommend'),
  e('r6',  'be-hybrid',        'be-content',         'recommend', { label: 'parallel' }),
  e('r7',  'be-hybrid',        'be-collab',          'recommend', { label: 'parallel' }),
  e('r8',  'be-content',       'data-redis',         'recommend', { label: 'user ratings' }),
  e('r9',  'be-content',       'data-bigquery',      'recommend', { variant: 'bold', label: 'movie_similarity' }),
  e('r10', 'be-collab',        'data-redis',         'recommend', { label: 'all user ratings' }),
  e('r11', 'be-coldStart',     'data-redis',         'recommend', { label: 'popular:<genre>' }),
  e('r12', 'be-recommendRoute','be-mergeSort',       'recommend'),
  e('r13', 'be-mergeSort',     'be-knapsack',        'recommend', { label: 'if budget' }),
  e('r14', 'be-mergeSort',     'be-socket',          'recommend', { variant: 'bold', label: 'algo:step' }),
  e('r15', 'be-knapsack',      'be-socket',          'recommend', { variant: 'bold', label: 'algo:step' }),
  e('r16', 'be-socket',        'fe-algoDrawer',      'recommend', { variant: 'bold', label: 'recommend:ready' }),

  // ── Rating flow ───────────────────────────────────────────────────────────
  e('rt1', 'user-movie',  'be-rateRoute',  'rating', { label: 'POST /rate' }),
  e('rt2', 'be-rateRoute','data-redis',    'rating', { label: 'user:ratings + phase' }),
  e('rt3', 'be-rateRoute','data-bigquery', 'rating', { variant: 'dashed', label: 'async upsert (fire-and-forget)' }),

  // ── Graph compute flow ────────────────────────────────────────────────────
  e('g1', 'user-graph',   'be-graphRoute', 'graph', { label: 'POST /graph/compute' }),
  e('g2', 'be-graphRoute','data-redis',    'graph', { label: 'users:all + ratings' }),
  e('g3', 'be-graphRoute','be-kruskal',    'graph'),
  e('g4', 'be-graphRoute','be-floyd',      'graph'),
  e('g5', 'be-graphRoute','be-dijkstra',   'graph'),
  e('g6', 'be-kruskal',   'be-socket',     'graph', { variant: 'bold', label: 'graph:step' }),
  e('g7', 'be-floyd',     'be-socket',     'graph', { variant: 'bold', label: 'graph:step' }),
  e('g8', 'be-dijkstra',  'be-socket',     'graph', { variant: 'bold', label: 'graph:step' }),
  e('g9', 'be-socket',    'fe-d3graph',    'graph', { variant: 'bold', label: 'graph:complete' }),

  // ── Taste path flow (Socket.io direct) ───────────────────────────────────
  e('tp1', 'fe-d3graph', 'be-socket',   'tastepath', { variant: 'bold', label: 'tastepath:find' }),
  e('tp2', 'be-socket',  'data-redis',  'tastepath', { label: 'users + ratings' }),
  e('tp3', 'be-socket',  'be-dijkstra', 'tastepath'),
  e('tp4', 'be-socket',  'fe-d3graph',  'tastepath', { variant: 'bold', label: 'tastepath:result' }),

  // ── Profile flow ──────────────────────────────────────────────────────────
  e('p1', 'fe-profile',     'be-profileRoute', 'profile', { label: 'GET /profile' }),
  e('p2', 'be-profileRoute','data-redis',      'profile', { label: 'ratings + phase' }),
  e('p3', 'data-redis',     'data-bigquery',   'profile', { variant: 'dashed', label: 'MISS fallback' }),

  // ── Node expansion (top movies) ───────────────────────────────────────────
  e('ne1', 'fe-d3graph',    'be-profileRoute', 'node-expansion', { label: 'GET /profile/:id/top-movies' }),
  e('ne2', 'be-profileRoute','data-redis',     'node-expansion', { label: 'user ratings' }),

  // ── TMDB seeding (dashed — not runtime) ──────────────────────────────────
  e('tm1', 'data-tmdb', 'data-bigquery', 'seeding', { variant: 'dashed', label: 'seed migration only' }),
];
```

- [ ] **Step 2: Type-check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: Still only the one missing `ArchitectureFlow` error. No errors in `graphData.ts`.

- [ ] **Step 3: Commit**

```bash
cd D:/Project/CineGraph && git add frontend/components/architecture/data/graphData.ts && git commit -m "feat(architecture): add graph node and edge data with 8 verified flows"
```

---

### Task 3: Node detail content (`nodeDetails.ts`)

**Files:**
- Create: `frontend/components/architecture/data/nodeDetails.ts`

Static detail content for every component node. No API calls — all data is hardcoded here.

- [ ] **Step 1: Create `nodeDetails.ts`**

Create `frontend/components/architecture/data/nodeDetails.ts`:

```ts
// frontend/components/architecture/data/nodeDetails.ts

export interface NodeDetail {
  title: string;
  description: string;
  facts: { label: string; value: string }[];
  filePath?: string;
}

export const nodeDetails: Record<string, NodeDetail> = {
  'user-search': {
    title: 'Search Bar',
    description: 'Expandable search input in the Navbar. Debounces input 400ms before firing requests. Shows genre chips (empty state) or up to 8 movie result cards. A generation counter prevents stale fetch results from overwriting newer ones.',
    facts: [
      { label: 'Debounce', value: '400ms' },
      { label: 'Max results', value: '8 movies' },
      { label: 'Genre chips', value: 'Substring filtered (e.g. "act" → "Action")' },
      { label: 'Race prevention', value: 'Generation counter (searchGenRef)' },
    ],
    filePath: 'frontend/components/layout/SearchBar.tsx',
  },
  'user-discover': {
    title: 'Discover Page',
    description: 'Main recommendation page. User picks an engine and optional watch-time budget. Fires POST /recommend and immediately gets a sessionId. Listens on Socket.io for algo:step, algo:complete, and recommend:ready to drive the AlgoDrawer and movie list.',
    facts: [
      { label: 'Route', value: '/discover' },
      { label: 'Socket events received', value: 'algo:step, algo:complete, recommend:ready' },
      { label: 'Engines available', value: 'Content, Collaborative, Hybrid, Cold Start' },
    ],
    filePath: 'frontend/app/discover/page.tsx',
  },
  'user-movie': {
    title: 'Movie Page',
    description: 'Full movie detail: poster, overview, cast, director, genres, runtime. GET /movies/:id returns both the movie and top-6 similar movies from BigQuery movie_similarity. User rates 1–5 stars via POST /rate.',
    facts: [
      { label: 'Route', value: '/movie/[id]' },
      { label: 'Endpoints', value: 'GET /movies/:id, POST /rate' },
      { label: 'Similar movies', value: 'Top 6 from BigQuery movie_similarity (always direct)' },
    ],
    filePath: 'frontend/app/movie/[id]/page.tsx',
  },
  'user-graph': {
    title: 'Graph Page',
    description: 'Live D3 user-similarity graph. Fires POST /graph/compute then streams Kruskal, Floyd-Warshall, and Dijkstra steps via Socket.io. Clicking a user node expands to show their top 3 rated movies fetched from /profile/:id/top-movies.',
    facts: [
      { label: 'Route', value: '/graph' },
      { label: 'Max users', value: '20 (capped from users:all set)' },
      { label: 'Socket events', value: 'graph:step, graph:complete' },
      { label: 'Taste path', value: 'Socket.io tastepath:find (direct, no REST)' },
    ],
    filePath: 'frontend/app/graph/page.tsx',
  },
  'fe-searchbar': {
    title: 'SearchBar + SearchDropdown',
    description: 'SearchBar owns expand/collapse animation, debounce timer, query, genre, and result state. SearchDropdown renders genre chips or movie result cards. Click outside (mousedown listener) or Escape collapses and clears. useCallback + generation counter prevent stale closures and race conditions.',
    facts: [
      { label: 'State', value: 'isExpanded, query, genre, results, genres, loading, error' },
      { label: 'Collapse trigger', value: 'Click outside (mousedown) or Escape' },
      { label: 'Stale closure fix', value: 'collapse wrapped in useCallback([])' },
    ],
    filePath: 'frontend/components/layout/SearchBar.tsx',
  },
  'fe-algoDrawer': {
    title: 'AlgoDrawer',
    description: 'Replays MergeSort and Knapsack steps received via Socket.io. Steps are pushed to refs (not state) on each algo:step event — only algo:complete triggers a re-render to enable Play. Two independent useEffect replay loops drive the cursor via setTimeout chains.',
    facts: [
      { label: 'Steps storage', value: 'useRef arrays — zero re-renders per step' },
      { label: 'Play enabled by', value: 'algo:complete sets msTotalSteps/ksTotalSteps state' },
      { label: 'Session correlation', value: 'currentSessionIdRef avoids stale socket handler' },
      { label: 'Animations', value: 'Framer Motion (layout + layoutId on poster cards)' },
    ],
    filePath: 'frontend/components/layout/AlgoDrawer.tsx',
  },
  'fe-d3graph': {
    title: 'D3UserGraph',
    description: 'Force-directed SVG graph. User nodes sized by rating count. MST edges from Kruskal form the backbone. Dijkstra path highlighted. Floyd-Warshall heatmap overlay. tastepath:find is emitted directly on Socket.io — no REST call.',
    facts: [
      { label: 'Library', value: 'D3.js force simulation' },
      { label: 'Communities', value: 'Colored clusters from Kruskal result' },
      { label: 'Node expansion', value: 'GET /profile/:id/top-movies on click' },
      { label: 'Panels', value: 'KruskalPanel, DijkstraPanel, FloydWarshallPanel' },
    ],
    filePath: 'frontend/components/graph/D3UserGraph.tsx',
  },
  'fe-profile': {
    title: 'ProfileDrawer',
    description: 'Slide-in drawer showing user phase, rating count, and all rated movies. Opens on avatar click in the Navbar. Fetches GET /profile on open. Phase badge (COLD / WARMING / FULL) updates in the Navbar after each rating.',
    facts: [
      { label: 'Endpoint', value: 'GET /profile' },
      { label: 'Phases', value: 'cold (<5), warming (5–19), full (≥20)' },
      { label: 'Animation', value: 'Framer Motion slide-in' },
    ],
    filePath: 'frontend/components/layout/ProfileDrawer.tsx',
  },
  'be-moviesRoute': {
    title: 'Movies Route',
    description: 'Three endpoints. Route order matters — /genres and /search are registered before /:id to prevent Express treating them as numeric ID params. search requires at least one of q or genre (400 otherwise). /:id returns movie + top-6 similar, fetching similarity directly from BigQuery.',
    facts: [
      { label: 'GET /movies/genres', value: 'Distinct genre list (Redis-cached, 24h TTL)' },
      { label: 'GET /movies/search', value: '?q= + ?genre=, 400 if both empty' },
      { label: 'GET /movies/:id', value: '{ movie, similar: Movie[] }' },
      { label: 'Similarity cache', value: 'None — movie_similarity always hits BigQuery' },
    ],
    filePath: 'backend/src/routes/movies.ts',
  },
  'be-recommendRoute': {
    title: 'Recommend Route',
    description: 'POST /recommend returns { sessionId } immediately, then runs an async IIFE: getRecommendations → mergeSort → (optional) knapsack → emit recommend:ready via Socket.io. The emitter is set by socketServer after init via setEmitter().',
    facts: [
      { label: 'Pattern', value: 'Fire-and-forget async IIFE' },
      { label: 'Immediate response', value: '{ sessionId }' },
      { label: 'Step delay', value: '16ms between emissions (≈60fps)' },
      { label: 'Socket events', value: 'algo:step, algo:complete, recommend:ready, recommend:error' },
    ],
    filePath: 'backend/src/routes/recommend.ts',
  },
  'be-rateRoute': {
    title: 'Rate Route',
    description: 'POST /rate writes rating to Redis synchronously (blocking), recomputes phase, then fire-and-forgets a BigQuery upsert. Returns { success, newPhase, ratingsCount } immediately after Redis writes complete. BigQuery failure is logged but not surfaced to the client.',
    facts: [
      { label: 'Validation', value: 'zod — movieId: int+, rating: 1–5' },
      { label: 'Redis writes', value: 'user:<id>:ratings hash, users:all set, user:<id>:phase' },
      { label: 'BigQuery', value: 'upsertRating — async, non-blocking, non-fatal' },
      { label: 'Response', value: '{ success, newPhase, ratingsCount }' },
    ],
    filePath: 'backend/src/routes/rate.ts',
  },
  'be-graphRoute': {
    title: 'Graph Route',
    description: 'POST /graph/compute returns { graphSessionId } immediately, then async: fetches ≤20 users from Redis, builds Pearson similarity matrix in-memory (no DB), runs Kruskal → Floyd-Warshall → Dijkstra, streaming graph:step events. Emits graph:complete with full matrix + MST edges + communities.',
    facts: [
      { label: 'Pattern', value: 'Fire-and-forget async IIFE' },
      { label: 'Matrix', value: 'Pearson correlation — computed in-memory, no DB write' },
      { label: 'Floyd steps', value: 'Only matrixSnapshot steps emitted (not all O(V³))' },
      { label: 'Dijkstra target', value: 'Current user → closest neighbour by similarity' },
    ],
    filePath: 'backend/src/routes/graph.ts',
  },
  'be-profileRoute': {
    title: 'Profile Route',
    description: 'GET /profile returns phase, ratingsCount, nextPhaseAt, and full ratedMovies array (sorted by rating desc). GET /profile/:userId/top-movies returns top 3 movies by rating for a user node — used by D3UserGraph node expansion. Both read only from Redis (with movie:<id> BQ fallback).',
    facts: [
      { label: 'GET /profile', value: 'Full rated movie list with poster + metadata' },
      { label: 'GET /profile/:id/top-movies', value: 'Top 3 for D3 node expansion' },
      { label: 'nextPhaseAt', value: 'null if already full, 5 if cold, 20 if warming' },
    ],
    filePath: 'backend/src/routes/profile.ts',
  },
  'be-socket': {
    title: 'Socket.io Server',
    description: 'Maintains a userId → socketId map. Auth middleware validates handshake.auth.token. Wires two emitter functions to REST routes via setEmitter / setGraphEmitter. Also handles tastepath:find events directly — builds Pearson matrix inline and runs Dijkstra, emitting steps back to the same socket.',
    facts: [
      { label: 'Auth', value: 'handshake.auth.token (session UUID)' },
      { label: 'Emitters wired', value: 'setEmitter (recommend), setGraphEmitter (graph)' },
      { label: 'Direct event', value: 'tastepath:find → Dijkstra → tastepath:result' },
      { label: 'CORS', value: 'FRONTEND_URL env var (Railway)' },
    ],
    filePath: 'backend/src/socket/socketServer.ts',
  },
  'be-mergeSort': {
    title: 'MergeSort',
    description: 'Sorts recommendations by score descending. Each split, compare, merge, and place operation is recorded as a MergeSortStep. The AlgoDrawer replays these with Framer Motion layout animations on poster cards.',
    facts: [
      { label: 'Complexity', value: 'O(n log n)' },
      { label: 'Input', value: 'Recommendation[] unsorted' },
      { label: 'Output', value: '{ sorted: Recommendation[], steps: MergeSortStep[] }' },
      { label: 'Step types', value: 'split, merge, compare, place' },
    ],
    filePath: 'backend/src/algorithms/mergeSort.ts',
  },
  'be-knapsack': {
    title: '0/1 Knapsack',
    description: 'Selects the subset of sorted recommendations that maximises total score within a watch-time budget (minutes). Bottom-up DP. Each cell fill emits a KnapsackStep showing row, col, value, decision, and a dpSnapshot matrix.',
    facts: [
      { label: 'Complexity', value: 'O(n × budget)' },
      { label: 'Weight', value: 'movie.runtime (minutes)' },
      { label: 'Value', value: 'recommendation.score' },
      { label: 'Triggered when', value: 'budget param provided in POST /recommend' },
    ],
    filePath: 'backend/src/algorithms/knapsack.ts',
  },
  'be-dijkstra': {
    title: 'Dijkstra',
    description: 'Used in two contexts: (1) Graph route — finds shortest similarity path from current user to their closest neighbour. (2) Socket.io tastepath:find — finds path between any two selected users. Edge weight = 1 − similarity (lower = closer). Each step emits visitedUserId, distance, frontier, path.',
    facts: [
      { label: 'Complexity', value: 'O((V+E) log V)' },
      { label: 'Edge weight', value: '1 − similarity score' },
      { label: 'Context 1', value: 'graph route — current user to closest neighbour' },
      { label: 'Context 2', value: 'tastepath:find — any source to any target' },
    ],
    filePath: 'backend/src/algorithms/dijkstra.ts',
  },
  'be-floyd': {
    title: 'Floyd-Warshall',
    description: 'All-pairs shortest paths on the user similarity graph. Full O(V³) runs but only matrixSnapshot steps are emitted (not every iteration) to keep visualization manageable. FloydWarshallPanel renders the distance matrix as a heatmap.',
    facts: [
      { label: 'Complexity', value: 'O(V³)' },
      { label: 'Emitted steps', value: 'matrixSnapshot steps only' },
      { label: 'Visualized in', value: 'FloydWarshallPanel.tsx (heatmap grid)' },
    ],
    filePath: 'backend/src/algorithms/floydWarshall.ts',
  },
  'be-kruskal': {
    title: "Kruskal's MST",
    description: "Builds the minimum spanning tree of the user similarity graph. Used to detect communities (clusters of similar users). Union-Find with path compression. MST edges become the backbone of D3UserGraph. Communities color the node clusters.",
    facts: [
      { label: 'Complexity', value: 'O(E log E)' },
      { label: 'Data structure', value: 'Union-Find (path compression)' },
      { label: 'Output', value: '{ mstEdges, communities: string[][], steps: MSTStep[] }' },
      { label: 'Step types', value: 'add, reject, consider' },
    ],
    filePath: 'backend/src/algorithms/kruskal.ts',
  },
  'be-content': {
    title: 'Content-Based Engine',
    description: "Active when phase='warming' or engine='content'. Reads user ratings from Redis, then for each rated movie queries BigQuery's movie_similarity table directly (no Redis cache for similarity). Scores candidate movies by similarity × (rating/5). Returns top-N by blended score.",
    facts: [
      { label: 'Phase', value: 'warming (5–19 ratings)' },
      { label: 'Similarity', value: 'BigQuery movie_similarity — always direct, no cache' },
      { label: 'Candidates', value: 'Top 50 similar per rated movie' },
      { label: 'Scoring', value: 'similarity_score × (rating / 5)' },
    ],
    filePath: 'backend/src/ml/contentBased.ts',
  },
  'be-collab': {
    title: 'Collaborative Engine',
    description: "Active when engine='collaborative'. Computes Pearson correlation between current user and every user in Redis users:all. Takes top K=10 neighbours. Predicts unseen movie ratings with weighted-sum CF formula. Pure Redis — no BigQuery queries.",
    facts: [
      { label: 'Algorithm', value: 'Pearson CF, top-K=10 neighbours' },
      { label: 'Data source', value: 'Redis only (user:*:ratings hashes)' },
      { label: 'Formula', value: 'user_mean + Σ(sim × deviation) / Σ|sim|' },
    ],
    filePath: 'backend/src/ml/collaborative.ts',
  },
  'be-hybrid': {
    title: 'Hybrid Engine',
    description: "Active when phase='full' or engine='hybrid'. Runs content-based and collaborative in parallel via Promise.all, then round-robin interleaves results (content[0], collab[0], content[1], collab[1], …). Deduplicates by movieId. Returns top-N from the blended list.",
    facts: [
      { label: 'Phase', value: 'full (≥20 ratings)' },
      { label: 'Parallelism', value: 'Promise.all([contentBased, collaborative])' },
      { label: 'Blend', value: 'Round-robin interleave, dedup by movieId' },
    ],
    filePath: 'backend/src/ml/hybrid.ts',
  },
  'be-coldStart': {
    title: 'Cold Start Engine',
    description: "Active when phase='cold' (<5 ratings) or engine='cold_start'. Reads preferred genres from Redis (set during onboarding). Fetches popular:<genre> sorted sets from Redis (BQ fallback). Scores movies by voteAverage×0.7 + popularity/1000×0.3. Defaults to Action + Drama if no genres set.",
    facts: [
      { label: 'Phase', value: 'cold (<5 ratings)' },
      { label: 'Data', value: 'Redis popular:<genre> sorted sets' },
      { label: 'BQ fallback', value: 'getBQPopular() if Redis MISS' },
      { label: 'Score', value: 'voteAverage × 0.7 + (popularity/1000) × 0.3' },
    ],
    filePath: 'backend/src/ml/contentBased.ts',
  },
  'data-redis': {
    title: 'Redis — Upstash',
    description: 'Primary hot-path store. All reads go here first. Upstash serverless Redis via REST API. Stores movies, user ratings and phases, search results cache, genre list cache, and popularity sorted sets. Falls back to BigQuery on MISS and caches the result.',
    facts: [
      { label: 'Hosting', value: 'Upstash (serverless REST)' },
      { label: 'movie:<id>', value: 'Hash — full movie object' },
      { label: 'user:<id>:ratings', value: 'Hash — movieId → rating' },
      { label: 'user:<id>:phase', value: 'String — cold / warming / full' },
      { label: 'search:<q>:<g>', value: 'JSON Movie[] — TTL 1h' },
      { label: 'movies:genres', value: 'JSON string[] — TTL 24h' },
      { label: 'popular:<genre>', value: 'Sorted set — movieId by popularity score' },
      { label: 'users:all', value: 'Set — all session tokens' },
    ],
    filePath: 'backend/src/redis/client.ts',
  },
  'data-bigquery': {
    title: 'BigQuery — GCP',
    description: 'Cold/compute path. Holds the full movie catalogue, precomputed 40-dim feature vectors, and top-50 similarity entries per movie computed by VECTOR_SEARCH. Redis falls back to BigQuery on MISS and caches the result. movie_similarity is always queried directly — no Redis cache for it.',
    facts: [
      { label: 'Hosting', value: 'GCP (US region)' },
      { label: 'movies', value: 'Full catalogue — title, cast, genres, overview, vectors' },
      { label: 'movie_features', value: '40-dim vectors: 19 genre one-hots + cast + keywords + stats' },
      { label: 'movie_similarity', value: 'Top-50 similar per movie — always queried directly' },
    ],
    filePath: 'backend/src/bigquery/client.ts',
  },
  'data-tmdb': {
    title: 'TMDB API',
    description: 'The Movie Database. Used only during seeding/migration — not at runtime. Fetches movie metadata (title, overview, cast, genres, poster, keywords) which is processed and uploaded to BigQuery. After seeding, TMDB is not required for app operation.',
    facts: [
      { label: 'Usage', value: 'Seeding / migration only (not runtime)' },
      { label: 'Data', value: 'Title, overview, cast, director, genres, keywords, poster_path' },
      { label: 'Rate limit', value: '40 req / 10s (free tier)' },
      { label: 'Image base URL', value: 'https://image.tmdb.org/t/p/w500' },
    ],
    filePath: 'backend/src/tmdb/fetcher.ts',
  },
};
```

- [ ] **Step 2: Type-check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: Same one missing-`ArchitectureFlow` error only.

- [ ] **Step 3: Commit**

```bash
cd D:/Project/CineGraph && git add frontend/components/architecture/data/nodeDetails.ts && git commit -m "feat(architecture): add static node detail content for all 28 nodes"
```

---

### Task 4: Custom node components

**Files:**
- Create: `frontend/components/architecture/nodes/LayerLabelNode.tsx`
- Create: `frontend/components/architecture/nodes/ComponentNode.tsx`

- [ ] **Step 1: Create `LayerLabelNode.tsx`**

Create `frontend/components/architecture/nodes/LayerLabelNode.tsx`:

```tsx
'use client';
// frontend/components/architecture/nodes/LayerLabelNode.tsx

import { type NodeProps } from 'reactflow';
import type { NodeData } from '@/components/architecture/data/graphData';

const LAYER_COLORS: Record<string, string> = {
  user:     '#3B82F6',
  frontend: '#10B981',
  backend:  '#7C3AED',
  data:     '#F59E0B',
};

export function LayerLabelNode({ data }: NodeProps<NodeData>) {
  const color = LAYER_COLORS[data.layer] ?? '#888';
  return (
    <div
      style={{
        width: 140,
        padding: '6px 12px',
        borderRadius: 6,
        border: `1px solid ${color}44`,
        backgroundColor: `${color}11`,
        color,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.1em',
        userSelect: 'none',
        pointerEvents: 'none',
      }}
    >
      {data.label}
    </div>
  );
}
```

- [ ] **Step 2: Create `ComponentNode.tsx`**

Create `frontend/components/architecture/nodes/ComponentNode.tsx`:

```tsx
'use client';
// frontend/components/architecture/nodes/ComponentNode.tsx

import { Handle, Position, type NodeProps } from 'reactflow';
import type { NodeData } from '@/components/architecture/data/graphData';

const LAYER_COLORS: Record<string, string> = {
  user:     '#3B82F6',
  frontend: '#10B981',
  backend:  '#7C3AED',
  data:     '#F59E0B',
};

// Nodes fade in layer-by-layer on page load via the arch-fade-in keyframe in globals.css
const LAYER_DELAY: Record<string, string> = {
  user:     '0ms',
  frontend: '150ms',
  backend:  '300ms',
  data:     '450ms',
};

export function ComponentNode({ data }: NodeProps<NodeData>) {
  const color    = LAYER_COLORS[data.layer] ?? '#888';
  const delay    = LAYER_DELAY[data.layer] ?? '0ms';
  const selected = data.isSelected ?? false;

  return (
    <>
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: color, width: 6, height: 6, border: 'none' }}
      />
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: color, width: 6, height: 6, border: 'none' }}
      />
      <div
        style={{
          position: 'relative',
          minWidth: 160,
          padding: '8px 14px 8px 18px',
          borderRadius: 8,
          border: `1.5px solid ${selected ? color : `${color}55`}`,
          backgroundColor: selected ? `${color}22` : 'var(--color-bg-card)',
          boxShadow: selected ? `0 0 14px ${color}55` : 'none',
          cursor: 'pointer',
          transition: 'border-color 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease',
          animationDelay: delay,
        }}
      >
        {/* Left accent bar */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 3,
            borderRadius: '8px 0 0 8px',
            backgroundColor: color,
          }}
        />
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-primary)' }}>
          {data.label}
        </div>
        {data.sublabel && (
          <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 2 }}>
            {data.sublabel}
          </div>
        )}
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: color, width: 6, height: 6, border: 'none' }}
      />
      <Handle
        type="source"
        position={Position.Right}
        style={{ background: color, width: 6, height: 6, border: 'none' }}
      />
    </>
  );
}
```

- [ ] **Step 3: Type-check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: Same one missing-`ArchitectureFlow` error only.

- [ ] **Step 4: Commit**

```bash
cd D:/Project/CineGraph && git add frontend/components/architecture/nodes/ && git commit -m "feat(architecture): add LayerLabelNode and ComponentNode"
```

---

### Task 5: Animated edge component

**Files:**
- Create: `frontend/components/architecture/edges/AnimatedEdge.tsx`

A custom React Flow edge that renders an SVG path plus a dot that travels along it via `<animateMotion>`. `variant: 'dashed'` = async path, `variant: 'bold'` = Socket.io stream.

- [ ] **Step 1: Create `AnimatedEdge.tsx`**

Create `frontend/components/architecture/edges/AnimatedEdge.tsx`:

```tsx
'use client';
// frontend/components/architecture/edges/AnimatedEdge.tsx

import { getBezierPath, type EdgeProps } from 'reactflow';
import type { EdgeData } from '@/components/architecture/data/graphData';

const FLOW_COLORS: Record<string, string> = {
  search:           '#3B82F6',
  'movie-detail':   '#10B981',
  recommend:        '#7C3AED',
  rating:           '#F59E0B',
  graph:            '#EC4899',
  tastepath:        '#06B6D4',
  profile:          '#84CC16',
  'node-expansion': '#84CC16',
  seeding:          '#6B7280',
};

export function AnimatedEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
  markerEnd,
}: EdgeProps<EdgeData>) {
  const [edgePath] = getBezierPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
  });

  const flowGroup    = data?.flowGroup ?? 'default';
  const variant      = data?.variant ?? 'default';
  const color        = FLOW_COLORS[flowGroup] ?? '#555555';
  const strokeWidth  = variant === 'bold' ? 2.5 : 1.5;
  const strokeDash   = variant === 'dashed' ? '6 4' : undefined;
  const baseOpacity  = selected ? 1 : 0.3;
  const dotOpacity   = selected ? 1 : 0.45;
  const animDuration = variant === 'bold' ? '1.2s' : '2s';

  return (
    <>
      {/* Base path */}
      <path
        id={id}
        d={edgePath}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={strokeDash}
        opacity={baseOpacity}
        markerEnd={markerEnd}
        style={{ transition: 'opacity 0.25s ease' }}
      />
      {/* Travelling dot */}
      <circle r={3} fill={color} opacity={dotOpacity}>
        <animateMotion dur={animDuration} repeatCount="indefinite" path={edgePath} />
      </circle>
    </>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: Same one missing-`ArchitectureFlow` error only.

- [ ] **Step 3: Commit**

```bash
cd D:/Project/CineGraph && git add frontend/components/architecture/edges/AnimatedEdge.tsx && git commit -m "feat(architecture): add AnimatedEdge with travelling dot"
```

---

### Task 6: NodeDetailDrawer

**Files:**
- Create: `frontend/components/architecture/NodeDetailDrawer.tsx`

Slides in from the right (400px). Escape key closes it. Shows title, file path, description, and a facts table for the selected node.

- [ ] **Step 1: Create `NodeDetailDrawer.tsx`**

Create `frontend/components/architecture/NodeDetailDrawer.tsx`:

```tsx
'use client';
// frontend/components/architecture/NodeDetailDrawer.tsx

import { useEffect } from 'react';
import { nodeDetails } from '@/components/architecture/data/nodeDetails';

interface Props {
  nodeId: string | null;
  onClose: () => void;
}

export function NodeDetailDrawer({ nodeId, onClose }: Props) {
  const detail = nodeId ? (nodeDetails[nodeId] ?? null) : null;
  const isOpen = nodeId !== null;

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      style={{
        position:        'fixed',
        top:             64, // below Navbar
        right:           0,
        bottom:          0,
        width:           400,
        backgroundColor: 'var(--color-bg-card)',
        borderLeft:      '1px solid var(--color-card-border)',
        transform:       isOpen ? 'translateX(0)' : 'translateX(100%)',
        transition:      'transform 0.3s ease-out',
        zIndex:          40,
        overflowY:       'auto',
        padding:         '20px',
        display:         'flex',
        flexDirection:   'column',
        gap:             16,
      }}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        aria-label="Close detail panel"
        style={{
          alignSelf:       'flex-end',
          background:      'none',
          border:          'none',
          color:           'var(--color-text-muted)',
          cursor:          'pointer',
          fontSize:        18,
          lineHeight:      1,
          padding:         4,
        }}
      >
        ✕
      </button>

      {/* Content — fades in after drawer slides in */}
      <div
        style={{
          opacity:    isOpen ? 1 : 0,
          transition: 'opacity 0.15s ease 0.1s',
          display:    'flex',
          flexDirection: 'column',
          gap:        16,
        }}
      >
        {detail ? (
          <>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
              {detail.title}
            </h2>

            {detail.filePath && (
              <code
                style={{
                  display:         'block',
                  fontSize:        11,
                  color:           'var(--color-text-muted)',
                  backgroundColor: '#111',
                  padding:         '4px 10px',
                  borderRadius:    4,
                }}
              >
                {detail.filePath}
              </code>
            )}

            <p style={{ fontSize: 13, lineHeight: 1.65, color: 'var(--color-text-secondary)', margin: 0 }}>
              {detail.description}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {detail.facts.map(({ label, value }) => (
                <div
                  key={label}
                  style={{
                    display:             'grid',
                    gridTemplateColumns: '140px 1fr',
                    gap:                 8,
                    fontSize:            12,
                    padding:             '8px 0',
                    borderBottom:        '1px solid #2a2a2a',
                  }}
                >
                  <span style={{ color: 'var(--color-text-muted)', fontWeight: 500 }}>{label}</span>
                  <span style={{ color: 'var(--color-text-primary)' }}>{value}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          isOpen && (
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
              No details available for this node.
            </p>
          )
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: Same one missing-`ArchitectureFlow` error only.

- [ ] **Step 3: Commit**

```bash
cd D:/Project/CineGraph && git add frontend/components/architecture/NodeDetailDrawer.tsx && git commit -m "feat(architecture): add NodeDetailDrawer slide-in panel"
```

---

### Task 7: ArchitectureFlow — main React Flow canvas

**Files:**
- Create: `frontend/components/architecture/ArchitectureFlow.tsx`

Wires all components together. Manages `selectedNodeId` and `selectedFlowGroup` state. Derives `displayNodes` / `displayEdges` for opacity changes without mutating source data.

- [ ] **Step 1: Create `ArchitectureFlow.tsx`**

Create `frontend/components/architecture/ArchitectureFlow.tsx`:

```tsx
'use client';
// frontend/components/architecture/ArchitectureFlow.tsx

import { useCallback, useState } from 'react';
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type NodeMouseHandler,
  type EdgeMouseHandler,
  type Node,
  type Edge,
} from 'reactflow';
import 'reactflow/dist/style.css';

import {
  initialNodes,
  initialEdges,
  type NodeData,
  type EdgeData,
} from '@/components/architecture/data/graphData';
import { ComponentNode }  from '@/components/architecture/nodes/ComponentNode';
import { LayerLabelNode } from '@/components/architecture/nodes/LayerLabelNode';
import { AnimatedEdge }   from '@/components/architecture/edges/AnimatedEdge';
import { NodeDetailDrawer } from '@/components/architecture/NodeDetailDrawer';

const nodeTypes = {
  component:  ComponentNode,
  layerLabel: LayerLabelNode,
} as const;

const edgeTypes = {
  animated: AnimatedEdge,
} as const;

export function ArchitectureFlow() {
  const [nodes, , onNodesChange] = useNodesState<NodeData>(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState<EdgeData>(initialEdges);

  const [selectedNodeId,    setSelectedNodeId]    = useState<string | null>(null);
  const [selectedFlowGroup, setSelectedFlowGroup] = useState<string | null>(null);

  // Node click: toggle drawer; clear flow highlight
  const onNodeClick: NodeMouseHandler = useCallback((_evt, node: Node<NodeData>) => {
    if (node.type === 'layerLabel') return;
    setSelectedNodeId(prev => prev === node.id ? null : node.id);
    setSelectedFlowGroup(null);
  }, []);

  // Edge click: toggle flow highlight; close drawer
  const onEdgeClick: EdgeMouseHandler = useCallback((_evt, edge: Edge<EdgeData>) => {
    const group = edge.data?.flowGroup ?? null;
    setSelectedFlowGroup(prev => prev === group ? null : group);
    setSelectedNodeId(null);
  }, []);

  // Click on empty canvas: clear everything
  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedFlowGroup(null);
  }, []);

  // Derive display nodes: inject isSelected into data, apply flow-dim opacity
  const displayNodes = nodes.map(node => {
    const inFlow = selectedFlowGroup
      ? edges.some(e => e.data?.flowGroup === selectedFlowGroup && (e.source === node.id || e.target === node.id))
      : true;
    return {
      ...node,
      data: { ...node.data, isSelected: node.id === selectedNodeId },
      style: {
        ...node.style,
        opacity:    selectedFlowGroup ? (inFlow ? 1 : 0.15) : 1,
        transition: 'opacity 0.2s ease',
      },
    };
  });

  // Derive display edges: selected edge group fully opaque, rest dimmed
  const displayEdges = edges.map(edge => ({
    ...edge,
    selected: selectedFlowGroup ? edge.data?.flowGroup === selectedFlowGroup : false,
    style: {
      ...edge.style,
      opacity:    selectedFlowGroup ? (edge.data?.flowGroup === selectedFlowGroup ? 1 : 0.06) : 1,
      transition: 'opacity 0.2s ease',
    },
  }));

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>

      {/* Flow name label shown when a flow group is selected */}
      {selectedFlowGroup && (
        <div
          style={{
            position:        'absolute',
            top:             80,
            left:            '50%',
            transform:       'translateX(-50%)',
            zIndex:          10,
            backgroundColor: 'var(--color-bg-elevated)',
            border:          '1px solid var(--color-card-border)',
            borderRadius:    8,
            padding:         '6px 18px',
            fontSize:        12,
            fontWeight:      600,
            color:           'var(--color-text-primary)',
            letterSpacing:   '0.05em',
            textTransform:   'capitalize',
            pointerEvents:   'none',
          }}
        >
          {selectedFlowGroup.replace(/-/g, ' ')} flow — click canvas to clear
        </div>
      )}

      <ReactFlow
        nodes={displayNodes}
        edges={displayEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        fitView
        fitViewOptions={{ padding: 0.12 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        defaultEdgeOptions={{ type: 'animated' }}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#2a2a2a" />
        <Controls
          showInteractive={false}
          style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-card-border)' }}
        />
        <MiniMap
          nodeColor={(n) => {
            const layer = (n.data as NodeData)?.layer;
            const map: Record<string, string> = {
              user: '#3B82F6', frontend: '#10B981', backend: '#7C3AED', data: '#F59E0B',
            };
            return map[layer ?? ''] ?? '#444';
          }}
          style={{ backgroundColor: '#111', border: '1px solid var(--color-card-border)' }}
          maskColor="rgba(0,0,0,0.6)"
        />
      </ReactFlow>

      <NodeDetailDrawer nodeId={selectedNodeId} onClose={() => setSelectedNodeId(null)} />
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: **0 errors**. The missing-module error is now resolved.

- [ ] **Step 3: Smoke-test in dev**

```bash
cd frontend && npm run dev
```

Open `http://localhost:3000/architecture`. Expected:
- React Flow canvas fills the screen below the Navbar
- ~30 nodes visible across 4 rows with colour-coded left borders
- Animated dots travelling along edges
- Clicking a node opens the right-side detail drawer with title, description, and facts
- Clicking an edge dims all other flows and shows the flow name at the top
- Clicking the canvas clears the highlight and closes the drawer

- [ ] **Step 4: Commit**

```bash
cd D:/Project/CineGraph && git add frontend/components/architecture/ArchitectureFlow.tsx && git commit -m "feat(architecture): add ArchitectureFlow React Flow canvas"
```

---

### Task 8: Load animation + React Flow dark theme overrides

**Files:**
- Modify: `frontend/app/globals.css`

Adds the staggered `arch-fade-in` keyframe used by `ComponentNode` and overrides React Flow's default light-theme styles to match the app's dark theme.

- [ ] **Step 1: Append to `globals.css`**

Open `frontend/app/globals.css` and append at the very end of the file:

```css
/* ── Architecture page: node load animation ─────────────────────────────── */
@keyframes arch-fade-in {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}

.react-flow__node {
  animation: arch-fade-in 0.35s ease both;
}

/* ── React Flow dark theme overrides ──────────────────────────────────────── */
.react-flow__attribution { display: none; }

.react-flow__edge-path {
  transition: opacity 0.2s ease;
}

.react-flow__controls-button {
  background-color: var(--color-bg-card) !important;
  border-color: var(--color-card-border) !important;
  color: var(--color-text-secondary) !important;
  fill: var(--color-text-secondary) !important;
}
.react-flow__controls-button:hover {
  background-color: var(--color-bg-elevated) !important;
}

/* Remove React Flow's default white node background */
.react-flow__node-component,
.react-flow__node-layerLabel {
  background: transparent !important;
  border: none !important;
  padding: 0 !important;
}
```

- [ ] **Step 2: Type-check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Production build**

```bash
cd frontend && npm run build
```

Expected: Build completes with no errors. No missing modules, no type errors.

- [ ] **Step 4: Commit**

```bash
cd D:/Project/CineGraph && git add frontend/app/globals.css && git commit -m "feat(architecture): add node load animation and React Flow dark theme overrides"
```
