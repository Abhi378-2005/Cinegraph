import { getUserRatings, getPreferredGenres } from '../redis/ratings';
import { getPopularMovieIds, getMovie } from '../redis/movies';
import { getVector } from '../redis/vectors';
import { getTopSimilar } from '../bigquery/similarity';
import type { Recommendation } from '../types';

export async function contentBasedRecommend(
  userId: string,
  topN = 20
): Promise<Recommendation[]> {
  const ratings = await getUserRatings(userId);
  const ratedIds = Object.keys(ratings).map(Number);
  if (ratedIds.length === 0) return [];

  const ratedSet = new Set(ratedIds);

  // For each rated movie, get its pre-computed top-50 similar movies from BigQuery
  const candidateScores = new Map<number, number>();

  for (const ratedId of ratedIds) {
    const weight = ratings[ratedId] / 5;
    const similar = await getTopSimilar(ratedId, 50);
    for (const entry of similar) {
      if (ratedSet.has(entry.similarMovieId)) continue;
      const prev = candidateScores.get(entry.similarMovieId) ?? 0;
      candidateScores.set(entry.similarMovieId, prev + entry.score * weight);
    }
  }

  // Sort candidates by blended score
  const sorted = Array.from(candidateScores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN);

  const results: Recommendation[] = [];
  for (const [id, blendedScore] of sorted) {
    const movie = await getMovie(id);
    if (!movie) continue;
    const normalised = Math.min(1, blendedScore / ratedIds.length);
    results.push({
      movie,
      score: normalised * 5,
      matchPercent: Math.round(normalised * 100),
      reason: 'Similar to movies you\'ve rated highly',
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
