import { bq } from './client';
import { log, timer } from '../logger';

const DS = `${process.env.GCP_PROJECT_ID ?? 'cinegraph'}.${process.env.GCP_DATASET_ID ?? 'cinegraph'}`;

export interface SimilarEntry {
  movieId: number;
  similarMovieId: number;
  score: number;
  rank: number;
  signalBreakdown: string;
}

export async function getTopSimilar(movieId: number, limit = 50): Promise<SimilarEntry[]> {
  const elapsed = timer();
  const [rows] = await bq.query({
    query: `
      SELECT movie_id, similar_movie_id, similarity_score, rank, signal_breakdown
      FROM \`${DS}.movie_similarity\`
      WHERE movie_id = @movieId
      ORDER BY rank ASC
      LIMIT @limit
    `,
    params: { movieId, limit },
    parameterMode: 'NAMED',
  });
  log.bq(`getTopSimilar(movieId=${movieId}, limit=${limit}) → ${rows.length} entries  (${elapsed()})`);
  return (rows as Record<string, unknown>[]).map(row => ({
    movieId:         Number(row.movie_id),
    similarMovieId:  Number(row.similar_movie_id),
    score:           Number(row.similarity_score),
    rank:            Number(row.rank),
    signalBreakdown: String(row.signal_breakdown ?? ''),
  }));
}
