'use client';
// frontend/components/onboarding/GenrePicker.tsx

import { useState } from 'react';

const GENRES = [
  { name: 'Action',          color: 'var(--color-brand)' },
  { name: 'Adventure',       color: '#2563EB' },
  { name: 'Animation',       color: '#059669' },
  { name: 'Comedy',          color: '#D97706' },
  { name: 'Crime',           color: '#DC2626' },
  { name: 'Documentary',     color: '#0891B2' },
  { name: 'Drama',           color: 'var(--color-brand)' },
  { name: 'Fantasy',         color: '#9333EA' },
  { name: 'Horror',          color: '#DC2626' },
  { name: 'Music',           color: '#059669' },
  { name: 'Mystery',         color: '#4B5563' },
  { name: 'Romance',         color: '#DB2777' },
  { name: 'Science Fiction', color: '#2563EB' },
  { name: 'Thriller',        color: '#B45309' },
  { name: 'War',             color: '#374151' },
  { name: 'Western',         color: '#92400E' },
];

interface GenrePickerProps {
  onSubmit: (genres: string[]) => void;
  loading?: boolean;
}

export function GenrePicker({ onSubmit, loading = false }: GenrePickerProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (genre: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(genre)) {
        next.delete(genre);
      } else if (next.size < 3) {
        next.add(genre);
      }
      return next;
    });
  };

  return (
    <div className="flex flex-col items-center gap-8 px-4 py-12 min-h-screen"
      style={{ backgroundColor: 'var(--color-bg-base)' }}>
      {/* Header */}
      <div className="text-center">
        <h1 className="text-4xl font-bold text-white mb-2">
          Cine<span style={{ color: 'var(--color-brand)' }}>Graph</span>
        </h1>
        <p className="text-lg" style={{ color: 'var(--color-text-secondary)' }}>
          Pick 3 genres you love to get started
        </p>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
          {selected.size}/3 selected
        </p>
      </div>

      {/* Genre grid */}
      <div className="grid grid-cols-2 gap-3 w-full max-w-2xl sm:grid-cols-3 lg:grid-cols-4">
        {GENRES.map(({ name, color }) => {
          const isSelected = selected.has(name);
          return (
            <button
              key={name}
              onClick={() => toggle(name)}
              className="relative h-24 rounded-lg overflow-hidden flex items-center justify-center font-bold text-white text-sm transition-all duration-150"
              style={{
                backgroundColor: color,
                opacity: !isSelected && selected.size === 3 ? 0.4 : 1,
                boxShadow: isSelected
                  ? `0 0 0 3px white, 0 0 0 5px var(--color-brand)`
                  : 'none',
                transform: isSelected ? 'scale(1.03)' : 'scale(1)',
              }}
            >
              {/* Gradient overlay */}
              <div className="absolute inset-0"
                style={{ background: 'linear-gradient(135deg, rgba(0,0,0,0.2), rgba(0,0,0,0.5))' }} />

              <span className="relative z-10 uppercase tracking-wide">{name}</span>

              {/* Checkmark */}
              {isSelected && (
                <div
                  className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: 'var(--color-brand)' }}
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <polyline points="1.5 5 4 7.5 8.5 2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* CTA */}
      <button
        onClick={() => onSubmit(Array.from(selected))}
        disabled={selected.size < 3 || loading}
        className="px-10 py-3 rounded text-white font-semibold text-base transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
        style={{
          backgroundColor: 'var(--color-brand)',
          boxShadow: selected.size === 3 ? '0 0 20px var(--color-brand-glow)' : 'none',
        }}
      >
        {loading ? 'Loading…' : 'Find My Movies →'}
      </button>
    </div>
  );
}
