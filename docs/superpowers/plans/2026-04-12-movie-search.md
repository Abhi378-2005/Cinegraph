# Movie Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Navbar search bar with BigQuery-backed substring title search, Redis lazy-caching, and genre chip filtering.

**Architecture:** The backend exposes `GET /movies/search?q=&genre=` and `GET /movies/genres`. On each search request it checks Redis for a cached result (`search:<q>:<genre>`) and falls through to BigQuery on miss, writing the result back to Redis with a 1-hour TTL. The frontend adds an expandable search bar to the Navbar that debounces 400ms before firing, shows a dropdown overlay with genre chips (empty state) or movie result cards (when typing).

**Tech Stack:** TypeScript, Express, `@google-cloud/bigquery`, `@upstash/redis`, Next.js App Router, React, Tailwind CSS, `next/image`, `next/navigation`.

---

## File Map

| Action | Path | Responsibility |
|--------|------|---------------|
| Modify | `backend/src/bigquery/movies.ts` | Export `rowToMovie` so `search.ts` can reuse it |
| Create | `backend/src/bigquery/search.ts` | `searchMoviesBQ` and `getGenresBQ` — raw BigQuery queries |
| Create | `backend/src/bigquery/search.test.ts` | Unit tests for BigQuery search functions |
| Modify | `backend/src/redis/movies.ts` | Replace KMP search with BQ-cached `searchMovies`; add `getGenres` |
| Create | `backend/src/redis/movies.test.ts` | Unit tests for cache hit/miss logic |
| Modify | `backend/src/routes/movies.ts` | Add `genre` param to search route; add `/genres` route |
| Modify | `frontend/lib/api.ts` | Add `genre` param to `searchMovies`; add `getGenres` |
| Create | `frontend/components/layout/SearchDropdown.tsx` | Dropdown panel: genre chips + movie result cards |
| Create | `frontend/components/layout/SearchBar.tsx` | Expandable input, debounce, state, mounts SearchDropdown |
| Modify | `frontend/components/layout/Navbar.tsx` | Mount `<SearchBar />` |

---

## Task 1: Export `rowToMovie` from `bigquery/movies.ts`

**Files:**
- Modify: `backend/src/bigquery/movies.ts`

`rowToMovie` is currently a private function. `search.ts` (Task 2) needs it.

- [ ] **Step 1: Add `export` to `rowToMovie`**

In `backend/src/bigquery/movies.ts`, change line 7 from:
```ts
function rowToMovie(row: Record<string, unknown>): Movie {
```
to:
```ts
export function rowToMovie(row: Record<string, unknown>): Movie {
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd backend && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add backend/src/bigquery/movies.ts
git commit -m "refactor(bigquery): export rowToMovie for reuse"
```

---

## Task 2: Create `bigquery/search.ts` with tests

**Files:**
- Create: `backend/src/bigquery/search.ts`
- Create: `backend/src/bigquery/search.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `backend/src/bigquery/search.test.ts`:

```ts
import { searchMoviesBQ, getGenresBQ } from './search';

const mockQuery = jest.fn();
jest.mock('./client', () => ({
  bq: { query: (...args: unknown[]) => mockQuery(...args) },
}));

const FAKE_ROW = {
  movie_id: 1,
  title: 'Batman Begins',
  overview: 'Bruce Wayne becomes Batman.',
  poster_path: '/batman.jpg',
  backdrop_path: '/batman_bd.jpg',
  release_year: 2005,
  genres: ['Action', 'Drama'],
  cast_names: ['Christian Bale'],
  director: 'Christopher Nolan',
  keywords: ['superhero'],
  vote_average: 8.2,
  vote_count: 15000,
  popularity: 45.3,
  runtime: 140,
};

describe('searchMoviesBQ', () => {
  beforeEach(() => mockQuery.mockReset());

  it('returns mapped Movie objects on match', async () => {
    mockQuery.mockResolvedValue([[FAKE_ROW]]);
    const results = await searchMoviesBQ('batman', '', 20);
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(1);
    expect(results[0].title).toBe('Batman Begins');
    expect(results[0].genres).toEqual(['Action', 'Drama']);
    expect(results[0].cast).toEqual(['Christian Bale']);
  });

  it('returns empty array when BQ returns no rows', async () => {
    mockQuery.mockResolvedValue([[]]);
    const results = await searchMoviesBQ('xyz', '', 20);
    expect(results).toHaveLength(0);
  });

  it('passes normalized query and genre params', async () => {
    mockQuery.mockResolvedValue([[FAKE_ROW]]);
    await searchMoviesBQ('batman', 'action', 20);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        params: expect.objectContaining({ query: 'batman', genre: 'action', limit: 20 }),
      })
    );
  });
});

describe('getGenresBQ', () => {
  beforeEach(() => mockQuery.mockReset());

  it('returns genre strings from rows', async () => {
    mockQuery.mockResolvedValue([[{ genre: 'Action' }, { genre: 'Comedy' }]]);
    const genres = await getGenresBQ();
    expect(genres).toEqual(['Action', 'Comedy']);
  });

  it('returns empty array when no genres found', async () => {
    mockQuery.mockResolvedValue([[]]);
    const genres = await getGenresBQ();
    expect(genres).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL (module not found)**

```bash
cd backend && npm test -- --testPathPattern=bigquery/search.test
```
Expected: FAIL — `Cannot find module './search'`

- [ ] **Step 3: Implement `backend/src/bigquery/search.ts`**

```ts
import { bq } from './client';
import { rowToMovie } from './movies';
import type { Movie } from '../types';
import { log, timer } from '../logger';

const DS = `${process.env.GCP_PROJECT_ID ?? 'cinegraph'}.${process.env.GCP_DATASET_ID ?? 'cinegraph'}`;

export async function searchMoviesBQ(
  query: string,
  genre: string,
  limit = 20
): Promise<Movie[]> {
  const elapsed = timer();
  const [rows] = await bq.query({
    query: `
      SELECT movie_id, title, overview, poster_path, backdrop_path, release_year,
             genres, cast_names, director, keywords,
             vote_average, vote_count, popularity, runtime
      FROM \`${DS}.movies\`
      WHERE (@query = '' OR LOWER(title) LIKE CONCAT('%', @query, '%'))
        AND (@genre = '' OR EXISTS (
          SELECT 1 FROM UNNEST(genres) g WHERE LOWER(g) LIKE CONCAT('%', @genre, '%')
        ))
      LIMIT @limit
    `,
    params: { query, genre, limit },
    parameterMode: 'NAMED',
  });
  log.bq(`searchMoviesBQ(q="${query}", genre="${genre}") → ${rows.length} rows  (${elapsed()})`);
  return (rows as Record<string, unknown>[]).map(rowToMovie);
}

export async function getGenresBQ(): Promise<string[]> {
  const elapsed = timer();
  const [rows] = await bq.query({
    query: `
      SELECT DISTINCT g AS genre
      FROM \`${DS}.movies\`, UNNEST(genres) AS g
      ORDER BY g
    `,
    parameterMode: 'NAMED',
    params: {},
  });
  log.bq(`getGenresBQ() → ${rows.length} genres  (${elapsed()})`);
  return (rows as { genre: string }[]).map(r => r.genre);
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd backend && npm test -- --testPathPattern=bigquery/search.test
```
Expected: PASS — 5 tests pass.

- [ ] **Step 5: Verify TypeScript**

```bash
cd backend && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add backend/src/bigquery/search.ts backend/src/bigquery/search.test.ts
git commit -m "feat(bigquery): add searchMoviesBQ and getGenresBQ"
```

---

## Task 3: Update `redis/movies.ts` — replace KMP search, add `getGenres`

**Files:**
- Modify: `backend/src/redis/movies.ts`
- Create: `backend/src/redis/movies.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `backend/src/redis/movies.test.ts`:

```ts
import { searchMovies, getGenres } from './movies';

const mockRedisGet = jest.fn();
const mockRedisSet = jest.fn();
jest.mock('./client', () => ({
  redis: {
    get: (...args: unknown[]) => mockRedisGet(...args),
    set: (...args: unknown[]) => mockRedisSet(...args),
    hgetall: jest.fn(),
    sadd: jest.fn(),
    hset: jest.fn(),
    smembers: jest.fn(),
    zrange: jest.fn(),
    zadd: jest.fn(),
  },
}));

const mockSearchMoviesBQ = jest.fn();
const mockGetGenresBQ = jest.fn();
jest.mock('../bigquery/search', () => ({
  searchMoviesBQ: (...args: unknown[]) => mockSearchMoviesBQ(...args),
  getGenresBQ: (...args: unknown[]) => mockGetGenresBQ(...args),
}));

// Also mock bigquery/movies to prevent Redis client init errors in transitive imports
jest.mock('../bigquery/movies', () => ({
  getBQMovie: jest.fn(),
  getBQPopular: jest.fn(),
  rowToMovie: jest.fn(),
}));

const FAKE_MOVIES = [
  {
    id: 1, title: 'Batman Begins', overview: '', posterPath: '/x.jpg',
    backdropPath: undefined, releaseYear: 2005, genres: ['Action'],
    cast: ['Christian Bale'], director: 'Nolan', keywords: [],
    voteAverage: 8.2, voteCount: 15000, popularity: 45, runtime: 140,
  },
];

describe('searchMovies', () => {
  beforeEach(() => {
    mockRedisGet.mockReset();
    mockRedisSet.mockReset();
    mockSearchMoviesBQ.mockReset();
  });

  it('returns cached results on Redis HIT', async () => {
    mockRedisGet.mockResolvedValue(FAKE_MOVIES);
    const results = await searchMovies('batman', '', 20);
    expect(results).toEqual(FAKE_MOVIES);
    expect(mockSearchMoviesBQ).not.toHaveBeenCalled();
  });

  it('calls BigQuery and caches result on Redis MISS', async () => {
    mockRedisGet.mockResolvedValue(null);
    mockSearchMoviesBQ.mockResolvedValue(FAKE_MOVIES);
    const results = await searchMovies('batman', '', 20);
    expect(results).toEqual(FAKE_MOVIES);
    expect(mockSearchMoviesBQ).toHaveBeenCalledWith('batman', '', 20);
    expect(mockRedisSet).toHaveBeenCalledWith('search:batman:', FAKE_MOVIES, { ex: 3600 });
  });

  it('normalizes query and genre to lowercase before cache key', async () => {
    mockRedisGet.mockResolvedValue(null);
    mockSearchMoviesBQ.mockResolvedValue([]);
    await searchMovies('BATMAN', 'ACTION', 20);
    expect(mockRedisGet).toHaveBeenCalledWith('search:batman:action');
  });

  it('falls through to BigQuery when Redis.get throws', async () => {
    mockRedisGet.mockRejectedValue(new Error('Redis down'));
    mockSearchMoviesBQ.mockResolvedValue(FAKE_MOVIES);
    const results = await searchMovies('batman', '', 20);
    expect(results).toEqual(FAKE_MOVIES);
  });
});

describe('getGenres', () => {
  beforeEach(() => {
    mockRedisGet.mockReset();
    mockRedisSet.mockReset();
    mockGetGenresBQ.mockReset();
  });

  it('returns cached genres on Redis HIT', async () => {
    mockRedisGet.mockResolvedValue(['Action', 'Comedy', 'Drama']);
    const genres = await getGenres();
    expect(genres).toEqual(['Action', 'Comedy', 'Drama']);
    expect(mockGetGenresBQ).not.toHaveBeenCalled();
  });

  it('fetches from BigQuery and caches with 24h TTL on Redis MISS', async () => {
    mockRedisGet.mockResolvedValue(null);
    mockGetGenresBQ.mockResolvedValue(['Action', 'Comedy']);
    const genres = await getGenres();
    expect(genres).toEqual(['Action', 'Comedy']);
    expect(mockRedisSet).toHaveBeenCalledWith('movies:genres', ['Action', 'Comedy'], { ex: 86400 });
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd backend && npm test -- --testPathPattern=redis/movies.test
```
Expected: FAIL — `getGenres is not exported` / `searchMovies signature mismatch`

- [ ] **Step 3: Replace KMP search and add `getGenres` in `backend/src/redis/movies.ts`**

Replace the entire block from `// KMP-based title search` through the end of `searchMovies` (lines 100–144), and add the `getGenres` function. Also add the new import at the top.

At the top of `backend/src/redis/movies.ts`, add to the existing imports:
```ts
import { searchMoviesBQ, getGenresBQ } from '../bigquery/search';
```

Then delete lines 100–144 (the `buildLPS`, `kmpSearch`, and old `searchMovies` functions) and replace with:

```ts
export async function searchMovies(
  query: string,
  genre = '',
  limit = 20
): Promise<Movie[]> {
  const q = query.toLowerCase().trim();
  const g = genre.toLowerCase().trim();
  const key = `search:${q}:${g}`;

  try {
    const cached = await redis.get<Movie[]>(key);
    if (cached) {
      log.redis(`HIT  ${key} → ${cached.length} results`);
      return cached;
    }
  } catch {
    log.redis(`WARN redis.get(${key}) failed — falling through to BigQuery`);
  }

  log.redis(`MISS ${key} → querying BigQuery`);
  const elapsed = timer();
  const movies = await searchMoviesBQ(q, g, limit);
  log.redis(`BQ   searchMovies("${q}", "${g}") → ${movies.length} results  (${elapsed()})`);

  try {
    await redis.set(key, movies, { ex: 3600 });
  } catch {
    log.redis(`WARN redis.set(${key}) failed — result not cached`);
  }

  return movies;
}

export async function getGenres(): Promise<string[]> {
  const key = 'movies:genres';

  try {
    const cached = await redis.get<string[]>(key);
    if (cached) {
      log.redis(`HIT  ${key} → ${cached.length} genres`);
      return cached;
    }
  } catch {
    log.redis(`WARN redis.get(${key}) failed — falling through to BigQuery`);
  }

  log.redis(`MISS ${key} → querying BigQuery`);
  const genres = await getGenresBQ();

  try {
    await redis.set(key, genres, { ex: 86400 });
  } catch {
    log.redis(`WARN redis.set(${key}) failed — genres not cached`);
  }

  return genres;
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd backend && npm test -- --testPathPattern=redis/movies.test
```
Expected: PASS — 6 tests pass.

- [ ] **Step 5: Verify TypeScript**

```bash
cd backend && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add backend/src/redis/movies.ts backend/src/redis/movies.test.ts
git commit -m "feat(redis): replace KMP search with BigQuery-backed cached searchMovies, add getGenres"
```

---

## Task 4: Update `routes/movies.ts` — genre param + `/genres` route

**Files:**
- Modify: `backend/src/routes/movies.ts`

- [ ] **Step 1: Update the search route and add `/genres`**

Replace the contents of `backend/src/routes/movies.ts` with:

```ts
import { Router } from 'express';
import { getMovie, searchMovies, getGenres } from '../redis/movies';
import { getTopSimilar } from '../bigquery/similarity';
import { log, timer } from '../logger';

export const moviesRouter = Router();

// GET /movies/genres
moviesRouter.get('/genres', async (_req, res) => {
  try {
    const genres = await getGenres();
    res.json({ genres });
  } catch (err) {
    console.error('Genres error:', err);
    res.status(500).json({ error: 'Failed to load genres' });
  }
});

// GET /movies/search?q=<query>&genre=<genre>
moviesRouter.get('/search', async (req, res) => {
  const q = String(req.query.q ?? '').trim();
  const genre = String(req.query.genre ?? '').trim();
  if (!q && !genre) return res.status(400).json({ error: 'Provide q or genre' });

  log.http(`search  q="${q}" genre="${genre}"`);
  try {
    const elapsed = timer();
    const movies = await searchMovies(q, genre, 20);
    log.http(`search "${q}" genre="${genre}" → ${movies.length} results  (${elapsed()})`);
    res.json({ movies });
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Search failed' });
  }
});

// GET /movies/:id — returns { movie, similar: Movie[] }
moviesRouter.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid movie id' });
  try {
    const elapsed = timer();
    const movie = await getMovie(id);
    if (!movie) return res.status(404).json({ error: 'Movie not found' });

    log.http(`movie:${id} "${movie.title}" fetched  (${elapsed()})`);

    const simElapsed = timer();
    const similarEntries = await getTopSimilar(id, 6);
    const similarMovies = (
      await Promise.all(similarEntries.map(e => getMovie(e.similarMovieId)))
    ).filter((m): m is NonNullable<typeof m> => m !== null);

    log.http(`movie:${id} similar → ${similarMovies.length} movies  (${simElapsed()})`);
    res.json({ movie, similar: similarMovies });
  } catch (err) {
    console.error('Movie detail error:', err);
    res.status(500).json({ error: 'Failed to load movie' });
  }
});
```

Note: `/genres` must come before `/:id` to avoid Express matching "genres" as an id param.

- [ ] **Step 2: Verify TypeScript**

```bash
cd backend && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Manual smoke test (requires running backend)**

```bash
# In one terminal:
cd backend && npm run dev

# In another terminal:
curl "http://localhost:3001/movies/genres"
# Expected: { "genres": ["Action", "Adventure", "Animation", ...] }

curl "http://localhost:3001/movies/search?q=batman"
# Expected: { "movies": [...] }  (1-2s cold, instant on repeat)

curl "http://localhost:3001/movies/search?genre=action"
# Expected: { "movies": [...] }

curl "http://localhost:3001/movies/search"
# Expected: 400 { "error": "Provide q or genre" }
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/movies.ts
git commit -m "feat(routes): add genre param to search, add /movies/genres endpoint"
```

---

## Task 5: Update `frontend/lib/api.ts`

**Files:**
- Modify: `frontend/lib/api.ts`

- [ ] **Step 1: Update `searchMovies` and add `getGenres`**

In `frontend/lib/api.ts`, replace the existing `searchMovies` method and add `getGenres` inside the `api` object:

```ts
  /** Substring title search with optional genre filter. */
  async searchMovies(query: string, genre = ''): Promise<{ movies: Movie[] }> {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (genre) params.set('genre', genre);
    return apiFetch(`/movies/search?${params.toString()}`);
  },

  /** Returns the distinct genre list (cached on backend). */
  async getGenres(): Promise<{ genres: string[] }> {
    return apiFetch('/movies/genres');
  },
```

- [ ] **Step 2: Type-check**

```bash
cd frontend && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/lib/api.ts
git commit -m "feat(api): add genre param to searchMovies, add getGenres"
```

---

## Task 6: Create `SearchDropdown.tsx`

**Files:**
- Create: `frontend/components/layout/SearchDropdown.tsx`

- [ ] **Step 1: Create the component**

Create `frontend/components/layout/SearchDropdown.tsx`:

```tsx
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

      {/* Idle state: no query, no genre selected, no genre chips loaded yet */}
      {!showResults && !showGenreChips && (
        <p className="p-4 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
          Type to search or pick a genre.
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd frontend && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/layout/SearchDropdown.tsx
git commit -m "feat(ui): add SearchDropdown component with genre chips and result cards"
```

---

## Task 7: Create `SearchBar.tsx`

**Files:**
- Create: `frontend/components/layout/SearchBar.tsx`

- [ ] **Step 1: Create the component**

Create `frontend/components/layout/SearchBar.tsx`:

```tsx
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
    const next = genre === g ? '' : g; // toggle off if same genre clicked again
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
          // Prevent placeholder from showing white text
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
```

- [ ] **Step 2: Type-check**

```bash
cd frontend && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/layout/SearchBar.tsx
git commit -m "feat(ui): add SearchBar with debounce, genre filter, and expand animation"
```

---

## Task 8: Mount `SearchBar` in `Navbar.tsx`

**Files:**
- Modify: `frontend/components/layout/Navbar.tsx`

- [ ] **Step 1: Add the import and mount `<SearchBar />`**

In `frontend/components/layout/Navbar.tsx`, add the import after the existing imports:

```ts
import { SearchBar } from '@/components/layout/SearchBar';
```

Then in the JSX, inside the right-side `<div className="flex items-center gap-3">`, add `<SearchBar />` before the phase badge span:

```tsx
      {/* Right: Search + Phase badge + avatar */}
      <div className="flex items-center gap-3">
        <SearchBar />
        <span
          className={`text-xs font-bold px-2 py-1 rounded ${PHASE_COLORS[phase]} text-white tracking-wider`}
        >
          {PHASE_LABELS[phase]}
        </span>
        <button
          onClick={() => setProfileOpen(true)}
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white transition-opacity hover:opacity-80"
          style={{ backgroundColor: 'var(--color-brand)' }}
          aria-label="Open profile"
        >
          CG
        </button>
      </div>
```

- [ ] **Step 2: Type-check and lint**

```bash
cd frontend && npx tsc --noEmit && npm run lint
```
Expected: no errors.

- [ ] **Step 3: Verify the UI in dev server**

```bash
cd frontend && npm run dev
```

Open `http://localhost:3000/discover` and verify:
- Search icon appears to the left of the COLD badge in the Navbar
- Clicking it expands an input with a brand-colored underline
- Typing triggers a dropdown after ~400ms
- Empty state shows genre chips
- Clicking a genre chip highlights it and shows genre-filtered results
- Clicking a result navigates to `/movie/[id]`
- Escape or clicking outside collapses the bar

- [ ] **Step 4: Commit**

```bash
git add frontend/components/layout/Navbar.tsx
git commit -m "feat(navbar): mount SearchBar with expandable movie search"
```
