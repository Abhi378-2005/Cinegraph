import { Router } from 'express';
import { getAllUserIds, getUserRatings } from '../redis/ratings';
import { pearsonCorrelation } from '../ml/pearsonCorrelation';
import { floydWarshall } from '../algorithms/floydWarshall';
import { kruskal } from '../algorithms/kruskal';
import { randomUUID } from 'crypto';
import { getEmitter } from './recommend';

export const similarityRouter = Router();

// GET /similarity — fires async Floyd-Warshall + Kruskal job, returns { sessionId }
similarityRouter.get('/', async (req, res) => {
  const userId = req.headers['x-session-token'] as string;
  if (!userId) return res.status(401).json({ error: 'Missing X-Session-Token' });

  const sessionId = randomUUID();
  res.json({ sessionId });

  (async () => {
    try {
      const allIds = await getAllUserIds();
      const capped = allIds.slice(0, 20); // Floyd-Warshall cap at 20 users
      const ratingsMap: Record<string, Record<number, number>> = {};

      const ratings = await Promise.all(capped.map(uid => getUserRatings(uid)));
      capped.forEach((uid, i) => { ratingsMap[uid] = ratings[i]; });

      // Build Pearson similarity matrix
      const n = capped.length;
      const matrix: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
      for (let i = 0; i < n; i++) {
        matrix[i][i] = 1;
        for (let j = i + 1; j < n; j++) {
          const sim = Math.max(0, pearsonCorrelation(ratingsMap[capped[i]], ratingsMap[capped[j]]));
          matrix[i][j] = matrix[j][i] = sim;
        }
      }

      // Floyd-Warshall — stream steps
      const { steps: fwSteps } = floydWarshall(matrix, capped);
      for (const step of fwSteps) {
        getEmitter()?.(userId, 'algo:step', { algorithm: 'floydWarshall', step });
        await new Promise(r => setTimeout(r, 16));
      }
      getEmitter()?.(userId, 'algo:complete', { algorithm: 'floydWarshall', durationMs: 0, totalSteps: fwSteps.length });

      // Kruskal MST — up to 50 users for community detection
      const allIds50 = allIds.slice(0, 50);
      const allRatings: Record<string, Record<number, number>> = { ...ratingsMap };
      const cappedSet = new Set(capped);
      const extraIds = allIds50.filter(id => !cappedSet.has(id));
      const extraRatings = await Promise.all(extraIds.map(uid => getUserRatings(uid)));
      extraIds.forEach((uid, i) => { allRatings[uid] = extraRatings[i]; });
      const n50 = allIds50.length;
      const bigMatrix: number[][] = Array.from({ length: n50 }, () => new Array(n50).fill(0));
      for (let i = 0; i < n50; i++) {
        bigMatrix[i][i] = 1;
        for (let j = i + 1; j < n50; j++) {
          const sim = Math.max(0, pearsonCorrelation(allRatings[allIds50[i]], allRatings[allIds50[j]]));
          bigMatrix[i][j] = bigMatrix[j][i] = sim;
        }
      }

      const { communities, mstEdges, steps: kruskalSteps } = kruskal(bigMatrix, allIds50);

      // Stream Kruskal MST steps at ~60fps
      for (const step of kruskalSteps) {
        getEmitter()?.(userId, 'algo:step', { algorithm: 'kruskal', step });
        await new Promise(r => setTimeout(r, 16));
      }
      getEmitter()?.(userId, 'algo:complete', { algorithm: 'kruskal', durationMs: 0, totalSteps: kruskalSteps.length });
      getEmitter()?.(userId, 'community:update', { communities, mstEdges });
    } catch (err) {
      console.error('Similarity job failed:', err);
      getEmitter()?.(userId, 'similarity:error', { message: 'Similarity computation failed' });
    }
  })();
});
