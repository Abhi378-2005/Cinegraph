import { redis } from './client';

export async function setVector(movieId: number, vector: number[]): Promise<void> {
  await redis.set(`movie:vector:${movieId}`, JSON.stringify(vector), { ex: 86400 });
}

export async function getVector(movieId: number): Promise<number[] | null> {
  const data = await redis.get<string>(`movie:vector:${movieId}`);
  return data ? (JSON.parse(data) as number[]) : null;
}

export async function getAllVectors(movieIds: number[]): Promise<Map<number, number[]>> {
  const entries = await Promise.all(
    movieIds.map(async id => [id, await getVector(id)] as const)
  );
  return new Map(entries.filter((e): e is [number, number[]] => e[1] !== null));
}
