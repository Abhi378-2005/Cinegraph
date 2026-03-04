import { getPhase, getPreferredGenres } from '../redis/ratings';
import { contentBasedRecommend, getTopPopularForGenres } from './contentBased';
import { collaborativeRecommend } from './collaborative';
import type { Recommendation } from '../types';

export async function getRecommendations(
  userId: string,
  engine: 'content' | 'collaborative' | 'hybrid' | 'cold_start',
  topN = 20
): Promise<Recommendation[]> {
  const phase = await getPhase(userId);

  if (engine === 'cold_start' || phase === 'cold') {
    const genres = await getPreferredGenres(userId);
    return getTopPopularForGenres(
      genres.length > 0 ? genres : ['Action', 'Drama'],
      topN
    );
  }

  if (engine === 'content' || phase === 'warming') {
    return contentBasedRecommend(userId, topN);
  }

  if (engine === 'collaborative') {
    return collaborativeRecommend(userId, topN);
  }

  // hybrid: interleave content + collaborative results
  const [contentRecs, collabRecs] = await Promise.all([
    contentBasedRecommend(userId, topN),
    collaborativeRecommend(userId, topN),
  ]);

  const seen = new Set<number>();
  const blended: Recommendation[] = [];
  const maxLen = Math.max(contentRecs.length, collabRecs.length);

  for (let i = 0; i < maxLen; i++) {
    for (const rec of [contentRecs[i], collabRecs[i]]) {
      if (rec && !seen.has(rec.movie.id)) {
        seen.add(rec.movie.id);
        blended.push({ ...rec, engine: 'hybrid' });
      }
    }
  }
  return blended.slice(0, topN);
}
