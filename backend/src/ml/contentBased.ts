import { getUserRatings, getPreferredGenres } from '../redis/ratings';
import { getAllMovieIds, getMovie, getPopularMovieIds } from '../redis/movies';
import { getVector } from '../redis/vectors';
import { cosineSimilarity } from './cosineSimilarity';
import type { Recommendation } from '../types';

export async function contentBasedRecommend(
  userId: string,
  topN = 20
): Promise<Recommendation[]> {
  const ratings = await getUserRatings(userId);
  const ratedIds = Object.keys(ratings).map(Number);

  if (ratedIds.length === 0) return [];

  // Build taste profile: weighted average of rated movie vectors (weight = rating/5)
  const profile = new Array<number>(40).fill(0);
  let totalWeight = 0;
  for (const id of ratedIds) {
    const vec = await getVector(id);
    if (!vec) continue;
    const w = ratings[id] / 5;
    for (let i = 0; i < vec.length; i++) profile[i] += vec[i] * w;
    totalWeight += w;
  }
  if (totalWeight === 0) return [];
  for (let i = 0; i < profile.length; i++) profile[i] /= totalWeight;

  // Score all unrated movies
  const allIds = await getAllMovieIds();
  const ratedSet = new Set(ratedIds);
  const scored: { id: number; sim: number }[] = [];

  for (const id of allIds) {
    if (ratedSet.has(id)) continue;
    const vec = await getVector(id);
    if (!vec) continue;
    scored.push({ id, sim: cosineSimilarity(profile, vec) });
  }

  scored.sort((a, b) => b.sim - a.sim);
  const top = scored.slice(0, topN);

  const results: Recommendation[] = [];
  for (const { id, sim } of top) {
    const movie = await getMovie(id);
    if (!movie) continue;
    results.push({
      movie,
      score: sim * 5,
      matchPercent: Math.round(sim * 100),
      reason: `Similar to movies you've rated highly`,
      engine: 'content',
      similarMovies: ratedIds.slice(0, 3),
    });
  }
  return results;
}

export async function getTopPopularForGenres(
  genres: string[],
  topN = 20
): Promise<Recommendation[]> {
  const seen = new Set<number>();
  const results: Recommendation[] = [];
  for (const genre of genres) {
    const ids = await getPopularMovieIds(genre, 20);
    for (const id of ids) {
      if (seen.has(id) || results.length >= topN) continue;
      seen.add(id);
      const movie = await getMovie(id);
      if (!movie) continue;
      const score = (movie.voteAverage * 0.7) + 0.3;
      results.push({
        movie, score,
        matchPercent: Math.round((score / 5) * 100),
        reason: `Top rated ${genre} movie`,
        engine: 'cold_start',
      });
    }
  }
  return results.slice(0, topN);
}
