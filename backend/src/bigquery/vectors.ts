import { bq } from './client';

const DS = `${process.env.GCP_PROJECT_ID ?? 'cinegraph'}.${process.env.GCP_DATASET_ID ?? 'cinegraph'}`;

export async function getBQVector(movieId: number): Promise<number[] | null> {
  const [rows] = await bq.query({
    query: `SELECT feature_vector FROM \`${DS}.movie_features\` WHERE movie_id = @movieId LIMIT 1`,
    params: { movieId },
    parameterMode: 'NAMED',
  });
  if (rows.length === 0) return null;
  return (rows[0] as Record<string, unknown>).feature_vector as number[];
}

export async function getBQVectorBatch(movieIds: number[]): Promise<Map<number, number[]>> {
  if (movieIds.length === 0) return new Map();
  const [rows] = await bq.query({
    query: `SELECT movie_id, feature_vector FROM \`${DS}.movie_features\` WHERE movie_id IN UNNEST(@movieIds)`,
    params: { movieIds },
    parameterMode: 'NAMED',
  });
  const map = new Map<number, number[]>();
  for (const row of rows as Record<string, unknown>[]) {
    map.set(Number(row.movie_id), row.feature_vector as number[]);
  }
  return map;
}

export async function getAllBQVectors(): Promise<Map<number, number[]>> {
  const [rows] = await bq.query({
    query: `SELECT movie_id, feature_vector FROM \`${DS}.movie_features\``,
    parameterMode: 'NAMED',
  });
  const map = new Map<number, number[]>();
  for (const row of rows as Record<string, unknown>[]) {
    map.set(Number(row.movie_id), row.feature_vector as number[]);
  }
  return map;
}
