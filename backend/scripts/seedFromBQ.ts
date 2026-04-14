// backend/scripts/seedFromBQ.ts
// Seeds Redis with all movies, vectors, and synthetic users from BigQuery.
// Run once after migration: npm run seed:bq
import 'dotenv/config';
import { bq } from '../src/bigquery/client';
import { getAllBQVectors } from '../src/bigquery/vectors';
import { setMovie } from '../src/redis/movies';
import { setVector } from '../src/redis/vectors';
import { setRating, setPhase, setPreferredGenres } from '../src/redis/ratings';
import { redis } from '../src/redis/client';
import type { Movie } from '../src/types';

const DS = `${process.env.GCP_PROJECT_ID ?? 'cinegraph'}.${process.env.GCP_DATASET_ID ?? 'cinegraph'}`;

// ── Timing helpers ────────────────────────────────────────────────────────────

function ms(start: number): string { return `${(Date.now() - start).toLocaleString()}ms`; }
function now(): string { return new Date().toISOString().slice(11, 23); } // HH:MM:SS.mmm

function section(title: string): void {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${'─'.repeat(60)}`);
}

function log(msg: string): void { console.log(`[${now()}] ${msg}`); }
function ok(msg: string):  void { console.log(`[${now()}] ✓ ${msg}`); }
function warn(msg: string): void { console.log(`[${now()}] ⚠ ${msg}`); }

// ── Data helpers ──────────────────────────────────────────────────────────────

function rowToMovie(row: Record<string, unknown>): Movie {
  return {
    id:           Number(row.movie_id),
    title:        String(row.title),
    overview:     String(row.overview ?? ''),
    posterPath:   String(row.poster_path ?? ''),
    backdropPath: row.backdrop_path ? String(row.backdrop_path) : undefined,
    releaseYear:  Number(row.release_year ?? 0),
    genres:       (row.genres as string[]) ?? [],
    cast:         (row.cast_names as string[]) ?? [],
    director:     String(row.director ?? ''),
    keywords:     (row.keywords as string[]) ?? [],
    voteAverage:  Number(row.vote_average ?? 0),
    voteCount:    Number(row.vote_count ?? 0),
    popularity:   Number(row.popularity ?? 0),
    runtime:      Number(row.runtime ?? 0),
  };
}

function popularityScore(m: Movie): number {
  return m.voteAverage * 0.7 + m.popularity / 1000.0 * 0.3;
}

const GENRE_PROFILES: Record<string, string[]> = {
  action: ['Action', 'Thriller', 'Adventure'],
  drama:  ['Drama', 'Romance', 'History'],
  scifi:  ['Science Fiction', 'Fantasy', 'Adventure'],
  horror: ['Horror', 'Mystery', 'Thriller'],
  mixed:  ['Comedy', 'Animation', 'Crime', 'Family'],
};

function generateRatings(
  movies: Movie[],
  preferredGenres: string[],
  count = 30,
): { movieId: number; rating: number }[] {
  const shuffled = [...movies].sort(() => Math.random() - 0.5);
  const ratings: { movieId: number; rating: number }[] = [];
  for (const movie of shuffled) {
    if (ratings.length >= count) break;
    const preferred = movie.genres.some(g => preferredGenres.includes(g));
    const base = preferred ? 3.5 : 1.5;
    const noise = (Math.random() - 0.5) * 1.5;
    ratings.push({ movieId: movie.id, rating: Math.min(5, Math.max(1, Math.round(base + noise))) });
  }
  return ratings;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const totalStart = Date.now();

  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║        CineGraph — Seed Redis from BigQuery              ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  log(`Dataset: ${DS}`);
  log(`Redis:   ${process.env.UPSTASH_REDIS_REST_URL?.slice(0, 40)}...`);

  // ── Step 1: Load movies from BigQuery ──────────────────────────────────────
  section('Step 1 — Load movies from BigQuery');
  let t = Date.now();
  log('Querying movies table...');

  const [rows] = await bq.query({ query: `SELECT * FROM \`${DS}.movies\`` });
  const movies = (rows as Record<string, unknown>[]).map(rowToMovie);

  ok(`${movies.length} movies loaded in ${ms(t)}`);

  // Genre breakdown
  const genreCounts: Record<string, number> = {};
  for (const m of movies) {
    for (const g of m.genres) genreCounts[g] = (genreCounts[g] ?? 0) + 1;
  }
  const topGenres = Object.entries(genreCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([g, c]) => `${g}(${c})`)
    .join('  ');
  log(`Genre spread: ${topGenres}`);

  const noVoteCount  = movies.filter(m => m.voteCount === 0).length;
  const noPoster     = movies.filter(m => !m.posterPath).length;
  const noOverview   = movies.filter(m => !m.overview).length;
  if (noVoteCount)  warn(`${noVoteCount} movies have voteCount=0`);
  if (noPoster)     warn(`${noPoster} movies have no posterPath`);
  if (noOverview)   warn(`${noOverview} movies have no overview`);

  // ── Step 2: Load feature vectors from BigQuery ─────────────────────────────
  section('Step 2 — Load feature vectors from BigQuery');
  t = Date.now();
  log('Querying movie_features table...');

  const vectorMap = await getAllBQVectors();

  ok(`${vectorMap.size} vectors loaded in ${ms(t)}`);

  const missingVecs = movies.filter(m => !vectorMap.has(m.id));
  if (missingVecs.length > 0) {
    warn(`${missingVecs.length} movies have no feature vector:`);
    for (const m of missingVecs.slice(0, 5)) warn(`  id=${m.id} "${m.title}"`);
    if (missingVecs.length > 5) warn(`  ... and ${missingVecs.length - 5} more`);
  } else {
    log('All movies have feature vectors');
  }

  // Spot-check a vector
  const sampleVec = vectorMap.values().next().value as number[] | undefined;
  if (sampleVec) {
    log(`Vector sample: dims=${sampleVec.length}  min=${Math.min(...sampleVec).toFixed(4)}  max=${Math.max(...sampleVec).toFixed(4)}`);
  }

  // ── Step 3: Seed movies + vectors + popular sets to Redis ──────────────────
  section('Step 3 — Seed movies, vectors, and popular sets to Redis');
  t = Date.now();
  log(`Writing ${movies.length} movies to Redis (movie hash + popular sorted sets + vector)...`);

  let seeded = 0;
  let vecSeeded = 0;
  let vecMissing = 0;
  const genresSeeded = new Set<string>();
  const batchStart = Date.now();

  for (const movie of movies) {
    const score = popularityScore(movie);
    const genreZadds = movie.genres.map(g => {
      genresSeeded.add(g);
      return redis.zadd(`popular:${g}`, { score, member: String(movie.id) });
    });

    await Promise.all([
      setMovie(movie),
      redis.zadd('popular:all', { score, member: String(movie.id) }),
      ...genreZadds,
    ]);

    const vec = vectorMap.get(movie.id);
    if (vec) { await setVector(movie.id, vec); vecSeeded++; }
    else vecMissing++;

    seeded++;

    if (seeded % 10 === 0) {
      const elapsed = Date.now() - batchStart;
      const rate = (seeded / elapsed * 1000).toFixed(1);
      const eta  = Math.round((movies.length - seeded) / Number(rate));
      log(`  ${seeded}/${movies.length} movies  |  ${rate} movies/s  |  ETA ~${eta}s  |  last: "${movie.title}"`);
    }
  }

  ok(`${seeded} movies seeded in ${ms(t)}`);
  ok(`${vecSeeded} vectors seeded  (${vecMissing} missing)`);
  ok(`popular:all + ${genresSeeded.size} genre sorted sets written`);
  log(`Genres covered: ${[...genresSeeded].sort().join(', ')}`);

  // ── Step 4: Synthetic users ────────────────────────────────────────────────
  section('Step 4 — Seed synthetic users for collaborative filtering');
  t = Date.now();
  log(`Creating ${Object.keys(GENRE_PROFILES).length * 10} synthetic users (10 per taste profile)...`);

  let totalRatings = 0;
  for (const [type, genres] of Object.entries(GENRE_PROFILES)) {
    const profileStart = Date.now();
    for (let n = 1; n <= 10; n++) {
      const userId = `synth_${type}_${String(n).padStart(2, '0')}`;
      const ratings = generateRatings(movies, genres, 30);
      await setPreferredGenres(userId, genres);
      for (const { movieId, rating } of ratings) {
        await setRating(userId, movieId, rating);
      }
      await setPhase(userId, 'full');
      await redis.sadd('users:all', userId);
      totalRatings += ratings.length;
    }
    ok(`10 ${type} users seeded  |  genres: ${genres.join(', ')}  |  ${ms(profileStart)}`);
  }

  ok(`${Object.keys(GENRE_PROFILES).length * 10} users seeded  |  ${totalRatings} total ratings  |  ${ms(t)}`);

  // ── Summary ────────────────────────────────────────────────────────────────
  section('Summary');
  console.log(`  Movies in Redis    : ${seeded}`);
  console.log(`  Vectors in Redis   : ${vecSeeded}`);
  console.log(`  Popular sets       : 1 (all) + ${genresSeeded.size} genres`);
  console.log(`  Synthetic users    : ${Object.keys(GENRE_PROFILES).length * 10}`);
  console.log(`  Total ratings      : ${totalRatings}`);
  console.log(`  Total time         : ${ms(totalStart)}`);
  console.log(`\n  ✓ Seed complete — backend is ready for live traffic\n`);

  process.exit(0);
}

main().catch(err => { console.error('Seed failed:', err); process.exit(1); });
