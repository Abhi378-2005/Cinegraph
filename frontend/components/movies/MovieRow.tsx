'use client';
// frontend/components/movies/MovieRow.tsx

import { useRef, useState } from 'react';
import type React from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '@/components/movies/ChevronIcons';
import { MovieCard } from './MovieCard';
import type { Movie } from '@/lib/types';

interface MovieRowProps {
  title: string;
  movies: Movie[];
  matchPercents?: Record<number, number>;
  titleExtras?: React.ReactNode;
}

export function MovieRow({ title, movies, matchPercents, titleExtras }: MovieRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(true);
  const [hoveringRow, setHoveringRow] = useState(false);

  const scroll = (dir: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const amount = 600;
    scrollRef.current.scrollBy({ left: dir === 'left' ? -amount : amount, behavior: 'smooth' });
  };

  const onScroll = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setShowLeft(scrollLeft > 10);
    setShowRight(scrollLeft + clientWidth < scrollWidth - 10);
  };

  return (
    <div
      className="relative"
      onMouseEnter={() => setHoveringRow(true)}
      onMouseLeave={() => setHoveringRow(false)}
    >
      {/* Row title */}
      <div className="flex items-center gap-3 px-8 mb-3">
        <h2
          className="text-lg font-semibold"
          style={{ color: 'var(--color-text-primary)' }}
        >
          {title}
        </h2>
        {titleExtras}
      </div>

      {/* Left chevron */}
      {hoveringRow && showLeft && (
        <button
          onClick={() => scroll('left')}
          className="absolute left-0 top-8 bottom-0 z-20 flex items-center px-2 opacity-90 hover:opacity-100"
          style={{ background: 'linear-gradient(to right, rgba(20,20,20,0.9), transparent)' }}
          aria-label="Scroll left"
        >
          <ChevronLeftIcon />
        </button>
      )}

      {/* Scrollable row */}
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="no-scrollbar flex gap-3 overflow-x-auto px-8 py-4"
        style={{ scrollSnapType: 'x mandatory' }}
      >
        {movies.map(movie => (
          <div key={movie.id} style={{ scrollSnapAlign: 'start' }}>
            <MovieCard
              movie={movie}
              matchPercent={matchPercents?.[movie.id]}
            />
          </div>
        ))}
      </div>

      {/* Right chevron */}
      {hoveringRow && showRight && (
        <button
          onClick={() => scroll('right')}
          className="absolute right-0 top-8 bottom-0 z-20 flex items-center px-2 opacity-90 hover:opacity-100"
          style={{ background: 'linear-gradient(to left, rgba(20,20,20,0.9), transparent)' }}
          aria-label="Scroll right"
        >
          <ChevronRightIcon />
        </button>
      )}
    </div>
  );
}
