'use client';

import Image from 'next/image';
import { posterUrl } from '@/lib/formatters';
import type { Movie } from '@/lib/types';

interface Props {
  query: string;
  genre: string;
  results: Movie[];
  genres: string[];
  loading: boolean;
  error: boolean;
  onGenreSelect: (genre: string) => void;
  onResultClick: (id: number) => void;
}

export function SearchDropdown({
  query, genre, results, genres, loading, error, onGenreSelect, onResultClick,
}: Props) {
  // Filter genre chips by substring match against current query
  const visibleGenres = query
    ? genres.filter(g => g.toLowerCase().includes(query.toLowerCase()))
    : genres;

  const showGenreChips = visibleGenres.length > 0;
  const showResults = query.length > 0 || genre !== '';

  return (
    <div
      className="absolute right-0 top-full mt-2 w-72 rounded-lg overflow-hidden shadow-xl z-50"
      style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      {/* Genre chips */}
      {showGenreChips && (
        <div
          className="p-3 flex flex-wrap gap-2"
          style={{ borderBottom: showResults ? '1px solid rgba(255,255,255,0.08)' : 'none' }}
        >
          {visibleGenres.slice(0, 12).map(g => (
            <button
              key={g}
              onClick={() => onGenreSelect(g)}
              className="text-xs px-2 py-1 rounded-full transition-colors"
              style={{
                backgroundColor: genre === g ? 'var(--color-brand)' : 'rgba(255,255,255,0.08)',
                color: genre === g ? 'white' : 'var(--color-text-secondary)',
              }}
            >
              {g}
            </button>
          ))}
        </div>
      )}

      {/* Results area */}
      {showResults && (
        <div>
          {loading && (
            <div className="p-4 flex items-center justify-center gap-2 text-sm"
              style={{ color: 'var(--color-text-muted)' }}>
              <div
                className="w-4 h-4 border-2 rounded-full animate-spin"
                style={{ borderColor: 'var(--color-brand)', borderTopColor: 'transparent' }}
              />
              Searching...
            </div>
          )}

          {error && !loading && (
            <p className="p-4 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
              Search unavailable. Try again.
            </p>
          )}

          {!loading && !error && results.length === 0 && (
            <p className="p-4 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
              No results found.
            </p>
          )}

          {!loading && !error && results.length > 0 && (
            <ul>
              {results.map(movie => (
                <li key={movie.id}>
                  <button
                    onClick={() => onResultClick(movie.id)}
                    className="w-full flex items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-white/5"
                  >
                    <div className="shrink-0 w-8 h-12 rounded overflow-hidden"
                      style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>
                      {movie.posterPath && (
                        <Image
                          src={posterUrl(movie.posterPath)}
                          alt={movie.title}
                          width={32}
                          height={48}
                          className="object-cover w-full h-full"
                        />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">{movie.title}</p>
                      <p className="text-xs flex items-center gap-1.5"
                        style={{ color: 'var(--color-text-muted)' }}>
                        {movie.releaseYear}
                        {movie.genres[0] && (
                          <span
                            className="px-1.5 py-0.5 rounded text-xs"
                            style={{ backgroundColor: 'rgba(124,58,237,0.2)', color: 'var(--color-brand)' }}
                          >
                            {movie.genres[0]}
                          </span>
                        )}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Idle state: no query, no genre selected, genres not yet loaded */}
      {!showResults && !showGenreChips && (
        <p className="p-4 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
          Type to search or pick a genre.
        </p>
      )}
    </div>
  );
}
