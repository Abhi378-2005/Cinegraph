// backend/scripts/migrateToBigQuery.ts
import 'dotenv/config';
import fs from 'fs';
import { bq, ensureTables, clearMigrationTables } from '../src/bigquery/client';
import { upsertMovies } from '../src/bigquery/upsert';
import { runFeatureVectorJob, runSimilarityJob } from '../src/bigquery/jobs';
import {
  fetchAllMovies,
  loadCheckpoint,
  CHECKPOINT_PATH,
  JSONL_PATH,
} from './migration/fetchMovies';
import {
  enrichMovies,
  loadEnrichedMovies,
  loadEnrichCheckpoint,
  ENRICH_CHECKPOINT_PATH,
  ENRICHED_PATH,
} from './migration/enrichMovies';
import { logger } from './migration/logger';

const RESUME          = process.argv.includes('--resume');
const SIMILARITY_ONLY = process.argv.includes('--similarity-only');
const TARGET_PAGES    = Number(process.env.TARGET_PAGES ?? '5000');

const LOCAL_ARTIFACTS = [CHECKPOINT_PATH, JSONL_PATH, ENRICH_CHECKPOINT_PATH, ENRICHED_PATH];

function deleteIfExists(filePath: string): void {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    logger.info(`Deleted ${filePath}`);
  }
}

async function main() {
  const mode = SIMILARITY_ONLY ? 'similarity-only' : RESUME ? 'resume' : 'full';
  logger.section(`CineGraph BigQuery Migration — mode: ${mode}`);
  logger.info(`TARGET_PAGES=${TARGET_PAGES}`);

  // Step 1: Ensure tables exist
  logger.section('Step 1: Verify BigQuery tables');
  await ensureTables();
  logger.info('Tables verified.');

  // Fresh full run: wipe local artifacts and BQ tables so reruns are idempotent
  if (!RESUME && !SIMILARITY_ONLY) {
    logger.section('Clearing local artifacts and BigQuery tables for fresh run');
    LOCAL_ARTIFACTS.forEach(deleteIfExists);
    await clearMigrationTables();
    logger.info('Clean slate — ready to migrate.');
  }

  if (!SIMILARITY_ONLY) {
    // Step 2: Fetch movies from TMDB
    logger.section('Step 2: Fetch movies from TMDB');
    const checkpoint = RESUME ? loadCheckpoint() : null;
    const resumeFrom = checkpoint?.lastPage ?? 0;
    if (resumeFrom > 0) logger.info(`Resuming fetch from page ${resumeFrom + 1}`);
    await fetchAllMovies(TARGET_PAGES, resumeFrom);

    // Step 3: Enrich with runtime, cast, director, keywords
    logger.section('Step 3: Enrich movies with detail data');
    const enrichCheckpoint = RESUME ? loadEnrichCheckpoint() : null;
    const enrichStartIndex = enrichCheckpoint ? enrichCheckpoint.lastIndex + 1 : 0;
    if (enrichStartIndex > 0) logger.info(`Resuming enrich from index ${enrichStartIndex}`);
    await enrichMovies(enrichStartIndex);

    // Step 4: Upsert raw movie rows to BigQuery
    // On resume, skip if BigQuery already has at least as many rows as the JSONL
    logger.section('Step 4: Upsert movies to BigQuery');
    const movies = loadEnrichedMovies();
    logger.info(`Loaded ${movies.length} enriched movies from JSONL`);
    let skipUpsert = false;
    if (RESUME) {
      const DS = `${process.env.GCP_PROJECT_ID ?? 'cinegraph'}.${process.env.GCP_DATASET_ID ?? 'cinegraph'}`;
      const [rows] = await bq.query({
        query: `SELECT COUNT(DISTINCT movie_id) AS cnt, COUNTIF(title IS NULL OR title = '') AS bad_title_cnt FROM \`${DS}.movies\``,
      });
      const bqCount = Number((rows[0] as Record<string, unknown>).cnt ?? 0);
      const badTitleCount = Number((rows[0] as Record<string, unknown>).bad_title_cnt ?? 0);
      logger.info(`Resume check — BigQuery has ${bqCount} distinct movies (JSONL has ${movies.length}), ${badTitleCount} row(s) with null/empty title`);
      if (bqCount >= movies.length && badTitleCount === 0) {
        skipUpsert = true;
        logger.info(`Skipping upsert — BigQuery count sufficient and all rows have valid titles.`);
      } else if (bqCount < movies.length) {
        logger.info(`Upsert required — BigQuery row count (${bqCount}) is below JSONL count (${movies.length}).`);
      } else {
        logger.info(`Upsert required — ${badTitleCount} row(s) have null/empty titles (possible PartialFailureError corruption).`);
      }
    }
    if (!skipUpsert) {
      await upsertMovies(movies);
      logger.info(`Upserted ${movies.length} movies.`);
    }
  }

  // Step 5: Build feature vectors via BigQuery SQL job
  logger.section('Step 5: Build feature vectors (BigQuery SQL job)');
  await runFeatureVectorJob();

  // Step 6: Compute similarity via VECTOR_SEARCH job
  logger.section('Step 6: Compute similarity (VECTOR_SEARCH job)');
  await runSimilarityJob();

  logger.section('Migration complete');
}

main().catch(err => {
  logger.error(`Migration failed: ${err instanceof Error ? err.stack ?? err.message : String(err)}`);
  process.exit(1);
});
