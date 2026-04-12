'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { SearchDropdown } from '@/components/layout/SearchDropdown';
import type { Movie } from '@/lib/types';

export function SearchBar() {
  const router = useRouter();
  const [isExpanded, setIsExpanded] = useState(false);
  const [query, setQuery] = useState('');
  const [genre, setGenre] = useState('');
  const [results, setResults] = useState<Movie[]>([]);
  const [genres, setGenres] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch genre list once when search bar first opens
  useEffect(() => {
    if (!isExpanded || genres.length > 0) return;
    api.getGenres().then(({ genres: g }) => setGenres(g)).catch(() => {});
  }, [isExpanded, genres.length]);

  // Focus the input when expanded
  useEffect(() => {
    if (isExpanded) inputRef.current?.focus();
  }, [isExpanded]);

  // Collapse on outside click
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        collapse();
      }
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, []);

  function collapse() {
    setIsExpanded(false);
    setQuery('');
    setGenre('');
    setResults([]);
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }

  const triggerSearch = useCallback((q: string, g: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q && !g) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(false);
    debounceRef.current = setTimeout(async () => {
      try {
        const { movies } = await api.searchMovies(q, g);
        setResults(movies.slice(0, 8));
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }, 400);
  }, []);

  function handleQueryChange(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value;
    setQuery(q);
    triggerSearch(q, genre);
  }

  function handleGenreSelect(g: string) {
    const next = genre === g ? '' : g;
    setGenre(next);
    triggerSearch(query, next);
  }

  function handleResultClick(id: number) {
    router.push(`/movie/${id}`);
    collapse();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') collapse();
  }

  function handleToggle() {
    if (isExpanded) {
      collapse();
    } else {
      setIsExpanded(true);
    }
  }

  return (
    <div ref={containerRef} className="relative flex items-center">
      {/* Animated expanding input */}
      <div
        className="flex items-center gap-1 overflow-hidden transition-all duration-200"
        style={{ width: isExpanded ? '220px' : '0px', opacity: isExpanded ? 1 : 0 }}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={handleQueryChange}
          onKeyDown={handleKeyDown}
          placeholder="Search movies..."
          className="flex-1 min-w-0 bg-transparent border-b text-sm text-white outline-none py-1 px-1"
          style={{
            borderColor: 'var(--color-brand)',
            caretColor: 'var(--color-brand)',
          }}
          aria-label="Search movies"
        />
        {genre && (
          <button
            onClick={() => handleGenreSelect(genre)}
            className="shrink-0 text-xs px-1.5 py-0.5 rounded-full"
            style={{ backgroundColor: 'var(--color-brand)', color: 'white' }}
            aria-label={`Remove genre filter: ${genre}`}
          >
            {genre} ×
          </button>
        )}
      </div>

      {/* Search icon toggle */}
      <button
        onClick={handleToggle}
        className="flex items-center justify-center w-8 h-8 transition-opacity hover:opacity-80"
        style={{ color: isExpanded ? 'var(--color-brand)' : 'var(--color-text-secondary)' }}
        aria-label={isExpanded ? 'Close search' : 'Open search'}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
      </button>

      {/* Dropdown */}
      {isExpanded && (
        <SearchDropdown
          query={query}
          genre={genre}
          results={results}
          genres={genres}
          loading={loading}
          error={error}
          onGenreSelect={handleGenreSelect}
          onResultClick={handleResultClick}
        />
      )}
    </div>
  );
}
