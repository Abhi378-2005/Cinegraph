import { redis } from './client';
import { getBQVector } from '../bigquery/vectors';

export async function setVector(movieId: number, vector: number[]): Promise<void> {
  await redis.set(`movie:vector:${movieId}`, JSON.stringify(vector), { ex: 86400 });
}

export async function getVector(movieId: number): Promise<number[] | null> {
  const data = await redis.get<number[]>(`movie:vector:${movieId}`);
  if (data) return data;

  // BigQuery fallback on Redis miss
  const vector = await getBQVector(movieId);
  if (!vector) return null;

  await redis.set(`movie:vector:${movieId}`, JSON.stringify(vector), { ex: 86400 });
  return vector;
}

export async function getAllVectors(movieIds: number[]): Promise<Map<number, number[]>> {
  const entries = await Promise.all(
    movieIds.map(async id => [id, await getVector(id)] as const)
  );
  return new Map(entries.filter((e): e is [number, number[]] => e[1] !== null));
}
