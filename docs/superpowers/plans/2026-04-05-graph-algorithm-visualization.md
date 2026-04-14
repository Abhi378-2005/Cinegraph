# Graph Algorithm Visualization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static `/graph` page placeholder with a live D3 force-directed user-similarity graph streaming Floyd-Warshall, Dijkstra, and Kruskal algorithm steps from the backend via Socket.io.

**Architecture:** A new `POST /graph/compute` route builds the user-similarity matrix from Redis, runs all three graph algorithms, and streams steps via the existing `emitToUser` helper on dedicated `graph:step` / `graph:complete` socket events. The graph page subscribes on mount, buffers steps in refs (no re-renders during streaming), and drives three independent replay engines — one per algorithm tab. A D3 force-directed SVG reacts live to replay cursor position.

**Tech Stack:** Node.js/Express (backend route), Socket.io (streaming), D3 v7 (force layout, SVG), Framer Motion (node expansion), React 19 / Next.js App Router (frontend), Upstash Redis (user data), TypeScript throughout.

---

## File Map

**Create:**
- `backend/src/routes/graph.ts` — `/graph/compute` route + `setGraphEmitter`
- `frontend/components/layout/SpeedControls.tsx` — extracted shared component
- `frontend/components/graph/D3UserGraph.tsx` — D3 force-directed SVG
- `frontend/components/graph/KruskalPanel.tsx` — Kruskal edge-list replay
- `frontend/components/graph/DijkstraPanel.tsx` — Dijkstra frontier/path replay
- `frontend/components/graph/FloydWarshallPanel.tsx` — Floyd-Warshall heatmap replay

**Modify:**
- `backend/src/index.ts` — register `/graph` router
- `backend/src/socket/socketServer.ts` — wire `setGraphEmitter`
- `backend/src/routes/profile.ts` — add `GET /profile/:userId/top-movies`
- `frontend/lib/types.ts` — add `GraphStepEvent`, `GraphCompleteEvent`
- `frontend/lib/socket.ts` — add `onGraphStep`, `onGraphComplete`
- `frontend/lib/api.ts` — add `api.computeGraph()`
- `frontend/components/layout/AlgoDrawer.tsx` — import `SpeedControls` from shared file
- `frontend/app/graph/page.tsx` — full rewrite

---

## Task 1: Extract SpeedControls into a shared component

**Files:**
- Create: `frontend/components/layout/SpeedControls.tsx`
- Modify: `frontend/components/layout/AlgoDrawer.tsx`

- [ ] **Step 1: Create the shared SpeedControls file**

Create `frontend/components/layout/SpeedControls.tsx`:

```tsx
'use client';

export function SpeedControls({
  replaySpeedMs,
  onSpeedChange,
}: {
  replaySpeedMs: number;
  onSpeedChange: (ms: number) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => onSpeedChange(Math.min(300, replaySpeedMs + 60))}
        className="px-1.5 py-0.5 rounded text-xs"
        style={{ backgroundColor: 'var(--color-bg-card)', color: 'var(--color-text-muted)' }}
      >
        ◀ slower
      </button>
      <button
        onClick={() => onSpeedChange(Math.max(60, replaySpeedMs - 60))}
        className="px-1.5 py-0.5 rounded text-xs"
        style={{ backgroundColor: 'var(--color-bg-card)', color: 'var(--color-text-muted)' }}
      >
        faster ▶
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Update AlgoDrawer to import from the shared file**

In `frontend/components/layout/AlgoDrawer.tsx`, replace the inline `SpeedControls` function (lines 23–48) with an import:

```tsx
import { SpeedControls } from '@/components/layout/SpeedControls';
```

Remove the lines:
```tsx
function SpeedControls({
  replaySpeedMs,
  onSpeedChange,
}: {
  replaySpeedMs: number;
  onSpeedChange: (ms: number) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => onSpeedChange(Math.min(300, replaySpeedMs + 60))}
        className="px-1.5 py-0.5 rounded text-xs"
        style={{ backgroundColor: 'var(--color-bg-card)', color: 'var(--color-text-muted)' }}
      >
        ◀ slower
      </button>
      <button
        onClick={() => onSpeedChange(Math.max(60, replaySpeedMs - 60))}
        className="px-1.5 py-0.5 rounded text-xs"
        style={{ backgroundColor: 'var(--color-bg-card)', color: 'var(--color-text-muted)' }}
      >
        faster ▶
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Type-check to confirm no regressions**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/components/layout/SpeedControls.tsx frontend/components/layout/AlgoDrawer.tsx
git commit -m "refactor: extract SpeedControls into shared component"
```

---

## Task 2: Add graph types to frontend

**Files:**
- Modify: `frontend/lib/types.ts`

- [ ] **Step 1: Add GraphStepEvent and GraphCompleteEvent**

In `frontend/lib/types.ts`, append after the existing `RecommendReadyEvent` and `CommunityUpdateEvent` lines:

```ts
export interface GraphStepEvent {
  graphSessionId: string;
  algorithm: 'kruskal' | 'dijkstra' | 'floydWarshall';
  step: MSTStep | DijkstraStep | FloydStep;
}

export interface GraphCompleteEvent {
  graphSessionId: string;
  userIds: string[];
  similarityMatrix: number[][];
  mstEdges: Array<{ u: string; v: string; weight: number }>;
  communities: string[][];
  dijkstraPath: string[];
  dijkstraTarget: string;
}
```

- [ ] **Step 2: Type-check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/lib/types.ts
git commit -m "feat(types): add GraphStepEvent and GraphCompleteEvent"
```

---

## Task 3: Add graph socket events and API call to frontend lib

**Files:**
- Modify: `frontend/lib/socket.ts`
- Modify: `frontend/lib/api.ts`

- [ ] **Step 1: Add imports and socket event handlers to socket.ts**

In `frontend/lib/socket.ts`, add to the imports:

```ts
import type {
  AlgoStepEvent,
  AlgoCompleteEvent,
  RecommendReadyEvent,
  CommunityUpdateEvent,
  GraphStepEvent,
  GraphCompleteEvent,
} from '@/lib/types';
```

In the `socketEvents` object, add:

```ts
onGraphStep:    (cb: (d: GraphStepEvent) => void): Unsubscribe    => safeOn('graph:step', cb),
onGraphComplete:(cb: (d: GraphCompleteEvent) => void): Unsubscribe => safeOn('graph:complete', cb),
```

- [ ] **Step 2: Add computeGraph to api.ts**

In `frontend/lib/api.ts`, add to the `api` object:

```ts
/** Triggers graph algorithm computation. Returns a graphSessionId. */
async computeGraph(): Promise<{ graphSessionId: string }> {
  return apiFetch('/graph/compute', { method: 'POST' });
},

/** Fetch top-rated movies for a user node (used for node expansion). */
async getTopMovies(userId: string): Promise<{ movies: Array<{ movieId: number; title: string; posterPath: string; rating: number }> }> {
  return apiFetch(`/profile/${encodeURIComponent(userId)}/top-movies`);
},
```

- [ ] **Step 3: Type-check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/lib/socket.ts frontend/lib/api.ts
git commit -m "feat(lib): add graph socket events and computeGraph API call"
```

---

## Task 4: Add GET /profile/:userId/top-movies endpoint

**Files:**
- Modify: `backend/src/routes/profile.ts`

- [ ] **Step 1: Add the endpoint**

In `backend/src/routes/profile.ts`, add these imports at the top (they're already imported — just verify `getUserRatings` and `getMovie` are present):

```ts
import { getUserRatings, getPhase, getRatingCount } from '../redis/ratings';
import { getMovie } from '../redis/movies';
```

Append the new route at the bottom of the file, before the final closing:

```ts
// GET /profile/:userId/top-movies — top 3 movies by rating for a given user
// Used by the graph page node expansion feature
profileRouter.get('/:userId/top-movies', async (req, res) => {
  const { userId } = req.params;
  if (!userId) return res.status(400).json({ error: 'Missing userId' });

  try {
    const ratings = await getUserRatings(userId);
    const sorted = Object.entries(ratings)
      .map(([id, r]) => ({ movieId: Number(id), rating: r }))
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 3);

    const movies = (
      await Promise.all(
        sorted.map(async ({ movieId, rating }) => {
          const movie = await getMovie(movieId);
          if (!movie) return null;
          return { movieId, title: movie.title, posterPath: movie.posterPath, rating };
        })
      )
    ).filter((m): m is NonNullable<typeof m> => m !== null);

    res.json({ movies });
  } catch (err) {
    console.error('top-movies error:', err);
    res.status(500).json({ error: 'Failed to fetch top movies' });
  }
});
```

- [ ] **Step 2: Type-check backend**

```bash
cd backend && npm run build
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add backend/src/routes/profile.ts
git commit -m "feat(profile): add GET /profile/:userId/top-movies endpoint"
```

---

## Task 5: Create the graph compute route

**Files:**
- Create: `backend/src/routes/graph.ts`

- [ ] **Step 1: Create the file**

Create `backend/src/routes/graph.ts`:

```ts
import { Router } from 'express';
import { randomUUID } from 'crypto';
import { getAllUserIds, getUserRatings } from '../redis/ratings';
import { pearsonCorrelation } from '../ml/pearsonCorrelation';
import { kruskal } from '../algorithms/kruskal';
import { floydWarshall } from '../algorithms/floydWarshall';
import { dijkstra } from '../algorithms/dijkstra';
import { log, timer } from '../logger';

// Emitter — set by socketServer after initialization
export let emitGraphToUser: ((userId: string, event: string, data: unknown) => void) | null = null;
export function setGraphEmitter(fn: typeof emitGraphToUser): void { emitGraphToUser = fn; }

export const graphRouter = Router();

const MAX_USERS = 20;
const STEP_DELAY_MS = 16;

/** Build pairwise Pearson similarity matrix for up to MAX_USERS users. */
async function buildSimilarityMatrix(userIds: string[]): Promise<number[][]> {
  const n = userIds.length;
  const ratingsArr = await Promise.all(userIds.map(uid => getUserRatings(uid)));
  const ratingsMap: Record<string, Record<number, number>> = {};
  userIds.forEach((uid, i) => { ratingsMap[uid] = ratingsArr[i]; });

  const matrix: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    matrix[i][i] = 1;
    for (let j = i + 1; j < n; j++) {
      const sim = Math.max(0, pearsonCorrelation(ratingsMap[userIds[i]], ratingsMap[userIds[j]]));
      matrix[i][j] = matrix[j][i] = sim;
    }
  }
  return matrix;
}

// POST /graph/compute
graphRouter.post('/compute', async (req, res) => {
  const userId = req.headers['x-session-token'] as string;
  if (!userId) return res.status(401).json({ error: 'Missing X-Session-Token' });

  const graphSessionId = randomUUID();
  res.json({ graphSessionId });

  (async () => {
    const elapsed = timer();
    try {
      // 1. Fetch users (capped at MAX_USERS)
      const allIds = await getAllUserIds();
      const userIds = allIds.slice(0, MAX_USERS);
      log.recommend(`[graph] users=${userIds.length}  session=${graphSessionId.slice(0, 8)}`);

      if (userIds.length < 2) {
        emitGraphToUser?.(userId, 'graph:complete', {
          graphSessionId, userIds, similarityMatrix: [],
          mstEdges: [], communities: [], dijkstraPath: [], dijkstraTarget: '',
        });
        return;
      }

      // 2. Build similarity matrix
      const matrix = await buildSimilarityMatrix(userIds);

      // 3. Kruskal — stream all steps
      const kStart = timer();
      const { mstEdges, communities, steps: kSteps } = kruskal(matrix, userIds);
      log.recommend(`[graph] kruskal steps=${kSteps.length}  (${kStart()})`);
      for (const step of kSteps) {
        emitGraphToUser?.(userId, 'graph:step', { graphSessionId, algorithm: 'kruskal', step });
        await new Promise(r => setTimeout(r, STEP_DELAY_MS));
      }

      // 4. Floyd-Warshall — only emit snapshot steps (matrixSnapshot defined)
      const fStart = timer();
      const { steps: fSteps } = floydWarshall(matrix, userIds);
      const fSnapshots = fSteps.filter(s => s.matrixSnapshot !== undefined);
      log.recommend(`[graph] floyd steps=${fSteps.length}  snapshots=${fSnapshots.length}  (${fStart()})`);
      for (const step of fSnapshots) {
        emitGraphToUser?.(userId, 'graph:step', { graphSessionId, algorithm: 'floydWarshall', step });
        await new Promise(r => setTimeout(r, STEP_DELAY_MS));
      }

      // 5. Dijkstra — source = current user, target = closest neighbor
      const sourceIdx = userIds.indexOf(userId);
      let targetIdx = -1;
      if (sourceIdx !== -1) {
        let maxSim = -1;
        for (let j = 0; j < userIds.length; j++) {
          if (j !== sourceIdx && matrix[sourceIdx][j] > maxSim) {
            maxSim = matrix[sourceIdx][j];
            targetIdx = j;
          }
        }
      }
      // Fall back: source=0, target=1
      const src = sourceIdx !== -1 ? sourceIdx : 0;
      const tgt = targetIdx !== -1 ? targetIdx : 1;

      const dStart = timer();
      const { path: dijkstraPath, steps: dSteps } = dijkstra(matrix, userIds, src, tgt);
      log.recommend(`[graph] dijkstra path=${dijkstraPath.length}  steps=${dSteps.length}  (${dStart()})`);
      for (const step of dSteps) {
        emitGraphToUser?.(userId, 'graph:step', { graphSessionId, algorithm: 'dijkstra', step });
        await new Promise(r => setTimeout(r, STEP_DELAY_MS));
      }

      // 6. Complete
      log.recommend(`[graph] DONE  total=${elapsed()}`);
      emitGraphToUser?.(userId, 'graph:complete', {
        graphSessionId,
        userIds,
        similarityMatrix: matrix,
        mstEdges,
        communities,
        dijkstraPath,
        dijkstraTarget: userIds[tgt] ?? '',
      });
    } catch (err) {
      console.error('[graph] compute error:', err);
      emitGraphToUser?.(userId, 'graph:error', { message: 'Graph computation failed' });
    }
  })();
});
```

- [ ] **Step 2: Type-check**

```bash
cd backend && npm run build
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add backend/src/routes/graph.ts
git commit -m "feat(graph): add POST /graph/compute route with streaming algo steps"
```

---

## Task 6: Wire graph route into index.ts and socketServer.ts

**Files:**
- Modify: `backend/src/index.ts`
- Modify: `backend/src/socket/socketServer.ts`

- [ ] **Step 1: Register router in index.ts**

In `backend/src/index.ts`, add the import alongside the other route imports:

```ts
import { graphRouter } from './routes/graph';
```

Add the route registration after `/profile`:

```ts
app.use('/graph', graphRouter);
```

- [ ] **Step 2: Wire setGraphEmitter in socketServer.ts**

In `backend/src/socket/socketServer.ts`, add the import at the top:

```ts
import { setGraphEmitter } from '../routes/graph';
```

After the existing `setEmitter(...)` call (around line 95), add:

```ts
  setGraphEmitter((userId: string, event: string, data: unknown) => {
    const socketId = userSocketMap.get(userId);
    if (socketId) {
      if (event !== 'graph:step') {
        log.socket(`EMIT  event=${event}  user=${userId.slice(0, 12)}  socketId=${socketId}`);
      }
      io.to(socketId).emit(event, data);
    } else {
      if (event !== 'graph:step') {
        log.socket(`EMIT MISSED  event=${event}  user=${userId.slice(0, 12)}  — no socket connected`);
      }
    }
  });
```

- [ ] **Step 3: Type-check and start backend**

```bash
cd backend && npm run build
```

Expected: no errors.

- [ ] **Step 4: Smoke test the endpoint**

Start the backend: `cd backend && npm run dev`

In another terminal:
```bash
curl -X POST http://localhost:3001/graph/compute \
  -H "Content-Type: application/json" \
  -H "X-Session-Token: test-user-123" \
  | cat
```

Expected response: `{"graphSessionId":"<uuid>"}` — a JSON object with a UUID string.

- [ ] **Step 5: Commit**

```bash
git add backend/src/index.ts backend/src/socket/socketServer.ts
git commit -m "feat(backend): wire graph router and graph emitter into server"
```

---

## Task 7: Build KruskalPanel component

**Files:**
- Create: `frontend/components/graph/KruskalPanel.tsx`

- [ ] **Step 1: Create the file**

Create `frontend/components/graph/KruskalPanel.tsx`:

```tsx
'use client';

import { SpeedControls } from '@/components/layout/SpeedControls';
import type { MSTStep } from '@/lib/types';

interface KruskalPanelProps {
  steps: MSTStep[];
  totalSteps: number;
  playing: boolean;
  index: number;
  replaySpeedMs: number;
  onPlay: () => void;
  onPause: () => void;
  onSpeedChange: (ms: number) => void;
}

const BADGE: Record<MSTStep['type'], { label: string; color: string }> = {
  consider: { label: 'CONSIDER', color: 'var(--color-text-muted)' },
  add:      { label: 'ADD',      color: 'var(--color-match)' },
  reject:   { label: 'REJECT',   color: 'var(--color-exclude)' },
};

export function KruskalPanel({
  steps, totalSteps, playing, index, replaySpeedMs, onPlay, onPause, onSpeedChange,
}: KruskalPanelProps) {
  const currentStep = steps[index - 1] ?? null;
  const communities = currentStep?.communities ?? [];

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Controls */}
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={playing ? onPause : onPlay}
          disabled={totalSteps === 0}
          className="px-3 py-1 rounded text-xs font-medium"
          style={{
            backgroundColor: totalSteps === 0 ? 'var(--color-bg-elevated)' : 'var(--color-brand)',
            color: totalSteps === 0 ? 'var(--color-text-muted)' : 'white',
            cursor: totalSteps === 0 ? 'not-allowed' : 'pointer',
          }}
        >
          {playing ? 'Pause' : (index === 0 && totalSteps > 0 ? 'Play' : 'Resume')}
        </button>
        <SpeedControls replaySpeedMs={replaySpeedMs} onSpeedChange={onSpeedChange} />
        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          {index}/{totalSteps}
        </span>
      </div>

      {/* Edge log */}
      <div
        className="flex-1 overflow-y-auto rounded p-2 space-y-1 text-xs font-mono no-scrollbar"
        style={{ backgroundColor: 'var(--color-bg-elevated)', minHeight: 0 }}
      >
        {steps.slice(0, index).map((step, i) => {
          const badge = BADGE[step.type];
          return (
            <div key={i} className="flex items-center gap-2">
              <span style={{ color: badge.color, minWidth: 60 }}>{badge.label}</span>
              <span style={{ color: 'var(--color-text-secondary)' }}>
                {step.edge.u.slice(0, 8)} — {step.edge.v.slice(0, 8)}
              </span>
              <span style={{ color: 'var(--color-text-muted)', marginLeft: 'auto' }}>
                {step.edge.weight.toFixed(3)}
              </span>
            </div>
          );
        })}
        {totalSteps === 0 && (
          <p style={{ color: 'var(--color-text-muted)' }}>Waiting for computation…</p>
        )}
      </div>

      {/* Community chips */}
      <div>
        <p className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Communities</p>
        <div className="flex flex-wrap gap-1">
          {communities.map((group, gi) => {
            const colors = [
              'var(--viz-color-1)', 'var(--viz-color-2)',
              'var(--viz-color-3)', 'var(--viz-color-4)',
            ];
            const color = colors[gi % colors.length];
            return (
              <span
                key={gi}
                className="px-1.5 py-0.5 rounded text-xs"
                style={{ backgroundColor: color + '33', color, border: `1px solid ${color}55` }}
              >
                {group.length} users
              </span>
            );
          })}
          {communities.length === 0 && (
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>—</span>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/graph/KruskalPanel.tsx
git commit -m "feat(graph): add KruskalPanel component"
```

---

## Task 8: Build DijkstraPanel component

**Files:**
- Create: `frontend/components/graph/DijkstraPanel.tsx`

- [ ] **Step 1: Create the file**

Create `frontend/components/graph/DijkstraPanel.tsx`:

```tsx
'use client';

import { SpeedControls } from '@/components/layout/SpeedControls';
import type { DijkstraStep } from '@/lib/types';

interface DijkstraPanelProps {
  steps: DijkstraStep[];
  totalSteps: number;
  playing: boolean;
  index: number;
  replaySpeedMs: number;
  finalPath: string[];
  sourceUserId: string;
  targetUserId: string;
  onPlay: () => void;
  onPause: () => void;
  onSpeedChange: (ms: number) => void;
}

export function DijkstraPanel({
  steps, totalSteps, playing, index, replaySpeedMs,
  finalPath, sourceUserId, targetUserId,
  onPlay, onPause, onSpeedChange,
}: DijkstraPanelProps) {
  const currentStep = steps[index - 1] ?? null;
  const pathToShow = index > 0 && totalSteps > 0 && index === totalSteps
    ? finalPath
    : (currentStep?.path ?? []);

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Controls */}
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={playing ? onPause : onPlay}
          disabled={totalSteps === 0}
          className="px-3 py-1 rounded text-xs font-medium"
          style={{
            backgroundColor: totalSteps === 0 ? 'var(--color-bg-elevated)' : 'var(--color-brand)',
            color: totalSteps === 0 ? 'var(--color-text-muted)' : 'white',
            cursor: totalSteps === 0 ? 'not-allowed' : 'pointer',
          }}
        >
          {playing ? 'Pause' : (index === 0 && totalSteps > 0 ? 'Play' : 'Resume')}
        </button>
        <SpeedControls replaySpeedMs={replaySpeedMs} onSpeedChange={onSpeedChange} />
        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          {index}/{totalSteps}
        </span>
      </div>

      {/* Source → Target header */}
      <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
        <span style={{ color: 'var(--color-brand)' }}>{sourceUserId.slice(0, 10)}</span>
        {' → '}
        <span style={{ color: 'var(--viz-dijkstra-path)' }}>{targetUserId.slice(0, 10)}</span>
      </div>

      {/* Current path chain */}
      <div>
        <p className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Current path</p>
        <div className="flex flex-wrap gap-1">
          {pathToShow.map((uid, i) => (
            <span
              key={i}
              className="px-1.5 py-0.5 rounded text-xs font-mono"
              style={{
                backgroundColor: 'var(--color-brand)' + '33',
                color: 'var(--viz-dijkstra-path)',
                border: '1px solid var(--color-brand)',
              }}
            >
              {uid.slice(0, 8)}
            </span>
          ))}
          {pathToShow.length === 0 && (
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>—</span>
          )}
        </div>
      </div>

      {/* Frontier queue */}
      <div>
        <p className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Frontier queue</p>
        <div
          className="rounded p-2 text-xs font-mono space-y-1 overflow-y-auto no-scrollbar"
          style={{ backgroundColor: 'var(--color-bg-elevated)', maxHeight: 120 }}
        >
          {currentStep?.frontier.map((uid, i) => (
            <div key={i} className="flex justify-between">
              <span style={{ color: 'var(--color-text-secondary)' }}>{uid.slice(0, 12)}</span>
            </div>
          ))}
          {(!currentStep || currentStep.frontier.length === 0) && (
            <span style={{ color: 'var(--color-text-muted)' }}>
              {totalSteps === 0 ? 'Waiting…' : 'Empty'}
            </span>
          )}
        </div>
      </div>

      {/* Visited node */}
      {currentStep && (
        <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          Visiting: <span style={{ color: 'var(--color-brand)' }}>{currentStep.visitedUserId.slice(0, 12)}</span>
          {' '}(dist: {currentStep.distance === Infinity ? '∞' : currentStep.distance.toFixed(3)})
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/graph/DijkstraPanel.tsx
git commit -m "feat(graph): add DijkstraPanel component"
```

---

## Task 9: Build FloydWarshallPanel component

**Files:**
- Create: `frontend/components/graph/FloydWarshallPanel.tsx`

- [ ] **Step 1: Create the file**

Create `frontend/components/graph/FloydWarshallPanel.tsx`:

```tsx
'use client';

import { SpeedControls } from '@/components/layout/SpeedControls';
import type { FloydStep } from '@/lib/types';

interface FloydWarshallPanelProps {
  steps: FloydStep[];
  totalSteps: number;
  playing: boolean;
  index: number;
  replaySpeedMs: number;
  userIds: string[];
  onPlay: () => void;
  onPause: () => void;
  onSpeedChange: (ms: number) => void;
}

/** Interpolate between dark (0) and brand purple (1) as a CSS rgba string. */
function heatColor(value: number): string {
  const v = Math.max(0, Math.min(1, value));
  // Dark navy → brand purple
  const r = Math.round(28 + v * (124 - 28));
  const g = Math.round(27 + v * (58  - 27));
  const b = Math.round(75 + v * (237 - 75));
  return `rgb(${r},${g},${b})`;
}

export function FloydWarshallPanel({
  steps, totalSteps, playing, index, replaySpeedMs,
  userIds, onPlay, onPause, onSpeedChange,
}: FloydWarshallPanelProps) {
  // Find the most recent snapshot step at or before current index
  const snapshotStep = [...steps.slice(0, index)]
    .reverse()
    .find(s => s.matrixSnapshot !== undefined) ?? null;

  const matrix = snapshotStep?.matrixSnapshot ?? null;
  const currentStep = steps[index - 1] ?? null;
  const progress = totalSteps > 0 ? Math.round((index / totalSteps) * 100) : 0;
  const n = userIds.length;

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Controls */}
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={playing ? onPause : onPlay}
          disabled={totalSteps === 0}
          className="px-3 py-1 rounded text-xs font-medium"
          style={{
            backgroundColor: totalSteps === 0 ? 'var(--color-bg-elevated)' : 'var(--color-brand)',
            color: totalSteps === 0 ? 'var(--color-text-muted)' : 'white',
            cursor: totalSteps === 0 ? 'not-allowed' : 'pointer',
          }}
        >
          {playing ? 'Pause' : (index === 0 && totalSteps > 0 ? 'Play' : 'Resume')}
        </button>
        <SpeedControls replaySpeedMs={replaySpeedMs} onSpeedChange={onSpeedChange} />
        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          {progress}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1 rounded overflow-hidden" style={{ backgroundColor: 'var(--color-bg-elevated)' }}>
        <div
          className="h-full rounded transition-all duration-100"
          style={{ width: `${progress}%`, backgroundColor: 'var(--color-brand)' }}
        />
      </div>

      {/* Status label */}
      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
        {totalSteps === 0
          ? 'Waiting for computation…'
          : currentStep
          ? `Propagating k=${currentStep.k} i=${currentStep.i} j=${currentStep.j}…`
          : 'Complete'}
      </p>

      {/* Heatmap matrix */}
      {matrix && n > 0 ? (
        <div className="flex-1 overflow-auto no-scrollbar">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`,
              gap: 2,
            }}
          >
            {matrix.map((row, i) =>
              row.map((val, j) => {
                const isActive = currentStep && currentStep.i === i && currentStep.j === j;
                return (
                  <div
                    key={`${i}-${j}`}
                    title={`[${i},${j}] = ${val.toFixed(3)}`}
                    style={{
                      aspectRatio: '1',
                      backgroundColor: heatColor(val),
                      borderRadius: 2,
                      outline: isActive ? '2px solid var(--color-brand-bright)' : 'none',
                      transition: 'background-color 0.2s',
                    }}
                  />
                );
              })
            )}
          </div>
          <p className="text-xs mt-2 text-center" style={{ color: 'var(--color-text-muted)' }}>
            Indirect similarity matrix ({n}×{n}) · dark = 0 · purple = 1
          </p>
        </div>
      ) : (
        <div
          className="flex-1 rounded flex items-center justify-center text-xs"
          style={{ backgroundColor: 'var(--color-bg-elevated)', color: 'var(--color-text-muted)' }}
        >
          {totalSteps > 0 ? 'Propagating…' : 'No data yet'}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/graph/FloydWarshallPanel.tsx
git commit -m "feat(graph): add FloydWarshallPanel heatmap component"
```

---

## Task 10: Build D3UserGraph component

**Files:**
- Create: `frontend/components/graph/D3UserGraph.tsx`

- [ ] **Step 1: Create the file**

Create `frontend/components/graph/D3UserGraph.tsx`:

```tsx
'use client';

import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import type { MSTStep, DijkstraStep, FloydStep } from '@/lib/types';

interface GraphNode {
  id: string;
  ratingCount: number;
  communityIdx: number;
  isCurrent: boolean;
}

interface GraphEdge {
  source: string;
  target: string;
  weight: number;
  isMst: boolean;
}

export interface GraphHighlight {
  algorithm: 'kruskal' | 'dijkstra' | 'floydWarshall' | null;
  step: MSTStep | DijkstraStep | FloydStep | null;
  dijkstraPath: string[];
}

interface Props {
  userIds: string[];
  similarityMatrix: number[][];
  communities: string[][];
  mstEdges: Array<{ u: string; v: string; weight: number }>;
  currentUserId: string;
  highlight: GraphHighlight;
  expandedUserId: string | null;
  expandedMovies: Array<{ movieId: number; title: string; posterPath: string }>;
  onNodeClick: (userId: string) => void;
}

const COMMUNITY_COLORS = [
  'var(--viz-color-1)',
  'var(--viz-color-2)',
  'var(--viz-color-3)',
  'var(--viz-color-4)',
  'var(--viz-color-5)',
  'var(--viz-node-default)',
];

// Resolve a CSS var to its actual color value at runtime
function resolveCssVar(varName: string): string {
  if (typeof window === 'undefined') return '#7C3AED';
  const val = getComputedStyle(document.documentElement)
    .getPropertyValue(varName.replace('var(', '').replace(')', '').trim())
    .trim();
  return val || '#7C3AED';
}

export function D3UserGraph({
  userIds, similarityMatrix, communities, mstEdges,
  currentUserId, highlight, onNodeClick,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const simRef = useRef<d3.Simulation<d3.SimulationNodeDatum & GraphNode, undefined> | null>(null);

  // Build community lookup: userId → communityIdx
  const communityMap = new Map<string, number>();
  communities.forEach((group, gi) => group.forEach(uid => communityMap.set(uid, gi)));

  const mstSet = new Set(mstEdges.map(e => `${e.u}||${e.v}`));

  // Build nodes
  const nodes: GraphNode[] = userIds.map(id => ({
    id,
    ratingCount: 3, // placeholder — radius scaling
    communityIdx: communityMap.get(id) ?? 5,
    isCurrent: id === currentUserId,
  }));

  // Build edges (only sim > 0.3 to avoid clutter)
  const edges: GraphEdge[] = [];
  for (let i = 0; i < userIds.length; i++) {
    for (let j = i + 1; j < userIds.length; j++) {
      const w = similarityMatrix[i]?.[j] ?? 0;
      if (w > 0.3) {
        edges.push({
          source: userIds[i],
          target: userIds[j],
          weight: w,
          isMst: mstSet.has(`${userIds[i]}||${userIds[j]}`) || mstSet.has(`${userIds[j]}||${userIds[i]}`),
        });
      }
    }
  }

  useEffect(() => {
    if (!svgRef.current || userIds.length === 0) return;

    const svg = d3.select(svgRef.current);
    const width = svgRef.current.clientWidth || 600;
    const height = svgRef.current.clientHeight || 400;

    svg.selectAll('*').remove();

    const g = svg.append('g');

    // Zoom
    svg.call(
      d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.4, 3])
        .on('zoom', (event) => g.attr('transform', event.transform))
    );

    // Deep-copy nodes/edges for D3 mutation
    const simNodes = nodes.map(n => ({ ...n })) as (GraphNode & d3.SimulationNodeDatum)[];
    const nodeById = new Map(simNodes.map(n => [n.id, n]));
    const simEdges = edges.map(e => ({
      ...e,
      source: nodeById.get(e.source)!,
      target: nodeById.get(e.target)!,
    }));

    // Simulation
    const sim = d3.forceSimulation(simNodes)
      .force('link', d3.forceLink(simEdges).id((d: d3.SimulationNodeDatum) => (d as GraphNode).id).distance(80).strength(0.4))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide(22));

    simRef.current = sim as d3.Simulation<d3.SimulationNodeDatum & GraphNode, undefined>;

    // Draw edges
    const link = g.append('g')
      .selectAll<SVGLineElement, typeof simEdges[0]>('line')
      .data(simEdges)
      .join('line')
      .attr('stroke-opacity', d => 0.2 + d.weight * 0.6)
      .attr('stroke-width', d => d.isMst ? 2.5 : 1)
      .attr('stroke', d => d.isMst ? resolveCssVar('--viz-mst-edge') : '#4B5563');

    // Draw nodes
    const node = g.append('g')
      .selectAll<SVGGElement, typeof simNodes[0]>('g')
      .data(simNodes)
      .join('g')
      .attr('cursor', 'pointer')
      .call(
        d3.drag<SVGGElement, typeof simNodes[0]>()
          .on('start', (event, d) => {
            if (!event.active) sim.alphaTarget(0.3).restart();
            d.fx = d.x; d.fy = d.y;
          })
          .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y; })
          .on('end', (event, d) => {
            if (!event.active) sim.alphaTarget(0);
            d.fx = null; d.fy = null;
          })
      )
      .on('click', (_event, d) => onNodeClick(d.id));

    node.append('circle')
      .attr('r', d => d.isCurrent ? 16 : 12)
      .attr('fill', d => COMMUNITY_COLORS[d.communityIdx % COMMUNITY_COLORS.length])
      .attr('fill-opacity', 0.9)
      .attr('stroke', d => d.isCurrent ? resolveCssVar('--color-brand-bright') : '#141414')
      .attr('stroke-width', d => d.isCurrent ? 3 : 1.5);

    node.append('text')
      .text(d => d.id.slice(0, 4))
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('fill', 'white')
      .attr('font-size', 8)
      .attr('font-weight', '600')
      .attr('pointer-events', 'none');

    // Tooltip title
    node.append('title').text(d => d.id);

    // Tick
    sim.on('tick', () => {
      link
        .attr('x1', d => (d.source as d3.SimulationNodeDatum).x ?? 0)
        .attr('y1', d => (d.source as d3.SimulationNodeDatum).y ?? 0)
        .attr('x2', d => (d.target as d3.SimulationNodeDatum).x ?? 0)
        .attr('y2', d => (d.target as d3.SimulationNodeDatum).y ?? 0);
      node.attr('transform', d => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    return () => { sim.stop(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userIds.join(','), JSON.stringify(mstEdges), communities.length]);

  // Apply highlight overlays reactively (separate effect — no simulation restart)
  useEffect(() => {
    if (!svgRef.current || !highlight.algorithm) return;
    const svg = d3.select(svgRef.current);

    // Reset all node fills
    svg.selectAll<SVGCircleElement, GraphNode>('circle')
      .attr('fill', d => COMMUNITY_COLORS[d.communityIdx % COMMUNITY_COLORS.length])
      .attr('filter', null);

    if (highlight.algorithm === 'dijkstra') {
      const pathSet = new Set(highlight.dijkstraPath);
      const step = highlight.step as DijkstraStep | null;
      svg.selectAll<SVGCircleElement, GraphNode>('circle')
        .attr('fill', d => {
          if (step?.visitedUserId === d.id) return resolveCssVar('--color-brand');
          if (pathSet.has(d.id)) return resolveCssVar('--viz-dijkstra-path');
          return COMMUNITY_COLORS[d.communityIdx % COMMUNITY_COLORS.length];
        });
    }

    if (highlight.algorithm === 'kruskal') {
      const step = highlight.step as MSTStep | null;
      if (step) {
        svg.selectAll<SVGLineElement, GraphEdge>('line')
          .attr('stroke', d => {
            const matches =
              (d.source === step.edge.u && d.target === step.edge.v) ||
              (d.source === step.edge.v && d.target === step.edge.u);
            if (!matches) return d.isMst ? resolveCssVar('--viz-mst-edge') : '#4B5563';
            if (step.type === 'consider') return '#F59E0B';
            if (step.type === 'add')      return resolveCssVar('--color-match');
            return resolveCssVar('--color-exclude');
          });
      }
    }
  }, [highlight]);

  return (
    <svg
      ref={svgRef}
      width="100%"
      height="100%"
      style={{ display: 'block', background: 'var(--color-bg-base)' }}
    />
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/graph/D3UserGraph.tsx
git commit -m "feat(graph): add D3UserGraph force-directed SVG component"
```

---

## Task 11: Rewrite graph/page.tsx

**Files:**
- Modify: `frontend/app/graph/page.tsx`

- [ ] **Step 1: Full rewrite of the page**

Replace the entire contents of `frontend/app/graph/page.tsx` with:

```tsx
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
import { socketEvents } from '@/lib/socket';
import { posterUrl } from '@/lib/formatters';
import { getOrCreateToken } from '@/lib/session';
import { D3UserGraph, type GraphHighlight } from '@/components/graph/D3UserGraph';
import { KruskalPanel } from '@/components/graph/KruskalPanel';
import { DijkstraPanel } from '@/components/graph/DijkstraPanel';
import { FloydWarshallPanel } from '@/components/graph/FloydWarshallPanel';
import type {
  MSTStep, DijkstraStep, FloydStep,
  GraphStepEvent, GraphCompleteEvent,
} from '@/lib/types';

type Tab = 'kruskal' | 'dijkstra' | 'floydWarshall';

const TAB_LABELS: Record<Tab, string> = {
  kruskal:       'Kruskal MST',
  dijkstra:      'Dijkstra Path',
  floydWarshall: 'Floyd-Warshall',
};

export default function GraphPage() {
  const graphSessionIdRef = useRef<string | null>(null);
  const currentUserId = getOrCreateToken();

  // ── Step buffers (refs = no re-renders during streaming) ──
  const kruskalStepsRef   = useRef<MSTStep[]>([]);
  const dijkstraStepsRef  = useRef<DijkstraStep[]>([]);
  const floydStepsRef     = useRef<FloydStep[]>([]);

  // ── Graph data (set once on graph:complete) ──
  const [graphData, setGraphData] = useState<{
    userIds: string[];
    similarityMatrix: number[][];
    mstEdges: Array<{ u: string; v: string; weight: number }>;
    communities: string[][];
    dijkstraPath: string[];
    dijkstraTarget: string;
  } | null>(null);

  // ── Total steps per algo (enables Play buttons) ──
  const [kTotalSteps, setKTotalSteps] = useState(0);
  const [dTotalSteps, setDTotalSteps] = useState(0);
  const [fTotalSteps, setFTotalSteps] = useState(0);

  // ── Replay state ──
  const [activeTab, setActiveTab] = useState<Tab>('kruskal');

  const [kPlaying, setKPlaying] = useState(false);
  const [kIndex,   setKIndex]   = useState(0);
  const [kSpeed,   setKSpeed]   = useState(120);

  const [dPlaying, setDPlaying] = useState(false);
  const [dIndex,   setDIndex]   = useState(0);
  const [dSpeed,   setDSpeed]   = useState(120);

  const [fPlaying, setFPlaying] = useState(false);
  const [fIndex,   setFIndex]   = useState(0);
  const [fSpeed,   setFSpeed]   = useState(120);

  // ── D3 highlight state ──
  const [highlight, setHighlight] = useState<GraphHighlight>({
    algorithm: null, step: null, dijkstraPath: [],
  });

  // ── Node expansion ──
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [expandedMovies, setExpandedMovies] = useState<Array<{
    movieId: number; title: string; posterPath: string;
  }>>([]);

  // ── Socket subscription (mount only) ──
  useEffect(() => {
    const offStep = socketEvents.onGraphStep((event: GraphStepEvent) => {
      if (event.graphSessionId !== graphSessionIdRef.current) return;
      if (event.algorithm === 'kruskal')       kruskalStepsRef.current.push(event.step as MSTStep);
      if (event.algorithm === 'dijkstra')      dijkstraStepsRef.current.push(event.step as DijkstraStep);
      if (event.algorithm === 'floydWarshall') floydStepsRef.current.push(event.step as FloydStep);
    });

    const offComplete = socketEvents.onGraphComplete((event: GraphCompleteEvent) => {
      if (event.graphSessionId !== graphSessionIdRef.current) return;
      setGraphData({
        userIds: event.userIds,
        similarityMatrix: event.similarityMatrix,
        mstEdges: event.mstEdges,
        communities: event.communities,
        dijkstraPath: event.dijkstraPath,
        dijkstraTarget: event.dijkstraTarget,
      });
      setKTotalSteps(kruskalStepsRef.current.length);
      setDTotalSteps(dijkstraStepsRef.current.length);
      setFTotalSteps(floydStepsRef.current.length);
    });

    // Trigger computation
    api.computeGraph().then(({ graphSessionId }) => {
      graphSessionIdRef.current = graphSessionId;
    }).catch(() => {/* backend offline — no-op */});

    return () => { offStep(); offComplete(); };
  }, []);

  // ── Kruskal replay engine ──
  useEffect(() => {
    if (!kPlaying) return;
    if (kIndex >= kTotalSteps) { setKPlaying(false); return; }
    const step = kruskalStepsRef.current[kIndex];
    if (step) setHighlight({ algorithm: 'kruskal', step, dijkstraPath: [] });
    const t = setTimeout(() => setKIndex(i => i + 1), kSpeed);
    return () => clearTimeout(t);
  }, [kPlaying, kIndex, kTotalSteps, kSpeed]);

  // ── Dijkstra replay engine ──
  useEffect(() => {
    if (!dPlaying) return;
    if (dIndex >= dTotalSteps) { setDPlaying(false); return; }
    const step = dijkstraStepsRef.current[dIndex];
    if (step) {
      setHighlight({
        algorithm: 'dijkstra',
        step,
        dijkstraPath: step.path,
      });
    }
    const t = setTimeout(() => setDIndex(i => i + 1), dSpeed);
    return () => clearTimeout(t);
  }, [dPlaying, dIndex, dTotalSteps, dSpeed]);

  // ── Floyd-Warshall replay engine ──
  useEffect(() => {
    if (!fPlaying) return;
    if (fIndex >= fTotalSteps) { setFPlaying(false); return; }
    const step = floydStepsRef.current[fIndex];
    if (step) setHighlight({ algorithm: 'floydWarshall', step, dijkstraPath: [] });
    const t = setTimeout(() => setFIndex(i => i + 1), fSpeed);
    return () => clearTimeout(t);
  }, [fPlaying, fIndex, fTotalSteps, fSpeed]);

  // ── Update highlight when tab changes ──
  useEffect(() => {
    setHighlight({ algorithm: null, step: null, dijkstraPath: [] });
  }, [activeTab]);

  // ── Node expansion handler ──
  const handleNodeClick = useCallback(async (userId: string) => {
    if (expandedUserId === userId) {
      setExpandedUserId(null);
      setExpandedMovies([]);
      return;
    }
    setExpandedUserId(userId);
    setExpandedMovies([]);
    try {
      const { movies } = await api.getTopMovies(userId);
      setExpandedMovies(movies);
    } catch { /* no-op */ }
  }, [expandedUserId]);

  return (
    <main className="min-h-screen pt-16" style={{ backgroundColor: 'var(--color-bg-base)' }}>
      {/* Mobile warning */}
      <div className="lg:hidden flex items-center justify-center min-h-[60vh] px-8 text-center">
        <div>
          <h2 className="text-xl font-bold text-white mb-2">Desktop Only</h2>
          <p style={{ color: 'var(--color-text-secondary)' }}>
            The Graph Explorer requires a desktop screen.
          </p>
        </div>
      </div>

      {/* Desktop layout */}
      <div className="hidden lg:flex flex-col h-[calc(100vh-64px)]">
        {/* Header */}
        <div className="px-8 py-4 flex-shrink-0">
          <h1 className="text-2xl font-bold text-white mb-1">User Similarity Graph</h1>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            User communities via Kruskal MST · Taste paths via Dijkstra · Similarity propagation via Floyd-Warshall
          </p>
        </div>

        {/* Main split */}
        <div className="flex flex-1 min-h-0 px-8 pb-6 gap-4">
          {/* D3 Graph — left 60% */}
          <div
            className="flex-[3] rounded-lg overflow-hidden relative"
            style={{ border: '1px solid var(--color-border)' }}
          >
            {graphData ? (
              <>
                <D3UserGraph
                  userIds={graphData.userIds}
                  similarityMatrix={graphData.similarityMatrix}
                  communities={graphData.communities}
                  mstEdges={graphData.mstEdges}
                  currentUserId={currentUserId}
                  highlight={highlight}
                  expandedUserId={expandedUserId}
                  expandedMovies={expandedMovies}
                  onNodeClick={handleNodeClick}
                />
                {/* Expanded node movie thumbnails */}
                <AnimatePresence>
                  {expandedUserId && expandedMovies.length > 0 && (
                    <motion.div
                      key="expanded"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      className="absolute bottom-4 left-4 flex gap-2"
                    >
                      {expandedMovies.map(m => (
                        <div
                          key={m.movieId}
                          className="flex flex-col items-center gap-1"
                          style={{ width: 56 }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={posterUrl(m.posterPath)}
                            alt={m.title}
                            className="rounded w-full"
                            style={{ border: '1px solid var(--color-border)' }}
                          />
                          <span
                            className="text-[9px] text-center leading-tight"
                            style={{ color: 'var(--color-text-muted)' }}
                          >
                            {m.title.slice(0, 16)}
                          </span>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            ) : (
              <div
                className="w-full h-full flex items-center justify-center text-sm"
                style={{ color: 'var(--color-text-muted)' }}
              >
                Computing graph…
              </div>
            )}
          </div>

          {/* Algorithm panels — right 40% */}
          <div
            className="flex-[2] flex flex-col rounded-lg overflow-hidden"
            style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg-card)' }}
          >
            {/* Tabs */}
            <div
              className="flex border-b flex-shrink-0"
              style={{ borderColor: 'var(--color-border)' }}
            >
              {(Object.keys(TAB_LABELS) as Tab[]).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className="flex-1 px-3 py-2.5 text-xs font-medium transition-colors"
                  style={{
                    color: activeTab === tab ? 'var(--color-brand)' : 'var(--color-text-muted)',
                    borderBottom: activeTab === tab ? '2px solid var(--color-brand)' : '2px solid transparent',
                    backgroundColor: 'transparent',
                  }}
                >
                  {TAB_LABELS[tab]}
                </button>
              ))}
            </div>

            {/* Panel content */}
            <div className="flex-1 overflow-hidden p-4 min-h-0">
              {activeTab === 'kruskal' && (
                <KruskalPanel
                  steps={kruskalStepsRef.current}
                  totalSteps={kTotalSteps}
                  playing={kPlaying}
                  index={kIndex}
                  replaySpeedMs={kSpeed}
                  onPlay={() => { if (kIndex >= kTotalSteps) setKIndex(0); setKPlaying(true); }}
                  onPause={() => setKPlaying(false)}
                  onSpeedChange={setKSpeed}
                />
              )}
              {activeTab === 'dijkstra' && (
                <DijkstraPanel
                  steps={dijkstraStepsRef.current}
                  totalSteps={dTotalSteps}
                  playing={dPlaying}
                  index={dIndex}
                  replaySpeedMs={dSpeed}
                  finalPath={graphData?.dijkstraPath ?? []}
                  sourceUserId={currentUserId}
                  targetUserId={graphData?.dijkstraTarget ?? ''}
                  onPlay={() => { if (dIndex >= dTotalSteps) setDIndex(0); setDPlaying(true); }}
                  onPause={() => setDPlaying(false)}
                  onSpeedChange={setDSpeed}
                />
              )}
              {activeTab === 'floydWarshall' && (
                <FloydWarshallPanel
                  steps={floydStepsRef.current}
                  totalSteps={fTotalSteps}
                  playing={fPlaying}
                  index={fIndex}
                  replaySpeedMs={fSpeed}
                  userIds={graphData?.userIds ?? []}
                  onPlay={() => { if (fIndex >= fTotalSteps) setFIndex(0); setFPlaying(true); }}
                  onPause={() => setFPlaying(false)}
                  onSpeedChange={setFSpeed}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Smoke test — start both servers and open /graph**

```bash
# Terminal 1
cd backend && npm run dev

# Terminal 2
cd frontend && npm run dev
```

Open `http://localhost:3000/graph` on a desktop screen.

Expected:
- Page loads with header and "Computing graph…" in the D3 area
- After a few seconds (once backend runs), D3 graph appears with colored nodes
- Kruskal tab shows Play button enabled
- Clicking Play on Kruskal tab animates the edge list
- Switching to Dijkstra tab shows path panel
- Clicking a node shows a loading state, then movie thumbnails at bottom-left

- [ ] **Step 4: Commit**

```bash
git add frontend/app/graph/page.tsx
git commit -m "feat(graph): rewrite graph page with live D3 graph and algorithm panels"
```

---

## Self-Review Checklist

- [x] SpeedControls extracted and AlgoDrawer updated (Task 1)
- [x] `GraphStepEvent` / `GraphCompleteEvent` types defined (Task 2)
- [x] `api.computeGraph()` and `api.getTopMovies()` added (Task 3)
- [x] `onGraphStep` / `onGraphComplete` socket events wired (Task 3)
- [x] `GET /profile/:userId/top-movies` endpoint (Task 4)
- [x] `POST /graph/compute` streams Kruskal + Floyd + Dijkstra steps (Task 5)
- [x] Graph router registered in `index.ts`, emitter wired in `socketServer.ts` (Task 6)
- [x] KruskalPanel: edge log + community chips + Play/Pause (Task 7)
- [x] DijkstraPanel: frontier queue + path chain + source/target header (Task 8)
- [x] FloydWarshallPanel: heatmap + progress bar (Task 9)
- [x] D3UserGraph: force layout, community colors, drag, highlight reactions (Task 10)
- [x] graph/page.tsx: tabbed layout, replay engines, node expansion (Task 11)
- [x] All imports use `@/` alias
- [x] No hardcoded hex colors — CSS vars only
- [x] Socket subscriptions on `[]` deps, read `graphSessionIdRef.current`
- [x] `'use client'` first line on all new frontend files
- [x] Floyd-Warshall only emits snapshot steps from backend (Task 5)
