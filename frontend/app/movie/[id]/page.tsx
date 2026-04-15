'use client';
// frontend/app/movie/[id]/page.tsx

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { setPhase, getPhase } from '@/lib/session';
import { backdropUrl, formatGenres, formatRuntime, formatScore, formatYear, posterUrl } from '@/lib/formatters';
import { RatingStars } from '@/components/movies/RatingStars';
import { MovieRow } from '@/components/movies/MovieRow';
import { Toast } from '@/components/layout/Toast';
import type { Movie, Phase } from '@/lib/types';

const PHASE_MESSAGES: Partial<Record<Phase, string>> = {
  warming: "🎉 You've unlocked Content-Based recommendations! Rate 5 more movies to activate Collaborative filtering.",
  full: '🚀 Full Collaborative Filtering unlocked! Your taste graph is now active.',
};

export default function MovieDetailPage() {
  const params = useParams();
  const movieId = Number(params.id);

  const [movie, setMovie] = useState<Movie | null>(null);
  const [similar, setSimilar] = useState<Movie[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!movieId) return;
    api.getMovie(movieId).then(({ movie, similar }) => {
      setMovie(movie);
      setSimilar(similar);
      setLoading(false);
    });
  }, [movieId]);

  const handleRate = (newPhase: Phase) => {
    const prevPhase = getPhase();
    setPhase(newPhase);
    if (newPhase !== prevPhase) {
      const msg = PHASE_MESSAGES[newPhase];
      if (msg) setToast(msg);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-bg-base)' }}>
        <div className="w-8 h-8 rounded-full border-2 animate-spin"
          style={{ borderColor: 'var(--color-brand) transparent transparent transparent' }} />
      </div>
    );
  }

  if (!movie) return null;

  const backdrop = movie.backdropPath ? backdropUrl(movie.backdropPath) : posterUrl(movie.posterPath);

  return (
    <main className="min-h-screen" style={{ backgroundColor: 'var(--color-bg-base)' }}>
      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}

      {/* Hero banner */}
      <div className="relative w-full" style={{ height: '70vh' }}>
        <Image
          src={backdrop}
          alt={movie.title}
          fill
          priority
          className="object-cover object-center"
          style={{ opacity: 0.5 }}
        />
        {/* Gradient overlay */}
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(to top, var(--color-bg-base) 0%, rgba(20,20,20,0.6) 50%, transparent 100%)' }}
        />
        {/* Hero content */}
        <div className="absolute bottom-0 left-0 px-8 pb-10 max-w-2xl">
          <p className="text-xs font-semibold mb-2 uppercase tracking-widest" style={{ color: 'var(--color-brand)' }}>
            {formatGenres(movie.genres, 2)}
          </p>
          <h1 className="text-4xl font-bold text-white leading-tight mb-3">{movie.title}</h1>
          <div className="flex items-center gap-4 text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
            <span>⭐ {formatScore(movie.voteAverage)}</span>
            <span>{formatYear(movie.releaseYear)}</span>
            <span>{formatRuntime(movie.runtime)}</span>
            <span>Dir. {movie.director}</span>
          </div>
          <p className="text-sm leading-relaxed mb-6 line-clamp-3" style={{ color: 'var(--color-text-secondary)' }}>
            {movie.overview}
          </p>
          <div className="flex items-center gap-4">
            <button
              className="px-6 py-2.5 rounded font-semibold text-white text-sm"
              style={{ backgroundColor: 'var(--color-brand)' }}
            >
              ▶ Play Now
            </button>
            <button
              className="px-6 py-2.5 rounded font-semibold text-white text-sm"
              style={{ backgroundColor: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)' }}
            >
              + My List
            </button>
          </div>
        </div>
      </div>

      {/* Rate this movie */}
      <div className="px-8 py-6 flex items-center gap-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <span className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
          Rate this movie:
        </span>
        <RatingStars movieId={movie.id} onRate={handleRate} />
      </div>

      {/* Cast */}
      <div className="px-8 py-6">
        <p className="text-sm mb-2" style={{ color: 'var(--color-text-secondary)' }}>
          <span className="font-semibold text-white">Cast: </span>
          {movie.cast.slice(0, 5).join(', ')}
        </p>
      </div>

      {/* Similar movies */}
      {similar.length > 0 && (
        <div className="py-4">
          <MovieRow title="Similar Movies" movies={similar} />
        </div>
      )}
    </main>
  );
}
