import { redis } from './client';
import { getBQVector } from '../bigquery/vectors';
import { log, timer } from '../logger';

export async function setVector(movieId: number, vector: number[]): Promise<void> {
  await redis.set(`movie:vector:${movieId}`, JSON.stringify(vector), { ex: 86400 });
}

export async function getVector(movieId: number): Promise<number[] | null> {
  const elapsed = timer();
  const data = await redis.get<number[]>(`movie:vector:${movieId}`);
  if (data) {
    log.redis(`HIT  movie:vector:${movieId}  dims=${data.length}  (${elapsed()})`);
    return data;
  }

  log.redis(`MISS movie:vector:${movieId} → falling back to BigQuery`);
  const bqElapsed = timer();
  const vector = await getBQVector(movieId);
  if (!vector) {
    log.redis(`MISS movie:vector:${movieId} not found in BigQuery  (${bqElapsed()})`);
    return null;
  }
  log.redis(`BQ   movie:vector:${movieId} dims=${vector.length}  (${bqElapsed()}) → caching`);
  await redis.set(`movie:vector:${movieId}`, JSON.stringify(vector), { ex: 86400 });
  return vector;
}

export async function getAllVectors(movieIds: number[]): Promise<Map<number, number[]>> {
  const elapsed = timer();
  const entries = await Promise.all(
    movieIds.map(async id => [id, await getVector(id)] as const)
  );
  const map = new Map(entries.filter((e): e is [number, number[]] => e[1] !== null));
  log.redis(`getAllVectors(${movieIds.length} ids) → ${map.size} found  (${elapsed()})`);
  return map;
}
