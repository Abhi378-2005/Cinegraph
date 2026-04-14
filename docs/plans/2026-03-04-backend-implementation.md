# CineGraph Backend Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the complete CineGraph backend — Express + TypeScript server with Upstash Redis, all DSA algorithms from scratch, ML recommendation pipeline, REST routes, and Socket.io step streaming.

**Architecture:** Layered bottom-up: scaffold → Redis → TMDB/seed → ML → DSA → routes → Socket.io. Frontend at `frontend/` is already complete with mock fallback; it goes live with real data once Task 10 routes are done.

**Tech Stack:** Node.js 20, Express 4, TypeScript 5, @upstash/redis, socket.io 4, axios, zod, ts-node-dev, Jest + ts-jest

---

### Task 1: Scaffold — package.json, tsconfig, Express entry, types

**Files:**
- Modify: `backend/package.json`
- Create: `backend/tsconfig.json`
- Create: `backend/.env.example`
- Create: `backend/src/index.ts`
- Create: `backend/src/types.ts`
- Create: `backend/jest.config.ts`

**Step 1: Install dependencies**

```bash
cd backend
npm install express cors dotenv axios socket.io @upstash/redis zod
npm install -D typescript ts-node-dev @types/express @types/cors @types/node jest ts-jest @types/jest
```

**Step 2: Create `backend/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "dist",
    "rootDir": ".",
    "strict": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*", "scripts/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 3: Update `backend/package.json` scripts section**

```json
{
  "scripts": {
    "dev": "ts-node-dev --respawn --transpile-only src/index.ts",
    "build": "tsc",
    "start": "node dist/src/index.js",
    "seed": "ts-node-dev --transpile-only scripts/seedData.ts",
    "test": "jest"
  }
}
```

**Step 4: Create `backend/jest.config.ts`**

```typescript
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
};
```

**Step 5: Create `backend/.env.example`**

```
PORT=3001
TMDB_API_KEY=
TMDB_BASE_URL=https://api.themoviedb.org/3
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
FRONTEND_URL=http://localhost:3000
```

Also copy to `backend/.env` and fill in real Upstash + TMDB values.

**Step 6: Create `backend/src/types.ts`**

```typescript
export interface Movie {
  id: number;
  title: string;
  overview: string;
  posterPath: string;
  backdropPath?: string;
  releaseYear: number;
  genres: string[];
  cast: string[];
  director: string;
  keywords: string[];
  voteAverage: number;
  voteCount: number;
  popularity: number;
  runtime: number;
  featureVector?: number[];
}

export type Phase = 'cold' | 'warming' | 'full';

export interface User {
  id: string;
  preferredGenres: string[];
  ratings: Record<number, number>;
  phase: Phase;
  ratingCount: number;
}

export interface Recommendation {
  movie: Movie;
  score: number;
  matchPercent: number;
  reason: string;
  engine: 'content' | 'collaborative' | 'hybrid' | 'cold_start';
  similarUsers?: string[];
  similarMovies?: number[];
}

export interface FloydStep {
  k: number; i: number; j: number;
  oldVal: number; newVal: number;
  updated: boolean;
}

export interface DijkstraStep {
  visitedUserId: string;
  distance: number;
  frontier: string[];
  path: string[];
}

export interface MSTStep {
  algorithm: 'kruskal';
  type: 'add' | 'reject' | 'consider';
  edge: { u: string; v: string; weight: number };
  communities: string[][];
  totalCost: number;
}

export interface MergeSortStep {
  type: 'split' | 'merge' | 'compare' | 'place';
  array: Recommendation[];
  leftIndex: number;
  rightIndex: number;
}

export interface KnapsackStep {
  row: number;
  col: number;
  value: number;
  decision: 'include' | 'exclude';
}

export type AlgoStep = FloydStep | DijkstraStep | MSTStep | MergeSortStep | KnapsackStep;
```

**Step 7: Create `backend/src/index.ts`**

```typescript
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';

export const app = express();
export const httpServer = createServer(app);

app.use(cors({ origin: process.env.FRONTEND_URL ?? 'http://localhost:3000' }));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

const PORT = process.env.PORT ?? 3001;
httpServer.listen(PORT, () => {
  console.log(`CineGraph backend running on port ${PORT}`);
});
```

**Step 8: Verify server starts**

```bash
cd backend && npm run dev
```
Expected: `CineGraph backend running on port 3001`
Verify: `curl http://localhost:3001/health` → `{"status":"ok","uptime":...}`

**Step 9: Commit**

```bash
git add backend/package.json backend/package-lock.json backend/tsconfig.json backend/jest.config.ts backend/.env.example backend/src/index.ts backend/src/types.ts
git commit -m "feat(backend): scaffold Express + TypeScript + types"
```

---

### Task 2: Redis client + data access layer

**Files:**
- Create: `backend/src/redis/client.ts`
- Create: `backend/src/redis/movies.ts`
- Create: `backend/src/redis/ratings.ts`
- Create: `backend/src/redis/vectors.ts`

**Step 1: Create `backend/src/redis/client.ts`**

```typescript
import { Redis } from '@upstash/redis';

if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
  throw new Error('UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set in .env');
}

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});
```

**Step 2: Create `backend/src/redis/movies.ts`**

```typescript
import { redis } from './client';
import type { Movie } from '../types';

export async function setMovie(movie: Movie): Promise<void> {
  await Promise.all([
    redis.hset(`movie:${movie.id}`, {
      title: movie.title,
      overview: movie.overview,
      posterPath: movie.posterPath,
      backdropPath: movie.backdropPath ?? '',
      releaseYear: String(movie.releaseYear),
      genres: JSON.stringify(movie.genres),
      cast: JSON.stringify(movie.cast),
      director: movie.director,
      keywords: JSON.stringify(movie.keywords),
      voteAverage: String(movie.voteAverage),
      voteCount: String(movie.voteCount),
      popularity: String(movie.popularity),
      runtime: String(movie.runtime),
    }),
    redis.sadd('movies:all', String(movie.id)),
  ]);
}

export async function getMovie(id: number): Promise<Movie | null> {
  const data = await redis.hgetall<Record<string, string>>(`movie:${id}`);
  if (!data || !data.title) return null;
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

export async function getAllMovieIds(): Promise<number[]> {
  const ids = await redis.smembers('movies:all');
  return ids.map(Number);
}

export async function getPopularMovieIds(genre?: string, limit = 50): Promise<number[]> {
  const key = genre ? `popular:${genre}` : 'popular:all';
  const results = await redis.zrange(key, 0, limit - 1, { rev: true });
  return results.map(Number);
}

// KMP-based title search
function buildLPS(pattern: string): number[] {
  const lps = new Array<number>(pattern.length).fill(0);
  let len = 0, i = 1;
  while (i < pattern.length) {
    if (pattern[i] === pattern[len]) { lps[i++] = ++len; }
    else if (len !== 0) { len = lps[len - 1]; }
    else { lps[i++] = 0; }
  }
  return lps;
}

function kmpSearch(text: string, pattern: string): boolean {
  if (pattern.length === 0) return true;
  const lps = buildLPS(pattern);
  let i = 0, j = 0;
  while (i < text.length) {
    if (text[i] === pattern[j]) { i++; j++; }
    if (j === pattern.length) return true;
    else if (i < text.length && text[i] !== pattern[j]) {
      j !== 0 ? (j = lps[j - 1]) : i++;
    }
  }
  return false;
}

export async function searchMovies(query: string, limit = 20): Promise<Movie[]> {
  const ids = await getAllMovieIds();
  const q = query.toLowerCase();
  const results: Movie[] = [];
  for (const id of ids) {
    if (results.length >= limit) break;
    const movie = await getMovie(id);
    if (movie && kmpSearch(movie.title.toLowerCase(), q)) results.push(movie);
  }
  return results;
}
```

**Step 3: Create `backend/src/redis/ratings.ts`**

```typescript
import { redis } from './client';
import type { Phase } from '../types';

export async function setRating(userId: string, movieId: number, rating: number): Promise<void> {
  await Promise.all([
    redis.hset(`user:${userId}:ratings`, { [String(movieId)]: String(rating) }),
    redis.sadd('users:all', userId),
  ]);
}

export async function getUserRatings(userId: string): Promise<Record<number, number>> {
  const data = await redis.hgetall<Record<string, string>>(`user:${userId}:ratings`);
  if (!data) return {};
  return Object.fromEntries(
    Object.entries(data).map(([k, v]) => [Number(k), Number(v)])
  );
}

export async function getRatingCount(userId: string): Promise<number> {
  return redis.hlen(`user:${userId}:ratings`);
}

export async function getPhase(userId: string): Promise<Phase> {
  const p = await redis.get<string>(`user:${userId}:phase`);
  return (p as Phase) ?? 'cold';
}

export async function setPhase(userId: string, phase: Phase): Promise<void> {
  await redis.set(`user:${userId}:phase`, phase);
}

export async function computeAndSetPhase(userId: string): Promise<Phase> {
  const count = await getRatingCount(userId);
  const phase: Phase = count >= 20 ? 'full' : count >= 5 ? 'warming' : 'cold';
  await setPhase(userId, phase);
  return phase;
}

export async function getAllUserIds(): Promise<string[]> {
  return redis.smembers('users:all');
}

export async function setPreferredGenres(userId: string, genres: string[]): Promise<void> {
  await redis.set(`user:${userId}:genres`, JSON.stringify(genres));
}

export async function getPreferredGenres(userId: string): Promise<string[]> {
  const data = await redis.get<string>(`user:${userId}:genres`);
  return data ? JSON.parse(data) : [];
}
```

**Step 4: Create `backend/src/redis/vectors.ts`**

```typescript
import { redis } from './client';

export async function setVector(movieId: number, vector: number[]): Promise<void> {
  await redis.set(`movie:vector:${movieId}`, JSON.stringify(vector), { ex: 86400 });
}

export async function getVector(movieId: number): Promise<number[] | null> {
  const data = await redis.get<string>(`movie:vector:${movieId}`);
  return data ? (JSON.parse(data) as number[]) : null;
}

export async function getAllVectors(movieIds: number[]): Promise<Map<number, number[]>> {
  const result = new Map<number, number[]>();
  for (const id of movieIds) {
    const v = await getVector(id);
    if (v) result.set(id, v);
  }
  return result;
}
```

**Step 5: Update `backend/src/index.ts` to test Redis on health**

```typescript
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { redis } from './redis/client';

export const app = express();
export const httpServer = createServer(app);

app.use(cors({ origin: process.env.FRONTEND_URL ?? 'http://localhost:3000' }));
app.use(express.json());

app.get('/health', async (_req, res) => {
  let redisOk = false;
  try { await redis.ping(); redisOk = true; } catch { /* offline */ }
  res.json({ status: 'ok', redis: redisOk, uptime: process.uptime() });
});

const PORT = process.env.PORT ?? 3001;
httpServer.listen(PORT, () => {
  console.log(`CineGraph backend running on port ${PORT}`);
});
```

**Step 6: Verify Redis connects**

```bash
npm run dev
curl http://localhost:3001/health
```
Expected: `{"status":"ok","redis":true,"uptime":...}`

**Step 7: Commit**

```bash
git add backend/src/redis/ backend/src/index.ts
git commit -m "feat(backend): Redis client + data access layer"
```

---

### Task 3: TMDB client + preprocessor + fetcher

**Files:**
- Create: `backend/src/tmdb/client.ts`
- Create: `backend/src/tmdb/preprocessor.ts`
- Create: `backend/src/tmdb/fetcher.ts`

**Step 1: Create `backend/src/tmdb/client.ts`**

```typescript
import axios from 'axios';

export const tmdbClient = axios.create({
  baseURL: process.env.TMDB_BASE_URL ?? 'https://api.themoviedb.org/3',
  params: { api_key: process.env.TMDB_API_KEY },
  timeout: 10000,
});
```

**Step 2: Create `backend/src/tmdb/preprocessor.ts`**

```typescript
import type { Movie } from '../types';

export const GENRE_MAP: Record<number, string> = {
  28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy',
  80: 'Crime', 99: 'Documentary', 18: 'Drama', 10751: 'Family',
  14: 'Fantasy', 36: 'History', 27: 'Horror', 10402: 'Music',
  9648: 'Mystery', 10749: 'Romance', 878: 'Science Fiction',
  10770: 'TV Movie', 53: 'Thriller', 10752: 'War', 37: 'Western',
};

interface TMDBRaw {
  id: number; title: string; overview: string;
  poster_path: string | null; backdrop_path: string | null;
  release_date: string; genre_ids?: number[];
  genres?: { id: number; name: string }[];
  vote_average: number; vote_count: number;
  popularity: number; runtime?: number | null;
}
interface TMDBCredits {
  cast: { name: string; order: number }[];
  crew: { name: string; job: string }[];
}
interface TMDBKeywords { keywords: { name: string }[]; }

export function preprocessMovie(
  raw: TMDBRaw,
  credits?: TMDBCredits,
  keywords?: TMDBKeywords
): Movie {
  const genreIds = raw.genre_ids ?? raw.genres?.map(g => g.id) ?? [];
  const genres = genreIds.map(id => GENRE_MAP[id]).filter(Boolean);
  const cast = credits
    ? credits.cast.sort((a, b) => a.order - b.order).slice(0, 5).map(c => c.name)
    : [];
  const director = credits?.crew.find(c => c.job === 'Director')?.name ?? '';
  const kws = keywords?.keywords.slice(0, 20).map(k => k.name) ?? [];

  return {
    id: raw.id, title: raw.title, overview: raw.overview ?? '',
    posterPath: raw.poster_path ?? '',
    backdropPath: raw.backdrop_path ?? undefined,
    releaseYear: raw.release_date ? Number(raw.release_date.slice(0, 4)) : 0,
    genres, cast, director, keywords: kws,
    voteAverage: raw.vote_average, voteCount: raw.vote_count,
    popularity: raw.popularity, runtime: raw.runtime ?? 0,
  };
}
```

**Step 3: Create `backend/src/tmdb/fetcher.ts`**

```typescript
import { tmdbClient } from './client';
import { preprocessMovie } from './preprocessor';
import type { Movie } from '../types';

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

export async function fetchPopularMovies(pages = 20): Promise<Movie[]> {
  const movies: Movie[] = [];
  for (let page = 1; page <= pages; page++) {
    const { data } = await tmdbClient.get('/movie/popular', { params: { page } });
    for (const raw of data.results) {
      await delay(260); // stay under 40 req/s free tier limit
      try {
        const [creditsRes, keywordsRes] = await Promise.all([
          tmdbClient.get(`/movie/${raw.id}/credits`),
          tmdbClient.get(`/movie/${raw.id}/keywords`),
        ]);
        movies.push(preprocessMovie(raw, creditsRes.data, keywordsRes.data));
      } catch {
        movies.push(preprocessMovie(raw));
      }
    }
    console.log(`Fetched page ${page}/${pages} — ${movies.length} movies total`);
  }
  return movies;
}

export async function fetchMovieById(id: number): Promise<Movie | null> {
  try {
    const [movie, credits, keywords] = await Promise.all([
      tmdbClient.get(`/movie/${id}`),
      tmdbClient.get(`/movie/${id}/credits`),
      tmdbClient.get(`/movie/${id}/keywords`),
    ]);
    return preprocessMovie(movie.data, credits.data, keywords.data);
  } catch { return null; }
}
```

**Step 4: Commit**

```bash
git add backend/src/tmdb/
git commit -m "feat(backend): TMDB client + preprocessor + fetcher"
```

---

### Task 4: Seed script

**Files:**
- Create: `backend/scripts/seedData.ts`
- Create: `data/seed/` directory (populated by script)

The seed script:
1. Loads `data/seed/movies.json` if it exists, else fetches from TMDB and saves it
2. Computes feature vectors and seeds Redis with movies + vectors + popularity sets
3. Generates 50 synthetic users with genre-biased ratings and seeds them

**Step 1: Create `backend/scripts/seedData.ts`**

```typescript
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fetchPopularMovies } from '../src/tmdb/fetcher';
import { buildFeatureVector } from '../src/ml/featureVector';
import { redis } from '../src/redis/client';
import { setMovie } from '../src/redis/movies';
import { setVector } from '../src/redis/vectors';
import { setRating, setPhase, setPreferredGenres } from '../src/redis/ratings';
import type { Movie } from '../src/types';

const MOVIES_FILE = path.resolve(__dirname, '../../data/seed/movies.json');

async function loadOrFetchMovies(): Promise<Movie[]> {
  if (fs.existsSync(MOVIES_FILE)) {
    console.log('Loading movies from data/seed/movies.json...');
    return JSON.parse(fs.readFileSync(MOVIES_FILE, 'utf-8')) as Movie[];
  }
  console.log('Fetching movies from TMDB (this takes ~5 minutes)...');
  const movies = await fetchPopularMovies(20);
  fs.mkdirSync(path.dirname(MOVIES_FILE), { recursive: true });
  fs.writeFileSync(MOVIES_FILE, JSON.stringify(movies, null, 2));
  console.log(`Saved ${movies.length} movies to data/seed/movies.json`);
  return movies;
}

// Compute IDF values across corpus for TF-IDF keyword weighting
function computeIDF(movies: Movie[]): Map<string, number> {
  const df = new Map<string, number>();
  for (const movie of movies) {
    const seen = new Set(movie.keywords);
    for (const kw of seen) df.set(kw, (df.get(kw) ?? 0) + 1);
  }
  const idf = new Map<string, number>();
  for (const [kw, count] of df) {
    idf.set(kw, Math.log(movies.length / count));
  }
  return idf;
}

// Weighted popularity score for ZADD
function popularityScore(movie: Movie, maxPop: number): number {
  return (movie.voteAverage * 0.7) + ((movie.popularity / maxPop) * 0.3);
}

const GENRE_PROFILES: Record<string, string[]> = {
  action:  ['Action', 'Thriller', 'Adventure'],
  drama:   ['Drama', 'Romance', 'History'],
  scifi:   ['Science Fiction', 'Fantasy', 'Adventure'],
  horror:  ['Horror', 'Mystery', 'Thriller'],
  mixed:   ['Comedy', 'Animation', 'Crime', 'Family'],
};

function generateRatings(
  userId: string,
  movies: Movie[],
  preferredGenres: string[],
  count = 200
): { movieId: number; rating: number }[] {
  const shuffled = [...movies].sort(() => Math.random() - 0.5);
  const ratings: { movieId: number; rating: number }[] = [];
  for (const movie of shuffled) {
    if (ratings.length >= count) break;
    const hasPreferred = movie.genres.some(g => preferredGenres.includes(g));
    // Genre fans rate preferred genres 4-5, others 1-3
    const base = hasPreferred ? 3.5 : 1.5;
    const noise = (Math.random() - 0.5) * 1.5;
    const rating = Math.min(5, Math.max(1, Math.round(base + noise)));
    ratings.push({ movieId: movie.id, rating });
  }
  return ratings;
}

async function main() {
  console.log('=== CineGraph Seed Script ===');

  const movies = await loadOrFetchMovies();
  console.log(`\nSeeding ${movies.length} movies to Redis...`);

  const maxPop = Math.max(...movies.map(m => m.popularity));
  const idf = computeIDF(movies);

  for (let i = 0; i < movies.length; i++) {
    const movie = movies[i];
    const vector = buildFeatureVector(movie, idf);
    await setMovie(movie);
    await setVector(movie.id, vector);
    const score = popularityScore(movie, maxPop);
    await redis.zadd('popular:all', { score, member: String(movie.id) });
    for (const genre of movie.genres) {
      await redis.zadd(`popular:${genre}`, { score, member: String(movie.id) });
    }
    if ((i + 1) % 50 === 0) console.log(`  ${i + 1}/${movies.length} movies seeded`);
  }

  console.log('\nGenerating synthetic users...');
  const profiles = [
    { prefix: 'synth_action', type: 'action', genres: GENRE_PROFILES.action },
    { prefix: 'synth_drama',  type: 'drama',  genres: GENRE_PROFILES.drama  },
    { prefix: 'synth_scifi',  type: 'scifi',  genres: GENRE_PROFILES.scifi  },
    { prefix: 'synth_horror', type: 'horror', genres: GENRE_PROFILES.horror },
    { prefix: 'synth_mixed',  type: 'mixed',  genres: GENRE_PROFILES.mixed  },
  ];

  for (const profile of profiles) {
    for (let n = 1; n <= 10; n++) {
      const userId = `${profile.prefix}_${String(n).padStart(2, '0')}`;
      const ratings = generateRatings(userId, movies, profile.genres, 200);
      await setPreferredGenres(userId, profile.genres);
      for (const { movieId, rating } of ratings) {
        await setRating(userId, movieId, rating);
      }
      await setPhase(userId, 'full'); // synthetic users have full history
      await redis.sadd('users:all', userId);
    }
    console.log(`  Seeded 10 ${profile.type} users`);
  }

  console.log('\n✓ Seed complete!');
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
```

**Step 2: Note on running the seed script**

The seed script imports `buildFeatureVector` from Task 5. Run seed AFTER Task 5 is complete:

```bash
cd backend && npm run seed
```

Expected output:
```
=== CineGraph Seed Script ===
Loading movies from data/seed/movies.json...   (or TMDB fetch if first run)
Seeding 500 movies to Redis...
  50/500 movies seeded
  ...
  500/500 movies seeded
Generating synthetic users...
  Seeded 10 action users
  ...
✓ Seed complete!
```

**Step 3: Commit**

```bash
git add backend/scripts/ data/
git commit -m "feat(backend): seed script + synthetic user generation"
```

---

### Task 5: ML utilities — featureVector, cosineSimilarity, pearsonCorrelation

**Files:**
- Create: `backend/src/ml/featureVector.ts`
- Create: `backend/src/ml/cosineSimilarity.ts`
- Create: `backend/src/ml/pearsonCorrelation.ts`
- Create: `backend/src/ml/featureVector.test.ts`
- Create: `backend/src/ml/cosineSimilarity.test.ts`

**Step 1: Create `backend/src/ml/featureVector.ts`**

```typescript
import type { Movie } from '../types';

// Fixed genre order — 19 TMDB movie genres, one-hot encoded at indices 0-18
export const GENRE_ORDER = [
  'Action', 'Adventure', 'Animation', 'Comedy', 'Crime',
  'Documentary', 'Drama', 'Family', 'Fantasy', 'History',
  'Horror', 'Music', 'Mystery', 'Romance', 'Science Fiction',
  'TV Movie', 'Thriller', 'War', 'Western',
];

// djb2 hash → normalized 0-1 float
function hashToFloat(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) & 0x7fffffff;
  }
  return h / 0x7fffffff;
}

/**
 * Builds a 44-dimensional feature vector for a movie.
 * Dimensions:
 *   [0-18]  Genre one-hot (19 genres)
 *   [19-23] Top 5 cast hashed to 0-1
 *   [24]    Director hashed
 *   [25-34] Top 10 keywords TF-IDF weighted
 *   [35]    vote_average / 10
 *   [36]    log(popularity+1) normalized
 *   [37]    release decade (1970=0.1 … 2020=0.6)
 *   [38]    runtime / 240 (clamped)
 *   [39]    vote count tier
 */
export function buildFeatureVector(
  movie: Movie,
  idf: Map<string, number>,
  maxLogPop = 10
): number[] {
  const vec = new Array<number>(40).fill(0);

  // [0-18] Genre one-hot
  for (const genre of movie.genres) {
    const idx = GENRE_ORDER.indexOf(genre);
    if (idx !== -1) vec[idx] = 1;
  }

  // [19-23] Cast hash
  for (let i = 0; i < 5; i++) {
    vec[19 + i] = movie.cast[i] ? hashToFloat(movie.cast[i]) : 0;
  }

  // [24] Director hash
  vec[24] = movie.director ? hashToFloat(movie.director) : 0;

  // [25-34] Top 10 keywords TF-IDF
  const topKws = movie.keywords.slice(0, 10);
  for (let i = 0; i < 10; i++) {
    if (topKws[i]) {
      const idfVal = idf.get(topKws[i]) ?? 0;
      vec[25 + i] = idfVal / 10; // normalize IDF to ~0-1 range
    }
  }

  // [35] vote_average
  vec[35] = movie.voteAverage / 10;

  // [36] log-scaled popularity
  vec[36] = Math.log(movie.popularity + 1) / maxLogPop;

  // [37] release decade
  const decade = Math.floor((movie.releaseYear - 1970) / 10);
  vec[37] = Math.max(0, Math.min(1, decade * 0.1));

  // [38] runtime
  vec[38] = Math.min(1, movie.runtime / 240);

  // [39] vote count tier
  vec[39] = movie.voteCount < 100 ? 0.25
    : movie.voteCount < 1000 ? 0.5
    : movie.voteCount < 10000 ? 0.75
    : 1.0;

  return vec;
}
```

**Step 2: Create `backend/src/ml/cosineSimilarity.ts`**

```typescript
export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot  += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}
```

**Step 3: Create `backend/src/ml/pearsonCorrelation.ts`**

```typescript
export function pearsonCorrelation(
  ratingsA: Record<number, number>,
  ratingsB: Record<number, number>
): number {
  const coRated = Object.keys(ratingsA)
    .filter(id => ratingsB[Number(id)] !== undefined)
    .map(Number);

  if (coRated.length < 2) return 0;

  const as = coRated.map(id => ratingsA[id]);
  const bs = coRated.map(id => ratingsB[id]);
  const meanA = as.reduce((s, v) => s + v, 0) / as.length;
  const meanB = bs.reduce((s, v) => s + v, 0) / bs.length;

  let num = 0, denA = 0, denB = 0;
  for (let i = 0; i < coRated.length; i++) {
    const da = as[i] - meanA, db = bs[i] - meanB;
    num  += da * db;
    denA += da * da;
    denB += db * db;
  }
  if (denA === 0 || denB === 0) return 0;
  return num / Math.sqrt(denA * denB);
}
```

**Step 4: Write unit tests**

Create `backend/src/ml/cosineSimilarity.test.ts`:
```typescript
import { cosineSimilarity } from './cosineSimilarity';

test('identical vectors return 1', () => {
  expect(cosineSimilarity([1, 0, 1], [1, 0, 1])).toBeCloseTo(1);
});
test('orthogonal vectors return 0', () => {
  expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
});
test('zero vector returns 0', () => {
  expect(cosineSimilarity([0, 0], [1, 1])).toBe(0);
});
```

Create `backend/src/ml/pearsonCorrelation.test.ts`:
```typescript
import { pearsonCorrelation } from './pearsonCorrelation';

test('perfect positive correlation', () => {
  const a = { 1: 1, 2: 2, 3: 3 };
  const b = { 1: 2, 2: 4, 3: 6 };
  expect(pearsonCorrelation(a, b)).toBeCloseTo(1);
});
test('no co-rated movies returns 0', () => {
  expect(pearsonCorrelation({ 1: 5 }, { 2: 5 })).toBe(0);
});
test('fewer than 2 co-rated returns 0', () => {
  expect(pearsonCorrelation({ 1: 5 }, { 1: 3 })).toBe(0);
});
```

**Step 5: Run tests**

```bash
cd backend && npm test
```
Expected: 6 tests passing.

**Step 6: Commit**

```bash
git add backend/src/ml/
git commit -m "feat(backend): ML utilities — featureVector, cosineSimilarity, pearsonCorrelation"
```

---

### Task 6: Recommendation engines — contentBased, collaborative, hybrid

**Files:**
- Create: `backend/src/ml/contentBased.ts`
- Create: `backend/src/ml/collaborative.ts`
- Create: `backend/src/ml/hybrid.ts`

**Step 1: Create `backend/src/ml/contentBased.ts`**

```typescript
import { getUserRatings, getPreferredGenres } from '../redis/ratings';
import { getAllMovieIds, getMovie, getPopularMovieIds } from '../redis/movies';
import { getVector, getAllVectors } from '../redis/vectors';
import { cosineSimilarity } from './cosineSimilarity';
import type { Recommendation } from '../types';

export async function contentBasedRecommend(
  userId: string,
  topN = 20
): Promise<Recommendation[]> {
  const ratings = await getUserRatings(userId);
  const ratedIds = Object.keys(ratings).map(Number);

  if (ratedIds.length === 0) return [];

  // Build taste profile: weighted average of rated movie vectors
  const profile = new Array<number>(40).fill(0);
  let totalWeight = 0;
  for (const id of ratedIds) {
    const vec = await getVector(id);
    if (!vec) continue;
    const w = ratings[id] / 5;
    for (let i = 0; i < vec.length; i++) profile[i] += vec[i] * w;
    totalWeight += w;
  }
  if (totalWeight === 0) return [];
  for (let i = 0; i < profile.length; i++) profile[i] /= totalWeight;

  // Score all unrated movies
  const allIds = await getAllMovieIds();
  const ratedSet = new Set(ratedIds);
  const scored: { id: number; sim: number }[] = [];

  for (const id of allIds) {
    if (ratedSet.has(id)) continue;
    const vec = await getVector(id);
    if (!vec) continue;
    scored.push({ id, sim: cosineSimilarity(profile, vec) });
  }

  scored.sort((a, b) => b.sim - a.sim);
  const top = scored.slice(0, topN);

  const results: Recommendation[] = [];
  for (const { id, sim } of top) {
    const movie = await getMovie(id);
    if (!movie) continue;
    results.push({
      movie,
      score: sim * 5,
      matchPercent: Math.round(sim * 100),
      reason: `Similar to movies you've rated highly`,
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

**Step 2: Create `backend/src/ml/collaborative.ts`**

```typescript
import { getUserRatings, getAllUserIds } from '../redis/ratings';
import { getMovie } from '../redis/movies';
import { pearsonCorrelation } from './pearsonCorrelation';
import type { Recommendation } from '../types';

export async function collaborativeRecommend(
  userId: string,
  topN = 20,
  K = 10
): Promise<Recommendation[]> {
  const [userRatings, allUserIds] = await Promise.all([
    getUserRatings(userId),
    getAllUserIds(),
  ]);

  if (Object.keys(userRatings).length === 0) return [];

  // Compute Pearson similarity to all other users
  const similarities: { userId: string; sim: number; ratings: Record<number, number> }[] = [];
  for (const otherId of allUserIds) {
    if (otherId === userId) continue;
    const otherRatings = await getUserRatings(otherId);
    const sim = pearsonCorrelation(userRatings, otherRatings);
    if (sim > 0) similarities.push({ userId: otherId, sim, ratings: otherRatings });
  }
  similarities.sort((a, b) => b.sim - a.sim);
  const topK = similarities.slice(0, K);
  if (topK.length === 0) return [];

  // Collect unseen movies and predict ratings
  const ratedSet = new Set(Object.keys(userRatings).map(Number));
  const userMean = Object.values(userRatings).reduce((s, v) => s + v, 0) / Object.keys(userRatings).length;

  const candidates = new Map<number, { num: number; den: number; users: string[] }>();
  for (const { userId: nId, sim, ratings } of topK) {
    const nMean = Object.values(ratings).reduce((s, v) => s + v, 0) / Object.keys(ratings).length;
    for (const [mId, rating] of Object.entries(ratings)) {
      const id = Number(mId);
      if (ratedSet.has(id)) continue;
      if (!candidates.has(id)) candidates.set(id, { num: 0, den: 0, users: [] });
      const c = candidates.get(id)!;
      c.num += sim * (rating - nMean);
      c.den += Math.abs(sim);
      c.users.push(nId);
    }
  }

  const predictions: { id: number; predicted: number; users: string[] }[] = [];
  for (const [id, { num, den, users }] of candidates) {
    if (den === 0) continue;
    predictions.push({ id, predicted: userMean + num / den, users });
  }
  predictions.sort((a, b) => b.predicted - a.predicted);

  const results: Recommendation[] = [];
  for (const { id, predicted, users } of predictions.slice(0, topN)) {
    const movie = await getMovie(id);
    if (!movie) continue;
    const score = Math.min(5, Math.max(0, predicted));
    results.push({
      movie, score,
      matchPercent: Math.round((score / 5) * 100),
      reason: `Liked by ${users.length} users with similar taste`,
      engine: 'collaborative',
      similarUsers: users.slice(0, 3),
    });
  }
  return results;
}
```

**Step 3: Create `backend/src/ml/hybrid.ts`**

```typescript
import { getPhase, getPreferredGenres } from '../redis/ratings';
import { contentBasedRecommend, getTopPopularForGenres } from './contentBased';
import { collaborativeRecommend } from './collaborative';
import type { Recommendation } from '../types';

export async function getRecommendations(
  userId: string,
  engine: 'content' | 'collaborative' | 'hybrid' | 'cold_start',
  topN = 20
): Promise<Recommendation[]> {
  const phase = await getPhase(userId);

  if (engine === 'cold_start' || phase === 'cold') {
    const genres = await getPreferredGenres(userId);
    return getTopPopularForGenres(genres.length > 0 ? genres : ['Action', 'Drama'], topN);
  }

  if (engine === 'content' || phase === 'warming') {
    return contentBasedRecommend(userId, topN);
  }

  if (engine === 'collaborative') {
    return collaborativeRecommend(userId, topN);
  }

  // hybrid: blend content + collaborative
  const [contentRecs, collabRecs] = await Promise.all([
    contentBasedRecommend(userId, topN),
    collaborativeRecommend(userId, topN),
  ]);

  const seen = new Set<number>();
  const blended: Recommendation[] = [];
  const maxLen = Math.max(contentRecs.length, collabRecs.length);

  for (let i = 0; i < maxLen; i++) {
    for (const rec of [contentRecs[i], collabRecs[i]]) {
      if (rec && !seen.has(rec.movie.id)) {
        seen.add(rec.movie.id);
        blended.push({ ...rec, engine: 'hybrid' });
      }
    }
  }
  return blended.slice(0, topN);
}
```

**Step 4: Commit**

```bash
git add backend/src/ml/contentBased.ts backend/src/ml/collaborative.ts backend/src/ml/hybrid.ts
git commit -m "feat(backend): recommendation engines — content, collaborative, hybrid"
```

---

### Task 7: DSA Part 1 — mergeSort + greedy

**Files:**
- Create: `backend/src/algorithms/mergeSort.ts`
- Create: `backend/src/algorithms/greedy.ts`
- Create: `backend/src/algorithms/mergeSort.test.ts`

**Step 1: Create `backend/src/algorithms/mergeSort.ts`**

```typescript
import type { Recommendation, MergeSortStep } from '../types';

function merge(
  left: Recommendation[],
  right: Recommendation[],
  steps: MergeSortStep[],
  leftOffset: number,
  rightOffset: number
): Recommendation[] {
  const result: Recommendation[] = [];
  let i = 0, j = 0;

  while (i < left.length && j < right.length) {
    steps.push({
      type: 'compare',
      array: [...left, ...right],
      leftIndex: leftOffset + i,
      rightIndex: rightOffset + j,
    });
    if (left[i].score >= right[j].score) {
      steps.push({ type: 'place', array: [...left, ...right], leftIndex: leftOffset + i, rightIndex: rightOffset + j });
      result.push(left[i++]);
    } else {
      steps.push({ type: 'place', array: [...left, ...right], leftIndex: leftOffset + i, rightIndex: rightOffset + j });
      result.push(right[j++]);
    }
  }
  while (i < left.length) result.push(left[i++]);
  while (j < right.length) result.push(right[j++]);

  steps.push({ type: 'merge', array: result, leftIndex: leftOffset, rightIndex: rightOffset + j - 1 });
  return result;
}

function mergeSortHelper(
  arr: Recommendation[],
  steps: MergeSortStep[],
  offset = 0
): Recommendation[] {
  if (arr.length <= 1) return arr;
  const mid = Math.floor(arr.length / 2);
  steps.push({ type: 'split', array: arr, leftIndex: offset, rightIndex: offset + arr.length - 1 });

  const left  = mergeSortHelper(arr.slice(0, mid), steps, offset);
  const right = mergeSortHelper(arr.slice(mid), steps, offset + mid);
  return merge(left, right, steps, offset, offset + mid);
}

export function mergeSort(
  items: Recommendation[]
): { sorted: Recommendation[]; steps: MergeSortStep[] } {
  const steps: MergeSortStep[] = [];
  const sorted = mergeSortHelper([...items], steps);
  return { sorted, steps };
}
```

**Step 2: Create `backend/src/algorithms/greedy.ts`**

```typescript
import type { Movie, Recommendation } from '../types';

export function greedyTopK(
  movies: Movie[],
  preferredGenres: string[],
  topN = 20,
  maxPopularity = 1000
): Recommendation[] {
  const scored = movies
    .filter(m => m.genres.some(g => preferredGenres.includes(g)))
    .map(m => {
      const popNorm = Math.min(1, m.popularity / maxPopularity);
      const score = (m.voteAverage / 10) * 0.7 + popNorm * 0.3;
      return { movie: m, score };
    });

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, topN).map(({ movie, score }) => ({
    movie,
    score: score * 5,
    matchPercent: Math.round(score * 100),
    reason: `Top rated ${preferredGenres[0] ?? 'movie'}`,
    engine: 'cold_start' as const,
  }));
}
```

**Step 3: Write test for mergeSort**

Create `backend/src/algorithms/mergeSort.test.ts`:
```typescript
import { mergeSort } from './mergeSort';
import type { Recommendation } from '../types';

function makeRec(score: number): Recommendation {
  return { movie: { id: score, title: '', overview: '', posterPath: '', releaseYear: 2020, genres: [], cast: [], director: '', keywords: [], voteAverage: score, voteCount: 0, popularity: 0, runtime: 90 }, score, matchPercent: score * 20, reason: '', engine: 'content' };
}

test('sorts descending by score', () => {
  const { sorted } = mergeSort([makeRec(3), makeRec(5), makeRec(1), makeRec(4)]);
  expect(sorted.map(r => r.score)).toEqual([5, 4, 3, 1]);
});

test('returns steps array', () => {
  const { steps } = mergeSort([makeRec(2), makeRec(1)]);
  expect(steps.length).toBeGreaterThan(0);
});

test('empty array', () => {
  const { sorted } = mergeSort([]);
  expect(sorted).toEqual([]);
});
```

**Step 4: Run tests**

```bash
cd backend && npm test -- --testPathPattern=mergeSort
```
Expected: 3 tests passing.

**Step 5: Commit**

```bash
git add backend/src/algorithms/mergeSort.ts backend/src/algorithms/greedy.ts backend/src/algorithms/mergeSort.test.ts
git commit -m "feat(backend): DSA mergeSort + greedy from scratch"
```

---

### Task 8: DSA Part 2 — knapsack + floydWarshall

**Files:**
- Create: `backend/src/algorithms/knapsack.ts`
- Create: `backend/src/algorithms/floydWarshall.ts`
- Create: `backend/src/algorithms/knapsack.test.ts`
- Create: `backend/src/algorithms/floydWarshall.test.ts`

**Step 1: Create `backend/src/algorithms/knapsack.ts`**

```typescript
import type { Recommendation, KnapsackStep } from '../types';

export function knapsack(
  movies: Recommendation[],
  budgetMinutes: number
): { selected: Recommendation[]; totalScore: number; steps: KnapsackStep[] } {
  const n = movies.length;
  const W = budgetMinutes;
  const steps: KnapsackStep[] = [];

  // dp[i][w] = max total value for first i movies within w minutes
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(W + 1).fill(0));

  for (let i = 1; i <= n; i++) {
    const weight = movies[i - 1].movie.runtime;
    const value  = Math.round(movies[i - 1].score * 10);

    for (let w = 0; w <= W; w++) {
      if (weight <= w && dp[i - 1][w - weight] + value > dp[i - 1][w]) {
        dp[i][w] = dp[i - 1][w - weight] + value;
        steps.push({ row: i, col: w, value: dp[i][w], decision: 'include' });
      } else {
        dp[i][w] = dp[i - 1][w];
        steps.push({ row: i, col: w, value: dp[i][w], decision: 'exclude' });
      }
    }
  }

  // Backtrack to find selected movies
  const selected: Recommendation[] = [];
  let w = W;
  for (let i = n; i > 0; i--) {
    if (dp[i][w] !== dp[i - 1][w]) {
      selected.push(movies[i - 1]);
      w -= movies[i - 1].movie.runtime;
    }
  }

  return { selected: selected.reverse(), totalScore: dp[n][W] / 10, steps };
}
```

**Step 2: Create `backend/src/algorithms/floydWarshall.ts`**

```typescript
import type { FloydStep } from '../types';

const MAX_USERS = 20;

export function floydWarshall(
  similarityMatrix: number[][],
  userIds: string[]
): { matrix: number[][]; steps: FloydStep[] } {
  const n = Math.min(userIds.length, MAX_USERS);
  const sim = similarityMatrix.slice(0, n).map(row => [...row.slice(0, n)]);
  const steps: FloydStep[] = [];

  for (let k = 0; k < n; k++) {
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const transitive = sim[i][k] * sim[k][j];
        if (transitive > sim[i][j]) {
          const oldVal = sim[i][j];
          sim[i][j] = transitive;
          steps.push({ k, i, j, oldVal, newVal: transitive, updated: true });
        }
      }
    }
  }

  return { matrix: sim, steps };
}
```

**Step 3: Write tests**

Create `backend/src/algorithms/knapsack.test.ts`:
```typescript
import { knapsack } from './knapsack';
import type { Recommendation } from '../types';

function makeRec(id: number, runtime: number, score: number): Recommendation {
  return { movie: { id, title: `M${id}`, overview: '', posterPath: '', releaseYear: 2020, genres: [], cast: [], director: '', keywords: [], voteAverage: score, voteCount: 0, popularity: 0, runtime }, score, matchPercent: score * 20, reason: '', engine: 'content' };
}

test('selects movies within budget', () => {
  const movies = [makeRec(1, 120, 4), makeRec(2, 90, 5), makeRec(3, 60, 3)];
  const { selected } = knapsack(movies, 150);
  const totalRuntime = selected.reduce((s, r) => s + r.movie.runtime, 0);
  expect(totalRuntime).toBeLessThanOrEqual(150);
});

test('zero budget returns empty', () => {
  const { selected } = knapsack([makeRec(1, 120, 4)], 0);
  expect(selected).toHaveLength(0);
});

test('records steps', () => {
  const { steps } = knapsack([makeRec(1, 60, 4)], 60);
  expect(steps.length).toBeGreaterThan(0);
});
```

Create `backend/src/algorithms/floydWarshall.test.ts`:
```typescript
import { floydWarshall } from './floydWarshall';

test('propagates transitive similarity', () => {
  // A↔B=0.8, B↔C=0.8, A↔C should become 0.64
  const matrix = [
    [1.0, 0.8, 0.0],
    [0.8, 1.0, 0.8],
    [0.0, 0.8, 1.0],
  ];
  const { matrix: result } = floydWarshall(matrix, ['a', 'b', 'c']);
  expect(result[0][2]).toBeCloseTo(0.64);
});

test('caps at 20 users', () => {
  const n = 25;
  const matrix = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => i === j ? 1 : 0.1)
  );
  const { matrix: result } = floydWarshall(matrix, Array.from({ length: n }, (_, i) => `u${i}`));
  expect(result.length).toBe(20);
});
```

**Step 4: Run tests**

```bash
cd backend && npm test -- --testPathPattern="knapsack|floydWarshall"
```
Expected: 6 tests passing.

**Step 5: Commit**

```bash
git add backend/src/algorithms/knapsack.ts backend/src/algorithms/floydWarshall.ts backend/src/algorithms/knapsack.test.ts backend/src/algorithms/floydWarshall.test.ts
git commit -m "feat(backend): DSA knapsack + floydWarshall from scratch"
```

---

### Task 9: DSA Part 3 — dijkstra (binary heap) + kruskal (union-find)

**Files:**
- Create: `backend/src/algorithms/dijkstra.ts`
- Create: `backend/src/algorithms/kruskal.ts`
- Create: `backend/src/algorithms/dijkstra.test.ts`
- Create: `backend/src/algorithms/kruskal.test.ts`

**Step 1: Create `backend/src/algorithms/dijkstra.ts`**

```typescript
import type { DijkstraStep } from '../types';

// Min-heap over [distance, nodeIndex] pairs — implemented from scratch
class MinHeap {
  private heap: [number, number][] = [];

  push(dist: number, idx: number): void {
    this.heap.push([dist, idx]);
    this._bubbleUp(this.heap.length - 1);
  }

  pop(): [number, number] | undefined {
    if (this.heap.length === 0) return undefined;
    const min = this.heap[0];
    const last = this.heap.pop()!;
    if (this.heap.length > 0) { this.heap[0] = last; this._sinkDown(0); }
    return min;
  }

  get size(): number { return this.heap.length; }

  private _bubbleUp(i: number): void {
    while (i > 0) {
      const p = Math.floor((i - 1) / 2);
      if (this.heap[p][0] <= this.heap[i][0]) break;
      [this.heap[p], this.heap[i]] = [this.heap[i], this.heap[p]];
      i = p;
    }
  }

  private _sinkDown(i: number): void {
    const n = this.heap.length;
    while (true) {
      let s = i;
      const l = 2 * i + 1, r = 2 * i + 2;
      if (l < n && this.heap[l][0] < this.heap[s][0]) s = l;
      if (r < n && this.heap[r][0] < this.heap[s][0]) s = r;
      if (s === i) break;
      [this.heap[s], this.heap[i]] = [this.heap[i], this.heap[s]];
      i = s;
    }
  }
}

export function dijkstra(
  similarityMatrix: number[][],
  userIds: string[],
  sourceIdx: number,
  targetIdx: number
): { path: string[]; distance: number; steps: DijkstraStep[] } {
  const n = userIds.length;
  const dist  = new Array<number>(n).fill(Infinity);
  const prev  = new Array<number>(n).fill(-1);
  const visited = new Array<boolean>(n).fill(false);
  const steps: DijkstraStep[] = [];

  dist[sourceIdx] = 0;
  const heap = new MinHeap();
  heap.push(0, sourceIdx);

  while (heap.size > 0) {
    const entry = heap.pop();
    if (!entry) break;
    const [d, u] = entry;
    if (visited[u]) continue;
    visited[u] = true;

    const frontier = Array.from({ length: n }, (_, i) => i)
      .filter(i => !visited[i] && dist[i] < Infinity)
      .map(i => userIds[i]);

    // Reconstruct current path
    const path: string[] = [];
    let cur = u;
    while (cur !== -1) { path.unshift(userIds[cur]); cur = prev[cur]; }

    steps.push({ visitedUserId: userIds[u], distance: d, frontier, path });

    if (u === targetIdx) break;

    for (let v = 0; v < n; v++) {
      if (visited[v] || similarityMatrix[u][v] <= 0) continue;
      const edgeWeight = 1 - similarityMatrix[u][v]; // convert similarity → distance
      const newDist = dist[u] + edgeWeight;
      if (newDist < dist[v]) {
        dist[v] = newDist;
        prev[v] = u;
        heap.push(newDist, v);
      }
    }
  }

  // Reconstruct final path
  const finalPath: string[] = [];
  let cur = targetIdx;
  while (cur !== -1) { finalPath.unshift(userIds[cur]); cur = prev[cur]; }

  return {
    path: dist[targetIdx] < Infinity ? finalPath : [],
    distance: dist[targetIdx],
    steps,
  };
}
```

**Step 2: Create `backend/src/algorithms/kruskal.ts`**

```typescript
import type { MSTStep } from '../types';

// Union-Find with path compression + union by rank — from scratch
class UnionFind {
  private parent: number[];
  private rank: number[];

  constructor(n: number) {
    this.parent = Array.from({ length: n }, (_, i) => i);
    this.rank   = new Array(n).fill(0);
  }

  find(x: number): number {
    if (this.parent[x] !== x) this.parent[x] = this.find(this.parent[x]); // path compression
    return this.parent[x];
  }

  union(x: number, y: number): boolean {
    const px = this.find(x), py = this.find(y);
    if (px === py) return false;
    if (this.rank[px] < this.rank[py]) this.parent[px] = py;
    else if (this.rank[px] > this.rank[py]) this.parent[py] = px;
    else { this.parent[py] = px; this.rank[px]++; }
    return true;
  }

  getComponents(): number[][] {
    const groups = new Map<number, number[]>();
    for (let i = 0; i < this.parent.length; i++) {
      const root = this.find(i);
      if (!groups.has(root)) groups.set(root, []);
      groups.get(root)!.push(i);
    }
    return Array.from(groups.values());
  }
}

interface Edge { u: number; v: number; weight: number; }

export function kruskal(
  similarityMatrix: number[][],
  userIds: string[]
): { mstEdges: { u: string; v: string; weight: number }[]; communities: string[][]; steps: MSTStep[] } {
  const n = userIds.length;
  const uf = new UnionFind(n);
  const steps: MSTStep[] = [];

  // Build all edges (weight = 1 - similarity, lower = more similar)
  const edges: Edge[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (similarityMatrix[i][j] > 0) {
        edges.push({ u: i, v: j, weight: 1 - similarityMatrix[i][j] });
      }
    }
  }
  edges.sort((a, b) => a.weight - b.weight); // ascending = most similar first

  const mstEdges: { u: string; v: string; weight: number }[] = [];
  let totalCost = 0;

  for (const edge of edges) {
    const communities = uf.getComponents().map(comp => comp.map(i => userIds[i]));
    const edgeData = { u: userIds[edge.u], v: userIds[edge.v], weight: edge.weight };

    steps.push({ algorithm: 'kruskal', type: 'consider', edge: edgeData, communities, totalCost });

    if (uf.union(edge.u, edge.v)) {
      // Only add edge if similarity >= 0.5 (weight <= 0.5)
      if (edge.weight <= 0.5) {
        totalCost += edge.weight;
        mstEdges.push(edgeData);
        steps.push({ algorithm: 'kruskal', type: 'add', edge: edgeData, communities: uf.getComponents().map(c => c.map(i => userIds[i])), totalCost });
      }
    } else {
      steps.push({ algorithm: 'kruskal', type: 'reject', edge: edgeData, communities, totalCost });
    }
  }

  const communities = uf.getComponents().map(comp => comp.map(i => userIds[i]));
  return { mstEdges, communities, steps };
}
```

**Step 3: Write tests**

Create `backend/src/algorithms/dijkstra.test.ts`:
```typescript
import { dijkstra } from './dijkstra';

const matrix = [
  [1.0, 0.9, 0.1],
  [0.9, 1.0, 0.8],
  [0.1, 0.8, 1.0],
];
const users = ['a', 'b', 'c'];

test('finds shortest path a→c through b', () => {
  const { path } = dijkstra(matrix, users, 0, 2);
  expect(path).toEqual(['a', 'b', 'c']);
});

test('returns steps', () => {
  const { steps } = dijkstra(matrix, users, 0, 2);
  expect(steps.length).toBeGreaterThan(0);
});

test('unreachable target returns empty path', () => {
  const isolated = [[1, 0], [0, 1]];
  const { path } = dijkstra(isolated, ['x', 'y'], 0, 1);
  expect(path).toEqual([]);
});
```

Create `backend/src/algorithms/kruskal.test.ts`:
```typescript
import { kruskal } from './kruskal';

test('detects two communities', () => {
  // A-B highly similar, C-D highly similar, A-C weakly similar
  const matrix = [
    [1.0, 0.9, 0.2, 0.1],
    [0.9, 1.0, 0.1, 0.2],
    [0.2, 0.1, 1.0, 0.9],
    [0.1, 0.2, 0.9, 1.0],
  ];
  const { communities } = kruskal(matrix, ['a', 'b', 'c', 'd']);
  expect(communities).toHaveLength(2);
});

test('adds MST edges', () => {
  const matrix = [[1, 0.8], [0.8, 1]];
  const { mstEdges } = kruskal(matrix, ['a', 'b']);
  expect(mstEdges).toHaveLength(1);
});
```

**Step 4: Run all algorithm tests**

```bash
cd backend && npm test
```
Expected: All tests passing (mergeSort, knapsack, floydWarshall, dijkstra, kruskal, ML utilities).

**Step 5: Commit**

```bash
git add backend/src/algorithms/dijkstra.ts backend/src/algorithms/kruskal.ts backend/src/algorithms/dijkstra.test.ts backend/src/algorithms/kruskal.test.ts
git commit -m "feat(backend): DSA dijkstra (binary heap) + kruskal (union-find) from scratch"
```

---

### Task 10: REST routes + mount in Express

**Files:**
- Create: `backend/src/routes/movies.ts`
- Create: `backend/src/routes/rate.ts`
- Create: `backend/src/routes/recommend.ts`
- Create: `backend/src/routes/similarity.ts`
- Modify: `backend/src/index.ts`

**Step 1: Create `backend/src/routes/movies.ts`**

```typescript
import { Router } from 'express';
import { getMovie, searchMovies, getAllMovieIds } from '../redis/movies';
import { getVector } from '../redis/vectors';
import { cosineSimilarity } from '../ml/cosineSimilarity';

export const moviesRouter = Router();

moviesRouter.get('/search', async (req, res) => {
  const q = String(req.query.q ?? '').trim();
  if (!q) return res.json({ movies: [] });
  const movies = await searchMovies(q, 20);
  res.json({ movies });
});

moviesRouter.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid movie id' });

  const movie = await getMovie(id);
  if (!movie) return res.status(404).json({ error: 'Movie not found' });

  // Find top-6 similar movies by cosine similarity
  const vec = await getVector(id);
  const allIds = await getAllMovieIds();
  const similar: { id: number; sim: number }[] = [];

  if (vec) {
    for (const otherId of allIds) {
      if (otherId === id) continue;
      const otherVec = await getVector(otherId);
      if (otherVec) similar.push({ id: otherId, sim: cosineSimilarity(vec, otherVec) });
    }
    similar.sort((a, b) => b.sim - a.sim);
  }

  const similarMovies = [];
  for (const { id: sid } of similar.slice(0, 6)) {
    const m = await getMovie(sid);
    if (m) similarMovies.push(m);
  }

  res.json({ movie, similar: similarMovies });
});
```

**Step 2: Create `backend/src/routes/rate.ts`**

```typescript
import { Router } from 'express';
import { z } from 'zod';
import { setRating, computeAndSetPhase, getRatingCount } from '../redis/ratings';

export const rateRouter = Router();

const rateSchema = z.object({
  movieId: z.number().int().positive(),
  rating: z.number().min(1).max(5),
});

rateRouter.post('/', async (req, res) => {
  const userId = req.headers['x-session-token'] as string;
  if (!userId) return res.status(401).json({ error: 'Missing X-Session-Token' });

  const parsed = rateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { movieId, rating } = parsed.data;
  await setRating(userId, movieId, Math.round(rating));
  const newPhase = await computeAndSetPhase(userId);
  const ratingsCount = await getRatingCount(userId);

  res.json({ success: true, newPhase, ratingsCount });
});
```

**Step 3: Create `backend/src/routes/recommend.ts`**

```typescript
import { Router } from 'express';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { getRecommendations } from '../ml/hybrid';
import { mergeSort } from '../algorithms/mergeSort';
import { knapsack } from '../algorithms/knapsack';
import { setPreferredGenres } from '../redis/ratings';

// Imported and set by socketServer after initialization
export let emitToUser: ((userId: string, event: string, data: unknown) => void) | null = null;
export function setEmitter(fn: typeof emitToUser): void { emitToUser = fn; }

export const recommendRouter = Router();

const recommendSchema = z.object({
  engine: z.enum(['content', 'collaborative', 'hybrid', 'cold_start']),
  budget: z.number().int().positive().optional(),
  genres: z.array(z.string()).optional(),
});

recommendRouter.post('/', async (req, res) => {
  const userId = req.headers['x-session-token'] as string;
  if (!userId) return res.status(401).json({ error: 'Missing X-Session-Token' });

  const parsed = recommendSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { engine, budget, genres } = parsed.data;
  const sessionId = randomUUID();

  if (genres && genres.length > 0) {
    await setPreferredGenres(userId, genres);
  }

  // Return immediately — stream results via socket
  res.json({ sessionId });

  // Background job — fire and forget
  (async () => {
    try {
      const recs = await getRecommendations(userId, engine);
      const { sorted, steps: sortSteps } = mergeSort(recs);

      // Stream merge sort steps
      for (const step of sortSteps) {
        emitToUser?.(userId, 'algo:step', { algorithm: 'mergeSort', step });
        await new Promise(r => setTimeout(r, 16));
      }
      emitToUser?.(userId, 'algo:complete', { algorithm: 'mergeSort', durationMs: 0, totalSteps: sortSteps.length });

      let finalRecs = sorted;

      // Run knapsack if budget provided
      if (budget) {
        const { selected, steps: kSteps } = knapsack(sorted, budget);
        for (const step of kSteps) {
          emitToUser?.(userId, 'algo:step', { algorithm: 'knapsack', step });
          await new Promise(r => setTimeout(r, 16));
        }
        emitToUser?.(userId, 'algo:complete', { algorithm: 'knapsack', durationMs: 0, totalSteps: kSteps.length });
        finalRecs = selected;
      }

      emitToUser?.(userId, 'recommend:ready', { recommendations: finalRecs, engine });
    } catch (err) {
      console.error('Recommendation job failed:', err);
    }
  })();
});
```

**Step 4: Create `backend/src/routes/similarity.ts`**

```typescript
import { Router } from 'express';
import { getAllUserIds, getUserRatings } from '../redis/ratings';
import { pearsonCorrelation } from '../ml/pearsonCorrelation';
import { floydWarshall } from '../algorithms/floydWarshall';
import { kruskal } from '../algorithms/kruskal';
import { randomUUID } from 'crypto';
import { emitToUser } from './recommend';

export const similarityRouter = Router();

similarityRouter.get('/', async (req, res) => {
  const userId = req.headers['x-session-token'] as string;
  if (!userId) return res.status(401).json({ error: 'Missing X-Session-Token' });

  const sessionId = randomUUID();
  res.json({ sessionId });

  (async () => {
    try {
      const allIds = await getAllUserIds();
      const capped = allIds.slice(0, 20); // Floyd-Warshall cap
      const ratingsMap: Record<string, Record<number, number>> = {};

      for (const uid of capped) {
        ratingsMap[uid] = await getUserRatings(uid);
      }

      // Build initial Pearson similarity matrix
      const n = capped.length;
      const matrix: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
      for (let i = 0; i < n; i++) {
        matrix[i][i] = 1;
        for (let j = i + 1; j < n; j++) {
          const sim = Math.max(0, pearsonCorrelation(ratingsMap[capped[i]], ratingsMap[capped[j]]));
          matrix[i][j] = matrix[j][i] = sim;
        }
      }

      // Floyd-Warshall — stream steps
      const { matrix: refined, steps: fwSteps } = floydWarshall(matrix, capped);
      for (const step of fwSteps) {
        emitToUser?.(userId, 'algo:step', { algorithm: 'floydWarshall', step });
        await new Promise(r => setTimeout(r, 16));
      }
      emitToUser?.(userId, 'algo:complete', { algorithm: 'floydWarshall', durationMs: 0, totalSteps: fwSteps.length });

      // Kruskal MST — community detection
      const allIds50 = allIds.slice(0, 50);
      const allRatings: Record<string, Record<number, number>> = { ...ratingsMap };
      for (const uid of allIds50.filter(id => !capped.includes(id))) {
        allRatings[uid] = await getUserRatings(uid);
      }
      const n50 = allIds50.length;
      const bigMatrix: number[][] = Array.from({ length: n50 }, () => new Array(n50).fill(0));
      for (let i = 0; i < n50; i++) {
        bigMatrix[i][i] = 1;
        for (let j = i + 1; j < n50; j++) {
          const sim = Math.max(0, pearsonCorrelation(allRatings[allIds50[i]], allRatings[allIds50[j]]));
          bigMatrix[i][j] = bigMatrix[j][i] = sim;
        }
      }

      const { communities, mstEdges } = kruskal(bigMatrix, allIds50);
      emitToUser?.(userId, 'community:update', { communities, mstEdges });
    } catch (err) {
      console.error('Similarity job failed:', err);
    }
  })();
});
```

**Step 5: Update `backend/src/index.ts` to mount all routes**

```typescript
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { redis } from './redis/client';
import { moviesRouter } from './routes/movies';
import { rateRouter } from './routes/rate';
import { recommendRouter } from './routes/recommend';
import { similarityRouter } from './routes/similarity';

export const app = express();
export const httpServer = createServer(app);

app.use(cors({ origin: process.env.FRONTEND_URL ?? 'http://localhost:3000' }));
app.use(express.json());

app.get('/health', async (_req, res) => {
  let redisOk = false;
  try { await redis.ping(); redisOk = true; } catch { /* offline */ }
  res.json({ status: 'ok', redis: redisOk, uptime: process.uptime() });
});

app.use('/movies', moviesRouter);
app.use('/rate', rateRouter);
app.use('/recommend', recommendRouter);
app.use('/similarity', similarityRouter);

const PORT = process.env.PORT ?? 3001;
httpServer.listen(PORT, () => {
  console.log(`CineGraph backend running on port ${PORT}`);
});
```

**Step 6: Verify routes respond**

```bash
cd backend && npm run dev

# In another terminal:
curl http://localhost:3001/health
curl "http://localhost:3001/movies/search?q=dark"
curl -X POST http://localhost:3001/rate \
  -H "Content-Type: application/json" \
  -H "X-Session-Token: test-user-001" \
  -d '{"movieId": 155, "rating": 5}'
```

Expected: `/health` returns `{"status":"ok","redis":true,...}`, `/movies/search` returns movie array, `/rate` returns `{"success":true,"newPhase":"cold","ratingsCount":1}`.

**Step 7: Commit**

```bash
git add backend/src/routes/ backend/src/index.ts
git commit -m "feat(backend): REST routes — movies, rate, recommend, similarity"
```

---

### Task 11: Socket.io server

**Files:**
- Create: `backend/src/socket/socketServer.ts`
- Modify: `backend/src/index.ts`

**Step 1: Create `backend/src/socket/socketServer.ts`**

```typescript
import { Server, type Socket } from 'socket.io';
import type { Server as HTTPServer } from 'http';
import { setEmitter } from '../routes/recommend';

// Map userId → socketId for targeting specific users
const userSocketMap = new Map<string, string>();

export function initSocketServer(httpServer: HTTPServer): void {
  const io = new Server(httpServer, {
    cors: { origin: process.env.FRONTEND_URL ?? 'http://localhost:3000' },
  });

  // Auth middleware — require non-empty token
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token || typeof token !== 'string') {
      return next(new Error('Missing auth token'));
    }
    (socket as Socket & { userId: string }).userId = token;
    next();
  });

  io.on('connection', (socket) => {
    const userId = (socket as Socket & { userId: string }).userId;
    userSocketMap.set(userId, socket.id);

    socket.on('disconnect', () => {
      userSocketMap.delete(userId);
    });

    // Client asks to re-trigger recommendation streaming
    socket.on('recommend:start', ({ engine, budget }: { engine: string; budget?: number }) => {
      // The REST route handles the actual job; this event is for re-subscription
      console.log(`recommend:start from ${userId}: engine=${engine}`);
    });

    // Client requests similarity computation
    socket.on('similarity:compute', ({ userIds }: { userIds: string[] }) => {
      console.log(`similarity:compute from ${userId}: ${userIds.length} users`);
    });

    // Client requests taste path
    socket.on('tastepath:find', ({ sourceUserId, targetUserId }: { sourceUserId: string; targetUserId: string }) => {
      console.log(`tastepath:find: ${sourceUserId} → ${targetUserId}`);
    });
  });

  // Wire emitter so routes can send to specific users
  setEmitter((userId: string, event: string, data: unknown) => {
    const socketId = userSocketMap.get(userId);
    if (socketId) {
      io.to(socketId).emit(event, data);
    }
  });
}
```

**Step 2: Update `backend/src/index.ts` to initialize Socket.io**

Add after `httpServer` is created:

```typescript
import { initSocketServer } from './socket/socketServer';

// ... (existing code) ...

// Initialize Socket.io — must be after httpServer is created, before listen
initSocketServer(httpServer);
```

Full updated `backend/src/index.ts`:

```typescript
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { redis } from './redis/client';
import { moviesRouter } from './routes/movies';
import { rateRouter } from './routes/rate';
import { recommendRouter } from './routes/recommend';
import { similarityRouter } from './routes/similarity';
import { initSocketServer } from './socket/socketServer';

export const app = express();
export const httpServer = createServer(app);

app.use(cors({ origin: process.env.FRONTEND_URL ?? 'http://localhost:3000' }));
app.use(express.json());

app.get('/health', async (_req, res) => {
  let redisOk = false;
  try { await redis.ping(); redisOk = true; } catch { /* offline */ }
  res.json({ status: 'ok', redis: redisOk, uptime: process.uptime() });
});

app.use('/movies', moviesRouter);
app.use('/rate', rateRouter);
app.use('/recommend', recommendRouter);
app.use('/similarity', similarityRouter);

initSocketServer(httpServer);

const PORT = process.env.PORT ?? 3001;
httpServer.listen(PORT, () => {
  console.log(`CineGraph backend running on port ${PORT}`);
});
```

**Step 3: End-to-end smoke test**

```bash
cd backend && npm run dev
```

In browser, open `http://localhost:3000` (frontend). Set a session token cookie, then:
1. Visit `/discover` — EngineSelector should trigger `POST /recommend` → socket should receive `recommend:ready`
2. Visit `/movie/155` (The Dark Knight) — should load movie + similar movies
3. Rate a movie — `POST /rate` should return phase update

Check backend console for `CineGraph backend running on port 3001` with no errors.

**Step 4: Run seed script now that all code is in place**

```bash
cd backend && npm run seed
```

Expected: 500 movies seeded, 50 synthetic users seeded.

**Step 5: Commit**

```bash
git add backend/src/socket/ backend/src/index.ts
git commit -m "feat(backend): Socket.io server + step streaming wired to routes"
```

---

## Post-Implementation Notes

### Running the full stack

```bash
# Terminal 1 — backend
cd backend && npm run dev

# Terminal 2 — frontend
cd frontend && npm run dev
```

Frontend at `http://localhost:3000`, backend at `http://localhost:3001`.

### First-time setup checklist

1. Copy `backend/.env.example` → `backend/.env` and fill in:
   - `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` (from Upstash dashboard)
   - `TMDB_API_KEY` (from themoviedb.org — free account)
2. Run `cd backend && npm run seed` (requires VPN if TMDB is blocked; uses `data/seed/movies.json` on subsequent runs)
3. Start backend with `npm run dev`

### What this does NOT include (future tasks)

- Dijkstra taste path triggered from `/graph` page events
- Full Floyd-Warshall streaming from `/similarity` endpoint to graph page D3 heatmap
- `data/seed/synthetic_ratings.json` as a static committed file (currently generated at seed time)
- Railway deployment configuration (`Procfile` or `railway.toml`)
