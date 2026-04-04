import { getUserRatings, getAllUserIds } from '../redis/ratings';
import { getMovie } from '../redis/movies';
import { pearsonCorrelation } from './pearsonCorrelation';
import type { Recommendation } from '../types';
import { log, timer } from '../logger';

export async function collaborativeRecommend(
  userId: string,
  topN = 20,
  K = 10
): Promise<Recommendation[]> {
  const elapsed = timer();
  const [userRatings, allUserIds] = await Promise.all([
    getUserRatings(userId),
    getAllUserIds(),
  ]);

  if (Object.keys(userRatings).length === 0) {
    log.ml(`collaborative user=${userId.slice(0, 12)} → no ratings, returning []`);
    return [];
  }

  log.ml(`collaborative user=${userId.slice(0, 12)}  userRatings=${Object.keys(userRatings).length}  totalUsers=${allUserIds.length}`);

  const similarities: { userId: string; sim: number; ratings: Record<number, number> }[] = [];
  for (const otherId of allUserIds) {
    if (otherId === userId) continue;
    const otherRatings = await getUserRatings(otherId);
    const sim = pearsonCorrelation(userRatings, otherRatings);
    if (sim > 0) similarities.push({ userId: otherId, sim, ratings: otherRatings });
  }
  similarities.sort((a, b) => b.sim - a.sim);
  const topK = similarities.slice(0, K);
  log.ml(`collaborative  similar_users=${similarities.length}  topK=${topK.length}  best_sim=${topK[0]?.sim.toFixed(3) ?? 'n/a'}`);

  if (topK.length === 0) return [];

  const ratedSet = new Set(Object.keys(userRatings).map(Number));
  const userMeanRating = Object.values(userRatings).reduce((s, v) => s + v, 0) / Object.keys(userRatings).length;

  const candidates = new Map<number, { num: number; den: number; users: string[] }>();
  for (const { userId: nId, sim, ratings } of topK) {
    const nMean = Object.values(ratings).reduce((s, v) => s + v, 0) / Object.keys(ratings).length;
    for (const [mId, rating] of Object.entries(ratings)) {
      const id = Number(mId);
      if (ratedSet.has(id)) continue;
      if (!candidates.has(id)) candidates.set(id, { num: 0, den: 0, users: [] });
      const c = candidates.get(id)!;
      c.num += sim * (rating - nMean);
      c.den += Math.abs(sim);
      c.users.push(nId);
    }
  }

  const predictions: { id: number; predicted: number; users: string[] }[] = [];
  for (const [id, { num, den, users }] of candidates) {
    if (den === 0) continue;
    predictions.push({ id, predicted: userMeanRating + num / den, users });
  }
  predictions.sort((a, b) => b.predicted - a.predicted);
  log.ml(`collaborative  candidates=${candidates.size}  predictions=${predictions.length}`);

  const results: Recommendation[] = [];
  for (const { id, predicted, users } of predictions.slice(0, topN)) {
    const movie = await getMovie(id);
    if (!movie) continue;
    const score = Math.min(5, Math.max(0, predicted));
    results.push({
      movie, score,
      matchPercent: Math.round((score / 5) * 100),
      reason:       `Liked by ${users.length} users with similar taste`,
      engine:       'collaborative',
      similarUsers: users.slice(0, 3),
    });
  }

  log.ml(`collaborative done  results=${results.length}  (${elapsed()})`);
  return results;
}
