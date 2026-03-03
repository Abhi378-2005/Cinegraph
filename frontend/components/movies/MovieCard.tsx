'use client';
// frontend/components/movies/MovieCard.tsx

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { formatGenres, formatRuntime, formatYear, posterUrl } from '@/lib/formatters';
import type { Movie } from '@/lib/types';

interface MovieCardProps {
  movie: Movie;
  matchPercent?: number;
  reason?: string;
}

export function MovieCard({ movie, matchPercent, reason }: MovieCardProps) {
  const [hovered, setHovered] = useState(false);
  const router = useRouter();

  const imgSrc = posterUrl(movie.posterPath);

  return (
    <div
      className="relative flex-shrink-0 cursor-pointer select-none"
      style={{
        width: '200px',
        transition: 'transform 200ms ease, box-shadow 200ms ease',
        transform: hovered ? 'scale(1.08)' : 'scale(1)',
        zIndex: hovered ? 10 : 1,
        boxShadow: hovered
          ? '0 0 0 2px var(--color-brand), 0 8px 32px rgba(0,0,0,0.6)'
          : 'none',
        borderRadius: '4px',
        overflow: 'visible',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => router.push(`/movie/${movie.id}`)}
    >
      {/* Poster */}
      <div
        className="relative rounded overflow-hidden"
        style={{ aspectRatio: '2/3', backgroundColor: 'var(--color-bg-elevated)' }}
      >
        <Image
          src={imgSrc}
          alt={movie.title}
          fill
          sizes="200px"
          className="object-cover"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = '/placeholder-poster.jpg';
          }}
        />

        {/* Bottom gradient always visible */}
        <div
          className="absolute bottom-0 left-0 right-0 h-16"
          style={{
            background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%)',
          }}
        />

        {/* Match % badge — visible on hover */}
        {matchPercent !== undefined && hovered && (
          <div
            className="absolute top-2 right-2 text-xs font-bold px-2 py-0.5 rounded"
            style={{ backgroundColor: 'var(--color-brand)', color: 'white' }}
          >
            {matchPercent}% Match
          </div>
        )}
      </div>

      {/* Info below poster */}
      <div className="mt-2 px-0.5">
        <p
          className="text-sm font-semibold truncate"
          style={{ color: 'var(--color-text-primary)' }}
        >
          {movie.title}
        </p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
          {formatYear(movie.releaseYear)} · {formatGenres(movie.genres, 2)} · {formatRuntime(movie.runtime)}
        </p>
        {reason && hovered && (
          <p className="text-xs mt-1 truncate" style={{ color: 'var(--color-text-muted)' }}>
            {reason}
          </p>
        )}
      </div>
    </div>
  );
}
