import type { DijkstraStep } from '../types';

export interface DijkstraResult {
  path: string[];
  distance: number;
  steps: DijkstraStep[];
}

// ─── Min-Heap (Binary Heap) ──────────────────────────────────────────────────

interface HeapEntry {
  idx: number;
  dist: number;
}

function heapPush(heap: HeapEntry[], entry: HeapEntry): void {
  heap.push(entry);
  let i = heap.length - 1;
  while (i > 0) {
    const parent = Math.floor((i - 1) / 2);
    if (heap[parent].dist <= heap[i].dist) break;
    // Swap
    const tmp = heap[parent];
    heap[parent] = heap[i];
    heap[i] = tmp;
    i = parent;
  }
}

function heapPop(heap: HeapEntry[]): HeapEntry | undefined {
  if (heap.length === 0) return undefined;
  const top = heap[0];
  const last = heap.pop()!;
  if (heap.length === 0) return top;

  heap[0] = last;
  let i = 0;
  const n = heap.length;

  while (true) {
    const left  = 2 * i + 1;
    const right = 2 * i + 2;
    let smallest = i;

    if (left < n && heap[left].dist < heap[smallest].dist)   smallest = left;
    if (right < n && heap[right].dist < heap[smallest].dist) smallest = right;

    if (smallest === i) break;

    const tmp = heap[i];
    heap[i] = heap[smallest];
    heap[smallest] = tmp;
    i = smallest;
  }

  return top;
}

// ─── Dijkstra ────────────────────────────────────────────────────────────────

/**
 * Dijkstra's shortest path on a user-similarity graph.
 *
 * Edge weight = 1 - similarity[i][j]  (lower similarity = higher traversal cost).
 * Uses a hand-rolled binary min-heap for the priority queue.
 */
export function dijkstra(
  similarityMatrix: number[][],
  userIds: string[],
  sourceIdx: number,
  targetIdx: number
): DijkstraResult {
  const n = userIds.length;

  // Guard: empty input or out-of-bounds indices
  if (
    n === 0 ||
    similarityMatrix.length === 0 ||
    sourceIdx < 0 || sourceIdx >= n ||
    targetIdx < 0 || targetIdx >= n
  ) {
    return { path: [], distance: Infinity, steps: [] };
  }

  // Trivial case: source === target
  if (sourceIdx === targetIdx) {
    return { path: [userIds[sourceIdx]], distance: 0, steps: [] };
  }

  // Build edge-weight matrix from similarity matrix
  // weight[i][j] = 1 - similarity[i][j]  (only for distinct nodes with similarity > 0)
  const weight: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (__, j) => {
      if (i === j) return 0;
      const sim = similarityMatrix[i]?.[j] ?? 0;
      return sim > 0 ? 1 - sim : Infinity;
    })
  );

  // Initialise distances and previous-node map
  const dist: number[]   = new Array(n).fill(Infinity);
  const prev: number[]   = new Array(n).fill(-1);
  const visited: boolean[] = new Array(n).fill(false);

  dist[sourceIdx] = 0;

  const heap: HeapEntry[] = [];
  const openSet = new Set<number>();

  heapPush(heap, { idx: sourceIdx, dist: 0 });
  openSet.add(sourceIdx);

  const steps: DijkstraStep[] = [];

  while (heap.length > 0) {
    const entry = heapPop(heap)!;
    const u = entry.idx;

    // Remove from openSet immediately upon popping (before stale-entry check)
    openSet.delete(u);

    // Skip stale heap entries (lazy deletion)
    if (visited[u]) continue;
    visited[u] = true;

    // Reconstruct path from source to u using prev[]
    const pathToU: string[] = [];
    let cur = u;
    while (cur !== -1) {
      pathToU.unshift(userIds[cur]);
      cur = prev[cur];
    }

    // Frontier = nodes currently open (genuinely unvisited with pending heap work)
    const frontier = Array.from(openSet).map(idx => userIds[idx]);

    steps.push({
      visitedUserId: userIds[u],
      distance:      dist[u],
      frontier,
      path:          pathToU,
    });

    // Early exit once we pop the target
    if (u === targetIdx) break;

    // Relax neighbours
    for (let v = 0; v < n; v++) {
      if (visited[v]) continue;
      const w = weight[u][v];
      if (w === Infinity) continue;

      const newDist = dist[u] + w;
      if (newDist < dist[v]) {
        dist[v] = newDist;
        prev[v] = u;
        heapPush(heap, { idx: v, dist: newDist });
        openSet.add(v);
      }
    }
  }

  // Target unreachable
  if (dist[targetIdx] === Infinity) {
    return { path: [], distance: Infinity, steps };
  }

  // Reconstruct final path from source → target
  const path: string[] = [];
  let cur = targetIdx;
  while (cur !== -1) {
    path.unshift(userIds[cur]);
    cur = prev[cur];
  }

  return { path, distance: dist[targetIdx], steps };
}
