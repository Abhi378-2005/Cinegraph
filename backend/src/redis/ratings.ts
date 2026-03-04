import { redis } from './client';
import type { Phase } from '../types';

export async function setRating(userId: string, movieId: number, rating: number): Promise<void> {
  await Promise.all([
    redis.hset(`user:${userId}:ratings`, { [String(movieId)]: String(rating) }),
    redis.sadd('users:all', userId),
  ]);
}

export async function getUserRatings(userId: string): Promise<Record<number, number>> {
  const data = await redis.hgetall<Record<string, string>>(`user:${userId}:ratings`);
  if (!data) return {};
  return Object.fromEntries(
    Object.entries(data).map(([k, v]) => [Number(k), Number(v)])
  );
}

export async function getRatingCount(userId: string): Promise<number> {
  return redis.hlen(`user:${userId}:ratings`);
}

export async function getPhase(userId: string): Promise<Phase> {
  const p = await redis.get<string>(`user:${userId}:phase`);
  return (p as Phase) ?? 'cold';
}

export async function setPhase(userId: string, phase: Phase): Promise<void> {
  await redis.set(`user:${userId}:phase`, phase);
}

export async function computeAndSetPhase(userId: string): Promise<Phase> {
  const count = await getRatingCount(userId);
  const phase: Phase = count >= 20 ? 'full' : count >= 5 ? 'warming' : 'cold';
  await setPhase(userId, phase);
  return phase;
}

export async function getAllUserIds(): Promise<string[]> {
  return redis.smembers('users:all');
}

export async function setPreferredGenres(userId: string, genres: string[]): Promise<void> {
  await redis.set(`user:${userId}:genres`, JSON.stringify(genres));
}

export async function getPreferredGenres(userId: string): Promise<string[]> {
  const data = await redis.get<string>(`user:${userId}:genres`);
  return data ? JSON.parse(data) : [];
}
