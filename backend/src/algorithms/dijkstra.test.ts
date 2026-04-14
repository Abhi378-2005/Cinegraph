import { dijkstra } from './dijkstra';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Build a symmetric similarity matrix from a list of (i, j, sim) tuples.
 *  All unspecified pairs default to 0 (disconnected). */
function buildMatrix(n: number, edges: [number, number, number][]): number[][] {
  const m = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (let i = 0; i < n; i++) m[i][i] = 1;
  for (const [i, j, sim] of edges) {
    m[i][j] = sim;
    m[j][i] = sim;
  }
  return m;
}

function userIds(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `user${i}`);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test('source === target returns single-element path with distance 0', () => {
  const ids = userIds(3);
  const matrix = buildMatrix(3, [
    [0, 1, 0.8],
    [1, 2, 0.7],
  ]);

  const result = dijkstra(matrix, ids, 1, 1);

  expect(result.path).toEqual(['user1']);
  expect(result.distance).toBe(0);
  expect(result.steps).toEqual([]);
});

test('direct path between adjacent nodes (high similarity) is found correctly', () => {
  // 3 nodes: 0 — 0.9 — 1 — 0.8 — 2
  // Source=0, Target=2 — direct via 0→1→2 is likely the only path anyway
  const ids = userIds(3);
  const matrix = buildMatrix(3, [
    [0, 1, 0.9],
    [1, 2, 0.8],
  ]);

  const result = dijkstra(matrix, ids, 0, 2);

  expect(result.path).toEqual(['user0', 'user1', 'user2']);
  expect(result.distance).toBeGreaterThan(0);
  expect(result.distance).toBeLessThan(1);
});

test('prefers low-cost path (higher similarity edges) over high-cost path', () => {
  // 4 nodes:
  //   0 →(sim=0.9)→ 1 →(sim=0.9)→ 3   cost = (1-0.9)+(1-0.9) = 0.2
  //   0 →(sim=0.1)→ 2 →(sim=0.9)→ 3   cost = (1-0.1)+(1-0.9) = 1.0
  // Dijkstra must prefer 0→1→3
  const ids = userIds(4);
  const matrix = buildMatrix(4, [
    [0, 1, 0.9],
    [1, 3, 0.9],
    [0, 2, 0.1],
    [2, 3, 0.9],
  ]);

  const result = dijkstra(matrix, ids, 0, 3);

  expect(result.path).toEqual(['user0', 'user1', 'user3']);
  expect(result.distance).toBeCloseTo(0.2, 5);
});

test('unreachable target returns empty path and Infinity distance', () => {
  // Two disconnected pairs: {0,1} and {2,3}
  const ids = userIds(4);
  const matrix = buildMatrix(4, [
    [0, 1, 0.8],
    [2, 3, 0.7],
  ]);

  const result = dijkstra(matrix, ids, 0, 3);

  expect(result.path).toEqual([]);
  expect(result.distance).toBe(Infinity);
});

test('steps array: visitedUserId values come from userIds array', () => {
  const ids = userIds(4);
  const matrix = buildMatrix(4, [
    [0, 1, 0.8],
    [1, 2, 0.7],
    [2, 3, 0.9],
  ]);

  const result = dijkstra(matrix, ids, 0, 3);

  const validIds = new Set(ids);
  for (const step of result.steps) {
    expect(validIds.has(step.visitedUserId)).toBe(true);
  }
  expect(result.steps.length).toBeGreaterThan(0);
});

test('path backtracking: path[0] is source and path[last] is target', () => {
  const ids = userIds(5);
  const matrix = buildMatrix(5, [
    [0, 1, 0.8],
    [1, 2, 0.7],
    [2, 3, 0.9],
    [3, 4, 0.6],
  ]);

  const result = dijkstra(matrix, ids, 0, 4);

  expect(result.path.length).toBeGreaterThan(0);
  expect(result.path[0]).toBe('user0');
  expect(result.path[result.path.length - 1]).toBe('user4');
});

test('empty matrix returns empty path and Infinity distance', () => {
  const result = dijkstra([], [], 0, 1);

  expect(result.path).toEqual([]);
  expect(result.distance).toBe(Infinity);
});

test('out-of-bounds indices return empty path and Infinity distance', () => {
  const ids = userIds(3);
  const matrix = buildMatrix(3, [[0, 1, 0.8]]);

  const result = dijkstra(matrix, ids, 0, 10);

  expect(result.path).toEqual([]);
  expect(result.distance).toBe(Infinity);
});

test('steps frontier contains only unvisited user IDs at each step', () => {
  const ids = userIds(4);
  const matrix = buildMatrix(4, [
    [0, 1, 0.8],
    [1, 2, 0.7],
    [2, 3, 0.9],
  ]);

  const { steps } = dijkstra(matrix, ids, 0, 3);

  const validIds = new Set(ids);
  for (const step of steps) {
    for (const fId of step.frontier) {
      expect(validIds.has(fId)).toBe(true);
    }
  }
});
