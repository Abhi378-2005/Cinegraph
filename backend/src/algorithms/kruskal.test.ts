import { kruskal } from './kruskal';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Build a symmetric similarity matrix from (i, j, sim) tuples. */
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

test('empty matrix returns empty result', () => {
  const result = kruskal([], []);
  expect(result.mstEdges).toEqual([]);
  expect(result.communities).toEqual([]);
  expect(result.steps).toEqual([]);
});

test('2-node graph: edge is added when similarity >= 0.5', () => {
  // similarity = 0.6 → weight = 0.4 (≤ 0.5) → should be added
  const ids = userIds(2);
  const matrix = buildMatrix(2, [[0, 1, 0.6]]);

  const result = kruskal(matrix, ids);

  expect(result.mstEdges).toHaveLength(1);
  expect(result.mstEdges[0].u).toBe('user0');
  expect(result.mstEdges[0].v).toBe('user1');
  expect(result.mstEdges[0].weight).toBeCloseTo(0.4, 5);
});

test('2-node graph: edge is rejected when similarity < 0.5 (weight > 0.5)', () => {
  // similarity = 0.3 → weight = 0.7 (> 0.5) → pruned before MST
  const ids = userIds(2);
  const matrix = buildMatrix(2, [[0, 1, 0.3]]);

  const result = kruskal(matrix, ids);

  expect(result.mstEdges).toHaveLength(0);
  // No steps at all because the edge is pruned before entering the algorithm
  expect(result.steps).toHaveLength(0);
});

test('classic MST: 3-node graph picks the minimum spanning tree edges', () => {
  // Edge weights (1 - sim):
  //   0-1: 1 - 0.9 = 0.1
  //   1-2: 1 - 0.8 = 0.2
  //   0-2: 1 - 0.6 = 0.4
  // MST should include 0-1 and 1-2 (total 0.3), not 0-2
  const ids = userIds(3);
  const matrix = buildMatrix(3, [
    [0, 1, 0.9],
    [1, 2, 0.8],
    [0, 2, 0.6],
  ]);

  const result = kruskal(matrix, ids);

  expect(result.mstEdges).toHaveLength(2);

  const edgeSet = new Set(
    result.mstEdges.map(e => [e.u, e.v].sort().join('-'))
  );
  expect(edgeSet.has('user0-user1')).toBe(true);
  expect(edgeSet.has('user1-user2')).toBe(true);
  expect(edgeSet.has('user0-user2')).toBe(false);
});

test('no cycles: MST of n fully-connected nodes has exactly n-1 edges', () => {
  // 5 nodes all similar to each other (sim = 0.8 → weight = 0.2 ≤ 0.5)
  const n = 5;
  const edges: [number, number, number][] = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      edges.push([i, j, 0.8]);
    }
  }
  const ids = userIds(n);
  const matrix = buildMatrix(n, edges);

  const result = kruskal(matrix, ids);

  expect(result.mstEdges).toHaveLength(n - 1);
});

test('communities: disconnected groups produce separate communities', () => {
  // Group A: user0, user1 (sim = 0.9)
  // Group B: user2, user3 (sim = 0.8)
  // No edges between groups
  const ids = userIds(4);
  const matrix = buildMatrix(4, [
    [0, 1, 0.9],
    [2, 3, 0.8],
  ]);

  const result = kruskal(matrix, ids);

  expect(result.communities).toHaveLength(2);

  // Each community should contain exactly the expected members
  const communityStrings = result.communities
    .map(c => c.slice().sort().join(','))
    .sort();

  expect(communityStrings).toContain('user0,user1');
  expect(communityStrings).toContain('user2,user3');
});

test('steps: consider, add, and reject step types all appear for a 3-node graph', () => {
  // With 3 edges forming a triangle, the most expensive edge will be rejected
  const ids = userIds(3);
  const matrix = buildMatrix(3, [
    [0, 1, 0.9],
    [1, 2, 0.8],
    [0, 2, 0.6],
  ]);

  const { steps } = kruskal(matrix, ids);

  const types = new Set(steps.map(s => s.type));
  expect(types.has('consider')).toBe(true);
  expect(types.has('add')).toBe(true);
  expect(types.has('reject')).toBe(true);
});

test('steps: algorithm field is always "kruskal"', () => {
  const ids = userIds(3);
  const matrix = buildMatrix(3, [
    [0, 1, 0.8],
    [1, 2, 0.7],
  ]);

  const { steps } = kruskal(matrix, ids);

  for (const step of steps) {
    expect(step.algorithm).toBe('kruskal');
  }
});

test('totalCost accumulates correctly across add steps', () => {
  // Two edges get added:
  //   0-1: weight 0.1 (sim 0.9)
  //   1-2: weight 0.2 (sim 0.8)
  // Third edge 0-2 (weight 0.4) is rejected
  const ids = userIds(3);
  const matrix = buildMatrix(3, [
    [0, 1, 0.9],
    [1, 2, 0.8],
    [0, 2, 0.6],
  ]);

  const { steps } = kruskal(matrix, ids);

  const addSteps = steps.filter(s => s.type === 'add');
  expect(addSteps).toHaveLength(2);

  // totalCost on first add step should equal the weight of the first edge
  expect(addSteps[0].totalCost).toBeCloseTo(0.1, 5);
  // totalCost on second add step should be the sum of first two edges
  expect(addSteps[1].totalCost).toBeCloseTo(0.3, 5);
});

test('communities snapshot in steps reflects state at time of step', () => {
  // 4 nodes, edges added one by one — communities should grow
  const ids = userIds(4);
  const matrix = buildMatrix(4, [
    [0, 1, 0.9],   // weight 0.1
    [2, 3, 0.8],   // weight 0.2
    [1, 2, 0.7],   // weight 0.3
  ]);

  const { steps } = kruskal(matrix, ids);

  // After first 'add' step, there should be 3 communities (one merged pair + 2 singletons)
  const firstAdd = steps.find(s => s.type === 'add');
  expect(firstAdd).toBeDefined();
  expect(firstAdd!.communities.length).toBe(3);

  // After all edges are processed the final 'add' step should have 1 community
  const addSteps = steps.filter(s => s.type === 'add');
  const lastAdd = addSteps[addSteps.length - 1];
  expect(lastAdd.communities.length).toBe(1);
});
