# Architecture Page — Design Spec
**Date:** 2026-04-12
**Status:** Approved

## Overview

Add an `/architecture` route that serves as an interactive, animated explanatory page for the entire CineGraph system. The page shows every component — frontend, backend, data layer — as a React Flow node graph with animated data-flow edges. Clicking any node opens a detail drawer. Clicking an edge highlights the full end-to-end flow it belongs to.

Audience: both recruiters/hiring managers (portfolio showcase) and developers (system design walkthrough).

---

## Architecture & Layout

**Library:** `reactflow` (React Flow v11). No additional diagram libraries.

**Canvas:** Full-viewport React Flow canvas (`h-screen`, overflow hidden). Navbar stays fixed on top. No page scroll — all navigation is zoom/pan inside the canvas.

**Layout:** 4 horizontal swimlane rows with a label node on the left edge of each row:

```
┌──────────────────────────────────────────────────────────────────────┐
│  USER      [ Search Bar ]  [ Discover ]  [ Movie Page ]  [ Graph ]   │
├──────────────────────────────────────────────────────────────────────┤
│  FRONTEND  [ SearchBar/Dropdown ]  [ AlgoDrawer ]  [ D3UserGraph ]   │
├──────────────────────────────────────────────────────────────────────┤
│  BACKEND   [ Movies Route ]  [ Recommend Route ]  [ Rate Route ]     │
│            [ Graph Route ]  [ Socket.io Server ]                     │
│            [ MergeSort ]  [ Knapsack ]  [ Dijkstra ]                 │
│            [ Floyd-Warshall ]  [ Kruskal ]                           │
│            [ Content Engine ]  [ Collaborative Engine ]              │
│            [ Hybrid Engine ]  [ Cold Start Engine ]                  │
├──────────────────────────────────────────────────────────────────────┤
│  DATA      [ Redis (Upstash) ]  [ BigQuery (GCP) ]  [ TMDB API ]    │
└──────────────────────────────────────────────────────────────────────┘
```

**React Flow config:** `fitView` on mount, `nodesDraggable: false`, `nodesConnectable: false`, zoom + pan enabled. `<Background variant="dots" />` and `<MiniMap />` (bottom-right, dark themed).

**Navbar:** Add `{ href: '/architecture', label: 'Architecture' }` to `NAV_LINKS` in `Navbar.tsx`.

---

## Node Types & Color Coding

### `ComponentNode` (all clickable nodes)
Left border accent + icon + label. Color by layer:
- User layer: `#3B82F6` (blue)
- Frontend layer: `#10B981` (green)
- Backend layer: `#7C3AED` (brand purple)
- Data layer: `#F59E0B` (amber)

On hover: `scale(1.04)` + border glow.
On click: brief pulse ring → opens detail drawer. Selected state: filled accent background.

### `LayerLabelNode` (non-interactive row labels)
Transparent background, uppercase muted text. Not clickable.

**Total nodes: ~28**

---

## Verified Data Flows & Edges

Each flow is a named group. Clicking an edge highlights all nodes and edges in that flow; others dim. A label shows the flow name.

### 1. Search Flow
```
SearchBar → GET /movies/search → Redis (search:<q>:<g>, TTL 1h)
                                       └─ MISS → BigQuery (movies table, LIKE) → Redis SET
SearchBar → GET /movies/genres → Redis (movies:genres, TTL 24h)
                                       └─ MISS → BigQuery (DISTINCT genres) → Redis SET
```

### 2. Movie Detail Flow
```
Movie Page → GET /movies/:id → Redis (movie:<id> hash)
                                    └─ MISS → BigQuery (movies table) → Redis SET
           → BigQuery (movie_similarity table) — always direct, no Redis cache
           → Redis (movie:<id>) per similar movie  — BQ fallback each
```

### 3. Recommendation Flow (fire-and-forget async job)
```
Discover Page → POST /recommend → { sessionId } immediately
                                 ↓ async job
cold_start:  Redis (user:genres) + Redis (popular:<genre> sorted set → BQ fallback) + Redis (movie:<id>)
content:     Redis (user ratings) → BigQuery (movie_similarity, always direct) → Redis (movie:<id>)
collab:      Redis (users:all + all user ratings) → Pearson in-memory → Redis (movie:<id>)
hybrid:      content + collaborative in parallel → round-robin interleave

→ MergeSort → algo:step × N via Socket.io → algo:complete
→ [if budget] Knapsack → algo:step × N via Socket.io → algo:complete
→ recommend:ready via Socket.io
```

### 4. Rating Flow
```
Movie Page → POST /rate → Redis (user:<id>:ratings hash)
                        → Redis (users:all set)
                        → Redis (user:<id>:phase)
                        → BigQuery upsertRating (fire-and-forget, dashed edge, non-blocking)
```

### 5. Graph Compute Flow (fire-and-forget async job)
```
Graph Page → POST /graph/compute → { graphSessionId } immediately
                                  ↓ async job
→ Redis (users:all) → Redis (user ratings × up to 20 users)
→ Pearson similarity matrix (in-memory, no DB)
→ Kruskal    → graph:step × N via Socket.io
→ Floyd-Warshall (snapshot steps only) → graph:step × N via Socket.io
→ Dijkstra   → graph:step × N via Socket.io
→ graph:complete via Socket.io
```

### 6. Taste Path Flow (Socket.io direct, not REST)
```
D3UserGraph → Socket.io tastepath:find
→ Redis (users:all + all user ratings)
→ Pearson matrix (in-memory)
→ Dijkstra → algo:step via Socket.io → tastepath:result via Socket.io
```

### 7. Profile Flow
```
Profile Drawer → GET /profile → Redis (user ratings + phase + count)
              → Redis (movie:<id>) per rated movie — BQ fallback
```

### 8. Node Expansion (top movies)
```
D3UserGraph → GET /profile/:userId/top-movies
→ Redis (user ratings) → Redis (movie:<id> × top 3) — BQ fallback
```

---

## Animated Edges (`AnimatedEdge`)

Custom React Flow edge: SVG path + dot travelling along it via `stroke-dashoffset` CSS animation.

- **Default:** dim line, slow dot
- **Node hovered:** connected edges brighten, dot speeds up
- **Node selected:** connected edges glow with layer accent color
- **Edge clicked:** entire flow group highlights; other nodes/edges dim; flow name label appears

Special edge variants:
- **Dashed edge:** async/fire-and-forget paths (Rating → BigQuery upsertRating)
- **Bold edge:** Socket.io streaming paths (algo:step, graph:step, recommend:ready)

---

## Node Detail Drawer (`NodeDetailDrawer`)

Slides in from right (~400px wide). Main canvas stays visible. Close on outside click or Escape.

Content by node type:

**Data nodes** (Redis, BigQuery, TMDB API):
- Purpose + hosting info
- Key Redis keys or BigQuery tables
- Cache TTLs

**Route nodes** (Movies, Recommend, Rate, Graph routes):
- Endpoint(s)
- Request/response shape
- Sync vs fire-and-forget behaviour

**Algorithm nodes** (MergeSort, Knapsack, Dijkstra, Floyd-Warshall, Kruskal):
- Role in CineGraph (not generic description)
- Time complexity badge
- Input → output
- Socket.io streaming note

**ML Engine nodes** (Content, Collaborative, Hybrid, Cold Start):
- Activation phase
- Data sources
- Scoring approach

**Frontend nodes** (SearchBar, AlgoDrawer, D3UserGraph, etc.):
- Component file path
- State owned
- Key interactions

All content defined statically in `nodeDetails.ts`. No API calls from the drawer.

---

## Animations

**Page load:** Nodes fade in layer by layer with staggered delay — User first, then Frontend, Backend, Data. ~150ms gap between layers. CSS `@keyframes` + inline `animationDelay`.

**Node hover:** `scale(1.04)` + border glow (200ms ease).

**Node click:** Brief pulse ring before drawer opens.

**Selected state:** Filled accent background; persists while drawer is open.

**Drawer:** `translateX(100%)` → `translateX(0)` (300ms ease-out). Content fades in 100ms after drawer settles.

**Flow highlight (edge click):** Selected flow nodes + edges light up. Unrelated nodes drop to 20% opacity. Flow name label fades in at top of canvas.

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| React Flow fails to mount | Fallback text: "Diagram unavailable" |
| `nodeDetails.ts` missing entry for a node id | Drawer shows node id + "No details available" |
| User clicks edge with no flow group defined | No highlight change; edge click is a no-op |

---

## Files Changed

| File | Change |
|---|---|
| `frontend/app/architecture/page.tsx` | **New** — route shell, renders `<ArchitectureFlow />` |
| `frontend/components/architecture/ArchitectureFlow.tsx` | **New** — React Flow canvas, zoom/pan, minimap, background |
| `frontend/components/architecture/NodeDetailDrawer.tsx` | **New** — right-side detail drawer, slide animation |
| `frontend/components/architecture/nodes/ComponentNode.tsx` | **New** — clickable node with accent border + icon + label |
| `frontend/components/architecture/nodes/LayerLabelNode.tsx` | **New** — non-interactive swimlane row label |
| `frontend/components/architecture/edges/AnimatedEdge.tsx` | **New** — SVG edge with travelling dot animation |
| `frontend/components/architecture/data/graphData.ts` | **New** — all node + edge definitions, flow group assignments |
| `frontend/components/architecture/data/nodeDetails.ts` | **New** — static detail content per node id |
| `frontend/components/layout/Navbar.tsx` | Add `/architecture` to `NAV_LINKS` |
