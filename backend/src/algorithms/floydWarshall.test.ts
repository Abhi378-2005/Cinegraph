import { floydWarshall } from './floydWarshall';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Build an n×n identity-like matrix (1 on diagonal, 0 elsewhere). */
function identityMatrix(n: number): number[][] {
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (__, j) => (i === j ? 1 : 0))
  );
}

/** Build user IDs array of length n. */
function userIds(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `user${i}`);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test('empty matrix returns empty result', () => {
  const result = floydWarshall([], []);
  expect(result.matrix).toEqual([]);
  expect(result.steps).toEqual([]);
});

test('2x2 matrix: direct similarity values are preserved', () => {
  const matrix = [
    [1.0, 0.6],
    [0.6, 1.0],
  ];
  const ids = userIds(2);
  const { matrix: out } = floydWarshall(matrix, ids);

  expect(out).toHaveLength(2);
  expect(out[0]).toHaveLength(2);
  // Diagonal must stay 1
  expect(out[0][0]).toBe(1.0);
  expect(out[1][1]).toBe(1.0);
  // Direct link: 0.6 — should not decrease
  expect(out[0][1]).toBeGreaterThanOrEqual(0.6);
  expect(out[1][0]).toBeGreaterThanOrEqual(0.6);
});

test('transitive path: A→B=0.8, B→C=0.7, A→C starts at 0.1 → should become 0.56', () => {
  // 3 nodes: 0=A, 1=B, 2=C
  // Direct: A→B=0.8, B→C=0.7, A→C=0.1 (plus symmetric values)
  const matrix = [
    [1.0, 0.8, 0.1],
    [0.8, 1.0, 0.7],
    [0.1, 0.7, 1.0],
  ];
  const ids = userIds(3);
  const { matrix: out } = floydWarshall(matrix, ids);

  // Transitive path A→B→C = 0.8 * 0.7 = 0.56  >  direct 0.1
  expect(out[0][2]).toBeCloseTo(0.56, 5);
  expect(out[2][0]).toBeCloseTo(0.56, 5);
});

test('caps at 20 users: passing 25-user matrix produces 20x20 output', () => {
  const n = 25;
  const matrix = identityMatrix(n);
  // Add some non-zero off-diagonal values so the algorithm has work to do
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i !== j) matrix[i][j] = 0.3;
    }
  }

  const ids = userIds(n);
  const { matrix: out } = floydWarshall(matrix, ids);

  expect(out).toHaveLength(20);
  out.forEach(row => expect(row).toHaveLength(20));
});

test('steps array: both updated and non-updated steps exist for a 3x3 matrix', () => {
  const matrix = [
    [1.0, 0.8, 0.1],
    [0.8, 1.0, 0.7],
    [0.1, 0.7, 1.0],
  ];
  const ids = userIds(3);
  const { steps } = floydWarshall(matrix, ids);

  expect(steps.length).toBeGreaterThan(0);

  const updatedSteps    = steps.filter(s => s.updated);
  const nonUpdatedSteps = steps.filter(s => !s.updated);

  expect(updatedSteps.length).toBeGreaterThan(0);
  expect(nonUpdatedSteps.length).toBeGreaterThan(0);
});

test('steps never include i===j (diagonal skipped)', () => {
  const matrix = [
    [1.0, 0.5, 0.3],
    [0.5, 1.0, 0.4],
    [0.3, 0.4, 1.0],
  ];
  const ids = userIds(3);
  const { steps } = floydWarshall(matrix, ids);

  const diagonalSteps = steps.filter(s => s.i === s.j);
  expect(diagonalSteps).toHaveLength(0);
});

test('result matrix values remain in [0,1] range', () => {
  const n = 5;
  const matrix = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (__, j) =>
      i === j ? 1.0 : Math.random() * 0.9
    )
  );
  const ids = userIds(n);
  const { matrix: out } = floydWarshall(matrix, ids);

  out.forEach(row =>
    row.forEach(val => {
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(1);
    })
  );
});
