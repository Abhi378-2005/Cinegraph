# Graph Explorer — Visual Improvements Design

**Date:** 2026-04-14
**Scope:** Three targeted improvements to the Graph Explorer page (`/graph`). No backend algorithm changes. No new routes.

---

## 1. Current User Node — Pulsing Ring + "YOU" Label

### What changes
**File:** `frontend/components/graph/D3UserGraph.tsx`

The current user node already renders with `r=16` and a brand-bright stroke. Two additions:

**Pulsing ring:** A second SVG `<circle>` rendered _before_ the main node circle (so it sits behind), with identical `cx`/`cy`, `r=18`, `fill="none"`, `stroke="var(--color-brand)"`, `stroke-width="1.5"`. A CSS `@keyframes` animation (`pulseRing`) expands `r` from 18→28 and fades `opacity` from 0.6→0 over 1.4s, looping infinitely. The `<style>` tag is injected once into the SVG `<defs>` block during the D3 setup `useEffect`.

**Label:** The existing `<text>` element showing `d.id.slice(0,4)` is split into two elements for the current node only:
- Line 1: `"YOU"` — `font-size=8`, `font-weight=700`, white, `dy="-3"`
- Line 2: `d.id.slice(0,4)` — `font-size=6`, `opacity=0.55`, white, `dy="8"`

All other nodes keep their existing single 4-char label.

### What does NOT change
- Node shape (stays circle)
- Community colour fill
- Size (`r=16` vs `r=12`)
- Drag behaviour

---

## 2. Floyd-Warshall Panel — Crosshair Highlight + Two-Phase Output

### Files changed
- `frontend/components/graph/FloydWarshallPanel.tsx` — all changes here, no backend change needed

### During replay — crosshair stripe
The matrix heatmap cell render loop gains a crosshair check:

```
const isKRow = currentStep && i === currentStep.k
const isKCol = currentStep && j === currentStep.k
const isKDiag = isKRow && isKCol
```

- `isKRow || isKCol`: background gets an additive purple tint (`rgba(124,58,237,0.25)` blended on top of the existing `heatColor(val)`)
- `isKDiag`: white `outline: "2px solid white"` (the pivot cell)
- All other cells: unchanged

### During replay — "biggest update" badge
A `prevSnapshotRef = useRef<number[][] | null>(null)` tracks the previous snapshot. On each new snapshot step, diff the two matrices to find the `(i,j)` pair with the largest positive delta. Render a small badge below the matrix:

```
Biggest update: <UserA> ↔ <UserB>  +0.14  via <UserK>
```

`UserA = userIds[i]`, `UserB = userIds[j]`, `UserK = userIds[currentStep.k]`. All IDs truncated to 8 chars. Badge uses `var(--color-knapsack)` text on a faint purple background. Hidden when no snapshot has arrived yet.

### On complete — results phase
When `index >= totalSteps && totalSteps > 0`, `AnimatePresence` swaps the heatmap panel for a results card (same fade pattern as KnapsackPanel phase transitions).

**Current user index:** `const myIdx = userIds.indexOf(currentUserId)` — `currentUserId` is passed as a new prop from `graph/page.tsx` (already available as `currentUserIdRef.current`).

**Top-3 indirect matches:** Take row `myIdx` of the final matrix snapshot, sort entries descending by similarity value, exclude self (`j === myIdx`), take top 3. For each entry render:
- Rank badge (1/2/3) in graduated purple
- Truncated user ID (8 chars)
- Similarity as a percentage bar (`width = val * 100%`, brand-purple fill)
- `"via UserX"` label where UserX is the k that produced the biggest gain for this pair — or `"direct"` if the value didn't change from the initial matrix

**Plain-English summary line:**
```
Propagation improved N pairs · biggest gain: <UserA> ↔ <UserB> +0.18
```
Computed once when transitioning to results phase: count cells where `finalMatrix[i][j] > initialMatrix[i][j]` (divided by 2 for symmetry), find the max delta pair.

**Initial matrix:** Stored in `initialMatrixRef = useRef<number[][] | null>(null)`, set on the very first snapshot step received.

**Mini matrix thumbnail:** The final matrix heatmap renders at `10px` cells with `opacity=0.5` below the ranked list as a reference.

### New props added to FloydWarshallPanel
```ts
currentUserId: string   // to find myIdx in userIds
```

---

## 3. Dijkstra — Edge Colouring on D3 + Visual Path Chain in Panel

### 3a. D3UserGraph.tsx — edge colouring

The existing `highlight.algorithm === 'dijkstra'` branch in the second `useEffect` (highlight overlay effect) currently only recolours nodes. Extend it to also recolour edges.

**SVG `<defs>` glow filter:** Add once during the D3 setup useEffect:
```svg
<filter id="dijkstra-glow">
  <feGaussianBlur stdDeviation="2.5" result="blur"/>
  <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
</filter>
```

**Edge colour logic** (applied to all `<line>` elements during Dijkstra highlight):

```
pathPairs = Set of "A||B" strings built from consecutive pairs in step.path
edgeOnPath(u, v) = pathPairs.has("u||v") || pathPairs.has("v||u")
edgeExplored(u, v) = both u and v are in step.path (visited)
```

- Edge on current path → `stroke = var(--viz-dijkstra-path)`, `stroke-width = 3`, `filter = url(#dijkstra-glow)`
- Edge explored but not on path → `stroke = var(--color-brand)`, `stroke-width = 1.5`, `opacity = 0.5`, no filter
- All others → `stroke = var(--viz-node-default)`, `stroke-width = 1`, `opacity = 0.2`

**At completion** (`kDone`-equivalent): when Dijkstra replay finishes, path edges upgrade to `stroke-width = 4` and a stronger glow. This is already triggered by `highlight` state updating — no extra state needed.

**Node recolouring** stays as-is (visited = brand-purple, path = dijkstra-path colour).

### 3b. DijkstraPanel.tsx — visual path chain

**Replace** the current "Current path" chip list with a horizontal path chain component:

```
[YOU] → [a3f2] → [9b1c ●]
```

Each node pill: `border-radius=6`, `padding="3px 8px"`, `font-size=10px`. Colour coding:
- Source (first): `background = var(--color-brand)`, white text, bold "YOU"
- Intermediate: `background = rgba(124,58,237,0.35)`, `color = var(--color-knapsack)`
- Target (last): `background = rgba(74,222,128,0.2)`, `border = 1px solid var(--color-match)`, `color = var(--color-match)`, plus a `●` dot
- Arrows between: `→` in `var(--color-match)`, `font-size=14px`

Scrolls horizontally if path is long (overflow-x: auto).

**Similarity distance bar** (replaces raw "Visiting: userId (dist: X)" line):
```
distance: 0.41  (similarity: 59%)
[████████░░░░░░░░] purple→green gradient
```
- Bar width: `currentStep.distance * 100%` (distance is already in [0,1] since weight = 1 - sim, max sim = 1)
- Gradient: `linear-gradient(to right, var(--color-brand), var(--color-match))`
- Label shows both the raw distance and `(similarity: ${Math.round((1 - dist) * 100)}%)`

**Frontier queue** keeps its list but each entry gets a small coloured dot:
- Distance < 0.3 → green dot
- 0.3–0.6 → yellow dot  
- > 0.6 → red dot
Distances for frontier entries are not in the current `DijkstraStep` type — omit the dots and just keep the list as-is. (Adding per-frontier distances would require a backend type change — out of scope.)

**Remove** the raw `"Visiting: userId (dist: X)"` line — the path chain and bar make it redundant.

---

## Files Changed Summary

| File | Change |
|------|--------|
| `frontend/components/graph/D3UserGraph.tsx` | Pulsing ring + YOU label + Dijkstra edge colouring |
| `frontend/components/graph/FloydWarshallPanel.tsx` | Crosshair stripe, biggest-update badge, two-phase results |
| `frontend/components/graph/DijkstraPanel.tsx` | Visual path chain, similarity distance bar |
| `frontend/app/graph/page.tsx` | Pass `currentUserId` prop to FloydWarshallPanel |

No backend changes. No new dependencies.

---

## Out of Scope
- Frontier queue distance dots (requires backend type change)
- Kruskal panel changes (not requested)
- Mobile layout (graph page is desktop-only by design)
- New routes or socket events
