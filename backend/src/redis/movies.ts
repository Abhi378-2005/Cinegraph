import { redis } from './client';
import type { Movie } from '../types';
import { getBQMovie, getBQPopular } from '../bigquery/movies';
import { searchMoviesBQ, getGenresBQ } from '../bigquery/search';
import { log, timer } from '../logger';

// Handles both JSON-encoded arrays (new: '["a","b"]') and raw comma strings (old: 'a,b')
function parseStringArray(value: string | undefined): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value as string[];   // Upstash auto-deserialized
  try { return JSON.parse(value); }
  catch { return value.split(',').map(s => s.trim()).filter(Boolean); }
}

export async function setMovie(movie: Movie): Promise<void> {
  await Promise.all([
    redis.hset(`movie:${movie.id}`, {
      title:        movie.title,
      overview:     movie.overview,
      posterPath:   movie.posterPath,
      backdropPath: movie.backdropPath ?? '',
      releaseYear:  String(movie.releaseYear),
      genres:       JSON.stringify(movie.genres),
      cast:         JSON.stringify(movie.cast),
      director:     movie.director,
      keywords:     JSON.stringify(movie.keywords),
      voteAverage:  String(movie.voteAverage),
      voteCount:    String(movie.voteCount),
      popularity:   String(movie.popularity),
      runtime:      String(movie.runtime),
    }),
    redis.sadd('movies:all', String(movie.id)),
    redis.hset('movies:titles', { [String(movie.id)]: movie.title }),
  ]);
}

export async function getMovie(id: number): Promise<Movie | null> {
  const elapsed = timer();
  const data = await redis.hgetall<Record<string, string>>(`movie:${id}`);
  if (data && data.title) {
    log.redis(`HIT  movie:${id} "${data.title}"  (${elapsed()})`);
    return {
      id,
      title:        data.title,
      overview:     data.overview ?? '',
      posterPath:   data.posterPath ?? '',
      backdropPath: data.backdropPath || undefined,
      releaseYear:  Number(data.releaseYear),
      genres:       parseStringArray(data.genres),
      cast:         parseStringArray(data.cast),
      director:     data.director ?? '',
      keywords:     parseStringArray(data.keywords),
      voteAverage:  Number(data.voteAverage),
      voteCount:    Number(data.voteCount),
      popularity:   Number(data.popularity),
      runtime:      Number(data.runtime),
    };
  }

  log.redis(`MISS movie:${id} → falling back to BigQuery`);
  const bqElapsed = timer();
  const movie = await getBQMovie(id);
  if (!movie) {
    log.redis(`MISS movie:${id} not found in BigQuery either  (${bqElapsed()})`);
    return null;
  }
  log.redis(`BQ   movie:${id} "${movie.title}" fetched in ${bqElapsed()} → caching in Redis`);
  await setMovie(movie);
  return movie;
}

export async function getAllMovieIds(): Promise<number[]> {
  const ids = await redis.smembers('movies:all');
  log.redis(`getAllMovieIds → ${ids.length} ids`);
  return ids.map(Number);
}

export async function getPopularMovieIds(genre?: string, limit = 50): Promise<number[]> {
  const key = genre ? `popular:${genre}` : 'popular:all';
  const elapsed = timer();
  const results = await redis.zrange(key, 0, limit - 1, { rev: true });
  if (results.length > 0) {
    log.redis(`HIT  ${key} → ${results.length} ids  (${elapsed()})`);
    return results.map(Number);
  }

  log.redis(`MISS ${key} → falling back to BigQuery`);
  const bqElapsed = timer();
  const movies = await getBQPopular(genre ?? '', limit);
  log.redis(`BQ   getBQPopular(${genre || 'all'}, ${limit}) → ${movies.length} movies  (${bqElapsed()})`);

  if (movies.length > 0) {
    const [first, ...rest] = movies.map(m => ({ score: m.voteAverage * 0.7 + m.popularity / 1000.0 * 0.3, member: String(m.id) }));
    await redis.zadd(key, first, ...rest);
    log.redis(`cached ${movies.length} ids → ${key}`);
  }

  return movies.map(m => m.id);
}

export async function searchMovies(
  query: string,
  genre = '',
  limit = 20
): Promise<Movie[]> {
  const q = query.toLowerCase().trim();
  const g = genre.toLowerCase().trim();
  const key = `search:${q}:${g}`;

  try {
    const cached = await redis.get<Movie[]>(key);
    if (cached) {
      log.redis(`HIT  ${key} → ${cached.length} results`);
      return cached;
    }
  } catch {
    log.redis(`WARN redis.get(${key}) failed — falling through to BigQuery`);
  }

  log.redis(`MISS ${key} → querying BigQuery`);
  const elapsed = timer();
  const movies = await searchMoviesBQ(q, g, limit);
  log.redis(`BQ   searchMovies("${q}", "${g}") → ${movies.length} results  (${elapsed()})`);

  try {
    await redis.set(key, movies, { ex: 3600 });
  } catch {
    log.redis(`WARN redis.set(${key}) failed — result not cached`);
  }

  return movies;
}

export async function getGenres(): Promise<string[]> {
  const key = 'movies:genres';

  try {
    const cached = await redis.get<string[]>(key);
    if (cached) {
      log.redis(`HIT  ${key} → ${cached.length} genres`);
      return cached;
    }
  } catch {
    log.redis(`WARN redis.get(${key}) failed — falling through to BigQuery`);
  }

  log.redis(`MISS ${key} → querying BigQuery`);
  const genres = await getGenresBQ();

  try {
    await redis.set(key, genres, { ex: 86400 });
  } catch {
    log.redis(`WARN redis.set(${key}) failed — genres not cached`);
  }

  return genres;
}
