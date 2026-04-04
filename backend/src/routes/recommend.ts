import { Router } from 'express';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { getRecommendations } from '../ml/hybrid';
import { mergeSort } from '../algorithms/mergeSort';
import { knapsack } from '../algorithms/knapsack';
import { setPreferredGenres } from '../redis/ratings';
import { log, timer } from '../logger';

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
recommendRouter.post('/', async (req, res) => {
  const userId = req.headers['x-session-token'] as string;
  if (!userId) return res.status(401).json({ error: 'Missing X-Session-Token' });

  const parsed = recommendSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { engine, budget, genres } = parsed.data;
  const sessionId = randomUUID();

  log.recommend(`START  user=${userId.slice(0, 12)}  engine=${engine}  budget=${budget ?? 'none'}  genres=[${(genres ?? []).join(', ')}]`);

  if (genres && genres.length > 0) {
    await setPreferredGenres(userId, genres);
  }

  res.json({ sessionId });

  (async () => {
    const elapsed = timer();
    try {
      log.recommend(`running getRecommendations  user=${userId.slice(0, 12)}  engine=${engine}`);
      const recs = await getRecommendations(userId, engine);
      log.recommend(`got ${recs.length} recs  (${elapsed()})  — running mergeSort`);

      const sortStart = timer();
      const { sorted, steps: sortSteps } = mergeSort(recs);
      log.recommend(`mergeSort done  steps=${sortSteps.length}  (${sortStart()})`);

      for (const step of sortSteps) {
        emitToUser?.(userId, 'algo:step', { sessionId, algorithm: 'mergeSort', step });
        await new Promise(r => setTimeout(r, 16));
      }
      emitToUser?.(userId, 'algo:complete', { sessionId, algorithm: 'mergeSort', durationMs: 0, totalSteps: sortSteps.length });

      let finalRecs = sorted;

      if (budget !== undefined) {
        log.recommend(`running knapsack  budget=${budget}  items=${sorted.length}`);
        const kStart = timer();
        const { selected, steps: kSteps } = knapsack(sorted, budget);
        log.recommend(`knapsack done  selected=${selected.length}  steps=${kSteps.length}  (${kStart()})`);
        for (const step of kSteps) {
          emitToUser?.(userId, 'algo:step', { sessionId, algorithm: 'knapsack', step });
          await new Promise(r => setTimeout(r, 16));
        }
        emitToUser?.(userId, 'algo:complete', { sessionId, algorithm: 'knapsack', durationMs: 0, totalSteps: kSteps.length });
        finalRecs = selected;
      }

      log.recommend(`DONE  user=${userId.slice(0, 12)}  finalRecs=${finalRecs.length}  total=${elapsed()}  — emitting recommend:ready`);
      emitToUser?.(userId, 'recommend:ready', { sessionId, recommendations: finalRecs, engine });

      if (!emitToUser) {
        log.recommend(`WARN no emitter set — recommend:ready was not delivered`);
      }
    } catch (err) {
      log.recommend(`ERROR  user=${userId.slice(0, 12)}  ${err instanceof Error ? err.message : String(err)}`);
      console.error('Recommendation job failed:', err);
      emitToUser?.(userId, 'recommend:error', { message: 'Recommendation job failed' });
    }
  })();
});
