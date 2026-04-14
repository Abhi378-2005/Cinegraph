# BigQuery Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Google BigQuery as the primary data store for 100k movies, feature vectors, and pre-computed top-50 similarity scores, with Redis as a hot cache in front of BigQuery.

**Architecture:** A `src/bigquery/` module mirrors the existing `src/redis/` interface. The existing `redis/movies.ts` and `redis/vectors.ts` functions gain a cache-aside BigQuery fallback — on Redis miss they query BigQuery, populate Redis, and return. `contentBased.ts` is updated to replace the 100k full-scan with pre-computed similarity lookups. A one-time `scripts/migrateToBigQuery.ts` script fetches 100k movies from the TMDB proxy, builds feature vectors using the existing `buildFeatureVector` function, and uploads everything to BigQuery via MERGE upserts.

**Tech Stack:** `@google-cloud/bigquery` Node.js SDK, Jest (ts-jest), existing `cosineSimilarity` + `buildFeatureVector` from `src/ml/`, axios for TMDB proxy calls, `fs` + JSON for checkpoint files.

---

## File Map

### New files
| File | Responsibility |
|---|---|
| `src/bigquery/client.ts` | BigQuery singleton + auto-create tables on first use |
| `src/bigquery/schema.ts` | BigQuery table schema definitions |
| `src/bigquery/movies.ts` | `getBQMovie`, `getBQMovieBatch`, `getBQPopular` |
| `src/bigquery/vectors.ts` | `getBQVector`, `getBQVectorBatch` |
| `src/bigquery/similarity.ts` | `getTopSimilar(movieId, limit)` |
| `src/bigquery/upsert.ts` | `upsertMovies`, `upsertVectors`, `upsertSimilarity` |
| `src/bigquery/__tests__/movies.test.ts` | Unit tests for movies.ts (mocked BQ) |
| `src/bigquery/__tests__/vectors.test.ts` | Unit tests for vectors.ts (mocked BQ) |
| `src/bigquery/__tests__/similarity.test.ts` | Unit tests for similarity.ts (mocked BQ) |
| `scripts/migrateToBigQuery.ts` | Migration orchestrator |
| `scripts/migration/fetchMovies.ts` | Paginated TMDB proxy fetch with checkpoint |
| `scripts/migration/computeSimilarity.ts` | Chunked top-50 cosine similarity batch job |

### Modified files
| File | Change |
|---|---|
| `src/redis/movies.ts` | Add BigQuery cache-aside fallback to `getMovie` and `getPopularMovieIds` |
| `src/redis/vectors.ts` | Add BigQuery cache-aside fallback to `getVector` |
| `src/ml/contentBased.ts` | Replace `getAllMovieIds` full-scan with `getTopSimilar` lookups |
| `package.json` | Add `@google-cloud/bigquery` dependency |
| `.env.example` | Add `GCP_PROJECT_ID`, `GCP_DATASET_ID`, `GOOGLE_APPLICATION_CREDENTIALS` |
| `.gitignore` | Add `secrets/` directory |
| `jest.config.ts` | No change needed — tests live in `src/` |

---

## Task 1: Install dependency and update config files

**Files:**
- Modify: `backend/package.json`
- Modify: `backend/.env.example` (create if not present)
- Modify: `backend/.gitignore` (create if not present)

- [ ] **Step 1: Install @google-cloud/bigquery**

```bash
cd backend && npm install @google-cloud/bigquery
```

Expected: `@google-cloud/bigquery` appears in `package.json` dependencies.

- [ ] **Step 2: Add GCP variables to .env.example**

Add to the bottom of `backend/.env.example` (or create it with existing vars + these):

```
# Google BigQuery
GCP_PROJECT_ID=cinegraph-xxxxx
GCP_DATASET_ID=cinegraph
GOOGLE_APPLICATION_CREDENTIALS=./secrets/gcp-service-account.json
```

- [ ] **Step 3: Gitignore the secrets directory**

Add to `backend/.gitignore`:

```
# GCP service account key
secrets/
```

Then create the empty directory so git tracks it:

```bash
mkdir -p backend/secrets && touch backend/secrets/.gitkeep
```

Add `secrets/.gitkeep` to git but never the JSON key inside it.

- [ ] **Step 4: Add migration npm scripts to package.json**

In `backend/package.json`, add to `"scripts"`:

```json
"migrate": "ts-node --transpile-only scripts/migrateToBigQuery.ts",
"migrate:resume": "ts-node --transpile-only scripts/migrateToBigQuery.ts --resume",
"migrate:similarity-only": "ts-node --transpile-only scripts/migrateToBigQuery.ts --similarity-only"
```

- [ ] **Step 5: Commit**

```bash
cd backend && git add package.json package-lock.json .env.example .gitignore secrets/.gitkeep
git commit -m "chore: add @google-cloud/bigquery dependency and GCP config"
```

---

## Task 2: BigQuery schema definitions

**Files:**
- Create: `backend/src/bigquery/schema.ts`

No unit test needed — this is pure data (table field definitions).

- [ ] **Step 1: Create schema.ts**

```typescript
// backend/src/bigquery/schema.ts
import type { TableField } from '@google-cloud/bigquery';

export const MOVIES_SCHEMA: TableField[] = [
  { name: 'movie_id',           type: 'INTEGER',   mode: 'REQUIRED' },
  { name: 'title',              type: 'STRING',    mode: 'REQUIRED' },
  { name: 'original_title',     type: 'STRING',    mode: 'NULLABLE' },
  { name: 'overview',           type: 'STRING',    mode: 'NULLABLE' },
  { name: 'poster_path',        type: 'STRING',    mode: 'NULLABLE' },
  { name: 'backdrop_path',      type: 'STRING',    mode: 'NULLABLE' },
  { name: 'release_year',       type: 'INTEGER',   mode: 'NULLABLE' },
  { name: 'original_language',  type: 'STRING',    mode: 'NULLABLE' },
  { name: 'popularity',         type: 'FLOAT64',   mode: 'NULLABLE' },
  { name: 'vote_average',       type: 'FLOAT64',   mode: 'NULLABLE' },
  { name: 'vote_count',         type: 'INTEGER',   mode: 'NULLABLE' },
  { name: 'runtime',            type: 'INTEGER',   mode: 'NULLABLE' },
  { name: 'genres',             type: 'STRING',    mode: 'REPEATED' },
  { name: 'cast_names',         type: 'STRING',    mode: 'REPEATED' },
  { name: 'director',           type: 'STRING',    mode: 'NULLABLE' },
  { name: 'keywords',           type: 'STRING',    mode: 'REPEATED' },
  { name: 'updated_at',         type: 'TIMESTAMP', mode: 'REQUIRED' },
];

export const MOVIE_FEATURES_SCHEMA: TableField[] = [
  { name: 'movie_id',         type: 'INTEGER',  mode: 'REQUIRED' },
  { name: 'feature_vector',   type: 'FLOAT64',  mode: 'REPEATED' },
  { name: 'feature_version',  type: 'INTEGER',  mode: 'REQUIRED' },
  { name: 'updated_at',       type: 'TIMESTAMP',mode: 'REQUIRED' },
];

export const MOVIE_SIMILARITY_SCHEMA: TableField[] = [
  { name: 'movie_id',          type: 'INTEGER',  mode: 'REQUIRED' },
  { name: 'similar_movie_id',  type: 'INTEGER',  mode: 'REQUIRED' },
  { name: 'similarity_score',  type: 'FLOAT64',  mode: 'REQUIRED' },
  { name: 'rank',              type: 'INTEGER',  mode: 'REQUIRED' },
  { name: 'signal_breakdown',  type: 'STRING',   mode: 'NULLABLE' },
  { name: 'computed_at',       type: 'TIMESTAMP',mode: 'REQUIRED' },
];

export const USER_RATINGS_SCHEMA: TableField[] = [
  { name: 'session_token', type: 'STRING',    mode: 'REQUIRED' },
  { name: 'movie_id',      type: 'INTEGER',   mode: 'REQUIRED' },
  { name: 'rating',        type: 'FLOAT64',   mode: 'REQUIRED' },
  { name: 'rated_at',      type: 'TIMESTAMP', mode: 'REQUIRED' },
];

export const TABLE_NAMES = {
  movies:     'movies',
  features:   'movie_features',
  similarity: 'movie_similarity',
  ratings:    'user_ratings',
} as const;
```

- [ ] **Step 2: Commit**

```bash
git add src/bigquery/schema.ts
git commit -m "feat(bigquery): add table schema definitions"
```

---

## Task 3: BigQuery client singleton with auto-table creation

**Files:**
- Create: `backend/src/bigquery/client.ts`
- Create: `backend/src/bigquery/__tests__/client.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// backend/src/bigquery/__tests__/client.test.ts
const mockExists = jest.fn();
const mockCreate = jest.fn();
const mockTable  = jest.fn(() => ({ exists: mockExists, create: mockCreate }));
const mockDataset = jest.fn(() => ({ table: mockTable }));

jest.mock('@google-cloud/bigquery', () => ({
  BigQuery: jest.fn().mockImplementation(() => ({
    dataset: mockDataset,
  })),
}));

import { ensureTables } from '../client';
import { TABLE_NAMES } from '../schema';

describe('ensureTables', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('creates a table when it does not exist', async () => {
    mockExists.mockResolvedValue([false]);
    mockCreate.mockResolvedValue([{}]);

    await ensureTables();

    expect(mockCreate).toHaveBeenCalledTimes(
      Object.keys(TABLE_NAMES).length
    );
  });

  it('skips creation when table already exists', async () => {
    mockExists.mockResolvedValue([true]);

    await ensureTables();

    expect(mockCreate).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && npx jest src/bigquery/__tests__/client.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '../client'`

- [ ] **Step 3: Create client.ts**

```typescript
// backend/src/bigquery/client.ts
import { BigQuery } from '@google-cloud/bigquery';
import {
  MOVIES_SCHEMA, MOVIE_FEATURES_SCHEMA,
  MOVIE_SIMILARITY_SCHEMA, USER_RATINGS_SCHEMA,
  TABLE_NAMES,
} from './schema';

export const bq = new BigQuery({
  projectId: process.env.GCP_PROJECT_ID,
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
});

export const dataset = bq.dataset(process.env.GCP_DATASET_ID ?? 'cinegraph');

const TABLE_SCHEMAS = {
  [TABLE_NAMES.movies]:     MOVIES_SCHEMA,
  [TABLE_NAMES.features]:   MOVIE_FEATURES_SCHEMA,
  [TABLE_NAMES.similarity]: MOVIE_SIMILARITY_SCHEMA,
  [TABLE_NAMES.ratings]:    USER_RATINGS_SCHEMA,
};

export async function ensureTables(): Promise<void> {
  for (const [name, schema] of Object.entries(TABLE_SCHEMAS)) {
    const table = dataset.table(name);
    const [exists] = await table.exists();
    if (!exists) {
      await table.create({ schema });
      console.log(`Created BigQuery table: ${name}`);
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd backend && npx jest src/bigquery/__tests__/client.test.ts --no-coverage
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/bigquery/client.ts src/bigquery/__tests__/client.test.ts
git commit -m "feat(bigquery): add BigQuery client singleton and table auto-creation"
```

---

## Task 4: BigQuery movies read module

**Files:**
- Create: `backend/src/bigquery/movies.ts`
- Create: `backend/src/bigquery/__tests__/movies.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// backend/src/bigquery/__tests__/movies.test.ts
const mockQuery = jest.fn();
jest.mock('../client', () => ({
  bq: { query: mockQuery },
}));

import { getBQMovie, getBQMovieBatch, getBQPopular } from '../movies';
import type { Movie } from '../../types';

const BQ_ROW = {
  movie_id: 1, title: 'Dune', original_title: 'Dune',
  overview: 'Epic sci-fi', poster_path: '/dune.jpg', backdrop_path: '/bg.jpg',
  release_year: 2021, original_language: 'en', popularity: 88.5,
  vote_average: 7.8, vote_count: 15000, runtime: 155,
  genres: ['Science Fiction', 'Adventure'], cast_names: ['Timothée Chalamet'],
  director: 'Denis Villeneuve', keywords: ['desert', 'prophecy'],
  updated_at: { value: '2026-01-01T00:00:00Z' },
};

const EXPECTED_MOVIE: Movie = {
  id: 1, title: 'Dune', overview: 'Epic sci-fi',
  posterPath: '/dune.jpg', backdropPath: '/bg.jpg',
  releaseYear: 2021, genres: ['Science Fiction', 'Adventure'],
  cast: ['Timothée Chalamet'], director: 'Denis Villeneuve',
  keywords: ['desert', 'prophecy'], voteAverage: 7.8,
  voteCount: 15000, popularity: 88.5, runtime: 155,
};

describe('getBQMovie', () => {
  it('returns a Movie when row exists', async () => {
    mockQuery.mockResolvedValue([[BQ_ROW]]);
    const movie = await getBQMovie(1);
    expect(movie).toEqual(EXPECTED_MOVIE);
  });

  it('returns null when no row found', async () => {
    mockQuery.mockResolvedValue([[]]);
    expect(await getBQMovie(999)).toBeNull();
  });
});

describe('getBQMovieBatch', () => {
  it('returns a map of movie_id → Movie', async () => {
    mockQuery.mockResolvedValue([[BQ_ROW]]);
    const map = await getBQMovieBatch([1]);
    expect(map.get(1)).toEqual(EXPECTED_MOVIE);
  });
});

describe('getBQPopular', () => {
  it('returns movies sorted by weighted score', async () => {
    mockQuery.mockResolvedValue([[BQ_ROW]]);
    const movies = await getBQPopular('Science Fiction', 10);
    expect(movies).toHaveLength(1);
    expect(movies[0].id).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && npx jest src/bigquery/__tests__/movies.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '../movies'`

- [ ] **Step 3: Create movies.ts**

```typescript
// backend/src/bigquery/movies.ts
import { bq } from './client';
import type { Movie } from '../types';

const DS = `${process.env.GCP_PROJECT_ID ?? 'cinegraph'}.${process.env.GCP_DATASET_ID ?? 'cinegraph'}`;

function rowToMovie(row: Record<string, unknown>): Movie {
  return {
    id:              Number(row.movie_id),
    title:           String(row.title),
    overview:        String(row.overview ?? ''),
    posterPath:      String(row.poster_path ?? ''),
    backdropPath:    row.backdrop_path ? String(row.backdrop_path) : undefined,
    releaseYear:     Number(row.release_year ?? 0),
    genres:          (row.genres as string[]) ?? [],
    cast:            (row.cast_names as string[]) ?? [],
    director:        String(row.director ?? ''),
    keywords:        (row.keywords as string[]) ?? [],
    voteAverage:     Number(row.vote_average ?? 0),
    voteCount:       Number(row.vote_count ?? 0),
    popularity:      Number(row.popularity ?? 0),
    runtime:         Number(row.runtime ?? 0),
  };
}

export async function getBQMovie(id: number): Promise<Movie | null> {
  const [rows] = await bq.query({
    query: `SELECT * FROM \`${DS}.movies\` WHERE movie_id = @id LIMIT 1`,
    params: { id },
  });
  return rows.length > 0 ? rowToMovie(rows[0] as Record<string, unknown>) : null;
}

export async function getBQMovieBatch(ids: number[]): Promise<Map<number, Movie>> {
  if (ids.length === 0) return new Map();
  const [rows] = await bq.query({
    query: `SELECT * FROM \`${DS}.movies\` WHERE movie_id IN UNNEST(@ids)`,
    params: { ids },
  });
  const map = new Map<number, Movie>();
  for (const row of rows as Record<string, unknown>[]) {
    const m = rowToMovie(row);
    map.set(m.id, m);
  }
  return map;
}

export async function getBQPopular(genre: string, limit = 50): Promise<Movie[]> {
  const [rows] = await bq.query({
    query: `
      SELECT *,
        (vote_average * 0.7) + (popularity / 1000.0 * 0.3) AS score
      FROM \`${DS}.movies\`
      WHERE @genre IN UNNEST(genres) AND vote_count > 100
      ORDER BY score DESC
      LIMIT @limit
    `,
    params: { genre, limit },
  });
  return (rows as Record<string, unknown>[]).map(rowToMovie);
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd backend && npx jest src/bigquery/__tests__/movies.test.ts --no-coverage
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/bigquery/movies.ts src/bigquery/__tests__/movies.test.ts
git commit -m "feat(bigquery): add BigQuery movies read module"
```

---

## Task 5: BigQuery vectors read module

**Files:**
- Create: `backend/src/bigquery/vectors.ts`
- Create: `backend/src/bigquery/__tests__/vectors.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// backend/src/bigquery/__tests__/vectors.test.ts
const mockQuery = jest.fn();
jest.mock('../client', () => ({
  bq: { query: mockQuery },
}));

import { getBQVector, getBQVectorBatch } from '../vectors';

const VECTOR = [1, 0, 1, 0.5, 0.8];

describe('getBQVector', () => {
  it('returns a number[] when row exists', async () => {
    mockQuery.mockResolvedValue([[{ movie_id: 1, feature_vector: VECTOR }]]);
    const v = await getBQVector(1);
    expect(v).toEqual(VECTOR);
  });

  it('returns null when no row found', async () => {
    mockQuery.mockResolvedValue([[]]);
    expect(await getBQVector(999)).toBeNull();
  });
});

describe('getBQVectorBatch', () => {
  it('returns a map of movie_id → vector', async () => {
    mockQuery.mockResolvedValue([[{ movie_id: 1, feature_vector: VECTOR }]]);
    const map = await getBQVectorBatch([1]);
    expect(map.get(1)).toEqual(VECTOR);
    expect(map.get(2)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && npx jest src/bigquery/__tests__/vectors.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '../vectors'`

- [ ] **Step 3: Create vectors.ts**

```typescript
// backend/src/bigquery/vectors.ts
import { bq } from './client';

const DS = `${process.env.GCP_PROJECT_ID ?? 'cinegraph'}.${process.env.GCP_DATASET_ID ?? 'cinegraph'}`;

export async function getBQVector(movieId: number): Promise<number[] | null> {
  const [rows] = await bq.query({
    query: `SELECT feature_vector FROM \`${DS}.movie_features\` WHERE movie_id = @movieId LIMIT 1`,
    params: { movieId },
  });
  if (rows.length === 0) return null;
  return (rows[0] as Record<string, unknown>).feature_vector as number[];
}

export async function getBQVectorBatch(movieIds: number[]): Promise<Map<number, number[]>> {
  if (movieIds.length === 0) return new Map();
  const [rows] = await bq.query({
    query: `SELECT movie_id, feature_vector FROM \`${DS}.movie_features\` WHERE movie_id IN UNNEST(@movieIds)`,
    params: { movieIds },
  });
  const map = new Map<number, number[]>();
  for (const row of rows as Record<string, unknown>[]) {
    map.set(Number(row.movie_id), row.feature_vector as number[]);
  }
  return map;
}

export async function getAllBQVectors(): Promise<Map<number, number[]>> {
  const [rows] = await bq.query({
    query: `SELECT movie_id, feature_vector FROM \`${DS}.movie_features\``,
  });
  const map = new Map<number, number[]>();
  for (const row of rows as Record<string, unknown>[]) {
    map.set(Number(row.movie_id), row.feature_vector as number[]);
  }
  return map;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd backend && npx jest src/bigquery/__tests__/vectors.test.ts --no-coverage
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/bigquery/vectors.ts src/bigquery/__tests__/vectors.test.ts
git commit -m "feat(bigquery): add BigQuery vectors read module"
```

---

## Task 6: BigQuery similarity read module

**Files:**
- Create: `backend/src/bigquery/similarity.ts`
- Create: `backend/src/bigquery/__tests__/similarity.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// backend/src/bigquery/__tests__/similarity.test.ts
const mockQuery = jest.fn();
jest.mock('../client', () => ({
  bq: { query: mockQuery },
}));

import { getTopSimilar } from '../similarity';

const ROWS = [
  { movie_id: 1, similar_movie_id: 10, similarity_score: 0.95, rank: 1, signal_breakdown: 'genre:0.8' },
  { movie_id: 1, similar_movie_id: 20, similarity_score: 0.87, rank: 2, signal_breakdown: 'genre:0.7' },
];

describe('getTopSimilar', () => {
  it('returns results ordered by rank', async () => {
    mockQuery.mockResolvedValue([ROWS]);
    const results = await getTopSimilar(1, 50);
    expect(results).toHaveLength(2);
    expect(results[0].similarMovieId).toBe(10);
    expect(results[1].similarMovieId).toBe(20);
    expect(results[0].score).toBeCloseTo(0.95);
  });

  it('returns empty array when no similarity rows found', async () => {
    mockQuery.mockResolvedValue([[]]);
    expect(await getTopSimilar(999, 50)).toEqual([]);
  });

  it('respects the limit parameter', async () => {
    mockQuery.mockResolvedValue([ROWS]);
    const results = await getTopSimilar(1, 1);
    // limit is passed to BQ query, so BQ returns at most 1 row
    expect(mockQuery).toHaveBeenCalledWith(
      expect.objectContaining({ params: expect.objectContaining({ limit: 1 }) })
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && npx jest src/bigquery/__tests__/similarity.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '../similarity'`

- [ ] **Step 3: Create similarity.ts**

```typescript
// backend/src/bigquery/similarity.ts
import { bq } from './client';

const DS = `${process.env.GCP_PROJECT_ID ?? 'cinegraph'}.${process.env.GCP_DATASET_ID ?? 'cinegraph'}`;

export interface SimilarEntry {
  movieId: number;
  similarMovieId: number;
  score: number;
  rank: number;
  signalBreakdown: string;
}

export async function getTopSimilar(movieId: number, limit = 50): Promise<SimilarEntry[]> {
  const [rows] = await bq.query({
    query: `
      SELECT movie_id, similar_movie_id, similarity_score, rank, signal_breakdown
      FROM \`${DS}.movie_similarity\`
      WHERE movie_id = @movieId
      ORDER BY rank ASC
      LIMIT @limit
    `,
    params: { movieId, limit },
  });
  return (rows as Record<string, unknown>[]).map(row => ({
    movieId:         Number(row.movie_id),
    similarMovieId:  Number(row.similar_movie_id),
    score:           Number(row.similarity_score),
    rank:            Number(row.rank),
    signalBreakdown: String(row.signal_breakdown ?? ''),
  }));
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd backend && npx jest src/bigquery/__tests__/similarity.test.ts --no-coverage
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/bigquery/similarity.ts src/bigquery/__tests__/similarity.test.ts
git commit -m "feat(bigquery): add BigQuery similarity read module"
```

---

## Task 7: Extend redis/movies.ts with BigQuery cache-aside

**Files:**
- Modify: `backend/src/redis/movies.ts`

The existing tests (if any) should still pass. We're only extending `getMovie` and `getPopularMovieIds` — not changing their signatures.

- [ ] **Step 1: Write the failing test for cache-aside behaviour**

Add a new test file `src/redis/__tests__/movies-bq-fallback.test.ts`:

```typescript
// backend/src/redis/__tests__/movies-bq-fallback.test.ts
const mockHgetall  = jest.fn();
const mockHset     = jest.fn();
const mockSadd     = jest.fn();
const mockZrange   = jest.fn();
const mockSet      = jest.fn();

jest.mock('../client', () => ({
  redis: {
    hgetall: mockHgetall,
    hset: mockHset,
    sadd: mockSadd,
    zrange: mockZrange,
    set: mockSet,
  },
}));

const mockGetBQMovie  = jest.fn();
const mockGetBQPopular = jest.fn();
jest.mock('../../bigquery/movies', () => ({
  getBQMovie:   mockGetBQMovie,
  getBQPopular: mockGetBQPopular,
}));

import { getMovie, getPopularMovieIds } from '../movies';

const MOVIE = {
  id: 1, title: 'Dune', overview: 'Epic', posterPath: '/d.jpg',
  releaseYear: 2021, genres: ['Sci-Fi'], cast: [], director: 'Denis',
  keywords: [], voteAverage: 7.8, voteCount: 15000, popularity: 88, runtime: 155,
};

describe('getMovie with BigQuery fallback', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns cached Redis value without calling BigQuery', async () => {
    mockHgetall.mockResolvedValue({
      title: 'Dune', overview: 'Epic', posterPath: '/d.jpg', backdropPath: '',
      releaseYear: '2021', genres: '["Sci-Fi"]', cast: '[]', director: 'Denis',
      keywords: '[]', voteAverage: '7.8', voteCount: '15000',
      popularity: '88', runtime: '155',
    });
    const result = await getMovie(1);
    expect(result?.title).toBe('Dune');
    expect(mockGetBQMovie).not.toHaveBeenCalled();
  });

  it('falls back to BigQuery on Redis miss and populates Redis', async () => {
    mockHgetall.mockResolvedValue(null);
    mockGetBQMovie.mockResolvedValue(MOVIE);
    mockHset.mockResolvedValue(1);
    mockSadd.mockResolvedValue(1);

    const result = await getMovie(1);
    expect(result?.title).toBe('Dune');
    expect(mockGetBQMovie).toHaveBeenCalledWith(1);
    expect(mockHset).toHaveBeenCalled(); // Redis was populated
  });

  it('returns null when neither Redis nor BigQuery has the movie', async () => {
    mockHgetall.mockResolvedValue(null);
    mockGetBQMovie.mockResolvedValue(null);
    expect(await getMovie(1)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && npx jest src/redis/__tests__/movies-bq-fallback.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '../../bigquery/movies'`

- [ ] **Step 3: Add BigQuery fallback to getMovie and getPopularMovieIds in redis/movies.ts**

In `backend/src/redis/movies.ts`, add the import at the top and modify two functions:

```typescript
// Add at top of file (after existing imports):
import { getBQMovie, getBQPopular } from '../bigquery/movies';
```

Replace the existing `getMovie` function:

```typescript
export async function getMovie(id: number): Promise<Movie | null> {
  const data = await redis.hgetall<Record<string, string>>(`movie:${id}`);
  if (data && data.title) {
    return {
      id,
      title: data.title,
      overview: data.overview ?? '',
      posterPath: data.posterPath ?? '',
      backdropPath: data.backdropPath || undefined,
      releaseYear: Number(data.releaseYear),
      genres: JSON.parse(data.genres ?? '[]'),
      cast: JSON.parse(data.cast ?? '[]'),
      director: data.director ?? '',
      keywords: JSON.parse(data.keywords ?? '[]'),
      voteAverage: Number(data.voteAverage),
      voteCount: Number(data.voteCount),
      popularity: Number(data.popularity),
      runtime: Number(data.runtime),
    };
  }

  // BigQuery fallback on Redis miss
  const movie = await getBQMovie(id);
  if (!movie) return null;

  // Populate Redis for future requests (TTL 24h)
  await setMovie(movie);
  return movie;
}
```

Replace the existing `getPopularMovieIds` function:

```typescript
export async function getPopularMovieIds(genre?: string, limit = 50): Promise<number[]> {
  const key = genre ? `popular:${genre}` : 'popular:all';
  const results = await redis.zrange(key, 0, limit - 1, { rev: true });
  if (results.length > 0) return results.map(Number);

  // BigQuery fallback — Redis sorted set not populated yet
  const movies = await getBQPopular(genre ?? '', limit);
  return movies.map(m => m.id);
}
```

- [ ] **Step 4: Run all redis tests to verify nothing broke**

```bash
cd backend && npx jest src/redis/ --no-coverage
```

Expected: All tests PASS (including new fallback tests)

- [ ] **Step 5: Commit**

```bash
git add src/redis/movies.ts src/redis/__tests__/movies-bq-fallback.test.ts
git commit -m "feat(redis): add BigQuery cache-aside fallback to getMovie and getPopularMovieIds"
```

---

## Task 8: Extend redis/vectors.ts with BigQuery cache-aside

**Files:**
- Modify: `backend/src/redis/vectors.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// backend/src/redis/__tests__/vectors-bq-fallback.test.ts
const mockGet = jest.fn();
const mockSet = jest.fn();

jest.mock('../client', () => ({
  redis: { get: mockGet, set: mockSet },
}));

const mockGetBQVector = jest.fn();
jest.mock('../../bigquery/vectors', () => ({
  getBQVector: mockGetBQVector,
}));

import { getVector } from '../vectors';

const VECTOR = [1, 0, 0.5, 0.8];

describe('getVector with BigQuery fallback', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns cached Redis vector without calling BigQuery', async () => {
    mockGet.mockResolvedValue(JSON.stringify(VECTOR));
    const v = await getVector(1);
    expect(v).toEqual(VECTOR);
    expect(mockGetBQVector).not.toHaveBeenCalled();
  });

  it('falls back to BigQuery on Redis miss and populates Redis', async () => {
    mockGet.mockResolvedValue(null);
    mockGetBQVector.mockResolvedValue(VECTOR);
    mockSet.mockResolvedValue('OK');

    const v = await getVector(1);
    expect(v).toEqual(VECTOR);
    expect(mockGetBQVector).toHaveBeenCalledWith(1);
    expect(mockSet).toHaveBeenCalledWith(
      'movie:vector:1', JSON.stringify(VECTOR), { ex: 86400 }
    );
  });

  it('returns null when neither Redis nor BigQuery has the vector', async () => {
    mockGet.mockResolvedValue(null);
    mockGetBQVector.mockResolvedValue(null);
    expect(await getVector(1)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && npx jest src/redis/__tests__/vectors-bq-fallback.test.ts --no-coverage
```

Expected: FAIL

- [ ] **Step 3: Add BigQuery fallback to getVector in redis/vectors.ts**

```typescript
// backend/src/redis/vectors.ts
import { redis } from './client';
import { getBQVector } from '../bigquery/vectors';

export async function setVector(movieId: number, vector: number[]): Promise<void> {
  await redis.set(`movie:vector:${movieId}`, JSON.stringify(vector), { ex: 86400 });
}

export async function getVector(movieId: number): Promise<number[] | null> {
  const data = await redis.get<string>(`movie:vector:${movieId}`);
  if (data) return JSON.parse(data) as number[];

  // BigQuery fallback on Redis miss
  const vector = await getBQVector(movieId);
  if (!vector) return null;

  await redis.set(`movie:vector:${movieId}`, JSON.stringify(vector), { ex: 86400 });
  return vector;
}

export async function getAllVectors(movieIds: number[]): Promise<Map<number, number[]>> {
  const entries = await Promise.all(
    movieIds.map(async id => [id, await getVector(id)] as const)
  );
  return new Map(entries.filter((e): e is [number, number[]] => e[1] !== null));
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd backend && npx jest src/redis/__tests__/vectors-bq-fallback.test.ts --no-coverage
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/redis/vectors.ts src/redis/__tests__/vectors-bq-fallback.test.ts
git commit -m "feat(redis): add BigQuery cache-aside fallback to getVector"
```

---

## Task 9: Update contentBased.ts to use pre-computed similarity

**Files:**
- Modify: `backend/src/ml/contentBased.ts`
- Create: `backend/src/ml/__tests__/contentBased-bq.test.ts`

The existing `contentBasedRecommend` loops over 100k movie IDs. Replace that full-scan with pre-computed top-50 lookups per rated movie.

- [ ] **Step 1: Write the failing test**

```typescript
// backend/src/ml/__tests__/contentBased-bq.test.ts
jest.mock('../../redis/ratings', () => ({
  getUserRatings:    jest.fn(),
  getPreferredGenres: jest.fn(),
}));
jest.mock('../../redis/movies', () => ({
  getMovie: jest.fn(),
  getPopularMovieIds: jest.fn(),
}));
jest.mock('../../redis/vectors', () => ({
  getVector: jest.fn(),
}));
jest.mock('../../bigquery/similarity', () => ({
  getTopSimilar: jest.fn(),
}));

import { getUserRatings } from '../../redis/ratings';
import { getMovie } from '../../redis/movies';
import { getVector } from '../../redis/vectors';
import { getTopSimilar } from '../../bigquery/similarity';
import { contentBasedRecommend } from '../contentBased';

const mockGetUserRatings  = getUserRatings as jest.Mock;
const mockGetMovie        = getMovie as jest.Mock;
const mockGetVector       = getVector as jest.Mock;
const mockGetTopSimilar   = getTopSimilar as jest.Mock;

const MOVIE = (id: number) => ({
  id, title: `Movie ${id}`, overview: '', posterPath: '',
  releaseYear: 2020, genres: ['Action'], cast: [], director: '',
  keywords: [], voteAverage: 7.5, voteCount: 1000, popularity: 50, runtime: 120,
});

const VECTOR = [1, 0, 0, 0.5];

describe('contentBasedRecommend', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns empty array when user has no ratings', async () => {
    mockGetUserRatings.mockResolvedValue({});
    expect(await contentBasedRecommend('user1')).toEqual([]);
  });

  it('returns recommendations using pre-computed similarity', async () => {
    mockGetUserRatings.mockResolvedValue({ 1: 4 });
    mockGetVector.mockResolvedValue(VECTOR);
    mockGetTopSimilar.mockResolvedValue([
      { movieId: 1, similarMovieId: 2, score: 0.9, rank: 1, signalBreakdown: 'genre:0.9' },
      { movieId: 1, similarMovieId: 3, score: 0.8, rank: 2, signalBreakdown: 'genre:0.8' },
    ]);
    mockGetMovie.mockImplementation((id: number) => Promise.resolve(MOVIE(id)));

    const recs = await contentBasedRecommend('user1', 10);
    expect(recs.length).toBeGreaterThan(0);
    expect(recs[0].engine).toBe('content');
    // Rated movie (id=1) must NOT appear in recommendations
    expect(recs.every(r => r.movie.id !== 1)).toBe(true);
    expect(mockGetTopSimilar).toHaveBeenCalledWith(1, 50);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && npx jest src/ml/__tests__/contentBased-bq.test.ts --no-coverage
```

Expected: FAIL — `getTopSimilar` is not used in current implementation

- [ ] **Step 3: Replace the full-scan in contentBased.ts**

Replace `contentBasedRecommend` in `backend/src/ml/contentBased.ts`:

```typescript
import { getUserRatings, getPreferredGenres } from '../redis/ratings';
import { getPopularMovieIds, getMovie } from '../redis/movies';
import { getVector } from '../redis/vectors';
import { getTopSimilar } from '../bigquery/similarity';
import type { Recommendation } from '../types';

export async function contentBasedRecommend(
  userId: string,
  topN = 20
): Promise<Recommendation[]> {
  const ratings = await getUserRatings(userId);
  const ratedIds = Object.keys(ratings).map(Number);
  if (ratedIds.length === 0) return [];

  const ratedSet = new Set(ratedIds);

  // For each rated movie, get its pre-computed top-50 similar movies from BigQuery
  const candidateScores = new Map<number, number>();

  for (const ratedId of ratedIds) {
    const weight = ratings[ratedId] / 5;
    const similar = await getTopSimilar(ratedId, 50);
    for (const entry of similar) {
      if (ratedSet.has(entry.similarMovieId)) continue;
      const prev = candidateScores.get(entry.similarMovieId) ?? 0;
      candidateScores.set(entry.similarMovieId, prev + entry.score * weight);
    }
  }

  // Sort candidates by blended score
  const sorted = Array.from(candidateScores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN);

  const results: Recommendation[] = [];
  for (const [id, blendedScore] of sorted) {
    const movie = await getMovie(id);
    if (!movie) continue;
    const normalised = Math.min(1, blendedScore / ratedIds.length);
    results.push({
      movie,
      score: normalised * 5,
      matchPercent: Math.round(normalised * 100),
      reason: 'Similar to movies you\'ve rated highly',
      engine: 'content',
      similarMovies: ratedIds.slice(0, 3),
    });
  }
  return results;
}

export async function getTopPopularForGenres(
  genres: string[],
  topN = 20
): Promise<Recommendation[]> {
  const seen = new Set<number>();
  const results: Recommendation[] = [];
  for (const genre of genres) {
    const ids = await getPopularMovieIds(genre, 20);
    for (const id of ids) {
      if (seen.has(id) || results.length >= topN) continue;
      seen.add(id);
      const movie = await getMovie(id);
      if (!movie) continue;
      const score = (movie.voteAverage * 0.7) + 0.3;
      results.push({
        movie, score,
        matchPercent: Math.round((score / 5) * 100),
        reason: `Top rated ${genre} movie`,
        engine: 'cold_start',
      });
    }
  }
  return results.slice(0, topN);
}
```

- [ ] **Step 4: Run all ML tests to verify nothing broke**

```bash
cd backend && npx jest src/ml/ --no-coverage
```

Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/ml/contentBased.ts src/ml/__tests__/contentBased-bq.test.ts
git commit -m "feat(ml): replace full-scan with BigQuery pre-computed similarity lookup in contentBased"
```

---

## Task 10: BigQuery upsert module

**Files:**
- Create: `backend/src/bigquery/upsert.ts`

No unit test — MERGE SQL is best verified by integration test against a real BigQuery instance during migration dry run.

- [ ] **Step 1: Create upsert.ts**

```typescript
// backend/src/bigquery/upsert.ts
import { bq, dataset } from './client';
import { TABLE_NAMES } from './schema';
import type { Movie } from '../types';

const DS = `${process.env.GCP_PROJECT_ID ?? 'cinegraph'}.${process.env.GCP_DATASET_ID ?? 'cinegraph'}`;
const BATCH = 500;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function upsertMovies(movies: Movie[]): Promise<void> {
  const now = new Date().toISOString();
  const rows = movies.map(m => ({
    movie_id:          m.id,
    title:             m.title,
    original_title:    m.title,
    overview:          m.overview,
    poster_path:       m.posterPath,
    backdrop_path:     m.backdropPath ?? null,
    release_year:      m.releaseYear,
    original_language: '',
    popularity:        m.popularity,
    vote_average:      m.voteAverage,
    vote_count:        m.voteCount,
    runtime:           m.runtime,
    genres:            m.genres,
    cast_names:        m.cast,
    director:          m.director,
    keywords:          m.keywords,
    updated_at:        now,
  }));

  for (const batch of chunk(rows, BATCH)) {
    await bq.query({
      query: `
        MERGE \`${DS}.${TABLE_NAMES.movies}\` T
        USING UNNEST(@rows) S ON T.movie_id = S.movie_id
        WHEN MATCHED THEN UPDATE SET
          title = S.title, overview = S.overview, poster_path = S.poster_path,
          backdrop_path = S.backdrop_path, popularity = S.popularity,
          vote_average = S.vote_average, vote_count = S.vote_count,
          genres = S.genres, cast_names = S.cast_names, director = S.director,
          keywords = S.keywords, updated_at = S.updated_at
        WHEN NOT MATCHED THEN INSERT ROW
      `,
      params: { rows: batch },
    });
  }
  console.log(`Upserted ${rows.length} movies to BigQuery`);
}

export async function upsertVectors(
  entries: { movieId: number; vector: number[]; version: number }[]
): Promise<void> {
  const now = new Date().toISOString();
  const rows = entries.map(e => ({
    movie_id: e.movieId, feature_vector: e.vector,
    feature_version: e.version, updated_at: now,
  }));

  for (const batch of chunk(rows, BATCH)) {
    await bq.query({
      query: `
        MERGE \`${DS}.${TABLE_NAMES.features}\` T
        USING UNNEST(@rows) S ON T.movie_id = S.movie_id
        WHEN MATCHED THEN UPDATE SET
          feature_vector = S.feature_vector, feature_version = S.feature_version,
          updated_at = S.updated_at
        WHEN NOT MATCHED THEN INSERT ROW
      `,
      params: { rows: batch },
    });
  }
  console.log(`Upserted ${rows.length} feature vectors to BigQuery`);
}

export interface SimilarityRow {
  movieId: number;
  similarMovieId: number;
  score: number;
  rank: number;
  signalBreakdown: string;
}

export async function upsertSimilarity(rows: SimilarityRow[]): Promise<void> {
  const now = new Date().toISOString();
  const bqRows = rows.map(r => ({
    movie_id:         r.movieId,
    similar_movie_id: r.similarMovieId,
    similarity_score: r.score,
    rank:             r.rank,
    signal_breakdown: r.signalBreakdown,
    computed_at:      now,
  }));

  for (const batch of chunk(bqRows, BATCH)) {
    await bq.query({
      query: `
        MERGE \`${DS}.${TABLE_NAMES.similarity}\` T
        USING UNNEST(@rows) S
          ON T.movie_id = S.movie_id AND T.similar_movie_id = S.similar_movie_id
        WHEN MATCHED THEN UPDATE SET
          similarity_score = S.similarity_score, rank = S.rank,
          signal_breakdown = S.signal_breakdown, computed_at = S.computed_at
        WHEN NOT MATCHED THEN INSERT ROW
      `,
      params: { rows: batch },
    });
  }
  console.log(`Upserted ${rows.length} similarity rows to BigQuery`);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/bigquery/upsert.ts
git commit -m "feat(bigquery): add BigQuery upsert module with MERGE operations"
```

---

## Task 11: Migration script — fetchMovies

**Files:**
- Create: `backend/scripts/migration/fetchMovies.ts`

- [ ] **Step 1: Create fetchMovies.ts**

```typescript
// backend/scripts/migration/fetchMovies.ts
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { preprocessMovie } from '../../src/tmdb/preprocessor';
import type { Movie } from '../../src/types';

const PROXY_BASE = process.env.TMDB_PROXY_URL ?? 'https://proxy-gate-tanendra77.vercel.app/api/proxy';
const API_KEY    = process.env.TMDB_API_KEY ?? 'b24394c1c9b929edc87f91bae9258318';
const DELAY_MS   = 300;
const MAX_RETRIES = 3;

export interface Checkpoint {
  lastPage: number;
  totalFetched: number;
  totalPages: number;
}

const CHECKPOINT_PATH = path.join(process.cwd(), 'data', 'migration', 'checkpoint.json');
const JSONL_PATH      = path.join(process.cwd(), 'data', 'migration', 'movies_raw.jsonl');

export function loadCheckpoint(): Checkpoint | null {
  if (!fs.existsSync(CHECKPOINT_PATH)) return null;
  return JSON.parse(fs.readFileSync(CHECKPOINT_PATH, 'utf-8')) as Checkpoint;
}

function saveCheckpoint(cp: Checkpoint): void {
  fs.mkdirSync(path.dirname(CHECKPOINT_PATH), { recursive: true });
  fs.writeFileSync(CHECKPOINT_PATH, JSON.stringify(cp, null, 2));
}

function appendMovies(movies: Movie[]): void {
  fs.mkdirSync(path.dirname(JSONL_PATH), { recursive: true });
  const lines = movies.map(m => JSON.stringify(m)).join('\n') + '\n';
  fs.appendFileSync(JSONL_PATH, lines);
}

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

async function fetchPage(page: number): Promise<{ movies: Movie[]; totalPages: number }> {
  const tmdbUrl = `https://api.themoviedb.org/3/movie/popular?api_key=${API_KEY}&page=${page}`;
  const url = `${PROXY_BASE}?url=${encodeURIComponent(tmdbUrl)}`;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const { data } = await axios.get(url, { timeout: 15000 });
      const movies = (data.results as Record<string, unknown>[]).map(r =>
        preprocessMovie(r as Parameters<typeof preprocessMovie>[0])
      );
      return { movies, totalPages: data.total_pages as number };
    } catch (err) {
      if (attempt === MAX_RETRIES) throw err;
      const backoff = attempt * 1000;
      console.warn(`Page ${page} attempt ${attempt} failed, retrying in ${backoff}ms...`);
      await delay(backoff);
    }
  }
  throw new Error(`Failed to fetch page ${page} after ${MAX_RETRIES} attempts`);
}

export async function fetchAllMovies(
  targetPages = 5000,
  resumeFrom = 0
): Promise<void> {
  let startPage = resumeFrom + 1;
  let totalFetched = resumeFrom * 20;

  console.log(`Starting fetch from page ${startPage} (target: ${targetPages} pages)`);

  for (let page = startPage; page <= targetPages; page++) {
    const { movies, totalPages } = await fetchPage(page);
    appendMovies(movies);
    totalFetched += movies.length;

    saveCheckpoint({ lastPage: page, totalFetched, totalPages });

    if (page % 50 === 0) {
      console.log(`Progress: page ${page}/${Math.min(targetPages, totalPages)} — ${totalFetched} movies`);
    }

    await delay(DELAY_MS);

    if (page >= totalPages) {
      console.log(`Reached last available page (${totalPages}). Done.`);
      break;
    }
  }

  console.log(`Fetch complete. Total movies: ${totalFetched}`);
}

export function loadMoviesFromJsonl(): Movie[] {
  if (!fs.existsSync(JSONL_PATH)) return [];
  return fs.readFileSync(JSONL_PATH, 'utf-8')
    .split('\n')
    .filter(Boolean)
    .map(line => JSON.parse(line) as Movie);
}
```

- [ ] **Step 2: Commit**

```bash
git add scripts/migration/fetchMovies.ts
git commit -m "feat(migration): add paginated TMDB fetch script with checkpoint/resume"
```

---

## Task 12: Migration script — computeSimilarity

**Files:**
- Create: `backend/scripts/migration/computeSimilarity.ts`

- [ ] **Step 1: Create computeSimilarity.ts**

```typescript
// backend/scripts/migration/computeSimilarity.ts
import { cosineSimilarity } from '../../src/ml/cosineSimilarity';
import { GENRE_ORDER } from '../../src/ml/featureVector';
import type { SimilarityRow } from '../../src/bigquery/upsert';

const TOP_K = 50;
const CHUNK = 1000; // process this many "source" movies at a time

function buildSignalBreakdown(a: number[], b: number[]): string {
  // Genre similarity (dims 0-18), cast similarity (19-23), keyword similarity (25-34)
  const genreA = a.slice(0, 19);
  const genreB = b.slice(0, 19);
  const genreSim = cosineSimilarity(genreA, genreB);

  const castA = a.slice(19, 24);
  const castB = b.slice(19, 24);
  const castSim = cosineSimilarity(castA, castB);

  const kwA = a.slice(25, 35);
  const kwB = b.slice(25, 35);
  const kwSim = cosineSimilarity(kwA, kwB);

  return `genre:${genreSim.toFixed(2)},cast:${castSim.toFixed(2)},keyword:${kwSim.toFixed(2)}`;
}

export function computeTopKSimilarity(
  allVectors: Map<number, number[]>
): SimilarityRow[] {
  const ids  = Array.from(allVectors.keys());
  const vecs = ids.map(id => allVectors.get(id)!);
  const results: SimilarityRow[] = [];

  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunkIds  = ids.slice(i, i + CHUNK);
    const chunkVecs = vecs.slice(i, i + CHUNK);

    for (let ci = 0; ci < chunkIds.length; ci++) {
      const srcId  = chunkIds[ci];
      const srcVec = chunkVecs[ci];

      // Score against ALL movies
      const scored: { id: number; score: number }[] = [];
      for (let j = 0; j < ids.length; j++) {
        if (ids[j] === srcId) continue;
        scored.push({ id: ids[j], score: cosineSimilarity(srcVec, vecs[j]) });
      }

      // Keep top-K
      scored.sort((a, b) => b.score - a.score);
      const top = scored.slice(0, TOP_K);

      for (let rank = 0; rank < top.length; rank++) {
        results.push({
          movieId:         srcId,
          similarMovieId:  top[rank].id,
          score:           top[rank].score,
          rank:            rank + 1,
          signalBreakdown: buildSignalBreakdown(srcVec, allVectors.get(top[rank].id)!),
        });
      }
    }

    console.log(
      `Similarity: processed ${Math.min(i + CHUNK, ids.length)}/${ids.length} movies`
    );
  }

  return results;
}
```

- [ ] **Step 2: Commit**

```bash
git add scripts/migration/computeSimilarity.ts
git commit -m "feat(migration): add chunked top-50 cosine similarity computation"
```

---

## Task 13: Migration orchestrator

**Files:**
- Create: `backend/scripts/migrateToBigQuery.ts`

- [ ] **Step 1: Create migrateToBigQuery.ts**

```typescript
// backend/scripts/migrateToBigQuery.ts
import 'dotenv/config';
import { ensureTables } from '../src/bigquery/client';
import { upsertMovies, upsertVectors, upsertSimilarity } from '../src/bigquery/upsert';
import { getAllBQVectors } from '../src/bigquery/vectors';
import {
  fetchAllMovies,
  loadMoviesFromJsonl,
  loadCheckpoint,
} from './migration/fetchMovies';
import { computeTopKSimilarity } from './migration/computeSimilarity';
import { buildFeatureVector } from '../src/ml/featureVector';
import type { Movie } from '../src/types';

const RESUME         = process.argv.includes('--resume');
const SIMILARITY_ONLY = process.argv.includes('--similarity-only');
const TARGET_PAGES   = Number(process.env.TARGET_PAGES ?? '5000');
const FEATURE_VERSION = 1;

function buildIDF(movies: Movie[]): Map<string, number> {
  const docFreq = new Map<string, number>();
  for (const m of movies) {
    const uniqKws = new Set(m.keywords);
    for (const kw of uniqKws) {
      docFreq.set(kw, (docFreq.get(kw) ?? 0) + 1);
    }
  }
  const N = movies.length;
  const idf = new Map<string, number>();
  for (const [kw, df] of docFreq) {
    idf.set(kw, Math.log((N + 1) / (df + 1)));
  }
  return idf;
}

async function main() {
  console.log('=== CineGraph BigQuery Migration ===');
  console.log(`Mode: ${SIMILARITY_ONLY ? 'similarity-only' : RESUME ? 'resume' : 'full'}`);

  // Step 1: Ensure tables exist
  await ensureTables();
  console.log('Tables verified.');

  if (!SIMILARITY_ONLY) {
    // Step 2: Fetch movies
    const checkpoint = RESUME ? loadCheckpoint() : null;
    const resumeFrom = checkpoint?.lastPage ?? 0;

    if (resumeFrom > 0) {
      console.log(`Resuming from page ${resumeFrom + 1}`);
    }

    await fetchAllMovies(TARGET_PAGES, resumeFrom);

    // Step 3: Load from JSONL and upsert movies
    const movies = loadMoviesFromJsonl();
    console.log(`Loaded ${movies.length} movies from JSONL`);

    await upsertMovies(movies);

    // Step 4: Build feature vectors and upsert
    const maxLogPop = Math.log(Math.max(...movies.map(m => m.popularity)) + 1);
    const idf = buildIDF(movies);

    const vectorEntries = movies.map(m => ({
      movieId: m.id,
      vector:  buildFeatureVector(m, idf, maxLogPop),
      version: FEATURE_VERSION,
    }));

    await upsertVectors(vectorEntries);
    console.log(`Feature vectors upserted for ${vectorEntries.length} movies`);
  }

  // Step 5: Compute and upsert similarity
  console.log('Loading all vectors from BigQuery for similarity computation...');
  console.log('WARNING: This may take 30-60 minutes for 100k movies.');

  const allVectors = await getAllBQVectors();
  console.log(`Loaded ${allVectors.size} vectors from BigQuery`);

  const similarityRows = computeTopKSimilarity(allVectors);
  console.log(`Computed ${similarityRows.length} similarity rows`);

  await upsertSimilarity(similarityRows);

  console.log('=== Migration complete ===');
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
```

- [ ] **Step 2: Commit**

```bash
git add scripts/migrateToBigQuery.ts
git commit -m "feat(migration): add BigQuery migration orchestrator with resume support"
```

---

## Task 14: Run full test suite + smoke check

- [ ] **Step 1: Run all tests**

```bash
cd backend && npx jest --no-coverage
```

Expected: All tests PASS. If any fail, fix before proceeding.

- [ ] **Step 2: TypeScript build check**

```bash
cd backend && npx tsc --noEmit
```

Expected: Zero errors.

- [ ] **Step 3: Smoke test — start the backend and verify /health**

Ensure `backend/.env` has real GCP credentials and Upstash credentials, then:

```bash
cd backend && npm run dev
```

Hit `GET http://localhost:3001/health` — expected `{ status: 'ok' }`.

- [ ] **Step 4: Smoke test — run migration with 1 page (2 movies)**

```bash
cd backend && TARGET_PAGES=1 npm run migrate
```

Expected output:
```
Tables verified.
Progress: page 1/1 — 20 movies
Fetch complete. Total movies: 20
Upserted 20 movies to BigQuery
Upserted 20 feature vectors to BigQuery
Computed 20 × 19 = ~190 similarity rows
Migration complete.
```

Check in BigQuery console that `movies`, `movie_features`, `movie_similarity` tables have rows.

- [ ] **Step 5: Smoke test — POST /recommend returns data from BigQuery**

```bash
curl -X POST http://localhost:3001/recommend \
  -H "Content-Type: application/json" \
  -H "X-Session-Token: test-uuid-1234" \
  -d '{"engine":"cold_start","genres":["Action"]}'
```

Expected: `{ "sessionId": "<uuid>" }` — then Socket.io emits `recommend:ready`.

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "chore: BigQuery integration complete — all tests pass, smoke test verified"
```

---

## Notes for the migration run

- Run with **VPN active** (TMDB API is blocked in India without it)
- The full 100k migration (5000 pages) takes ~25 minutes to fetch + ~30-60 minutes for similarity computation
- Use `npm run migrate:resume` if the script crashes — it picks up from the last successful page
- The `data/migration/` directory is gitignored — the JSONL file can be large (several hundred MB)
- After running with 1 page for smoke test, **delete** `data/migration/checkpoint.json` and `data/migration/movies_raw.jsonl` before the full run
