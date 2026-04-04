import 'dotenv/config';
import { bq } from '../src/bigquery/client';
import { runFeatureVectorJob, runSimilarityJob } from '../src/bigquery/jobs';

const DS = `${process.env.GCP_PROJECT_ID ?? 'cinegraph'}.${process.env.GCP_DATASET_ID ?? 'cinegraph'}`;
const LOC = process.env.GCP_LOCATION ?? 'US';

async function runDML(query: string, label: string): Promise<void> {
  console.log(`Running: ${label}`);
  const [job] = await bq.createQueryJob({ query, location: LOC });
  await job.getQueryResults({ timeoutMs: 5 * 60 * 1000 });
  const [[meta]] = await Promise.all([job.getMetadata()]);
  if (meta.status?.errorResult) throw new Error(JSON.stringify(meta.status.errorResult));
  console.log(`Done: ${label}`);
}

async function main(): Promise<void> {
  // 1. Deduplicate movies table (keep latest updated_at per movie_id)
  await runDML(`
    CREATE OR REPLACE TABLE \`${DS}.movies\` AS
    SELECT * EXCEPT(rn)
    FROM (
      SELECT *, ROW_NUMBER() OVER (PARTITION BY movie_id ORDER BY updated_at DESC) AS rn
      FROM \`${DS}.movies\`
    )
    WHERE rn = 1
  `, 'Deduplicate movies table');

  // Verify
  const [rows] = await bq.query({ query: `SELECT COUNT(*) AS cnt FROM \`${DS}.movies\`` });
  console.log(`Movies after dedup: ${(rows[0] as Record<string, unknown>).cnt}`);

  // 2. Rebuild feature vectors (now uses dedup_movies CTE internally too)
  await runFeatureVectorJob();

  // 3. Rebuild similarity
  await runSimilarityJob();

  console.log('All tables are now clean and consistent.');
}

main().catch(err => { console.error('Failed:', err); process.exit(1); });
