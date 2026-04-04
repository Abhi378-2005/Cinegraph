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
  console.log('Fetching movies from TMDB (this takes ~5 minutes due to rate limiting)...');
  const movies = await fetchPopularMovies(20);
  fs.mkdirSync(path.dirname(MOVIES_FILE), { recursive: true });
  fs.writeFileSync(MOVIES_FILE, JSON.stringify(movies, null, 2));
  console.log(`Saved ${movies.length} movies to data/seed/movies.json`);
  return movies;
}

// Compute IDF across corpus for TF-IDF keyword weighting
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
  movies: Movie[],
  preferredGenres: string[],
  count = 200
): { movieId: number; rating: number }[] {
  const shuffled = [...movies].sort(() => Math.random() - 0.5);
  const ratings: { movieId: number; rating: number }[] = [];
  for (const movie of shuffled) {
    if (ratings.length >= count) break;
    const hasPreferred = movie.genres.some(g => preferredGenres.includes(g));
    const base = hasPreferred ? 3.5 : 1.5;
    const noise = (Math.random() - 0.5) * 1.5;
    const rating = Math.min(5, Math.max(1, Math.round(base + noise)));
    ratings.push({ movieId: movie.id, rating });
  }
  return ratings;
}

async function main() {
  console.log('=== CineGraph Seed Script ===\n');

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
      const ratings = generateRatings(movies, profile.genres, 200);
      await setPreferredGenres(userId, profile.genres);
      for (const { movieId, rating } of ratings) {
        await setRating(userId, movieId, rating);
      }
      await setPhase(userId, 'full');
      await redis.sadd('users:all', userId);
    }
    console.log(`  Seeded 10 ${profile.type} users`);
  }

  console.log('\n✓ Seed complete!');
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });