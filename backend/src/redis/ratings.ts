import { redis } from './client';
import type { Phase } from '../types';
import { log } from '../logger';

export async function setRating(userId: string, movieId: number, rating: number): Promise<void> {
  await Promise.all([
    redis.hset(`user:${userId}:ratings`, { [String(movieId)]: String(rating) }),
    redis.sadd('users:all', userId),
  ]);
  log.rate(`setRating  user=${userId.slice(0, 12)}  movie=${movieId}  rating=${rating}`);
}

export async function getUserRatings(userId: string): Promise<Record<number, number>> {
  const data = await redis.hgetall<Record<string, string>>(`user:${userId}:ratings`);
  if (!data) return {};
  const result = Object.fromEntries(
    Object.entries(data).map(([k, v]) => [Number(k), Number(v)])
  );
  log.redis(`getUserRatings user=${userId.slice(0, 12)} → ${Object.keys(result).length} ratings`);
  return result;
}

export async function getRatingCount(userId: string): Promise<number> {
  return redis.hlen(`user:${userId}:ratings`);
}

export async function getPhase(userId: string): Promise<Phase> {
  const p = await redis.get<string>(`user:${userId}:phase`);
  const phase = (p as Phase) ?? 'cold';
  log.redis(`getPhase user=${userId.slice(0, 12)} → ${phase}`);
  return phase;
}

export async function setPhase(userId: string, phase: Phase): Promise<void> {
  await redis.set(`user:${userId}:phase`, phase);
}

export async function computeAndSetPhase(userId: string): Promise<Phase> {
  const count = await getRatingCount(userId);
  const phase: Phase = count >= 20 ? 'full' : count >= 5 ? 'warming' : 'cold';
  await setPhase(userId, phase);
  log.rate(`computeAndSetPhase user=${userId.slice(0, 12)} count=${count} → phase=${phase}`);
  return phase;
}

export async function getAllUserIds(): Promise<string[]> {
  const ids = await redis.smembers('users:all');
  log.redis(`getAllUserIds → ${ids.length} users`);
  return ids;
}

export async function setPreferredGenres(userId: string, genres: string[]): Promise<void> {
  await redis.set(`user:${userId}:genres`, genres);
  log.redis(`setPreferredGenres user=${userId.slice(0, 12)} genres=[${genres.join(', ')}]`);
}

export async function getPreferredGenres(userId: string): Promise<string[]> {
  const data = await redis.get<string[]>(`user:${userId}:genres`);
  const genres = data ?? [];
  log.redis(`getPreferredGenres user=${userId.slice(0, 12)} → [${genres.join(', ')}]`);
  return genres;
}
