# Algorithm Visualization & UI Improvements — Design Spec

## Goal

Upgrade the AlgoDrawer from a simple progress-bar display into a full animated algorithm replay viewer, improve how recommendations are presented on the discover page, and make the watch budget opt-in so all results show by default.

## Architecture

**Backend changes (minimal):**

| File | Change |
|---|---|
| `backend/src/routes/recommend.ts` | Thread `sessionId` into every `algo:step`, `algo:complete`, and `recommend:ready` emit so the frontend can correlate events to a specific job |

**Frontend changes:**

| File | Change |
|---|---|
| `frontend/components/layout/AlgoDrawer.tsx` | Full redesign — sessionId-gated step buffering, replay engine, animated MergeSort and Knapsack panels |
| `frontend/components/recommendation/WatchBudget.tsx` | Add enable/disable toggle; slider hidden when off; emits `undefined` when off |
| `frontend/app/discover/page.tsx` | Pass `budget: undefined` when toggle off; lift `drawerOpen` state; engine badge + match score + "How were these picked?" link that sets `drawerOpen(true)` |
| `frontend/components/movies/MovieCard.tsx` | Add optional `matchPercent` badge prop |
| `frontend/lib/types.ts` | Add `sessionId: string` field to `AlgoStepEvent`, `AlgoCompleteEvent`, and `RecommendReadyEvent` |

---

## Section 1: AlgoDrawer — Buffering & Replay Engine

### SessionId correlation

`POST /recommend` already returns `{ sessionId }`. The discover page stores the latest `sessionId` and passes it to `AlgoDrawer` as a prop. AlgoDrawer only buffers steps whose `sessionId` matches the current prop value — stale steps from a previous job are silently dropped. When a new `sessionId` prop arrives, all buffers are cleared immediately.

This prevents mixed-up replays when the user changes engine or budget before the previous job finishes streaming.

### State

```typescript
sessionId: string                 // prop from discover page — current job
mergeSortSteps: MergeSortStep[]   // accumulates as algo:step arrives (current sessionId only)
knapsackSteps: KnapsackStep[]     // accumulates as algo:step arrives (current sessionId only)
recommendations: Recommendation[] // stored on recommend:ready (current sessionId only)
replayIndex: number               // current step being displayed
isReplaying: boolean
hasAutoPlayed: boolean            // ensures auto-play fires only once per sessionId
replaySpeedMs: number             // default 120ms, range 60–300ms
```

### Step lifecycle

1. `POST /recommend` fires → discover page stores returned `sessionId`, passes it to AlgoDrawer → AlgoDrawer clears all buffers.
2. `algo:step` arrives → check `event.sessionId === props.sessionId`; if match, push into `mergeSortSteps` or `knapsackSteps`; otherwise drop.
3. `recommend:ready` arrives → check `event.sessionId`; if match, store recommendations internally, mark data ready.
4. `hasAutoPlayed` is reset to `false` whenever `sessionId` prop changes so the new run auto-plays on drawer open.
3. User opens drawer for the **first time** → `hasAutoPlayed` is false → auto-play begins.
4. Auto-play is tab-aware: plays MergeSort steps first (auto-switches to MergeSort tab), then Knapsack steps (auto-switches to Knapsack tab if budget was enabled).
5. Replay finishes → interval clears → `▶ Replay` button appears.
6. `▶ Replay` pressed → `replayIndex = 0`, `hasAutoPlayed` stays true, plays again.

### Tabs

- **Merge Sort** — always visible
- **Knapsack** — visible only when budget toggle is ON
- **Overview** — static engine description (existing content)

### Speed controls

`◀ slower` / `faster ▶` buttons step `replaySpeedMs` by ±60ms, clamped to 60–300ms. Shown at the bottom of the active viz panel.

---

## Section 2: MergeSort Visualization

Rendered in the MergeSort tab using `MergeSortStep.array` which carries the full `Recommendation[]` state at each step.

### Layout

Horizontal scrollable row of small movie poster cards — **44×64px** each. Cards are keyed by `movie.id` so Framer Motion tracks them across positions.

**Each card shows:**
- TMDB poster image (`NEXT_PUBLIC_TMDB_IMAGE_BASE + movie.posterPath`)
- Movie title below card in 9px text, truncated to 1 line
- Score badge (small pill) in top-right corner of poster

### Per-step animations

| Step type | Animation |
|---|---|
| `split` | Faint vertical dividing line appears between `leftIndex` and `rightIndex` halves |
| `compare` | Cards at `leftIndex` and `rightIndex` get purple glow + scale to 1.1× |
| `place` | Card slides to its new array position via Framer Motion `layout` animation |
| `merge` | Merged subarray cards flash a brief green border (200ms) |

### Step counter

Bottom of panel: `step 12 / 48` · `◀ slower` · `faster ▶`

---

## Section 3: Knapsack Visualization

Rendered in the Knapsack tab. Two sequential phases.

### Phase 1 — DP Table

Grid: rows = movies (up to 20), columns = budget sampled at every **30-minute** interval (0, 30, 60, 90 … up to `budget`). Displayed as a compact grid with row labels on the left (movie title, truncated).

As each `KnapsackStep` plays:
- The current row highlights (background brightens)
- Cells in that row fill with color intensity proportional to `value / maxValue`:
  - 0 → `#1a1a2e` (near black)
  - mid → `#2d1b69` (dark purple)
  - high → `#7C3AED` (brand purple)
  - max → white glow
- The active cell (`col = budget`) pulses with a box-shadow

### Phase 2 — Card Selection (backtrack)

Triggered automatically after the last DP step. 600ms crossfade dissolve from grid → cards.

Movie poster cards (same 44×64px) slide in from the left one by one:
- **Include** (`decision: 'include'`) → card animates into a green-glowing "Selected" row at top, label `✓ included`
- **Exclude** (`decision: 'exclude'`) → card dims to 20% opacity, slides down, label `✗ skipped`

Running total at top of panel (updates as each card is resolved):
`Selected N movies · X min · score Y`

### Phase transition

Grid fades out over 600ms, cards fade in. Phase 2 begins as soon as all `KnapsackStep` entries are exhausted.

### Visibility

Knapsack tab and all its content is hidden when the budget toggle is OFF.

---

## Section 4: Budget Toggle

`WatchBudget.tsx` gains a toggle switch above the slider.

**When OFF (default):**
- Renders: `Watch Budget  [○ toggle]`
- Slider not rendered
- Calls `onChange(undefined)`
- `discover/page.tsx` passes `budget: undefined` to `api.getRecommendations` → backend skips knapsack

**When ON:**
- Toggle flips, slider renders below it
- Default slider value: **240 minutes** (generous default, shows most movies)
- Works as today

Toggle styled as a pill switch using `--color-brand` (violet). No new dependencies.

---

## Section 5: Recommendation UI Improvements

### Engine badge
On the "Recommended For You" `MovieRow` title, a small pill badge shows the active engine:
- `hybrid` → violet pill
- `content` → blue pill
- `collaborative` → teal pill

Sourced from `RecommendReadyEvent.engine` stored in discover page state.

### Match score badge
`MovieCard` gets an optional `matchPercent?: number` prop. When provided, shows a small badge in the **top-left** of the poster: `92% match` in green text on a dark semi-transparent background. Only rendered when `matchPercent > 0`.

`Recommendation.matchPercent` already exists in `lib/types.ts` — discover page passes it through when mapping `event.recommendations`.

### "How were these picked?" link
Small text link rendered next to the engine badge on the "Recommended For You" row. `open` state is lifted to `discover/page.tsx` and passed as `open` + `onOpenChange` props to `AlgoDrawer`. Clicking the link calls `setDrawerOpen(true)`.

---

## Data Flow Summary

```
POST /recommend → { sessionId }
  → discover page stores sessionId, passes to AlgoDrawer as prop
  → AlgoDrawer clears all step buffers

  backend streams algo:step { sessionId, algorithm, step }
    → AlgoDrawer checks sessionId match → buffers or drops

  backend streams algo:complete { sessionId, algorithm, totalSteps }
    → AlgoDrawer checks sessionId match → marks algorithm done

  backend emits recommend:ready { sessionId, recommendations, engine }
    → discover page renders movies, stores engine
    → AlgoDrawer checks sessionId match → stores recommendations, marks ready
    → user opens drawer for first time → auto-play fires (mergeSort → knapsack)
```

---

## Out of Scope

- Floyd-Warshall, Dijkstra, Kruskal visualizations (future — Approach 2 refactor)
- Persistent replay across page reloads
- Timeline scrubber / step-by-step manual control
