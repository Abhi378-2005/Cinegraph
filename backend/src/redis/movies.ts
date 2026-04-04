import { redis } from './client';
import type { Movie } from '../types';
import { getBQMovie, getBQPopular } from '../bigquery/movies';
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

// KMP-based title search
function buildLPS(pattern: string): number[] {
  const lps = new Array<number>(pattern.length).fill(0);
  let len = 0, i = 1;
  while (i < pattern.length) {
    if (pattern[i] === pattern[len]) { lps[i++] = ++len; }
    else if (len !== 0) { len = lps[len - 1]; }
    else { lps[i++] = 0; }
  }
  return lps;
}

function kmpSearch(text: string, pattern: string): boolean {
  if (pattern.length === 0) return true;
  const lps = buildLPS(pattern);
  let i = 0, j = 0;
  while (i < text.length) {
    if (text[i] === pattern[j]) { i++; j++; }
    if (j === pattern.length) return true;
    else if (i < text.length && text[i] !== pattern[j]) {
      j !== 0 ? (j = lps[j - 1]) : i++;
    }
  }
  return false;
}

export async function searchMovies(query: string, limit = 20): Promise<Movie[]> {
  const elapsed = timer();
  const titles = await redis.hgetall<Record<string, string>>('movies:titles');
  if (!titles) {
    log.redis(`searchMovies("${query}") → movies:titles is empty`);
    return [];
  }

  const q = query.toLowerCase();
  const matchingIds: number[] = [];
  for (const [id, title] of Object.entries(titles)) {
    if (matchingIds.length >= limit) break;
    if (kmpSearch(title.toLowerCase(), q)) matchingIds.push(Number(id));
  }

  log.redis(`searchMovies("${query}") → ${matchingIds.length} matches from ${Object.keys(titles).length} titles  (${elapsed()})`);
  const movies = await Promise.all(matchingIds.map(id => getMovie(id)));
  return movies.filter((m): m is Movie => m !== null);
}
