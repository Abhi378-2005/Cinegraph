import type { MSTStep } from '../types';

interface Edge {
  u: number;       // index into userIds
  v: number;
  weight: number;  // 1 - similarity (lower = more similar)
}

export interface KruskalResult {
  mstEdges: Array<{ u: string; v: string; weight: number }>;
  communities: string[][];
  steps: MSTStep[];
}

// ─── Union-Find (path compression + union by rank) ───────────────────────────

function find(parent: number[], x: number): number {
  if (parent[x] !== x) {
    parent[x] = find(parent, parent[x]); // path compression
  }
  return parent[x];
}

function union(parent: number[], rank: number[], x: number, y: number): boolean {
  const rx = find(parent, x);
  const ry = find(parent, y);

  if (rx === ry) return false; // already in the same component

  // Union by rank
  if (rank[rx] < rank[ry]) {
    parent[rx] = ry;
  } else if (rank[rx] > rank[ry]) {
    parent[ry] = rx;
  } else {
    parent[ry] = rx;
    rank[rx]++;
  }

  return true;
}

// ─── Community snapshot helper ────────────────────────────────────────────────

/**
 * Returns the current connected components as arrays of userId strings.
 * Each component is sorted internally; components are sorted by first member.
 *
 * NOTE: calls find() which mutates parent[] via path-compression — this is intentional
 * and idempotent (does not change the logical forest structure).
 */
function snapshotCommunities(parent: number[], n: number, userIds: string[]): string[][] {
  const groups = new Map<number, string[]>();

  for (let i = 0; i < n; i++) {
    const root = find(parent, i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(userIds[i]);
  }

  const result = Array.from(groups.values());
  result.forEach(g => g.sort());
  result.sort((a, b) => a[0].localeCompare(b[0]));
  return result;
}

// ─── Kruskal ─────────────────────────────────────────────────────────────────

/**
 * Kruskal's MST on the user-similarity graph.
 *
 * Edge weight = 1 - similarity[i][j].
 * Edges with weight > 0.5 (similarity < 0.5) are pruned before sorting.
 * Uses Union-Find with path compression and union by rank.
 */
export function kruskal(
  similarityMatrix: number[][],
  userIds: string[]
): KruskalResult {
  const n = userIds.length;

  if (n === 0 || similarityMatrix.length === 0) {
    return { mstEdges: [], communities: [], steps: [] };
  }

  // ── 1. Build edges from upper triangle and prune low-similarity pairs ──────
  const edges: Edge[] = [];

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const sim    = similarityMatrix[i]?.[j] ?? 0;
      const weight = 1 - sim;

      // Only connect sufficiently similar users (weight ≤ 0.5 means sim ≥ 0.5)
      if (weight <= 0.5) {
        edges.push({ u: i, v: j, weight });
      }
    }
  }

  // ── 2. Sort by weight ascending (most similar first) ──────────────────────
  edges.sort((a, b) => a.weight - b.weight);

  // ── 3. Initialise Union-Find ───────────────────────────────────────────────
  const parent = Array.from({ length: n }, (_, i) => i);
  const rank   = new Array<number>(n).fill(0);

  // ── 4. Kruskal main loop ───────────────────────────────────────────────────
  const mstEdges: Array<{ u: string; v: string; weight: number }> = [];
  const steps: MSTStep[] = [];
  let totalCost = 0;

  for (const edge of edges) {
    const { u, v, weight } = edge;
    const edgeStr = { u: userIds[u], v: userIds[v], weight };

    // 'consider' step — record before deciding
    steps.push({
      algorithm:   'kruskal',
      type:        'consider',
      edge:        edgeStr,
      communities: snapshotCommunities(parent, n, userIds),
      totalCost,
    });

    if (find(parent, u) !== find(parent, v)) {
      // No cycle — add to MST
      union(parent, rank, u, v);
      totalCost += weight;
      mstEdges.push(edgeStr);

      steps.push({
        algorithm:   'kruskal',
        type:        'add',
        edge:        edgeStr,
        communities: snapshotCommunities(parent, n, userIds),
        totalCost,
      });
    } else {
      // Would create a cycle — reject
      steps.push({
        algorithm:   'kruskal',
        type:        'reject',
        edge:        edgeStr,
        communities: snapshotCommunities(parent, n, userIds),
        totalCost,
      });
    }
  }

  // ── 5. Final communities (includes isolated nodes as singleton communities) –
  const communities = snapshotCommunities(parent, n, userIds);

  return { mstEdges, communities, steps };
}
