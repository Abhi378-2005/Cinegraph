// frontend/lib/api.ts

import { getOrCreateToken } from '@/lib/session';
import type { Movie, Phase } from '@/lib/types';

export interface RatedMovie {
  movieId: number;
  rating: number;
  title: string;
  posterPath: string;
  releaseYear: number;
  voteAverage: number;
}

export interface ProfileData {
  phase: Phase;
  ratingsCount: number;
  nextPhaseAt: number | null;
  ratedMovies: RatedMovie[];
}

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

  /** Substring title search with optional genre filter. */
  async searchMovies(query: string, genre = ''): Promise<{ movies: Movie[] }> {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (genre) params.set('genre', genre);
    return apiFetch(`/movies/search?${params.toString()}`);
  },

  /** Returns the distinct genre list (cached on backend). */
  async getGenres(): Promise<{ genres: string[] }> {
    return apiFetch('/movies/genres');
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

  /** Fetch current user's profile (phase, ratings count, rated movies). */
  async getProfile(): Promise<ProfileData> {
    return apiFetch('/profile');
  },

  /** Triggers graph algorithm computation. Returns a graphSessionId. */
  async computeGraph(): Promise<{ graphSessionId: string }> {
    return apiFetch('/graph/compute', { method: 'POST' });
  },

  /** Fetch top 3 rated movies for a user node (node expansion). */
  async getTopMovies(userId: string): Promise<{ movies: Array<{ movieId: number; title: string; posterPath: string; rating: number }> }> {
    return apiFetch(`/profile/${encodeURIComponent(userId)}/top-movies`);
  },
};
