import type { Movie, Recommendation } from '../types';

export function greedyTopK(
  movies: Movie[],
  preferredGenres: string[],
  topN = 20,
  maxPopularity = 1000
): Recommendation[] {
  const scored = movies
    .filter(m => m.genres.some(g => preferredGenres.includes(g)))
    .map(m => {
      const popNorm = Math.min(1, m.popularity / maxPopularity);
      const score = (m.voteAverage / 10) * 0.7 + popNorm * 0.3;
      return { movie: m, score };
    });

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, topN).map(({ movie, score }) => ({
    movie,
    score: score * 5,
    matchPercent: Math.round(score * 100),
    reason: `Top rated ${preferredGenres[0] ?? 'movie'}`,
    engine: 'cold_start' as const,
  }));
}
