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

  // Step 5: Compute and upsert similarity (per-chunk flush to avoid OOM)
  console.log('Loading all vectors from BigQuery for similarity computation...');
  console.log('WARNING: This may take 30-60 minutes for 100k movies.');

  const allVectors = await getAllBQVectors();
  console.log(`Loaded ${allVectors.size} vectors from BigQuery`);

  let totalSimilarityRows = 0;
  await computeTopKSimilarity(allVectors, async (chunkRows) => {
    await upsertSimilarity(chunkRows);
    totalSimilarityRows += chunkRows.length;
    console.log(`Flushed ${chunkRows.length} similarity rows (total so far: ${totalSimilarityRows})`);
  });

  console.log(`Total similarity rows upserted: ${totalSimilarityRows}`);
  console.log('=== Migration complete ===');
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
