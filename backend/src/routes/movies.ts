import { Router } from 'express';
import { getMovie, searchMovies, getGenres } from '../redis/movies';
import { getTopSimilar } from '../bigquery/similarity';
import { log, timer } from '../logger';

export const moviesRouter = Router();

// GET /movies/genres
moviesRouter.get('/genres', async (_req, res) => {
  try {
    const genres = await getGenres();
    res.json({ genres });
  } catch (err) {
    console.error('Genres error:', err);
    res.status(500).json({ error: 'Failed to load genres' });
  }
});

// GET /movies/search?q=<query>&genre=<genre>
moviesRouter.get('/search', async (req, res) => {
  const q = String(req.query.q ?? '').trim();
  const genre = String(req.query.genre ?? '').trim();
  if (!q && !genre) return res.status(400).json({ error: 'Provide q or genre' });

  log.http(`search  q="${q}" genre="${genre}"`);
  try {
    const elapsed = timer();
    const movies = await searchMovies(q, genre, 20);
    log.http(`search "${q}" genre="${genre}" → ${movies.length} results  (${elapsed()})`);
    res.json({ movies });
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Search failed' });
  }
});

// GET /movies/:id — returns { movie, similar: Movie[] }
moviesRouter.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid movie id' });
  try {
    const elapsed = timer();
    const movie = await getMovie(id);
    if (!movie) return res.status(404).json({ error: 'Movie not found' });

    log.http(`movie:${id} "${movie.title}" fetched  (${elapsed()})`);

    const simElapsed = timer();
    const similarEntries = await getTopSimilar(id, 6);
    const similarMovies = (
      await Promise.all(similarEntries.map(e => getMovie(e.similarMovieId)))
    ).filter((m): m is NonNullable<typeof m> => m !== null);

    log.http(`movie:${id} similar → ${similarMovies.length} movies  (${simElapsed()})`);
    res.json({ movie, similar: similarMovies });
  } catch (err) {
    console.error('Movie detail error:', err);
    res.status(500).json({ error: 'Failed to load movie' });
  }
});
