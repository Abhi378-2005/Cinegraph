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
