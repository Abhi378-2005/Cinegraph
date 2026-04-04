import { BigQuery } from '@google-cloud/bigquery';
import {
  MOVIES_SCHEMA,
  MOVIE_FEATURES_SCHEMA,
  MOVIE_SIMILARITY_SCHEMA,
  USER_RATINGS_SCHEMA,
  TABLE_NAMES,
} from './schema';

export const bq = new BigQuery({
  projectId: process.env.GCP_PROJECT_ID,
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
});

export const dataset = bq.dataset(process.env.GCP_DATASET_ID ?? 'cinegraph');

const TABLE_SCHEMAS = {
  [TABLE_NAMES.movies]: MOVIES_SCHEMA,
  [TABLE_NAMES.features]: MOVIE_FEATURES_SCHEMA,
  [TABLE_NAMES.similarity]: MOVIE_SIMILARITY_SCHEMA,
  [TABLE_NAMES.ratings]: USER_RATINGS_SCHEMA,
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

/**
 * Truncates movies, movie_features, and movie_similarity tables.
 * Run before a full re-migration to prevent duplicate rows.
 * Does NOT touch user_ratings.
 */
export async function clearMigrationTables(): Promise<void> {
  const tables = [TABLE_NAMES.movies, TABLE_NAMES.features, TABLE_NAMES.similarity];
  for (const name of tables) {
    const table = dataset.table(name);
    const [exists] = await table.exists();
    if (exists) {
      await table.delete();
      console.log(`Dropped table: ${name}`);
    }
  }
  // Recreate empty tables with correct schema
  await ensureTables();
}
