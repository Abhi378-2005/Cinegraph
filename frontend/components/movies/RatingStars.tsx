'use client';
// frontend/components/movies/RatingStars.tsx

import { useState } from 'react';
import { api } from '@/lib/api';
import { setPhase } from '@/lib/session';
import type { Phase } from '@/lib/types';

interface RatingStarsProps {
  movieId: number;
  initialRating?: number;
  onRate?: (newPhase: Phase) => void;
}

export function RatingStars({ movieId, initialRating = 0, onRate }: RatingStarsProps) {
  const [rating, setRating] = useState(initialRating);
  const [hover, setHover] = useState(0);
  const [loading, setLoading] = useState(false);

  const handleClick = async (star: number) => {
    if (loading) return;
    setLoading(true);
    setRating(star);
    try {
      const { newPhase } = await api.rateMovie(movieId, star);
      setPhase(newPhase);
      onRate?.(newPhase);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map(star => {
        const filled = star <= (hover || rating);
        return (
          <button
            key={star}
            disabled={loading}
            onClick={() => handleClick(star)}
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(0)}
            className="transition-transform duration-100 hover:scale-125 disabled:opacity-50"
            aria-label={`Rate ${star} star${star !== 1 ? 's' : ''}`}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill={filled ? 'var(--color-star-active)' : 'var(--color-star-inactive)'}
              stroke={filled ? 'var(--color-star-active)' : 'var(--color-star-inactive)'}
              strokeWidth="1"
            >
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </button>
        );
      })}
      {loading && (
        <span className="text-xs ml-2" style={{ color: 'var(--color-text-muted)' }}>
          Saving…
        </span>
      )}
    </div>
  );
}
