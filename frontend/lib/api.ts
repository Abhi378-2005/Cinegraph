// frontend/lib/api.ts

import { getOrCreateToken } from '@/lib/session';
import type { Movie, Phase } from '@/lib/types';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

let _mockCache: Movie[] | null = null;

async function loadMock(): Promise<Movie[]> {
  if (_mockCache) return _mockCache;
  try {
    const res = await fetch('/mock/movies.json');
    _mockCache = (await res.json()) as Movie[];
    return _mockCache;
  } catch {
    return [];
  }
}

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
  /** Returns a socket session ID. Falls back silently to mock. */
  async getRecommendations(
    engine: string,
    budget?: number
  ): Promise<{ sessionId: string }> {
    try {
      return await apiFetch('/recommend', {
        method: 'POST',
        body: JSON.stringify({ engine, budget }),
      });
    } catch {
      return { sessionId: 'mock-session' };
    }
  },

  /** Returns movie + similar list. Falls back to mock JSON. */
  async getMovie(id: number): Promise<{ movie: Movie; similar: Movie[] }> {
    try {
      return await apiFetch(`/movies/${id}`);
    } catch {
      const movies = await loadMock();
      const movie = movies.find(m => m.id === id) ?? movies[0];
      const similar = movies.filter(m => m.id !== movie.id).slice(0, 6);
      return { movie, similar };
    }
  },

  /** Full-text search. Falls back to client-side mock filter. */
  async searchMovies(query: string): Promise<{ movies: Movie[] }> {
    try {
      return await apiFetch(`/movies/search?q=${encodeURIComponent(query)}`);
    } catch {
      const movies = await loadMock();
      const q = query.toLowerCase();
      return {
        movies: movies.filter(
          m =>
            m.title.toLowerCase().includes(q) ||
            m.genres.some(g => g.toLowerCase().includes(q))
        ),
      };
    }
  },

  /** Rate a movie 1-5. Falls back to cold-phase mock response. */
  async rateMovie(
    movieId: number,
    rating: number
  ): Promise<{ newPhase: Phase; ratingsCount: number }> {
    try {
      return await apiFetch('/rate', {
        method: 'POST',
        body: JSON.stringify({ movieId, rating }),
      });
    } catch {
      return { newPhase: 'cold', ratingsCount: 0 };
    }
  },

  /** Cold-start: submit genre preferences. Falls back silently. */
  async startColdStart(genres: string[]): Promise<{ sessionId: string }> {
    try {
      return await apiFetch('/recommend', {
        method: 'POST',
        body: JSON.stringify({ engine: 'cold_start', genres }),
      });
    } catch {
      return { sessionId: 'mock-session' };
    }
  },

  /** Direct access to mock movies for components that need to populate without a backend. */
  async getMockMovies(): Promise<Movie[]> {
    return loadMock();
  },
};
