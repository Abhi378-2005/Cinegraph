'use client';
// frontend/app/discover/page.tsx

import { useCallback, useEffect, useRef, useState } from 'react';
import { MovieRow } from '@/components/movies/MovieRow';
import { EngineSelector } from '@/components/recommendation/EngineSelector';
import type { Engine } from '@/components/recommendation/EngineSelector';
import { WatchBudget } from '@/components/recommendation/WatchBudget';
import { AlgoDrawer } from '@/components/layout/AlgoDrawer';
import { api } from '@/lib/api';
import { socketEvents } from '@/lib/socket';
import type { Movie, RecommendReadyEvent } from '@/lib/types';

function groupByGenre(movies: Movie[]): Record<string, Movie[]> {
  const groups: Record<string, Movie[]> = {};
  for (const movie of movies) {
    const genre = movie.genres[0] ?? 'Other';
    if (!groups[genre]) groups[genre] = [];
    groups[genre].push(movie);
  }
  return groups;
}

export default function DiscoverPage() {
  const [engine, setEngine] = useState<Engine>('hybrid');
  const [budget, setBudget] = useState(120);
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Keep refs so fetchRecommendations always sees latest values without re-creating
  const engineRef = useRef(engine);
  const budgetRef = useRef(budget);
  engineRef.current = engine;
  budgetRef.current = budget;

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchRecommendations = useCallback(async () => {
    setLoading(true);
    setError(false);
    // 30s safety timeout — if socket never fires recommend:ready
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setError(true);
      setLoading(false);
    }, 30_000);
    try {
      await api.getRecommendations(engineRef.current, budgetRef.current);
      // Keep spinner — real data arrives via socket recommend:ready
    } catch {
      clearTimeout(timeoutRef.current!);
      setError(true);
      setLoading(false);
    }
  }, []); // stable — reads engine/budget from refs

  // Fire once on mount
  useEffect(() => {
    fetchRecommendations();
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, [fetchRecommendations]);

  // Re-fetch when engine or budget changes (after initial mount)
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    fetchRecommendations();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, budget]);

  // Listen for real recommendations from backend via Socket.io
  useEffect(() => {
    const unsubReady = socketEvents.onRecommendReady((event: RecommendReadyEvent) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setMovies(event.recommendations.map(r => r.movie));
      setLoading(false);
    });
    const unsubError = socketEvents.onRecommendError(() => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setError(true);
      setLoading(false);
    });
    return () => { unsubReady(); unsubError(); };
  }, []);

  const genreGroups = groupByGenre(movies);
  const topMovies = movies.slice(0, 6);

  return (
    <main
      className="min-h-screen pt-20 pb-20"
      style={{ backgroundColor: 'var(--color-bg-base)' }}
    >
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4 px-8 mb-8">
        <EngineSelector value={engine} onChange={setEngine} />
        <WatchBudget value={budget} onChange={setBudget} />
      </div>

      {/* Movie rows */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div
            className="w-8 h-8 rounded-full border-2 animate-spin"
            style={{ borderColor: 'var(--color-brand) transparent transparent transparent' }}
          />
        </div>
      ) : error ? (
        <div className="flex items-center justify-center py-24" style={{ color: 'var(--color-text-muted)' }}>
          <p>Could not load recommendations. Make sure the backend is running.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-10">
          {topMovies.length > 0 && (
            <MovieRow title="Recommended For You" movies={topMovies} />
          )}
          {Object.entries(genreGroups)
            .filter(([, ms]) => ms.length >= 2)
            .slice(0, 4)
            .map(([genre, ms]) => (
              <MovieRow key={genre} title={`Top in ${genre}`} movies={ms} />
            ))}
        </div>
      )}

      {/* Algorithm drawer pinned at bottom */}
      <AlgoDrawer />
    </main>
  );
}
