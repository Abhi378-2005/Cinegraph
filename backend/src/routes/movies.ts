import { Router } from 'express';
import { getMovie, searchMovies, getAllMovieIds } from '../redis/movies';
import { getVector } from '../redis/vectors';
import { cosineSimilarity } from '../ml/cosineSimilarity';

export const moviesRouter = Router();

// GET /movies/search?q=<query>
moviesRouter.get('/search', async (req, res) => {
  try {
    const q = String(req.query.q ?? '').trim();
    if (!q) return res.json({ movies: [] });
    const movies = await searchMovies(q, 20);
    res.json({ movies });
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Search failed' });
  }
});

// GET /movies/:id — returns { movie, similar: Movie[] }
// Find top-6 similar movies by cosine similarity on feature vectors
// Use Promise.all to fetch vectors in parallel for performance
moviesRouter.get('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid movie id' });

    const movie = await getMovie(id);
    if (!movie) return res.status(404).json({ error: 'Movie not found' });

    const vec = await getVector(id);
    const allIds = await getAllMovieIds();
    const similar: { id: number; sim: number }[] = [];

    if (vec) {
      const otherEntries = allIds.filter(otherId => otherId !== id);
      const otherVecs = await Promise.all(otherEntries.map(otherId => getVector(otherId)));
      for (let i = 0; i < otherEntries.length; i++) {
        const otherVec = otherVecs[i];
        if (otherVec) similar.push({ id: otherEntries[i], sim: cosineSimilarity(vec, otherVec) });
      }
      similar.sort((a, b) => b.sim - a.sim);
    }

    const top6 = similar.slice(0, 6);
    const top6Movies = await Promise.all(top6.map(({ id: sid }) => getMovie(sid)));
    const similarMovies = top6Movies.filter((m): m is NonNullable<typeof m> => m !== null);

    res.json({ movie, similar: similarMovies });
  } catch (err) {
    console.error('Movie detail error:', err);
    res.status(500).json({ error: 'Failed to load movie' });
  }
});
