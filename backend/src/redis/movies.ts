import { redis } from './client';
import type { Movie } from '../types';

export async function setMovie(movie: Movie): Promise<void> {
  await Promise.all([
    redis.hset(`movie:${movie.id}`, {
      title: movie.title,
      overview: movie.overview,
      posterPath: movie.posterPath,
      backdropPath: movie.backdropPath ?? '',
      releaseYear: String(movie.releaseYear),
      genres: JSON.stringify(movie.genres),
      cast: JSON.stringify(movie.cast),
      director: movie.director,
      keywords: JSON.stringify(movie.keywords),
      voteAverage: String(movie.voteAverage),
      voteCount: String(movie.voteCount),
      popularity: String(movie.popularity),
      runtime: String(movie.runtime),
    }),
    redis.sadd('movies:all', String(movie.id)),
    redis.hset('movies:titles', { [String(movie.id)]: movie.title }),
  ]);
}

export async function getMovie(id: number): Promise<Movie | null> {
  const data = await redis.hgetall<Record<string, string>>(`movie:${id}`);
  if (!data || !data.title) return null;
  return {
    id,
    title: data.title,
    overview: data.overview ?? '',
    posterPath: data.posterPath ?? '',
    backdropPath: data.backdropPath || undefined,
    releaseYear: Number(data.releaseYear),
    genres: JSON.parse(data.genres ?? '[]'),
    cast: JSON.parse(data.cast ?? '[]'),
    director: data.director ?? '',
    keywords: JSON.parse(data.keywords ?? '[]'),
    voteAverage: Number(data.voteAverage),
    voteCount: Number(data.voteCount),
    popularity: Number(data.popularity),
    runtime: Number(data.runtime),
  };
}

export async function getAllMovieIds(): Promise<number[]> {
  const ids = await redis.smembers('movies:all');
  return ids.map(Number);
}

export async function getPopularMovieIds(genre?: string, limit = 50): Promise<number[]> {
  const key = genre ? `popular:${genre}` : 'popular:all';
  const results = await redis.zrange(key, 0, limit - 1, { rev: true });
  return results.map(Number);
}

// KMP-based title search — implements KMP string matching algorithm from scratch
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
  // One Redis call to get all titles
  const titles = await redis.hgetall<Record<string, string>>('movies:titles');
  if (!titles) return [];

  const q = query.toLowerCase();
  const matchingIds: number[] = [];

  for (const [id, title] of Object.entries(titles)) {
    if (matchingIds.length >= limit) break;
    if (kmpSearch(title.toLowerCase(), q)) matchingIds.push(Number(id));
  }

  // Only fetch full movie objects for matches
  const movies = await Promise.all(matchingIds.map(id => getMovie(id)));
  return movies.filter((m): m is Movie => m !== null);
}
