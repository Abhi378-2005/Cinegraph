import type { FloydStep } from '../types';

export interface FloydResult {
  matrix: number[][];
  steps:  FloydStep[];
}

/**
 * Transitive Similarity Propagation via Floyd-Warshall.
 *
 * Instead of shortest-path, we propagate indirect similarities:
 *   dist[i][j] = max(dist[i][j],  dist[i][k] * dist[k][j])
 *
 * Similarities are in [0,1], so multiplication chains them correctly.
 * Capped at 20 users to keep step counts reasonable (20³ = 8 000 steps).
 */
export function floydWarshall(
  similarityMatrix: number[][],
  userIds: string[]
): FloydResult {
  if (similarityMatrix.length === 0 || userIds.length === 0) {
    return { matrix: [], steps: [] };
  }

  // Cap at 20 users
  const MAX_USERS = 20;
  const n   = Math.min(userIds.length, MAX_USERS, similarityMatrix.length);

  // Deep-copy the (possibly sliced) matrix
  const dist: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (__, j) =>
      (similarityMatrix[i]?.[j] ?? 0)
    )
  );

  const steps: FloydStep[] = [];
  let updateCount = 0;

  for (let k = 0; k < n; k++) {
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        // Skip diagonal — self-similarity stays as-is
        if (i === j) continue;

        const oldVal = dist[i][j];
        const newVal = dist[i][k] * dist[k][j];

        if (newVal > oldVal) {
          updateCount++;

          // Include matrixSnapshot every 100th actual update
          const snapshot: number[][] | undefined =
            updateCount % 100 === 0
              ? dist.map(row => [...row])
              : undefined;

          // Apply update AFTER snapshot (snapshot reflects state before this update)
          dist[i][j] = newVal;

          steps.push({
            k, i, j,
            oldVal,
            newVal,
            updated: true,
            ...(snapshot !== undefined ? { matrixSnapshot: snapshot } : {}),
          });
        } else {
          steps.push({
            k, i, j,
            oldVal,
            newVal,  // the actual candidate dist[i][k] * dist[k][j] that was considered but rejected
            updated: false,
          });
        }
      }
    }
  }

  return { matrix: dist, steps };
}
