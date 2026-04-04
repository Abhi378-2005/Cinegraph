import { getPhase, getPreferredGenres } from '../redis/ratings';
import { contentBasedRecommend, getTopPopularForGenres } from './contentBased';
import { collaborativeRecommend } from './collaborative';
import type { Recommendation } from '../types';
import { log, timer } from '../logger';

export async function getRecommendations(
  userId: string,
  engine: 'content' | 'collaborative' | 'hybrid' | 'cold_start',
  topN = 20
): Promise<Recommendation[]> {
  const elapsed = timer();
  const phase = await getPhase(userId);
  log.ml(`getRecommendations  user=${userId.slice(0, 12)}  engine=${engine}  phase=${phase}`);

  if (engine === 'cold_start' || phase === 'cold') {
    const genres = await getPreferredGenres(userId);
    const effective = genres.length > 0 ? genres : ['Action', 'Drama'];
    log.ml(`cold_start path  genres=[${effective.join(', ')}]`);
    const recs = await getTopPopularForGenres(effective, topN);
    log.ml(`cold_start → ${recs.length} recommendations  (${elapsed()})`);
    return recs;
  }

  if (engine === 'content' || phase === 'warming') {
    log.ml(`content-based path`);
    const recs = await contentBasedRecommend(userId, topN);
    log.ml(`content-based → ${recs.length} recommendations  (${elapsed()})`);
    return recs;
  }

  if (engine === 'collaborative') {
    log.ml(`collaborative path`);
    const recs = await collaborativeRecommend(userId, topN);
    log.ml(`collaborative → ${recs.length} recommendations  (${elapsed()})`);
    return recs;
  }

  // hybrid: interleave content + collaborative results
  log.ml(`hybrid path — running content + collaborative in parallel`);
  const [contentRecs, collabRecs] = await Promise.all([
    contentBasedRecommend(userId, topN),
    collaborativeRecommend(userId, topN),
  ]);
  log.ml(`hybrid  content=${contentRecs.length}  collab=${collabRecs.length}`);

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
  const result = blended.slice(0, topN);
  log.ml(`hybrid → ${result.length} recommendations  (${elapsed()})`);
  return result;
}
