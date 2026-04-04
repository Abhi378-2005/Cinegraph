# Algorithm Visualization & UI Improvements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade AlgoDrawer into an animated algorithm replay viewer with sessionId-gated step buffering, add a budget toggle (off by default), improve recommendation card UI, and add engine badge + "How were these picked?" link on the discover page.

**Architecture:** Backend threads `sessionId` into every socket emit so the frontend can correlate events to a specific recommendation job. AlgoDrawer buffers steps by sessionId, replays them on drawer open (auto-play once, then manual replay), switching tabs automatically between MergeSort and Knapsack phases. Open state is lifted to the discover page so it can be triggered from a UI link.

**Tech Stack:** TypeScript, Next.js 16 App Router, React 19, Framer Motion, socket.io-client, Tailwind v4, CSS custom properties.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `backend/src/routes/recommend.ts` | Modify | Add `sessionId` to all `emitToUser` calls |
| `frontend/lib/types.ts` | Modify | Add `sessionId` field to `AlgoStepEvent`, `AlgoCompleteEvent`, `RecommendReadyEvent` |
| `frontend/components/recommendation/WatchBudget.tsx` | Modify | Add enable/disable toggle; emit `undefined` when off |
| `frontend/components/movies/MovieCard.tsx` | Modify | Match badge always visible, moved to top-left, green on dark bg |
| `frontend/components/movies/MovieRow.tsx` | Modify | Add optional `titleExtras?: React.ReactNode` prop rendered beside title |
| `frontend/app/discover/page.tsx` | Modify | Lift `drawerOpen`, store `sessionId`/`activeEngine`/`matchPercents`, engine badge, "How were these picked?" link |
| `frontend/components/layout/AlgoDrawer.tsx` | Modify | Full rewrite: sessionId gating, replay engine, MergeSort viz, Knapsack viz |

---

## Task 1: Thread sessionId into backend emits

**Files:**
- Modify: `backend/src/routes/recommend.ts`

Context: `sessionId` is already created as `const sessionId = randomUUID()` at the top of the async job. It just isn't included in the socket emits. There are 5 emits to update (2× mergeSort, 2× knapsack, 1× recommend:ready). The `recommend:error` emit does not need sessionId.

- [ ] **Step 1: Update the five emitToUser calls**

Open `backend/src/routes/recommend.ts`. Replace the five emit calls inside the async IIFE:

```typescript
// mergeSort algo:step — line ~54
emitToUser?.(userId, 'algo:step', { sessionId, algorithm: 'mergeSort', step });

// mergeSort algo:complete — line ~57
emitToUser?.(userId, 'algo:complete', { sessionId, algorithm: 'mergeSort', durationMs: 0, totalSteps: sortSteps.length });

// knapsack algo:step — line ~67
emitToUser?.(userId, 'algo:step', { sessionId, algorithm: 'knapsack', step });

// knapsack algo:complete — line ~70
emitToUser?.(userId, 'algo:complete', { sessionId, algorithm: 'knapsack', durationMs: 0, totalSteps: kSteps.length });

// recommend:ready — line ~75
emitToUser?.(userId, 'recommend:ready', { sessionId, recommendations: finalRecs, engine });
```

- [ ] **Step 2: Verify backend TypeScript compiles**

```bash
cd backend && npm run build
```

Expected: exit 0, no errors.

- [ ] **Step 3: Commit**

```bash
git add backend/src/routes/recommend.ts
git commit -m "feat(backend): thread sessionId into all algo and recommend socket emits"
```

---

## Task 2: Add sessionId to frontend event types

**Files:**
- Modify: `frontend/lib/types.ts`

Context: `AlgoStepEvent`, `AlgoCompleteEvent`, and `RecommendReadyEvent` are the three interfaces that receive data from the backend socket emits updated in Task 1. They're at the bottom of `types.ts`.

- [ ] **Step 1: Update the three event interfaces**

In `frontend/lib/types.ts`, replace:

```typescript
export interface AlgoStepEvent { algorithm: string; step: AlgoStep; }
export interface AlgoCompleteEvent { algorithm: string; durationMs: number; totalSteps: number; }
export interface RecommendReadyEvent { recommendations: Recommendation[]; engine: string; }
```

With:

```typescript
export interface AlgoStepEvent { sessionId: string; algorithm: string; step: AlgoStep; }
export interface AlgoCompleteEvent { sessionId: string; algorithm: string; durationMs: number; totalSteps: number; }
export interface RecommendReadyEvent { sessionId: string; recommendations: Recommendation[]; engine: string; }
```

- [ ] **Step 2: Verify frontend TypeScript compiles**

```bash
cd frontend && npm run build 2>&1 | head -30
```

Expected: build succeeds or only pre-existing errors (none expected). The existing `AlgoDrawer.tsx` uses `AlgoStepEvent` and `AlgoCompleteEvent` — those handlers don't use `sessionId` yet so no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/lib/types.ts
git commit -m "feat(types): add sessionId to AlgoStepEvent, AlgoCompleteEvent, RecommendReadyEvent"
```

---

## Task 3: WatchBudget toggle

**Files:**
- Modify: `frontend/components/recommendation/WatchBudget.tsx`

Context: Current component takes `value: number` (always a number). New: `value: number | undefined` where `undefined` means "off". Toggle pill switches it on/off. When on, slider defaults to 240 minutes. The discover page state `budget` changes from `useState(120)` to `useState<number | undefined>(undefined)`.

- [ ] **Step 1: Rewrite WatchBudget.tsx**

Replace the entire file content:

```typescript
'use client';
// frontend/components/recommendation/WatchBudget.tsx

import { formatRuntime } from '@/lib/formatters';

interface WatchBudgetProps {
  value: number | undefined;
  onChange: (mins: number | undefined) => void;
}

export function WatchBudget({ value, onChange }: WatchBudgetProps) {
  const enabled = value !== undefined;
  const sliderValue = value ?? 240;

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm whitespace-nowrap" style={{ color: 'var(--color-text-secondary)' }}>
        Watch Budget
      </span>
      {/* Toggle pill */}
      <button
        role="switch"
        aria-checked={enabled}
        onClick={() => onChange(enabled ? undefined : 240)}
        className="relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200 focus:outline-none"
        style={{ backgroundColor: enabled ? 'var(--color-brand)' : '#374151' }}
        aria-label="Enable watch budget"
      >
        <span
          className="pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200"
          style={{
            margin: '2px',
            transform: enabled ? 'translateX(16px)' : 'translateX(0)',
          }}
        />
      </button>
      {enabled && (
        <>
          <input
            type="range"
            min={60}
            max={300}
            step={30}
            value={sliderValue}
            onChange={e => onChange(Number(e.target.value))}
            className="w-32 accent-violet-600"
            aria-label="Watch time budget in minutes"
          />
          <span className="text-sm font-medium w-14 text-white">
            {formatRuntime(sliderValue)}
          </span>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd frontend && npm run build 2>&1 | grep -E "error|Error" | head -20
```

Expected: TypeScript error in `discover/page.tsx` because `budget` state is still `number` and `WatchBudget` now expects `number | undefined`. That's expected — fixed in Task 6.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/recommendation/WatchBudget.tsx
git commit -m "feat(WatchBudget): add toggle; disabled by default; slider shown only when enabled"
```

---

## Task 4: MovieCard — always-visible match badge

**Files:**
- Modify: `frontend/components/movies/MovieCard.tsx`

Context: `MovieCard` already has `matchPercent?: number` prop. Currently the badge shows only on hover, is positioned top-right, and uses the brand color background. The spec wants it always visible, top-left, green text on semi-transparent dark background.

- [ ] **Step 1: Update the match badge block**

In `frontend/components/movies/MovieCard.tsx`, replace:

```typescript
        {/* Match % badge — visible on hover */}
        {matchPercent !== undefined && hovered && (
          <div
            className="absolute top-2 right-2 text-xs font-bold px-2 py-0.5 rounded"
            style={{ backgroundColor: 'var(--color-brand)', color: 'white' }}
          >
            {matchPercent}% Match
          </div>
        )}
```

With:

```typescript
        {/* Match % badge — always visible when provided */}
        {matchPercent !== undefined && matchPercent > 0 && (
          <div
            className="absolute top-2 left-2 text-xs font-bold px-1.5 py-0.5 rounded"
            style={{ backgroundColor: 'rgba(0,0,0,0.75)', color: '#4ade80' }}
          >
            {matchPercent}% match
          </div>
        )}
```

- [ ] **Step 2: Verify**

```bash
cd frontend && npm run build 2>&1 | grep -E "MovieCard" | head -10
```

Expected: no MovieCard errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/movies/MovieCard.tsx
git commit -m "feat(MovieCard): match badge always visible at top-left, green on dark bg"
```

---

## Task 5: MovieRow — titleExtras prop

**Files:**
- Modify: `frontend/components/movies/MovieRow.tsx`

Context: The discover page needs to render an engine badge + "How were these picked?" link next to the "Recommended For You" title. Adding a `titleExtras?: React.ReactNode` prop to MovieRow is the cleanest way to do this without duplicating the scroll/chevron logic.

- [ ] **Step 1: Add titleExtras to MovieRowProps and render it**

In `frontend/components/movies/MovieRow.tsx`, replace:

```typescript
interface MovieRowProps {
  title: string;
  movies: Movie[];
  matchPercents?: Record<number, number>;
}

export function MovieRow({ title, movies, matchPercents }: MovieRowProps) {
```

With:

```typescript
interface MovieRowProps {
  title: string;
  movies: Movie[];
  matchPercents?: Record<number, number>;
  titleExtras?: React.ReactNode;
}

export function MovieRow({ title, movies, matchPercents, titleExtras }: MovieRowProps) {
```

Then replace the row title block:

```typescript
      {/* Row title */}
      <h2
        className="text-lg font-semibold mb-3 px-8"
        style={{ color: 'var(--color-text-primary)' }}
      >
        {title}
      </h2>
```

With:

```typescript
      {/* Row title */}
      <div className="flex items-center gap-3 px-8 mb-3">
        <h2
          className="text-lg font-semibold"
          style={{ color: 'var(--color-text-primary)' }}
        >
          {title}
        </h2>
        {titleExtras}
      </div>
```

- [ ] **Step 2: Verify**

```bash
cd frontend && npm run build 2>&1 | grep -E "MovieRow" | head -10
```

Expected: no MovieRow errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/movies/MovieRow.tsx
git commit -m "feat(MovieRow): add titleExtras prop for engine badge and action links"
```

---

## Task 6: Discover page — budget, sessionId, engine badge, drawerOpen

**Files:**
- Modify: `frontend/app/discover/page.tsx`

Context: Several changes converge here:
1. `budget` state changes from `useState(120)` to `useState<number | undefined>(undefined)` to match WatchBudget's new interface.
2. Capture `sessionId` from the `api.getRecommendations` response and store it in state — AlgoDrawer receives it as a prop.
3. Store `activeEngine` from `recommend:ready` for the engine badge.
4. Build `matchPercents: Record<number, number>` from `recommend:ready` recommendations.
5. Lift `drawerOpen: boolean` state here and pass it to `AlgoDrawer` as `open` + `onOpenChange`.
6. Pass `budgetEnabled={budget !== undefined}` to AlgoDrawer.
7. Add engine badge + "How were these picked?" as `titleExtras` on the top MovieRow.

Note: `api.getRecommendations` already returns `Promise<{ sessionId: string }>` — the discover page just wasn't capturing the return value.

- [ ] **Step 1: Rewrite discover/page.tsx**

Replace the entire file:

```typescript
'use client';
// frontend/app/discover/page.tsx

import { useCallback, useEffect, useRef, useState } from 'react';
import { MovieRow } from '@/components/movies/MovieRow';
import { EngineSelector } from '@/components/recommendation/EngineSelector';
import type { Engine } from '@/components/recommendation/EngineSelector';
import { WatchBudget } from '@/components/recommendation/WatchBudget';
import { AlgoDrawer } from '@/components/layout/AlgoDrawer';
import { api } from '@/lib/api';
import { socketEvents } from '@/lib/socket';
import type { Movie, RecommendReadyEvent } from '@/lib/types';

const ENGINE_COLORS: Record<string, string> = {
  hybrid:        'var(--color-brand)',
  content:       '#3b82f6',
  collaborative: '#14b8a6',
  cold_start:    '#f59e0b',
};

function groupByGenre(movies: Movie[]): Record<string, Movie[]> {
  const groups: Record<string, Movie[]> = {};
  for (const movie of movies) {
    const genre = movie.genres[0] ?? 'Other';
    if (!groups[genre]) groups[genre] = [];
    groups[genre].push(movie);
  }
  return groups;
}

export default function DiscoverPage() {
  const [engine, setEngine]           = useState<Engine>('hybrid');
  const [budget, setBudget]           = useState<number | undefined>(undefined);
  const [movies, setMovies]           = useState<Movie[]>([]);
  const [matchPercents, setMatchPercents] = useState<Record<number, number>>({});
  const [activeEngine, setActiveEngine]   = useState<string>('');
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(false);
  const [sessionId, setSessionId]     = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen]   = useState(false);

  // Refs so fetchRecommendations stays stable
  const engineRef = useRef(engine);
  const budgetRef = useRef(budget);
  engineRef.current = engine;
  budgetRef.current = budget;

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchRecommendations = useCallback(async () => {
    setLoading(true);
    setError(false);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setError(true);
      setLoading(false);
    }, 30_000);
    try {
      const { sessionId: newId } = await api.getRecommendations(
        engineRef.current,
        budgetRef.current,
      );
      setSessionId(newId);
      // Keep spinner — real data arrives via socket recommend:ready
    } catch {
      clearTimeout(timeoutRef.current!);
      setError(true);
      setLoading(false);
    }
  }, []); // stable — reads from refs

  // Fire once on mount
  useEffect(() => {
    fetchRecommendations();
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, [fetchRecommendations]);

  // Re-fetch when engine or budget changes (skip first render)
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    fetchRecommendations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, budget]);

  // Socket: handle recommend:ready and recommend:error
  useEffect(() => {
    const unsubReady = socketEvents.onRecommendReady((event: RecommendReadyEvent) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setMovies(event.recommendations.map(r => r.movie));
      const percents: Record<number, number> = {};
      event.recommendations.forEach(r => { percents[r.movie.id] = r.matchPercent; });
      setMatchPercents(percents);
      setActiveEngine(event.engine);
      setLoading(false);
    });
    const unsubError = socketEvents.onRecommendError(() => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setError(true);
      setLoading(false);
    });
    return () => { unsubReady(); unsubError(); };
  }, []);

  const genreGroups = groupByGenre(movies);
  const topMovies   = movies.slice(0, 6);

  const topRowExtras = (
    <div className="flex items-center gap-2">
      {activeEngine && (
        <span
          className="text-xs px-2 py-0.5 rounded-full font-medium"
          style={{
            backgroundColor: ENGINE_COLORS[activeEngine] ?? 'var(--color-brand)',
            color: 'white',
          }}
        >
          {activeEngine}
        </span>
      )}
      <button
        onClick={() => setDrawerOpen(true)}
        className="text-xs"
        style={{ color: 'var(--color-text-muted)' }}
      >
        How were these picked?
      </button>
    </div>
  );

  return (
    <main
      className="min-h-screen pt-20 pb-20"
      style={{ backgroundColor: 'var(--color-bg-base)' }}
    >
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4 px-8 mb-8">
        <EngineSelector value={engine} onChange={setEngine} />
        <WatchBudget value={budget} onChange={setBudget} />
      </div>

      {/* Movie rows */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div
            className="w-8 h-8 rounded-full border-2 animate-spin"
            style={{ borderColor: 'var(--color-brand) transparent transparent transparent' }}
          />
        </div>
      ) : error ? (
        <div className="flex items-center justify-center py-24" style={{ color: 'var(--color-text-muted)' }}>
          <p>Could not load recommendations. Make sure the backend is running.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-10">
          {topMovies.length > 0 && (
            <MovieRow
              title="Recommended For You"
              movies={topMovies}
              matchPercents={matchPercents}
              titleExtras={topRowExtras}
            />
          )}
          {Object.entries(genreGroups)
            .filter(([, ms]) => ms.length >= 2)
            .slice(0, 4)
            .map(([genre, ms]) => (
              <MovieRow key={genre} title={`Top in ${genre}`} movies={ms} />
            ))}
        </div>
      )}

      {/* Algorithm drawer pinned at bottom */}
      <AlgoDrawer
        sessionId={sessionId}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        budgetEnabled={budget !== undefined}
      />
    </main>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
cd frontend && npm run build 2>&1 | grep -E "error TS|Error:" | head -20
```

Expected: TypeScript errors in `AlgoDrawer.tsx` because it still has the old props interface. That's expected — fixed in Task 7.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/discover/page.tsx
git commit -m "feat(discover): lift drawerOpen, store sessionId/engine, budget toggle, engine badge"
```

---

## Task 7: AlgoDrawer — core rewrite with replay engine

**Files:**
- Modify: `frontend/components/layout/AlgoDrawer.tsx`

Context: Complete rewrite. The new component accepts `{ sessionId, open, onOpenChange, budgetEnabled }` as props. It buffers algo steps by sessionId, runs a setTimeout-based replay engine, auto-switches tabs during replay, and shows placeholder panels for MergeSort and Knapsack (real viz panels added in Tasks 8 and 9). The `MergeSortPanel` and `KnapsackPanel` sub-components are also defined in this file.

- [ ] **Step 1: Replace AlgoDrawer.tsx with core shell + replay engine**

Replace the entire file:

```typescript
'use client';
// frontend/components/layout/AlgoDrawer.tsx

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { socketEvents } from '@/lib/socket';
import type {
  AlgoStepEvent,
  AlgoCompleteEvent,
  RecommendReadyEvent,
  MergeSortStep,
  KnapsackStep,
  Recommendation,
} from '@/lib/types';

// ─── Shared types ─────────────────────────────────────────────────────────────

type DrawerTab = 'mergesort' | 'knapsack' | 'overview';

interface ReplayItem {
  type: 'mergesort' | 'knapsack';
  step: MergeSortStep | KnapsackStep;
}

// ─── Speed controls (shared by both panels) ───────────────────────────────────

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

// ─── MergeSort panel (placeholder — viz added in Task 8) ─────────────────────

interface MergeSortPanelProps {
  currentStep: MergeSortStep | null;
  replayIndex: number;
  totalSteps: number;
  replayDone: boolean;
  isReplaying: boolean;
  onReplay: () => void;
  replaySpeedMs: number;
  onSpeedChange: (ms: number) => void;
}

function MergeSortPanel({
  currentStep,
  replayIndex,
  totalSteps,
  replayDone,
  isReplaying,
  onReplay,
  replaySpeedMs,
  onSpeedChange,
}: MergeSortPanelProps) {
  return (
    <div className="p-4 flex flex-col gap-3 h-full">
      <p className="text-sm font-semibold" style={{ color: 'var(--color-brand)' }}>
        Merge Sort — Recommendation Ranking
      </p>
      {!currentStep ? (
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Sorts recommendations by predicted score (O(n log n)).
          Steps appear here when the engine runs.
        </p>
      ) : (
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Step {replayIndex} / {totalSteps} — type: <span style={{ color: 'var(--color-brand)' }}>{currentStep.type}</span>
        </p>
      )}
      <div className="mt-auto flex items-center gap-3 text-xs" style={{ color: 'var(--color-text-muted)' }}>
        <span className="tabular-nums">{replayIndex} / {totalSteps}</span>
        <span style={{ color: replayDone ? '#4ade80' : 'var(--color-brand)' }}>
          {replayDone ? 'Complete ✓' : isReplaying ? 'Sorting…' : ''}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {replayDone && (
            <button
              onClick={onReplay}
              className="px-2 py-0.5 rounded text-xs"
              style={{ backgroundColor: 'var(--color-brand)', color: 'white' }}
            >
              ▶ Replay
            </button>
          )}
          <SpeedControls replaySpeedMs={replaySpeedMs} onSpeedChange={onSpeedChange} />
        </div>
      </div>
    </div>
  );
}

// ─── Knapsack panel (placeholder — viz added in Task 9) ──────────────────────

interface KnapsackPanelProps {
  currentStep: KnapsackStep | null;
  knapsackSteps: KnapsackStep[];
  recommendations: Recommendation[];
  knapsackReplayIndex: number;
  replayDone: boolean;
  isReplaying: boolean;
  onReplay: () => void;
  replaySpeedMs: number;
  onSpeedChange: (ms: number) => void;
}

function KnapsackPanel({
  currentStep,
  knapsackSteps,
  recommendations,
  knapsackReplayIndex,
  replayDone,
  isReplaying,
  onReplay,
  replaySpeedMs,
  onSpeedChange,
}: KnapsackPanelProps) {
  return (
    <div className="p-4 flex flex-col gap-3 h-full">
      <p className="text-sm font-semibold" style={{ color: '#a78bfa' }}>
        0/1 Knapsack — Watch Budget Optimizer
      </p>
      {!currentStep ? (
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Selects movies maximizing score within your watch-time budget.
          Steps appear here when the engine runs.
        </p>
      ) : (
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Row {currentStep.row} / {recommendations.length} — decision:{' '}
          <span style={{ color: currentStep.decision === 'include' ? '#4ade80' : 'var(--color-text-muted)' }}>
            {currentStep.decision}
          </span>
        </p>
      )}
      <div className="mt-auto flex items-center gap-3 text-xs" style={{ color: 'var(--color-text-muted)' }}>
        <span className="tabular-nums">{knapsackReplayIndex} / {knapsackSteps.length}</span>
        <span style={{ color: replayDone ? '#4ade80' : '#a78bfa' }}>
          {replayDone ? 'Complete ✓' : isReplaying ? 'Running…' : ''}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {replayDone && (
            <button
              onClick={onReplay}
              className="px-2 py-0.5 rounded text-xs"
              style={{ backgroundColor: '#a78bfa', color: 'white' }}
            >
              ▶ Replay
            </button>
          )}
          <SpeedControls replaySpeedMs={replaySpeedMs} onSpeedChange={onSpeedChange} />
        </div>
      </div>
    </div>
  );
}

// ─── Main drawer ──────────────────────────────────────────────────────────────

interface AlgoDrawerProps {
  sessionId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  budgetEnabled: boolean;
}

export function AlgoDrawer({
  sessionId,
  open,
  onOpenChange,
  budgetEnabled,
}: AlgoDrawerProps) {
  const [activeTab, setActiveTab]       = useState<DrawerTab>('mergesort');
  const [replayIndex, setReplayIndex]   = useState(0);
  const [isReplaying, setIsReplaying]   = useState(false);
  const [replayDone, setReplayDone]     = useState(false);
  const [hasAutoPlayed, setHasAutoPlayed] = useState(false);
  const [replaySpeedMs, setReplaySpeedMs] = useState(120);

  // Step buffers — not state; don't trigger re-render on push
  const mergeSortStepsRef   = useRef<MergeSortStep[]>([]);
  const knapsackStepsRef    = useRef<KnapsackStep[]>([]);
  const recommendationsRef  = useRef<Recommendation[]>([]);

  // Current display snapshot (state — triggers re-render)
  const [currentItem, setCurrentItem]   = useState<ReplayItem | null>(null);
  const [totalReplaySteps, setTotalReplaySteps] = useState(0);

  // ── Reset on new sessionId ──────────────────────────────────────────────────
  const prevSessionIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (sessionId === prevSessionIdRef.current) return;
    prevSessionIdRef.current = sessionId;
    mergeSortStepsRef.current  = [];
    knapsackStepsRef.current   = [];
    recommendationsRef.current = [];
    setCurrentItem(null);
    setReplayIndex(0);
    setIsReplaying(false);
    setReplayDone(false);
    setHasAutoPlayed(false);
    setTotalReplaySteps(0);
    setActiveTab('mergesort');
  }, [sessionId]);

  // ── Socket subscriptions ────────────────────────────────────────────────────
  useEffect(() => {
    const unsubStep = socketEvents.onAlgoStep((event: AlgoStepEvent) => {
      if (event.sessionId !== sessionId) return;
      if (event.algorithm === 'mergeSort') {
        mergeSortStepsRef.current.push(event.step as MergeSortStep);
      } else if (event.algorithm === 'knapsack') {
        knapsackStepsRef.current.push(event.step as KnapsackStep);
      }
    });

    const unsubComplete = socketEvents.onAlgoComplete((event: AlgoCompleteEvent) => {
      if (event.sessionId !== sessionId) return;
      // Replay drives off ref buffers; no explicit action needed here
    });

    const unsubReady = socketEvents.onRecommendReady((event: RecommendReadyEvent) => {
      if (event.sessionId !== sessionId) return;
      recommendationsRef.current = event.recommendations;
    });

    return () => { unsubStep(); unsubComplete(); unsubReady(); };
  }, [sessionId]);

  // ── Auto-play on first open ─────────────────────────────────────────────────
  useEffect(() => {
    if (open && !hasAutoPlayed && mergeSortStepsRef.current.length > 0) {
      startReplay();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // ── Replay engine ───────────────────────────────────────────────────────────
  function buildAllSteps(): ReplayItem[] {
    return [
      ...mergeSortStepsRef.current.map(s => ({ type: 'mergesort' as const, step: s })),
      ...(budgetEnabled
        ? knapsackStepsRef.current.map(s => ({ type: 'knapsack' as const, step: s }))
        : []),
    ];
  }

  function startReplay() {
    setHasAutoPlayed(true);
    setReplayDone(false);
    setReplayIndex(0);
    setIsReplaying(true);
    setActiveTab('mergesort');
  }

  useEffect(() => {
    if (!isReplaying) return;
    const allSteps = buildAllSteps();
    setTotalReplaySteps(allSteps.length);

    if (replayIndex >= allSteps.length) {
      setIsReplaying(false);
      setReplayDone(true);
      return;
    }

    const item = allSteps[replayIndex];
    setCurrentItem(item);
    if (item.type === 'mergesort') setActiveTab('mergesort');
    else if (item.type === 'knapsack') setActiveTab('knapsack');

    const id = setTimeout(() => setReplayIndex(i => i + 1), replaySpeedMs);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReplaying, replayIndex, replaySpeedMs, budgetEnabled]);

  // ── Tab list ────────────────────────────────────────────────────────────────
  const TABS: { id: DrawerTab; label: string }[] = [
    { id: 'mergesort', label: 'Merge Sort' },
    ...(budgetEnabled ? [{ id: 'knapsack' as DrawerTab, label: 'Knapsack' }] : []),
    { id: 'overview',  label: 'Overview' },
  ];

  const hasActivity =
    mergeSortStepsRef.current.length > 0 || knapsackStepsRef.current.length > 0;

  const mergeSortCount = mergeSortStepsRef.current.length;
  const knapsackReplayIndex = Math.max(0, replayIndex - mergeSortCount);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40"
      style={{ borderTop: '2px solid var(--color-brand)' }}
    >
      {/* Tab bar — always visible */}
      <div
        className="flex items-center px-4 h-12 gap-1"
        style={{ backgroundColor: 'var(--color-bg-elevated)' }}
      >
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => {
              if (activeTab === id && open) {
                onOpenChange(false);
              } else {
                setActiveTab(id);
                onOpenChange(true);
              }
            }}
            className="px-3 py-1 rounded text-xs font-medium transition-colors duration-150"
            style={{
              backgroundColor: activeTab === id && open ? 'var(--color-brand)' : 'transparent',
              color: activeTab === id && open ? 'white' : 'var(--color-text-secondary)',
            }}
          >
            {label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          {hasActivity && !open && (
            <span className="text-xs animate-pulse" style={{ color: 'var(--color-brand)' }}>
              ● live
            </span>
          )}
          <button
            onClick={() => onOpenChange(!open)}
            className="text-xs"
            style={{ color: 'var(--color-text-muted)' }}
            aria-label={open ? 'Collapse algo drawer' : 'Expand algo drawer'}
          >
            {open ? '▼ Collapse' : '▲ Algorithms'}
          </button>
        </div>
      </div>

      {/* Expandable content */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: '40vh', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            style={{ backgroundColor: 'var(--color-bg-elevated)', overflowY: 'auto' }}
          >
            {activeTab === 'mergesort' && (
              <MergeSortPanel
                currentStep={
                  currentItem?.type === 'mergesort'
                    ? (currentItem.step as MergeSortStep)
                    : null
                }
                replayIndex={Math.min(replayIndex, mergeSortCount)}
                totalSteps={mergeSortCount}
                replayDone={replayDone}
                isReplaying={isReplaying}
                onReplay={startReplay}
                replaySpeedMs={replaySpeedMs}
                onSpeedChange={setReplaySpeedMs}
              />
            )}
            {activeTab === 'knapsack' && budgetEnabled && (
              <KnapsackPanel
                currentStep={
                  currentItem?.type === 'knapsack'
                    ? (currentItem.step as KnapsackStep)
                    : null
                }
                knapsackSteps={knapsackStepsRef.current}
                recommendations={recommendationsRef.current}
                knapsackReplayIndex={knapsackReplayIndex}
                replayDone={replayDone}
                isReplaying={isReplaying}
                onReplay={startReplay}
                replaySpeedMs={replaySpeedMs}
                onSpeedChange={setReplaySpeedMs}
              />
            )}
            {activeTab === 'overview' && (
              <div className="p-4">
                <p
                  className="text-sm font-semibold mb-2"
                  style={{ color: 'var(--color-brand)' }}
                >
                  Active Engine
                </p>
                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  CineGraph runs three recommendation engines: Content-Based (cosine
                  similarity on 50-dimensional feature vectors), Collaborative
                  (Floyd-Warshall transitive similarity + Pearson correlation), and
                  Hybrid (phases based on your rating history).
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

- [ ] **Step 2: Verify the full build passes**

```bash
cd frontend && npm run build
```

Expected: clean build, 0 TypeScript errors. The MergeSort and Knapsack panels show placeholder text — that's correct at this stage.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/layout/AlgoDrawer.tsx
git commit -m "feat(AlgoDrawer): core rewrite — sessionId gating, replay engine, tab-aware auto-switch"
```

---

## Task 8: MergeSort visualization panel

**Files:**
- Modify: `frontend/components/layout/AlgoDrawer.tsx`

Context: Replace the placeholder `MergeSortPanel` body with the real animated visualization. The panel renders `MergeSortStep.array` (which carries the full `Recommendation[]` at each step) as a horizontal row of poster cards. Framer Motion `layout` + `layoutId` animate cards sliding to new positions. A `SortCard` sub-component handles a single card with compare/merge highlight states.

Note: Cards use `<img>` (not `next/image`) because these are tiny 44px thumbnails inside a visualization — `next/image` requires static sizes and adds unnecessary overhead here.

- [ ] **Step 1: Add SortCard sub-component and POSTER_BASE constant above MergeSortPanel**

In `AlgoDrawer.tsx`, insert this block just before the `// ─── MergeSort panel` comment:

```typescript
// ─── Poster helper ────────────────────────────────────────────────────────────

const POSTER_BASE = process.env.NEXT_PUBLIC_TMDB_IMAGE_BASE ?? '';

// ─── SortCard ────────────────────────────────────────────────────────────────

type CardState = 'normal' | 'compare' | 'merge';

function SortCard({
  rec,
  cardState,
}: {
  rec: Recommendation;
  cardState: CardState;
}) {
  return (
    <div
      className="flex flex-col items-center gap-1 flex-shrink-0"
      style={{ width: '44px' }}
    >
      <motion.div
        layout
        layoutId={`ms-card-${rec.movie.id}`}
        animate={{
          scale: cardState === 'compare' ? 1.1 : 1,
          boxShadow:
            cardState === 'compare'
              ? '0 0 10px rgba(124,58,237,0.8)'
              : cardState === 'merge'
              ? '0 0 8px rgba(74,222,128,0.6)'
              : 'none',
        }}
        transition={{ duration: 0.12 }}
        className="relative rounded overflow-hidden"
        style={{
          width: '44px',
          height: '64px',
          border:
            cardState === 'compare'
              ? '2px solid #7C3AED'
              : cardState === 'merge'
              ? '2px solid #4ade80'
              : '1px solid #333',
          backgroundColor: 'var(--color-bg-card)',
        }}
      >
        {rec.movie.posterPath && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`${POSTER_BASE}${rec.movie.posterPath}`}
            alt={rec.movie.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        )}
        {/* Score badge */}
        <div
          className="absolute top-0.5 right-0.5 rounded px-0.5"
          style={{
            background: 'rgba(0,0,0,0.85)',
            color: '#a78bfa',
            fontSize: '8px',
            lineHeight: '14px',
          }}
        >
          {rec.score.toFixed(1)}
        </div>
      </motion.div>
      <span
        className="truncate text-center block"
        style={{
          fontSize: '9px',
          color: cardState === 'compare' ? '#a78bfa' : '#555',
          width: '44px',
        }}
      >
        {rec.movie.title}
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Replace MergeSortPanel body with real visualization**

Replace the entire `function MergeSortPanel(...)` definition with:

```typescript
function MergeSortPanel({
  currentStep,
  replayIndex,
  totalSteps,
  replayDone,
  isReplaying,
  onReplay,
  replaySpeedMs,
  onSpeedChange,
}: MergeSortPanelProps) {
  if (!currentStep) {
    return (
      <div className="p-4">
        <p className="text-sm font-semibold mb-2" style={{ color: 'var(--color-brand)' }}>
          Merge Sort — Recommendation Ranking
        </p>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Sorts recommendations by predicted score (O(n log n)).
          Steps appear here when the engine runs.
        </p>
      </div>
    );
  }

  const items = currentStep.array;

  return (
    <div className="p-4 flex flex-col gap-3">
      <p className="text-sm font-semibold" style={{ color: 'var(--color-brand)' }}>
        Merge Sort — Recommendation Ranking
      </p>

      {/* Animated card row */}
      <div className="overflow-x-auto">
        <motion.div
          layout
          className="flex gap-2 pb-1"
          style={{ minWidth: 'max-content' }}
        >
          {items.map((rec, idx) => {
            const isCompare =
              currentStep.type === 'compare' &&
              (idx === currentStep.leftIndex || idx === currentStep.rightIndex);
            const isMerge =
              currentStep.type === 'merge' &&
              idx >= currentStep.leftIndex &&
              idx <= currentStep.rightIndex;
            return (
              <SortCard
                key={rec.movie.id}
                rec={rec}
                cardState={isCompare ? 'compare' : isMerge ? 'merge' : 'normal'}
              />
            );
          })}
        </motion.div>
      </div>

      {/* Step description */}
      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
        {currentStep.type === 'compare' &&
          `Comparing positions ${currentStep.leftIndex} and ${currentStep.rightIndex}`}
        {currentStep.type === 'place' &&
          `Placing item at position ${currentStep.leftIndex}`}
        {currentStep.type === 'split' &&
          `Splitting subarray [${currentStep.leftIndex}…${currentStep.rightIndex}]`}
        {currentStep.type === 'merge' &&
          `Merging into positions [${currentStep.leftIndex}…${currentStep.rightIndex}]`}
      </p>

      {/* Footer */}
      <div
        className="flex items-center gap-3 text-xs"
        style={{ color: 'var(--color-text-muted)' }}
      >
        <span className="tabular-nums">
          step {replayIndex} / {totalSteps}
        </span>
        <span
          style={{ color: replayDone ? '#4ade80' : 'var(--color-brand)' }}
        >
          {replayDone ? 'Complete ✓' : isReplaying ? 'Sorting…' : ''}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {replayDone && (
            <button
              onClick={onReplay}
              className="px-2 py-0.5 rounded text-xs"
              style={{ backgroundColor: 'var(--color-brand)', color: 'white' }}
            >
              ▶ Replay
            </button>
          )}
          <SpeedControls
            replaySpeedMs={replaySpeedMs}
            onSpeedChange={onSpeedChange}
          />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

```bash
cd frontend && npm run build
```

Expected: clean build, 0 errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/components/layout/AlgoDrawer.tsx
git commit -m "feat(AlgoDrawer): MergeSort animated card visualization with Framer Motion layout"
```

---

## Task 9: Knapsack visualization panel

**Files:**
- Modify: `frontend/components/layout/AlgoDrawer.tsx`

Context: Replace the placeholder `KnapsackPanel` body with the real two-phase visualization. Phase 1 (forward pass, first `recommendations.length` steps) shows movie rows filling in with colored bars. Phase 2 (backtrack, remaining steps) shows poster cards sliding in with include/exclude verdicts. Phase is detected by `knapsackReplayIndex` vs `recommendations.length`.

- [ ] **Step 1: Replace KnapsackPanel body with real visualization**

Replace the entire `function KnapsackPanel(...)` definition with:

```typescript
function KnapsackPanel({
  currentStep,
  knapsackSteps,
  recommendations,
  knapsackReplayIndex,
  replayDone,
  isReplaying,
  onReplay,
  replaySpeedMs,
  onSpeedChange,
}: KnapsackPanelProps) {
  const n = recommendations.length;
  // Forward steps: indices 0..n-1 (one per movie, ascending row)
  const forwardSteps    = knapsackSteps.slice(0, n);
  // Backtrack steps: indices n..end (descending row, resolves selection)
  const backtrackSteps  = knapsackSteps.slice(n);

  const isPhase2        = knapsackReplayIndex >= n;
  const backtrackShown  = Math.max(0, knapsackReplayIndex - n);
  const resolvedCards   = backtrackSteps.slice(0, backtrackShown);

  const maxValue = Math.max(...forwardSteps.map(s => s.value), 1);

  if (!currentStep && knapsackSteps.length === 0) {
    return (
      <div className="p-4">
        <p className="text-sm font-semibold mb-2" style={{ color: '#a78bfa' }}>
          0/1 Knapsack — Watch Budget Optimizer
        </p>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Selects movies maximizing score within your watch-time budget.
          Steps appear here when the engine runs.
        </p>
      </div>
    );
  }

  const includedCards = resolvedCards.filter(s => s.decision === 'include');
  const totalRuntime  = includedCards.reduce((acc, s) => {
    return acc + (recommendations[s.row - 1]?.movie.runtime ?? 90);
  }, 0);
  const latestValue   = currentStep?.value ?? 0;

  return (
    <div className="p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center gap-3">
        <p className="text-sm font-semibold" style={{ color: '#a78bfa' }}>
          0/1 Knapsack — Watch Budget Optimizer
        </p>
        <span
          className="text-xs px-2 py-0.5 rounded"
          style={{
            backgroundColor: isPhase2
              ? 'rgba(74,222,128,0.15)'
              : 'rgba(167,139,250,0.15)',
            color: isPhase2 ? '#4ade80' : '#a78bfa',
          }}
        >
          {isPhase2 ? 'Phase 2: Selecting' : 'Phase 1: Evaluating'}
        </span>
      </div>

      <AnimatePresence mode="wait">
        {!isPhase2 ? (
          /* ── Phase 1: DP evaluation rows ── */
          <motion.div
            key="phase1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.6 } }}
            className="flex flex-col gap-1"
          >
            {forwardSteps.slice(0, knapsackReplayIndex + 1).map((step, i) => {
              const movie = recommendations[step.row - 1]?.movie;
              if (!movie) return null;
              const proportion = step.value / maxValue;
              const isActive   = i === knapsackReplayIndex;
              return (
                <motion.div
                  key={movie.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-2"
                >
                  <span
                    className="truncate flex-shrink-0 text-xs"
                    style={{
                      width: '84px',
                      color: isActive ? '#a78bfa' : 'var(--color-text-secondary)',
                    }}
                  >
                    {movie.title}
                  </span>
                  <div
                    className="flex-1 h-3 rounded overflow-hidden"
                    style={{ backgroundColor: '#1a1a2e' }}
                  >
                    <motion.div
                      className="h-full rounded"
                      animate={{ width: `${proportion * 100}%` }}
                      transition={{ duration: 0.15 }}
                      style={{
                        backgroundColor: isActive
                          ? '#a78bfa'
                          : step.decision === 'include'
                          ? '#7C3AED'
                          : '#2d1b69',
                        boxShadow: isActive ? '0 0 6px #a78bfa' : 'none',
                      }}
                    />
                  </div>
                  <span
                    className="flex-shrink-0 text-center"
                    style={{
                      width: '14px',
                      fontSize: '10px',
                      color: step.decision === 'include' ? '#4ade80' : '#444',
                    }}
                  >
                    {step.decision === 'include' ? '✓' : '·'}
                  </span>
                </motion.div>
              );
            })}
          </motion.div>
        ) : (
          /* ── Phase 2: Card selection ── */
          <motion.div
            key="phase2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col gap-3"
          >
            {/* Running total */}
            <p className="text-xs" style={{ color: '#4ade80' }}>
              Selected {includedCards.length} movie
              {includedCards.length !== 1 ? 's' : ''} · {totalRuntime} min
              {latestValue > 0 ? ` · score ${latestValue}` : ''}
            </p>
            {/* Cards */}
            <div className="flex gap-3 flex-wrap">
              {resolvedCards.map((step, i) => {
                const rec = recommendations[step.row - 1];
                if (!rec) return null;
                const included = step.decision === 'include';
                return (
                  <motion.div
                    key={`ks-card-${rec.movie.id}-${i}`}
                    initial={{ x: -30, opacity: 0 }}
                    animate={{ x: 0, opacity: included ? 1 : 0.2 }}
                    transition={{ duration: 0.25 }}
                    className="flex flex-col items-center gap-1"
                    style={{ width: '44px' }}
                  >
                    <div
                      className="relative rounded overflow-hidden"
                      style={{
                        width: '44px',
                        height: '64px',
                        border: included ? '2px solid #4ade80' : '1px solid #333',
                        boxShadow: included
                          ? '0 0 8px rgba(74,222,128,0.5)'
                          : 'none',
                        backgroundColor: 'var(--color-bg-card)',
                      }}
                    >
                      {rec.movie.posterPath && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`${POSTER_BASE}${rec.movie.posterPath}`}
                          alt={rec.movie.title}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      )}
                    </div>
                    <span
                      style={{
                        fontSize: '9px',
                        color: included ? '#4ade80' : '#ef4444',
                      }}
                    >
                      {included ? '✓' : '✗'}
                    </span>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <div
        className="flex items-center gap-3 text-xs mt-auto"
        style={{ color: 'var(--color-text-muted)' }}
      >
        <span className="tabular-nums">
          {knapsackReplayIndex} / {knapsackSteps.length}
        </span>
        <span style={{ color: replayDone ? '#4ade80' : '#a78bfa' }}>
          {replayDone ? 'Complete ✓' : isReplaying ? 'Running…' : ''}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {replayDone && (
            <button
              onClick={onReplay}
              className="px-2 py-0.5 rounded text-xs"
              style={{ backgroundColor: '#a78bfa', color: 'white' }}
            >
              ▶ Replay
            </button>
          )}
          <SpeedControls
            replaySpeedMs={replaySpeedMs}
            onSpeedChange={onSpeedChange}
          />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify final build**

```bash
cd frontend && npm run build
```

Expected: clean build, 0 TypeScript errors. All 5 routes compile.

- [ ] **Step 3: Verify backend also builds**

```bash
cd backend && npm run build
```

Expected: exit 0, no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/components/layout/AlgoDrawer.tsx
git commit -m "feat(AlgoDrawer): Knapsack two-phase visualization — DP eval rows + card selection"
```

---

## Task 10: End-to-end smoke test

No code changes. Verify everything works together with the real backend.

- [ ] **Step 1: Start backend**

```bash
cd backend && npm run dev
```

Expected: `[server] listening on port 3001`, `[socket] Socket.io server initialized`

- [ ] **Step 2: Start frontend**

```bash
cd frontend && npm run dev
```

Expected: `✓ Ready on http://localhost:3000`

- [ ] **Step 3: Open /discover and verify**

1. Open `http://localhost:3000/discover`
2. Confirm WatchBudget shows toggle OFF (no slider)
3. Confirm loading spinner appears
4. Wait for `recommend:ready` — movies should appear
5. Confirm engine badge appears next to "Recommended For You"
6. Confirm match % badges appear on movie posters (green, top-left, always visible)
7. Click "How were these picked?" — AlgoDrawer should open
8. MergeSort tab should auto-play: poster cards animate into sort order
9. When mergeSort replay finishes: "▶ Replay" button appears, step counter shows final count
10. Click "▶ Replay" — animation restarts from step 0
11. Toggle speed controls — animation visibly speeds up / slows down

- [ ] **Step 4: Test budget toggle**

1. Enable WatchBudget toggle — slider appears defaulting to 4h
2. New recommendation job fires
3. After `recommend:ready`, open AlgoDrawer — "Knapsack" tab now visible
4. MergeSort plays first, then auto-switches to Knapsack tab
5. Knapsack Phase 1: movie rows fill in with purple bars
6. Knapsack Phase 2: cards slide in with ✓/✗ verdicts and running total

- [ ] **Step 5: Test sessionId isolation**

1. Click a different engine (e.g. content) while a job is still running
2. New job fires immediately; previous job's steps should NOT appear in the new replay
3. AlgoDrawer resets cleanly and replays only the new job's steps

- [ ] **Step 6: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: smoke test corrections"
```

(Only commit if fixes were needed in Step 3-5.)
