# Graph Algorithm Visualization — Design Spec
**Date:** 2026-04-05  
**Feature:** Floyd-Warshall · Dijkstra · Kruskal live visualization on `/graph` page  
**Status:** Approved, ready for implementation

---

## Overview

Replace the static SVG placeholder on `frontend/app/graph/page.tsx` with a live D3 force-directed user-similarity graph and three algorithm visualization panels (Kruskal, Dijkstra, Floyd-Warshall). All three backend algorithms are already fully implemented — this feature wires them to a Socket.io streaming flow and builds the frontend visualization layer.

---

## Backend Architecture

### New route: `backend/src/routes/graph.ts`

```
POST /graph/compute
Headers: X-Session-Token (required)
Body: { targetUserId?: string }
Returns: { graphSessionId: string }
```

- Returns `graphSessionId` (new UUID, independent from recommend sessionId) immediately
- Async IIFE runs the computation pipeline:
  1. Fetch all user IDs from Redis `users:all` set, cap at 20
  2. Build pairwise Pearson similarity matrix (same logic as collaborative filtering)
  3. Run **Kruskal** → stream `graph:step` `{ graphSessionId, algorithm: 'kruskal', step: MSTStep }`
  4. Run **Floyd-Warshall** → stream `graph:step` `{ graphSessionId, algorithm: 'floydWarshall', step: FloydStep }`
  5. Run **Dijkstra** (source = current user, target = `targetUserId` or closest neighbor) → stream `graph:step` `{ graphSessionId, algorithm: 'dijkstra', step: DijkstraStep }`
  6. Emit `graph:complete { graphSessionId, mstEdges, communities, dijkstraPath, userIds, similarityMatrix }`

### Socket events (new)
| Event | Direction | Payload |
|---|---|---|
| `graph:step` | server → client | `{ graphSessionId, algorithm, step }` |
| `graph:complete` | server → client | `{ graphSessionId, mstEdges, communities, dijkstraPath, userIds, similarityMatrix }` |

### Wiring
- `socketServer.ts` calls `setGraphEmitter()` on `graph.ts` after Socket.io initializes — same pattern as `setEmitter()` for recommend
- Reuses the existing `emitToUser(userId, event, data)` helper

### New helper endpoint (added to existing `backend/src/routes/profile.ts`)
```
GET /profile/:userId/top-movies
Returns: Movie[]  (top 3 by rating, fetched from Redis movie:<id> hashes)
```
Used by the frontend when a user node is expanded.

---

## Frontend Architecture

### Page: `frontend/app/graph/page.tsx`

- Full `'use client'` component
- On mount: calls `POST /graph/compute`, stores `graphSessionId` in a ref
- Subscribes to `graph:step` and `graph:complete` socket events filtered by `graphSessionId`
- Steps stored in refs (not state) to avoid re-renders during streaming — same pattern as AlgoDrawer
- `graph:complete` payload triggers state update that enables Play buttons and renders final graph

### Layout (desktop only — mobile warning preserved)

```
┌─────────────────────────────────────────────────────┐
│  Header: "User Similarity Graph"  + subtitle        │
├──────────────────────────┬──────────────────────────┤
│                          │  [ Kruskal | Dijkstra |  │
│   D3 Force-Directed      │    Floyd-Warshall ]       │
│   Node Graph             │                           │
│   (left, ~60% width)     │  Algorithm panel          │
│                          │  (right, ~40% width)      │
└──────────────────────────┴──────────────────────────┘
```

---

## D3 Node Graph

**Nodes:**
- One circle per user (capped at 20)
- Radius scaled by rating count (more ratings = larger node)
- Color = Kruskal community assignment (uses `--viz-color-1` through `--viz-color-4` CSS vars)
- Current user node marked with a star/ring accent in `--color-brand`

**Edges:**
- Lines between users where similarity > 0.5
- Opacity mapped to similarity strength
- MST edges (from Kruskal) drawn thicker/brighter than non-MST edges

**Force simulation:**
- D3 `forceSimulation` with `forceManyBody` (repulsion) + `forceLink` (attraction) + `forceCenter`
- Nodes are draggable
- Initialized in `useEffect` (DOM required), `'use client'` at top of file

**Algorithm reactions (live during replay):**
- **Kruskal**: considered edge flashes orange, accepted edge turns green and thickens, rejected edge fades red
- **Dijkstra**: visited node pulses brand purple, current path traced as glowing line
- **Floyd-Warshall**: the (i, j) node pair pulses briefly on each snapshot update

**Node expansion (click):**
- Clicking a user node fetches their top 3 movies via `GET /profile/:userId/top-movies`
- 3 satellite thumbnail nodes animate out around the clicked node (Framer Motion)
- Thumbnails show movie poster (TMDB image via `posterUrl()` helper) and title
- Clicking elsewhere collapses the expansion

---

## Algorithm Panels (right side)

All three panels share:
- Steps buffered in refs during streaming
- `graph:complete` enables Play button (same `msTotalSteps`/`ksTotalSteps` pattern)
- Reuse `SpeedControls` component — extract it from `AlgoDrawer.tsx` into `frontend/components/layout/SpeedControls.tsx` as a named export first

### Kruskal Panel
- Edge list: each step adds a row — user pair, weight, colored badge (`CONSIDER` / `ADD` / `REJECT`)
- Community groups shown as colored chips, merging as edges are accepted
- D3 graph highlights corresponding edge during replay

### Dijkstra Panel
- Frontier queue: priority list of user IDs + current best distance, updates each step
- Path chain: growing sequence of user-id pills showing current shortest path
- Source node = current user (marked), target = closest taste-neighbor
- Final path rendered in brand purple on D3 graph

### Floyd-Warshall Panel
- n×n heatmap grid — cells colored dark (0) → brand purple (1)
- Active (i, j) cell pulses; updated cells flash brighter
- Only snapshot steps replayed (every 100th update) — progress counter shown between snapshots
- Final matrix shown as "what the AI sees" summary card

---

## New Files

| File | Purpose |
|---|---|
| `backend/src/routes/graph.ts` | `/graph/compute` route + graph emitter |
| `frontend/app/graph/page.tsx` | Full rewrite — live D3 graph + tabbed panels |
| `frontend/components/graph/D3UserGraph.tsx` | D3 force-directed graph component |
| `frontend/components/graph/KruskalPanel.tsx` | Kruskal step visualization |
| `frontend/components/graph/DijkstraPanel.tsx` | Dijkstra step visualization |
| `frontend/components/graph/FloydWarshallPanel.tsx` | Floyd-Warshall heatmap |
| `frontend/components/layout/SpeedControls.tsx` | Extracted from AlgoDrawer — shared speed control component |

## Modified Files

| File | Change |
|---|---|
| `backend/src/index.ts` | Register `/graph` router |
| `backend/src/socketServer.ts` | Wire `setGraphEmitter()` |
| `backend/src/routes/profile.ts` | Add `GET /profile/:userId/top-movies` endpoint |
| `frontend/lib/types.ts` | Add `GraphStepEvent`, `GraphCompleteEvent` types |
| `frontend/components/layout/AlgoDrawer.tsx` | Import `SpeedControls` from extracted file instead of local definition |

---

## CSS Variables (no new variables needed)

Reuses existing tokens:
- `--viz-color-1` through `--viz-color-4` — community colors
- `--color-brand` — Dijkstra path, active node
- `--viz-mst-edge` — MST edge color
- `--color-bg-card`, `--color-border`, `--color-text-muted` — panel chrome

---

## Constraints & Gotchas

- D3 component must be `'use client'` and initialize inside `useEffect` (CLAUDE.md)
- All imports use `@/` alias — no relative paths
- No hardcoded hex colors — use CSS vars only
- Floyd-Warshall capped at 20 users (already enforced in backend)
- `posterUrl()` helper for all TMDB poster paths
- Socket subscriptions registered once on mount with `[]` deps, read `graphSessionIdRef.current` to avoid stale closures
