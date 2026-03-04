import { Router } from 'express';
import { z } from 'zod';
import { setRating, computeAndSetPhase, getRatingCount } from '../redis/ratings';

export const rateRouter = Router();

// Validates: { movieId: number (int, positive), rating: number (1-5) }
const rateSchema = z.object({
  movieId: z.number().int().positive(),
  rating: z.number().min(1).max(5),
});

// POST /rate — userId from X-Session-Token header
rateRouter.post('/', async (req, res) => {
  const userId = req.headers['x-session-token'] as string;
  if (!userId) return res.status(401).json({ error: 'Missing X-Session-Token' });

  const parsed = rateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const { movieId, rating } = parsed.data;
    await setRating(userId, movieId, Math.round(rating));
    const newPhase = await computeAndSetPhase(userId);
    const ratingsCount = await getRatingCount(userId);
    res.json({ success: true, newPhase, ratingsCount });
  } catch (err) {
    console.error('Rate error:', err);
    res.status(500).json({ error: 'Failed to save rating' });
  }
});
