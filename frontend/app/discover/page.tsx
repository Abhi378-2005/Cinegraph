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

const ENGINE_COLORS: Record<string, string> = {
  hybrid:        'var(--color-brand)',
  content:       '#3b82f6',
  collaborative: '#14b8a6',
  cold_start:    '#f59e0b',
};

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
  const [engine, setEngine]               = useState<Engine>('hybrid');
  const [budget, setBudget]               = useState<number | undefined>(undefined);
  const [movies, setMovies]               = useState<Movie[]>([]);
  const [matchPercents, setMatchPercents] = useState<Record<number, number>>({});
  const [activeEngine, setActiveEngine]   = useState<string>('');
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState(false);
  const [sessionId, setSessionId]         = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen]       = useState(false);

  // Ref that stays in sync with sessionId state so the stable socket
  // handler ([] deps) can read the current value without stale closure issues.
  const sessionIdRef = useRef<string | null>(null);

  // Refs so fetchRecommendations stays stable
  const engineRef = useRef(engine);
  const budgetRef = useRef(budget);
  engineRef.current = engine;
  budgetRef.current = budget;

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchRecommendations = useCallback(async () => {
    setLoading(true);
    setError(false);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setError(true);
      setLoading(false);
    }, 30_000);
    try {
      const { sessionId: newId } = await api.getRecommendations(
        engineRef.current,
        budgetRef.current,
      );
      setSessionId(newId);
      sessionIdRef.current = newId;
      // Keep spinner — real data arrives via socket recommend:ready
    } catch {
      clearTimeout(timeoutRef.current!);
      setError(true);
      setLoading(false);
    }
  }, []); // stable — reads from refs

  // Fire once on mount
  useEffect(() => {
    fetchRecommendations();
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, [fetchRecommendations]);

  // Re-fetch when engine or budget changes (skip first render)
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    fetchRecommendations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, budget]);

  // Socket: handle recommend:ready and recommend:error
  useEffect(() => {
    const unsubReady = socketEvents.onRecommendReady((event: RecommendReadyEvent) => {
      if (event.sessionId !== sessionIdRef.current) return;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setMovies(event.recommendations.map(r => r.movie));
      const percents: Record<number, number> = {};
      event.recommendations.forEach(r => { percents[r.movie.id] = r.matchPercent; });
      setMatchPercents(percents);
      setActiveEngine(event.engine);
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
  const topMovies   = movies.slice(0, 6);

  const topRowExtras = (
    <div className="flex items-center gap-2">
      {activeEngine && (
        <span
          className="text-xs px-2 py-0.5 rounded-full font-medium"
          style={{
            backgroundColor: ENGINE_COLORS[activeEngine] ?? 'var(--color-brand)',
            color: 'white',
          }}
        >
          {activeEngine}
        </span>
      )}
      <button
        onClick={() => setDrawerOpen(true)}
        className="text-xs"
        style={{ color: 'var(--color-text-muted)' }}
      >
        How were these picked?
      </button>
    </div>
  );

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
            <MovieRow
              title="Recommended For You"
              movies={topMovies}
              matchPercents={matchPercents}
              titleExtras={topRowExtras}
            />
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
      <AlgoDrawer
        sessionId={sessionId}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        budgetEnabled={budget !== undefined}
        budget={budget}
      />
    </main>
  );
}
