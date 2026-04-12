# Movie Search Feature — Design Spec
**Date:** 2026-04-12
**Status:** Approved

## Overview

Add a movie search feature to CineGraph with substring title matching, genre filtering via chips, and a lazy BigQuery → Redis cache architecture that scales to 20,000+ movies without pre-loading data into Redis.

---

## Architecture & Data Flow

```
User types in Navbar search bar
  → 400ms debounce
  → GET /movies/search?q=<title>&genre=<genre>

Backend:
  1. Normalize query (lowercase, trim)
  2. Check Redis: GET search:<q>:<genre>
     → HIT  → return cached JSON immediately (< 50ms)
     → MISS → query BigQuery:
               SELECT id, title, genres, posterPath, ...
               FROM movies
               WHERE LOWER(title) LIKE '%<q>%'
                 AND (genre filter if provided)
               LIMIT 20
             → SETEX search:<q>:<genre> 3600 <json>
             → return results (1–2s cold)

Frontend:
  → Dropdown renders up to 8 movie result cards
  → If query is empty + input focused → show genre chips
  → Clicking genre chip sets genre filter; typing filters chips by substring
```

**Cache key format:** `search:<normalized-query>:<genre-or-empty>`
Examples: `search:batman:action`, `search:batman:`, `search::drama`

**TTL:** 3600 seconds (1 hour). Balances freshness vs. Redis memory usage.

---

## Frontend Components

### Navbar changes (`frontend/components/layout/Navbar.tsx`)
- Add a search icon button on the right side (before the phase badge)
- Clicking it mounts `<SearchBar />` which expands an animated input (~220px wide, slides in from right)
- Clicking outside or pressing Escape collapses and clears the query

### New: `frontend/components/layout/SearchBar.tsx`
Responsibilities:
- Manages expand/collapse animation state
- Owns query string state and 400ms debounce timer
- Owns selected genre state
- Calls `api.searchMovies(query, genre)` after debounce fires
- Renders `<SearchDropdown />` when focused

### New: `frontend/components/layout/SearchDropdown.tsx`
Responsibilities:
- **Empty query + focused:** renders genre chips fetched from `GET /movies/genres`
  - Chips are filtered by substring as user types in genre search (e.g. "act" → "Action")
- **Query present:** renders up to 8 movie result cards
  - Each card: poster thumbnail + title + release year + first genre pill
  - Clicking navigates to `/movie/[id]`
- Loading spinner while debounce + BQ query runs
- "No results" empty state

### Modified: `frontend/lib/api.ts`
- Update `searchMovies(query, genre?)` to pass optional `genre` query param
- Add `getGenres(): Promise<{ genres: string[] }>` for the genre chips

---

## Backend Changes

### Modified: `backend/src/routes/movies.ts`
- `GET /movies/search?q=<title>&genre=<genre>` — both params optional, at least one required
- `GET /movies/genres` — returns distinct genre list (Redis-cached, BQ-sourced)

### New: `backend/src/bigquery/search.ts`
```ts
export async function searchMoviesBQ(
  query: string,
  genre: string,
  limit = 20
): Promise<Movie[]>
```
Uses the same `DS` constant pattern as `bigquery/movies.ts`:
```ts
const DS = `${process.env.GCP_PROJECT_ID ?? 'cinegraph'}.${process.env.GCP_DATASET_ID ?? 'cinegraph'}`;
```
BigQuery SQL (parameterized to prevent injection):
```sql
SELECT movie_id, title, overview, poster_path, backdrop_path, release_year,
       genres, cast_names, director, keywords,
       vote_average, vote_count, popularity, runtime
FROM `<DS>.movies`
WHERE (@query = '' OR LOWER(title) LIKE CONCAT('%', @query, '%'))
  AND (@genre = '' OR EXISTS (
    SELECT 1 FROM UNNEST(genres) g WHERE LOWER(g) LIKE CONCAT('%', @genre, '%')
  ))
LIMIT @limit
```
Row mapping reuses `rowToMovie` exported from `bigquery/movies.ts`.

### Modified: `backend/src/redis/movies.ts`
- `searchMovies(query, genre, limit)` becomes a cache wrapper:
  1. Normalize: `q = query.toLowerCase().trim()`, `g = genre.toLowerCase().trim()`
  2. Key: `search:${q}:${g}`
  3. Redis GET → return if hit
  4. Call `searchMoviesBQ(q, g, limit)` on miss
  5. `SETEX` result with 3600s TTL
  6. Return results
- Remove the old KMP search logic (replaced entirely)

### Genre list caching (`backend/src/redis/movies.ts`)
```ts
export async function getGenres(): Promise<string[]>
```
- Redis key: `movies:genres`
- On miss: `SELECT DISTINCT genre FROM movies CROSS JOIN UNNEST(genres) genre ORDER BY genre`
- Cache with 24h TTL (genres rarely change)

---

## Error Handling

| Scenario | Behavior |
|---|---|
| BigQuery timeout / error | Return 500; frontend shows "Search unavailable" in dropdown |
| Empty results | Return `{ movies: [] }`; frontend shows "No results found" |
| Redis unavailable | Fall through to BigQuery (Redis calls wrapped in try/catch) |
| Both `q` and `genre` empty | Backend returns 400; frontend disables request when both are empty |

---

## Files Changed

| File | Change |
|---|---|
| `backend/src/routes/movies.ts` | Add `genre` param to search route; add `/genres` route |
| `backend/src/redis/movies.ts` | Replace KMP `searchMovies` with BQ-cached version; add `getGenres` |
| `backend/src/bigquery/search.ts` | **New** — BigQuery search + genre query functions |
| `frontend/components/layout/Navbar.tsx` | Mount `<SearchBar />` |
| `frontend/components/layout/SearchBar.tsx` | **New** — expandable input, debounce, state |
| `frontend/components/layout/SearchDropdown.tsx` | **New** — results panel + genre chips |
| `frontend/lib/api.ts` | Update `searchMovies`; add `getGenres` |
