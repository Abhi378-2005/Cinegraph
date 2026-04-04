// frontend/lib/api.ts

import { getOrCreateToken } from '@/lib/session';
import type { Movie, Phase } from '@/lib/types';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getOrCreateToken();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Session-Token': token,
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
  return res.json() as Promise<T>;
}

export const api = {
  /** Returns a socket session ID. */
  async getRecommendations(
    engine: string,
    budget?: number
  ): Promise<{ sessionId: string }> {
    return apiFetch('/recommend', {
      method: 'POST',
      body: JSON.stringify({ engine, budget }),
    });
  },

  /** Returns movie + similar list. */
  async getMovie(id: number): Promise<{ movie: Movie; similar: Movie[] }> {
    return apiFetch(`/movies/${id}`);
  },

  /** Full-text search. */
  async searchMovies(query: string): Promise<{ movies: Movie[] }> {
    return apiFetch(`/movies/search?q=${encodeURIComponent(query)}`);
  },

  /** Rate a movie 1-5. */
  async rateMovie(
    movieId: number,
    rating: number
  ): Promise<{ newPhase: Phase; ratingsCount: number }> {
    return apiFetch('/rate', {
      method: 'POST',
      body: JSON.stringify({ movieId, rating }),
    });
  },

  /** Cold-start: submit genre preferences. */
  async startColdStart(genres: string[]): Promise<{ sessionId: string }> {
    return apiFetch('/recommend', {
      method: 'POST',
      body: JSON.stringify({ engine: 'cold_start', genres }),
    });
  },
};
