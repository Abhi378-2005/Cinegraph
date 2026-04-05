import { Router } from 'express';
import { getUserRatings, getPhase, getRatingCount } from '../redis/ratings';
import { getMovie } from '../redis/movies';
import { log } from '../logger';

export const profileRouter = Router();

// GET /profile — returns user phase, rating count, and all rated movies with details
profileRouter.get('/', async (req, res) => {
  const userId = req.headers['x-session-token'] as string;
  if (!userId) return res.status(401).json({ error: 'Missing X-Session-Token' });

  try {
    const [ratings, phase, ratingsCount] = await Promise.all([
      getUserRatings(userId),
      getPhase(userId),
      getRatingCount(userId),
    ]);

    // Resolve movie details for each rating in parallel
    const entries = Object.entries(ratings) as [string, number][];
    const ratedMovies = (
      await Promise.all(
        entries.map(async ([movieId, rating]) => {
          const movie = await getMovie(Number(movieId));
          if (!movie) return null;
          return {
            movieId: Number(movieId),
            rating,
            title: movie.title,
            posterPath: movie.posterPath,
            releaseYear: movie.releaseYear,
            voteAverage: movie.voteAverage,
          };
        })
      )
    )
      .filter((m): m is NonNullable<typeof m> => m !== null)
      .sort((a, b) => b.rating - a.rating);

    const nextPhaseAt = phase === 'cold' ? 5 : phase === 'warming' ? 20 : null;

    log.http(`profile  user=${userId.slice(0, 12)}  phase=${phase}  ratings=${ratingsCount}`);
    res.json({ phase, ratingsCount, nextPhaseAt, ratedMovies });
  } catch (err) {
    console.error('Profile error:', err);
    res.status(500).json({ error: 'Failed to load profile' });
  }
});

// GET /profile/:userId/top-movies — top 3 movies by rating for a given user
// Used by the graph page node expansion feature
profileRouter.get('/:userId/top-movies', async (req, res) => {
  const { userId } = req.params;
  if (!userId) return res.status(400).json({ error: 'Missing userId' });

  try {
    const ratings = await getUserRatings(userId);
    const sorted = Object.entries(ratings)
      .map(([id, r]) => ({ movieId: Number(id), rating: r }))
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 3);

    const movies = (
      await Promise.all(
        sorted.map(async ({ movieId, rating }) => {
          const movie = await getMovie(movieId);
          if (!movie) return null;
          return { movieId, title: movie.title, posterPath: movie.posterPath, rating };
        })
      )
    ).filter((m): m is NonNullable<typeof m> => m !== null);

    res.json({ movies });
  } catch (err) {
    console.error('top-movies error:', err);
    res.status(500).json({ error: 'Failed to fetch top movies' });
  }
});
