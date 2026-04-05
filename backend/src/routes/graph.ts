import { Router } from 'express';
import { randomUUID } from 'crypto';
import { getAllUserIds, getUserRatings } from '../redis/ratings';
import { pearsonCorrelation } from '../ml/pearsonCorrelation';
import { kruskal } from '../algorithms/kruskal';
import { floydWarshall } from '../algorithms/floydWarshall';
import { dijkstra } from '../algorithms/dijkstra';
import { log, timer } from '../logger';

// Emitter — set by socketServer after initialization
export let emitGraphToUser: ((userId: string, event: string, data: unknown) => void) | null = null;
export function setGraphEmitter(fn: typeof emitGraphToUser): void { emitGraphToUser = fn; }

export const graphRouter = Router();

const MAX_USERS = 20;
const STEP_DELAY_MS = 16;

/** Build pairwise Pearson similarity matrix for up to MAX_USERS users. */
async function buildSimilarityMatrix(userIds: string[]): Promise<number[][]> {
  const n = userIds.length;
  const ratingsArr = await Promise.all(userIds.map(uid => getUserRatings(uid)));
  const ratingsMap: Record<string, Record<number, number>> = {};
  userIds.forEach((uid, i) => { ratingsMap[uid] = ratingsArr[i]; });

  const matrix: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    matrix[i][i] = 1;
    for (let j = i + 1; j < n; j++) {
      const sim = Math.max(0, pearsonCorrelation(ratingsMap[userIds[i]], ratingsMap[userIds[j]]));
      matrix[i][j] = matrix[j][i] = sim;
    }
  }
  return matrix;
}

// POST /graph/compute
graphRouter.post('/compute', async (req, res) => {
  const userId = req.headers['x-session-token'] as string;
  if (!userId) return res.status(401).json({ error: 'Missing X-Session-Token' });

  const graphSessionId = randomUUID();
  res.json({ graphSessionId });

  (async () => {
    const elapsed = timer();
    try {
      // 1. Fetch users (capped at MAX_USERS)
      const allIds = await getAllUserIds();
      const userIds = allIds.slice(0, MAX_USERS);
      log.recommend(`[graph] users=${userIds.length}  session=${graphSessionId.slice(0, 8)}`);

      if (userIds.length < 2) {
        emitGraphToUser?.(userId, 'graph:complete', {
          graphSessionId, userIds, similarityMatrix: [],
          mstEdges: [], communities: [], dijkstraPath: [], dijkstraTarget: '',
        });
        return;
      }

      // 2. Build similarity matrix
      const matrix = await buildSimilarityMatrix(userIds);

      // 3. Kruskal — stream all steps
      const kStart = timer();
      const { mstEdges, communities, steps: kSteps } = kruskal(matrix, userIds);
      log.recommend(`[graph] kruskal steps=${kSteps.length}  (${kStart()})`);
      for (const step of kSteps) {
        emitGraphToUser?.(userId, 'graph:step', { graphSessionId, algorithm: 'kruskal', step });
        await new Promise(r => setTimeout(r, STEP_DELAY_MS));
      }

      // 4. Floyd-Warshall — only emit snapshot steps (matrixSnapshot defined)
      const fStart = timer();
      const { steps: fSteps } = floydWarshall(matrix, userIds);
      const fSnapshots = fSteps.filter(s => s.matrixSnapshot !== undefined);
      log.recommend(`[graph] floyd steps=${fSteps.length}  snapshots=${fSnapshots.length}  (${fStart()})`);
      for (const step of fSnapshots) {
        emitGraphToUser?.(userId, 'graph:step', { graphSessionId, algorithm: 'floydWarshall', step });
        await new Promise(r => setTimeout(r, STEP_DELAY_MS));
      }

      // 5. Dijkstra — source = current user, target = closest neighbor
      const sourceIdx = userIds.indexOf(userId);
      let targetIdx = -1;
      if (sourceIdx !== -1) {
        let maxSim = -1;
        for (let j = 0; j < userIds.length; j++) {
          if (j !== sourceIdx && matrix[sourceIdx][j] > maxSim) {
            maxSim = matrix[sourceIdx][j];
            targetIdx = j;
          }
        }
      }
      // Fall back: source=0, target=1
      const src = sourceIdx !== -1 ? sourceIdx : 0;
      const tgt = targetIdx !== -1 ? targetIdx : 1;

      const dStart = timer();
      const { path: dijkstraPath, steps: dSteps } = dijkstra(matrix, userIds, src, tgt);
      log.recommend(`[graph] dijkstra path=${dijkstraPath.length}  steps=${dSteps.length}  (${dStart()})`);
      for (const step of dSteps) {
        emitGraphToUser?.(userId, 'graph:step', { graphSessionId, algorithm: 'dijkstra', step });
        await new Promise(r => setTimeout(r, STEP_DELAY_MS));
      }

      // 6. Complete
      log.recommend(`[graph] DONE  total=${elapsed()}`);
      emitGraphToUser?.(userId, 'graph:complete', {
        graphSessionId,
        userIds,
        similarityMatrix: matrix,
        mstEdges,
        communities,
        dijkstraPath,
        dijkstraTarget: userIds[tgt] ?? '',
      });
    } catch (err) {
      log.recommend(`[graph] compute error: ${err instanceof Error ? err.message : String(err)}`);
      emitGraphToUser?.(userId, 'graph:error', { message: 'Graph computation failed' });
    }
  })();
});
