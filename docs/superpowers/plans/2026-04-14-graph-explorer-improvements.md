# Graph Explorer Visual Improvements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the Graph Explorer (`/graph`) with a pulsing "YOU" node, Floyd-Warshall crosshair + two-phase results panel, and Dijkstra edge colouring + visual path chain panel.

**Architecture:** All changes are purely frontend. `D3UserGraph.tsx` gains a CSS animation injection and extended highlight logic. `FloydWarshallPanel.tsx` gains crosshair stripe, a biggest-update badge, and a two-phase AnimatePresence swap. `DijkstraPanel.tsx` gains a visual path chain and distance bar. One new prop (`currentUserId`) threads from `graph/page.tsx` to `FloydWarshallPanel`.

**Tech Stack:** React 19, D3 v7, Framer Motion, TypeScript, Tailwind v4. No new dependencies.

---

## File Map

| File | What changes |
|------|-------------|
| `frontend/components/graph/D3UserGraph.tsx` | Pulse ring + YOU label (Task 1) · Dijkstra edge colouring + glow filter (Task 4) |
| `frontend/components/graph/FloydWarshallPanel.tsx` | Crosshair stripe + biggest-update badge (Task 2) · Two-phase results panel (Task 3) |
| `frontend/components/graph/DijkstraPanel.tsx` | Visual path chain + distance bar (Task 5) |
| `frontend/app/graph/page.tsx` | Pass `currentUserId` prop to FloydWarshallPanel (Task 3) |

---

## Task 1: Pulsing Ring + "YOU" Label on Current User Node

**Files:**
- Modify: `frontend/components/graph/D3UserGraph.tsx`

- [ ] **Step 1: Inject pulse animation style into the SVG**

Inside the main D3 setup `useEffect` (the one with `[]` deps at line 96), immediately after `svg.selectAll('*').remove()` and before appending `g`, inject a `<style>` element into the SVG:

```typescript
// After: svg.selectAll('*').remove();
svg.append('style').text(`
  @keyframes pulseRing {
    0%   { opacity: 0.7; transform: scale(1); }
    100% { opacity: 0;   transform: scale(1.8); }
  }
  .pulse-ring {
    animation: pulseRing 1.4s ease-out infinite;
    transform-box: fill-box;
    transform-origin: center;
  }
`);
```

- [ ] **Step 2: Add pulse ring circle before the main node circle**

After the existing `node.append('circle')` block (the one setting `r`, `fill`, `stroke`), add a second append that targets only the current user node. Insert it **before** the main circle append so it renders behind:

Find the block starting `node.append('circle')` and replace the whole node-circle + node-text block with:

```typescript
// Pulse ring — behind main circle, current user only
node.filter(d => d.isCurrent)
  .append('circle')
  .attr('class', 'pulse-ring')
  .attr('r', 16)
  .attr('fill', 'none')
  .attr('stroke', resolveCssVar('--color-brand'))
  .attr('stroke-width', 1.5);

// Main circles — all nodes
node.append('circle')
  .attr('r', d => d.isCurrent ? 16 : 12)
  .attr('fill', d => communityColor(d.communityIdx))
  .attr('fill-opacity', 0.9)
  .attr('stroke', d => d.isCurrent ? resolveCssVar('--color-brand-bright') : resolveCssVar('--color-bg-base'))
  .attr('stroke-width', d => d.isCurrent ? 3 : 1.5);

// Label — non-current nodes: 4-char UUID centred
node.filter(d => !d.isCurrent)
  .append('text')
  .text(d => d.id.slice(0, 4))
  .attr('text-anchor', 'middle')
  .attr('dominant-baseline', 'middle')
  .attr('fill', 'white')
  .attr('font-size', 8)
  .attr('font-weight', '600')
  .attr('pointer-events', 'none');

// Label — current user node: "YOU" + UUID below
node.filter(d => d.isCurrent)
  .append('text')
  .text('YOU')
  .attr('text-anchor', 'middle')
  .attr('dy', '-3')
  .attr('fill', 'white')
  .attr('font-size', 8)
  .attr('font-weight', '700')
  .attr('pointer-events', 'none');

node.filter(d => d.isCurrent)
  .append('text')
  .text(d => d.id.slice(0, 4))
  .attr('text-anchor', 'middle')
  .attr('dy', '8')
  .attr('fill', 'rgba(255,255,255,0.55)')
  .attr('font-size', 6)
  .attr('pointer-events', 'none');

node.append('title').text(d => d.id);
```

- [ ] **Step 3: Remove the old node text + title appends**

The original file has a single `node.append('text')` and a `node.append('title')` block. Delete those two blocks — they are fully replaced by the code in Step 2.

- [ ] **Step 4: Type-check**

```bash
cd /d/Project/CineGraph/frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Visual verify**

```bash
cd /d/Project/CineGraph/frontend && npm run dev
```

Open http://localhost:3000/graph. After the graph loads, confirm:
- Your node has a pulsing ring radiating outward
- Your node shows "YOU" with a faint UUID below
- Other nodes still show their 4-char UUID and look unchanged

- [ ] **Step 6: Commit**

```bash
cd /d/Project/CineGraph && git add frontend/components/graph/D3UserGraph.tsx && git commit -m "feat(graph): pulsing ring and YOU label on current user node"
```

---

## Task 2: Floyd-Warshall — Crosshair Stripe + Biggest-Update Badge

**Files:**
- Modify: `frontend/components/graph/FloydWarshallPanel.tsx`

- [ ] **Step 1: Add refs and state for snapshot diffing**

At the top of the `FloydWarshallPanel` function body, add three refs and one piece of state:

```typescript
// Add after the existing destructuring in FloydWarshallPanel:
const initialMatrixRef = React.useRef<number[][] | null>(null);
const prevSnapshotRef  = React.useRef<number[][] | null>(null);
const [biggestUpdate, setBiggestUpdate] = React.useState<{
  i: number; j: number; k: number; delta: number;
} | null>(null);
```

Add the import for `React` at the top if not already imported as a namespace — check the file. If it uses named imports only (`import { useEffect, ... } from 'react'`), add `useRef` and `useState` to that import and use them directly (no `React.` prefix needed).

- [ ] **Step 2: Compute biggest update when a new snapshot arrives**

Add a `useEffect` after the existing refs, watching `snapshotStep`:

```typescript
useEffect(() => {
  if (!snapshotStep?.matrixSnapshot) return;
  const snap = snapshotStep.matrixSnapshot;

  // Store the very first snapshot as the initial baseline
  if (!initialMatrixRef.current) {
    initialMatrixRef.current = snap.map(row => [...row]);
  }

  // Diff against previous snapshot to find the biggest single-step gain
  const prev = prevSnapshotRef.current;
  if (prev) {
    let maxDelta = 0;
    let best: { i: number; j: number; k: number; delta: number } | null = null;
    for (let i = 0; i < snap.length; i++) {
      for (let j = 0; j < snap[i].length; j++) {
        if (i === j) continue;
        const delta = snap[i][j] - (prev[i]?.[j] ?? 0);
        if (delta > maxDelta) {
          maxDelta = delta;
          best = { i, j, k: snapshotStep.k, delta };
        }
      }
    }
    if (best) setBiggestUpdate(best);
  }

  prevSnapshotRef.current = snap.map(row => [...row]);
}, [snapshotStep]);
```

- [ ] **Step 3: Apply crosshair tint in the matrix cell render**

In the `{matrix && n > 0 ? (` block, replace the inner cell `<div>` (the one with `title`, `backgroundColor: heatColor(val)`, `borderRadius: 2`, etc.) with:

```tsx
{matrix.map((row, i) =>
  row.map((val, j) => {
    const isActive = currentStep && currentStep.i === i && currentStep.j === j;
    const isKRow   = currentStep != null && i === currentStep.k;
    const isKCol   = currentStep != null && j === currentStep.k;
    const isKDiag  = isKRow && isKCol;
    return (
      <div
        key={`${i}-${j}`}
        title={`[${i},${j}] = ${val.toFixed(3)}`}
        style={{
          aspectRatio: '1',
          backgroundColor: heatColor(val),
          borderRadius: 2,
          boxShadow: (isKRow || isKCol) && !isKDiag
            ? 'inset 0 0 0 100px rgba(124,58,237,0.28)'
            : 'none',
          outline: isKDiag
            ? '2px solid white'
            : isActive
            ? '2px solid var(--color-brand-bright)'
            : 'none',
          transition: 'background-color 0.2s',
        }}
      />
    );
  })
)}
```

- [ ] **Step 4: Render the biggest-update badge below the matrix**

Inside the matrix section, directly below the closing `</div>` of the grid and above the existing caption `<p>`, add:

```tsx
{biggestUpdate && (
  <div
    className="mt-2 rounded px-2 py-1 text-xs"
    style={{
      backgroundColor: 'rgba(167,139,250,0.1)',
      border: '1px solid rgba(167,139,250,0.25)',
      color: 'var(--color-knapsack)',
    }}
  >
    Biggest update: {userIds[biggestUpdate.i]?.slice(0, 8)} ↔ {userIds[biggestUpdate.j]?.slice(0, 8)}
    {' '}
    <span style={{ color: 'var(--color-match)' }}>+{biggestUpdate.delta.toFixed(3)}</span>
    {' '}via {userIds[biggestUpdate.k]?.slice(0, 8)}
  </div>
)}
```

- [ ] **Step 5: Type-check**

```bash
cd /d/Project/CineGraph/frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Visual verify**

Open http://localhost:3000/graph, switch to Floyd-Warshall tab, press Play. Confirm:
- The active k row and column get a purple tint as the replay steps through
- The (k,k) diagonal cell has a white outline
- The "Biggest update" badge appears below the matrix and updates at each snapshot step

- [ ] **Step 7: Commit**

```bash
cd /d/Project/CineGraph && git add frontend/components/graph/FloydWarshallPanel.tsx && git commit -m "feat(graph): floyd-warshall crosshair stripe and biggest-update badge"
```

---

## Task 3: Floyd-Warshall — Two-Phase Results Panel

**Files:**
- Modify: `frontend/components/graph/FloydWarshallPanel.tsx`
- Modify: `frontend/app/graph/page.tsx`

- [ ] **Step 1: Add `currentUserId` prop to FloydWarshallPanel**

Update the interface at the top of `FloydWarshallPanel.tsx`:

```typescript
interface FloydWarshallPanelProps {
  steps: FloydStep[];
  totalSteps: number;
  playing: boolean;
  index: number;
  replaySpeedMs: number;
  userIds: string[];
  currentUserId: string;   // ← add this
  onPlay: () => void;
  onPause: () => void;
  onSpeedChange: (ms: number) => void;
}
```

Add `currentUserId` to the destructured props in the function signature.

- [ ] **Step 2: Pass `currentUserId` from graph/page.tsx**

In `frontend/app/graph/page.tsx`, find the `<FloydWarshallPanel` JSX block and add the new prop:

```tsx
{activeTab === 'floydWarshall' && (
  <FloydWarshallPanel
    steps={floydStepsRef.current}
    totalSteps={fTotalSteps}
    playing={fPlaying}
    index={fIndex}
    replaySpeedMs={fSpeed}
    userIds={graphData?.userIds ?? []}
    currentUserId={currentUserIdRef.current}   // ← add this
    onPlay={() => { if (fIndex >= fTotalSteps) setFIndex(0); setFPlaying(true); }}
    onPause={() => setFPlaying(false)}
    onSpeedChange={setFSpeed}
  />
)}
```

- [ ] **Step 3: Add `AnimatePresence` import to FloydWarshallPanel**

At the top of `FloydWarshallPanel.tsx`, add:

```typescript
import { motion, AnimatePresence } from 'framer-motion';
```

- [ ] **Step 4: Compute results-phase data**

Inside the `FloydWarshallPanel` function body, after the existing `progress` / `n` / `matrix` derivations, add:

```typescript
const isComplete  = totalSteps > 0 && index >= totalSteps;
const myIdx       = userIds.indexOf(currentUserId);
const finalMatrix = matrix; // `matrix` already = most recent snapshot

// Top-3 indirect matches for the current user
const topMatches: Array<{ j: number; val: number; isIndirect: boolean }> =
  myIdx >= 0 && finalMatrix
    ? finalMatrix[myIdx]
        .map((val, j) => ({
          j,
          val,
          isIndirect: (initialMatrixRef.current?.[myIdx]?.[j] ?? 0) < val - 0.001,
        }))
        .filter(entry => entry.j !== myIdx && entry.val > 0.01)
        .sort((a, b) => b.val - a.val)
        .slice(0, 3)
    : [];

// All-time biggest gain (initial → final)
let improvedPairs = 0;
let allTimeBestDelta = 0;
let allTimeBestI = -1;
let allTimeBestJ = -1;
if (finalMatrix && initialMatrixRef.current) {
  finalMatrix.forEach((row, i) => {
    row.forEach((val, j) => {
      if (j <= i) return;
      const delta = val - (initialMatrixRef.current![i]?.[j] ?? 0);
      if (delta > 0.001) improvedPairs++;
      if (delta > allTimeBestDelta) {
        allTimeBestDelta = delta;
        allTimeBestI = i;
        allTimeBestJ = j;
      }
    });
  });
}
```

- [ ] **Step 5: Wrap matrix section in AnimatePresence and add results phase**

Replace the entire `{matrix && n > 0 ? ( ... ) : ( ... )}` block with an `AnimatePresence` that swaps between two phases. The full replacement:

```tsx
<AnimatePresence mode="wait">
  {isComplete && myIdx >= 0 ? (
    /* ── Results phase ── */
    <motion.div
      key="results"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="flex flex-col gap-3 flex-1 overflow-auto no-scrollbar"
    >
      {/* Ranked indirect matches */}
      <div
        className="rounded p-3 flex flex-col gap-2"
        style={{ backgroundColor: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.18)' }}
      >
        <p className="text-xs font-semibold" style={{ color: 'var(--color-match)' }}>
          Your closest taste matches
        </p>
        {topMatches.length === 0 && (
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Not enough data — rate more movies to build your similarity profile.
          </p>
        )}
        {topMatches.map(({ j, val, isIndirect }, rank) => (
          <div key={j} className="flex items-center gap-2">
            {/* Rank badge */}
            <div
              className="flex-shrink-0 rounded-full flex items-center justify-center text-white font-bold"
              style={{
                width: 20, height: 20, fontSize: 9,
                backgroundColor: rank === 0 ? 'var(--color-brand)' : rank === 1 ? '#5a2ab0' : '#3a1a70',
              }}
            >
              {rank + 1}
            </div>
            {/* User ID */}
            <span className="text-xs font-mono flex-1" style={{ color: 'var(--color-text-secondary)' }}>
              {userIds[j]?.slice(0, 12)}
            </span>
            {/* Via label */}
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {isIndirect ? 'indirect' : 'direct'}
            </span>
            {/* Similarity bar */}
            <div className="flex items-center gap-1">
              <div
                className="rounded overflow-hidden"
                style={{ width: 48, height: 4, backgroundColor: 'rgba(255,255,255,0.08)' }}
              >
                <div
                  className="h-full rounded"
                  style={{
                    width: `${Math.round(val * 100)}%`,
                    backgroundColor: 'var(--color-brand)',
                  }}
                />
              </div>
              <span className="text-xs tabular-nums" style={{ color: 'var(--color-knapsack)', minWidth: 28 }}>
                {Math.round(val * 100)}%
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Plain-English summary */}
      {allTimeBestI >= 0 && (
        <p className="text-xs" style={{ color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
          Propagation improved {improvedPairs} pair{improvedPairs !== 1 ? 's' : ''} · biggest gain:{' '}
          <span style={{ color: 'var(--color-text-secondary)' }}>
            {userIds[allTimeBestI]?.slice(0, 8)} ↔ {userIds[allTimeBestJ]?.slice(0, 8)}
          </span>{' '}
          <span style={{ color: 'var(--color-match)' }}>+{allTimeBestDelta.toFixed(3)}</span>
        </p>
      )}

      {/* Mini matrix thumbnail */}
      {finalMatrix && n > 0 && (
        <div style={{ opacity: 0.45 }}>
          <p className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Final similarity matrix</p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`,
              gap: 1,
            }}
          >
            {finalMatrix.map((row, i) =>
              row.map((val, j) => (
                <div
                  key={`mini-${i}-${j}`}
                  style={{ aspectRatio: '1', backgroundColor: heatColor(val), borderRadius: 1 }}
                />
              ))
            )}
          </div>
        </div>
      )}
    </motion.div>
  ) : (
    /* ── Heatmap phase (during replay) ── */
    <motion.div
      key="heatmap"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.4 } }}
      className="flex-1 overflow-auto no-scrollbar"
    >
      {matrix && n > 0 ? (
        <>
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
                const isKRow   = currentStep != null && i === currentStep.k;
                const isKCol   = currentStep != null && j === currentStep.k;
                const isKDiag  = isKRow && isKCol;
                return (
                  <div
                    key={`${i}-${j}`}
                    title={`[${i},${j}] = ${val.toFixed(3)}`}
                    style={{
                      aspectRatio: '1',
                      backgroundColor: heatColor(val),
                      borderRadius: 2,
                      boxShadow: (isKRow || isKCol) && !isKDiag
                        ? 'inset 0 0 0 100px rgba(124,58,237,0.28)'
                        : 'none',
                      outline: isKDiag
                        ? '2px solid white'
                        : isActive
                        ? '2px solid var(--color-brand-bright)'
                        : 'none',
                      transition: 'background-color 0.2s',
                    }}
                  />
                );
              })
            )}
          </div>
          {biggestUpdate && (
            <div
              className="mt-2 rounded px-2 py-1 text-xs"
              style={{
                backgroundColor: 'rgba(167,139,250,0.1)',
                border: '1px solid rgba(167,139,250,0.25)',
                color: 'var(--color-knapsack)',
              }}
            >
              Biggest update: {userIds[biggestUpdate.i]?.slice(0, 8)} ↔ {userIds[biggestUpdate.j]?.slice(0, 8)}
              {' '}
              <span style={{ color: 'var(--color-match)' }}>+{biggestUpdate.delta.toFixed(3)}</span>
              {' '}via {userIds[biggestUpdate.k]?.slice(0, 8)}
            </div>
          )}
          <p className="text-xs mt-2 text-center" style={{ color: 'var(--color-text-muted)' }}>
            Indirect similarity matrix ({n}×{n}) · dark = 0 · purple = 1
          </p>
        </>
      ) : (
        <div
          className="flex-1 rounded flex items-center justify-center text-xs"
          style={{ backgroundColor: 'var(--color-bg-elevated)', color: 'var(--color-text-muted)' }}
        >
          {totalSteps > 0 ? 'Propagating…' : 'No data yet'}
        </div>
      )}
    </motion.div>
  )}
</AnimatePresence>
```

Note: This step replaces the simpler matrix block added in Task 2 (the crosshair + badge are now embedded inside the heatmap phase above). If Task 2 was committed separately, the matrix section will be replaced wholesale here.

- [ ] **Step 6: Type-check**

```bash
cd /d/Project/CineGraph/frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Visual verify**

Open http://localhost:3000/graph, switch to Floyd-Warshall tab, press Play and let it run to completion. Confirm:
- During replay: crosshair stripe and biggest-update badge visible
- On completion: panel flips to ranked matches + summary + mini matrix
- If you are not in `userIds` (cold user), the matches section shows the "not enough data" message

- [ ] **Step 8: Commit**

```bash
cd /d/Project/CineGraph && git add frontend/components/graph/FloydWarshallPanel.tsx frontend/app/graph/page.tsx && git commit -m "feat(graph): floyd-warshall two-phase results with top indirect matches"
```

---

## Task 4: Dijkstra Edge Colouring in D3UserGraph

**Files:**
- Modify: `frontend/components/graph/D3UserGraph.tsx`

- [ ] **Step 1: Add the dijkstra-glow SVG filter to the setup useEffect**

Inside the main D3 setup `useEffect`, after the `svg.append('style')...` call added in Task 1, append a `<defs>` block with the glow filter:

```typescript
const defs = svg.append('defs');
defs.append('filter')
  .attr('id', 'dijkstra-glow')
  .html(
    '<feGaussianBlur stdDeviation="2.5" result="blur"/>' +
    '<feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>'
  );
```

- [ ] **Step 2: Extend the Dijkstra highlight branch to colour edges**

In the second `useEffect` (the highlight overlay effect — the one watching `[highlight]`), find the `if (highlight.algorithm === 'dijkstra')` block. Replace it entirely with:

```typescript
if (highlight.algorithm === 'dijkstra') {
  const step = highlight.step as DijkstraStep | null;
  const pathArr = highlight.dijkstraPath;

  // Build set of edge pairs that are on the current path
  const pathPairSet = new Set<string>();
  for (let i = 0; i < pathArr.length - 1; i++) {
    pathPairSet.add(`${pathArr[i]}||${pathArr[i + 1]}`);
    pathPairSet.add(`${pathArr[i + 1]}||${pathArr[i]}`);
  }
  const visitedSet = new Set(pathArr);

  // Recolour edges
  svg.selectAll<SVGLineElement, SimEdgeLike>('line')
    .attr('stroke', d => {
      const su = typeof d.source === 'object' ? (d.source as GraphNode).id : d.source as string;
      const sv = typeof d.target === 'object' ? (d.target as GraphNode).id : d.target as string;
      if (pathPairSet.has(`${su}||${sv}`) || pathPairSet.has(`${sv}||${su}`))
        return resolveCssVar('--viz-dijkstra-path');
      if (visitedSet.has(su) && visitedSet.has(sv))
        return resolveCssVar('--color-brand');
      return resolveCssVar('--viz-node-default');
    })
    .attr('stroke-width', d => {
      const su = typeof d.source === 'object' ? (d.source as GraphNode).id : d.source as string;
      const sv = typeof d.target === 'object' ? (d.target as GraphNode).id : d.target as string;
      if (pathPairSet.has(`${su}||${sv}`) || pathPairSet.has(`${sv}||${su}`)) return 3;
      return (d as { isMst?: boolean }).isMst ? 2.5 : 1;
    })
    .attr('stroke-opacity', d => {
      const su = typeof d.source === 'object' ? (d.source as GraphNode).id : d.source as string;
      const sv = typeof d.target === 'object' ? (d.target as GraphNode).id : d.target as string;
      if (pathPairSet.has(`${su}||${sv}`) || pathPairSet.has(`${sv}||${su}`)) return 1;
      if (visitedSet.has(su) && visitedSet.has(sv)) return 0.55;
      return 0.12;
    })
    .attr('filter', d => {
      const su = typeof d.source === 'object' ? (d.source as GraphNode).id : d.source as string;
      const sv = typeof d.target === 'object' ? (d.target as GraphNode).id : d.target as string;
      return (pathPairSet.has(`${su}||${sv}`) || pathPairSet.has(`${sv}||${su}`))
        ? 'url(#dijkstra-glow)'
        : 'none';
    });

  // Node colouring — unchanged from original
  svg.selectAll<SVGCircleElement, GraphNode>('circle')
    .attr('fill', d => {
      if (step?.visitedUserId === d.id) return resolveCssVar('--color-brand');
      if (pathArr.includes(d.id)) return resolveCssVar('--viz-dijkstra-path');
      return communityColor(d.communityIdx);
    });
}
```

- [ ] **Step 3: Reset edge attributes in the no-highlight branch**

Find the top of the highlight `useEffect` where `!highlight.algorithm` resets edges. Extend it to also reset the new attributes:

```typescript
if (!highlight.algorithm) {
  svg.selectAll<SVGLineElement, SimEdgeLike>('line')
    .attr('stroke', d => d.isMst ? resolveCssVar('--viz-mst-edge') : resolveCssVar('--viz-node-default'))
    .attr('stroke-width', d => d.isMst ? 2.5 : 1)
    .attr('stroke-opacity', d => 0.2 + (d as { weight?: number }).weight ?? 0 * 0.6)
    .attr('filter', 'none');
  return;
}
```

- [ ] **Step 4: Type-check**

```bash
cd /d/Project/CineGraph/frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Visual verify**

Open http://localhost:3000/graph, switch to Dijkstra tab, press Play. Confirm:
- As the replay steps through, edges connecting visited nodes glow purple at reduced opacity
- The current best-path edges glow green with a visible blur halo
- Non-involved edges dim to near-invisible
- On tab switch away and back, the graph resets to default edge colours

- [ ] **Step 6: Commit**

```bash
cd /d/Project/CineGraph && git add frontend/components/graph/D3UserGraph.tsx && git commit -m "feat(graph): dijkstra edge colouring with glow on shortest path"
```

---

## Task 5: Dijkstra Panel — Visual Path Chain + Distance Bar

**Files:**
- Modify: `frontend/components/graph/DijkstraPanel.tsx`

- [ ] **Step 1: Replace the "Current path" chip list with a visual path chain**

In `DijkstraPanel.tsx`, find the `{/* Current path chain */}` section. Replace it entirely with:

```tsx
{/* Visual path chain */}
<div>
  <p className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Current path</p>
  <div className="overflow-x-auto">
    <div className="flex items-center gap-1 pb-1" style={{ minWidth: 'max-content' }}>
      {pathToShow.length === 0 ? (
        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>—</span>
      ) : (
        pathToShow.map((uid, i) => {
          const isFirst  = i === 0;
          const isLast   = i === pathToShow.length - 1 && pathToShow.length > 1;
          return (
            <React.Fragment key={i}>
              <span
                className="px-2 py-0.5 rounded text-xs font-mono flex-shrink-0"
                style={{
                  backgroundColor: isFirst
                    ? 'var(--color-brand)'
                    : isLast
                    ? 'rgba(74,222,128,0.2)'
                    : 'rgba(124,58,237,0.35)',
                  color: isFirst ? 'white' : isLast ? 'var(--color-match)' : 'var(--color-knapsack)',
                  border: isLast ? '1px solid var(--color-match)' : 'none',
                  fontWeight: isFirst || isLast ? 700 : 400,
                }}
              >
                {isFirst ? 'YOU' : uid.slice(0, 8)}{isLast ? ' ●' : ''}
              </span>
              {i < pathToShow.length - 1 && (
                <span style={{ color: 'var(--color-match)', fontSize: 14, lineHeight: 1 }}>→</span>
              )}
            </React.Fragment>
          );
        })
      )}
    </div>
  </div>
</div>
```

Add `import React from 'react';` at the top if `React.Fragment` is not already available. Alternatively, import `Fragment` from react and use it directly.

- [ ] **Step 2: Add similarity distance bar — replace the raw "Visiting" line**

Find the `{currentStep && (` block that shows `"Visiting: <userId> (dist: X)"`. Replace it with:

```tsx
{currentStep && currentStep.distance !== Infinity && (
  <div className="flex flex-col gap-1">
    <div className="flex justify-between text-xs" style={{ color: 'var(--color-text-muted)' }}>
      <span>distance: {currentStep.distance.toFixed(3)}</span>
      <span style={{ color: 'var(--color-match)' }}>
        similarity: {Math.round((1 - Math.min(1, currentStep.distance)) * 100)}%
      </span>
    </div>
    <div
      className="rounded overflow-hidden"
      style={{ height: 6, backgroundColor: 'rgba(255,255,255,0.08)' }}
    >
      <div
        className="h-full rounded transition-all duration-150"
        style={{
          width: `${Math.min(100, currentStep.distance * 100)}%`,
          background: 'linear-gradient(to right, var(--color-brand), var(--color-match))',
        }}
      />
    </div>
    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
      Visiting: <span style={{ color: 'var(--color-brand)' }}>{currentStep.visitedUserId.slice(0, 12)}</span>
    </p>
  </div>
)}
{currentStep && currentStep.distance === Infinity && (
  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
    Visiting: <span style={{ color: 'var(--color-brand)' }}>{currentStep.visitedUserId.slice(0, 12)}</span>
    {' '}(unreachable)
  </p>
)}
```

- [ ] **Step 3: Type-check**

```bash
cd /d/Project/CineGraph/frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Visual verify**

Open http://localhost:3000/graph, switch to Dijkstra tab, press Play. Confirm:
- "Current path" shows coloured pill nodes connected by `→` arrows, source says "YOU", target has `●`
- The gradient distance bar grows right-to-left as the algorithm explores further from the source
- The similarity percentage updates each step (`distance 0.41 → similarity 59%`)
- Frontier queue still shows below the distance bar

- [ ] **Step 5: Commit**

```bash
cd /d/Project/CineGraph && git add frontend/components/graph/DijkstraPanel.tsx && git commit -m "feat(graph): dijkstra visual path chain and similarity distance bar"
```

---

## Self-Review

**Spec coverage check:**
- ✅ Pulsing ring + YOU label → Task 1
- ✅ Floyd crosshair stripe → Task 2 + Task 3 (embedded in heatmap phase)
- ✅ Biggest-update badge → Task 2 + Task 3
- ✅ Two-phase results (top-3 indirect matches, summary, mini matrix) → Task 3
- ✅ `currentUserId` prop thread → Task 3 Step 1 + 2
- ✅ Dijkstra edge colouring + glow filter → Task 4
- ✅ Visual path chain → Task 5 Step 1
- ✅ Similarity distance bar → Task 5 Step 2
- ✅ Remove raw "Visiting" line → Task 5 Step 2 (replaced by bar + visiting line below bar)

**Notes for the implementer:**
- Task 3 replaces the matrix block added in Task 2. If Tasks 2 and 3 are run sequentially in the same session, skip the matrix block from Task 2 and go straight to Task 3's full `AnimatePresence` block — it includes the crosshair and badge.
- The `initialMatrixRef` is set in Task 2's `useEffect`. It must already be declared before Task 3's results computation uses it. Verify the ref declaration comes before the `isComplete` / `topMatches` derivations in the function body.
- `SimEdgeLike` type alias already exists at the bottom of `D3UserGraph.tsx` — the Task 4 edge attribute setters cast to it where needed.
