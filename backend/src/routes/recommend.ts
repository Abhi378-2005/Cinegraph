import { Router } from 'express';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { getRecommendations } from '../ml/hybrid';
import { mergeSort } from '../algorithms/mergeSort';
import { knapsack } from '../algorithms/knapsack';
import { setPreferredGenres } from '../redis/ratings';

// Emitter function — set by socketServer after initialization
export let emitToUser: ((userId: string, event: string, data: unknown) => void) | null = null;
export function setEmitter(fn: typeof emitToUser): void { emitToUser = fn; }
export function getEmitter() { return emitToUser; }

export const recommendRouter = Router();

const recommendSchema = z.object({
  engine: z.enum(['content', 'collaborative', 'hybrid', 'cold_start']),
  budget: z.number().int().positive().optional(),
  genres: z.array(z.string()).optional(),
});

// POST /recommend — fires async job, returns { sessionId } immediately
// Async job streams algo steps via socket, then emits recommend:ready
recommendRouter.post('/', async (req, res) => {
  const userId = req.headers['x-session-token'] as string;
  if (!userId) return res.status(401).json({ error: 'Missing X-Session-Token' });

  const parsed = recommendSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { engine, budget, genres } = parsed.data;
  const sessionId = randomUUID();

  if (genres && genres.length > 0) {
    await setPreferredGenres(userId, genres);
  }

  // Return sessionId immediately — background job streams the results
  res.json({ sessionId });

  // Fire-and-forget background job
  (async () => {
    try {
      const recs = await getRecommendations(userId, engine);
      const { sorted, steps: sortSteps } = mergeSort(recs);

      // Stream merge sort steps at ~60fps cap
      for (const step of sortSteps) {
        emitToUser?.(userId, 'algo:step', { algorithm: 'mergeSort', step });
        await new Promise(r => setTimeout(r, 16));
      }
      emitToUser?.(userId, 'algo:complete', { algorithm: 'mergeSort', durationMs: 0, totalSteps: sortSteps.length });

      let finalRecs = sorted;

      // If budget provided, run knapsack and stream those steps too
      if (budget !== undefined) {
        const { selected, steps: kSteps } = knapsack(sorted, budget);
        for (const step of kSteps) {
          emitToUser?.(userId, 'algo:step', { algorithm: 'knapsack', step });
          await new Promise(r => setTimeout(r, 16));
        }
        emitToUser?.(userId, 'algo:complete', { algorithm: 'knapsack', durationMs: 0, totalSteps: kSteps.length });
        finalRecs = selected;
      }

      emitToUser?.(userId, 'recommend:ready', { recommendations: finalRecs, engine });
    } catch (err) {
      console.error('Recommendation job failed:', err);
      emitToUser?.(userId, 'recommend:error', { message: 'Recommendation job failed' });
    }
  })();
});
