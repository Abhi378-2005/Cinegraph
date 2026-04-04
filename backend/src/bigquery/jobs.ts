import { bq } from './client';
import { logger } from '../../scripts/migration/logger';

const DS  = `${process.env.GCP_PROJECT_ID ?? 'cinegraph'}.${process.env.GCP_DATASET_ID ?? 'cinegraph'}`;
const LOC = process.env.GCP_LOCATION ?? 'US';

async function runJob(query: string, label: string): Promise<void> {
  logger.info(`Starting BigQuery job: ${label}`);
  const [job] = await bq.createQueryJob({ query, location: LOC });
  logger.info(`Job submitted: ${job.id}`);
  // getQueryResults polls until the job finishes and throws on error
  await job.getQueryResults({ timeoutMs: 60 * 60 * 1000 }); // 1-hour max
  const [[meta]] = await Promise.all([job.getMetadata()]);
  if (meta.status?.errorResult) {
    throw new Error(`Job ${job.id} failed: ${JSON.stringify(meta.status.errorResult)}`);
  }
  logger.info(`Job complete: ${label}`);
}

/**
 * Job 1 — BUILD FEATURE VECTORS
 *
 * Produces a 40-dim vector per movie (BigQuery is the source of truth — featureVector.ts is unused):
 *   [0–18]  Genre one-hot (19 TMDB genres, fixed order)
 *   [19–23] Top-5 cast name FARM_FINGERPRINT hashes → 0-1
 *   [24]    Director FARM_FINGERPRINT hash → 0-1
 *   [25–34] Top-10 keyword TF-IDF scores / 10  (ln((N+1)/(df+1)) / 10)
 *   [35]    vote_average / 10
 *   [36]    ln(popularity+1) / max_ln_pop  (corpus-normalised)
 *   [37]    floor((release_year−1970)/10) × 0.1  clamped [0,1]
 *   [38]    runtime / 240  clamped [0,1]
 *   [39]    vote-count tier  (<100→0.25, <1k→0.5, <10k→0.75, ≥10k→1.0)
 */
export async function runFeatureVectorJob(): Promise<void> {
  const sql = `
CREATE OR REPLACE TABLE \`${DS}.movie_features\` AS

WITH

-- Deduplicate movies: keep latest row per movie_id
dedup_movies AS (
  SELECT * EXCEPT(rn)
  FROM (
    SELECT *, ROW_NUMBER() OVER (PARTITION BY movie_id ORDER BY updated_at DESC) AS rn
    FROM \`${DS}.movies\`
  )
  WHERE rn = 1
),

n_total AS (
  SELECT COUNT(*) AS n
  FROM dedup_movies
),

corpus_stats AS (
  SELECT MAX(LN(popularity + 1)) AS max_log_pop
  FROM dedup_movies
),

-- Document frequency: how many movies contain each keyword
kw_df AS (
  SELECT kw, COUNT(DISTINCT movie_id) AS df
  FROM dedup_movies, UNNEST(keywords) AS kw
  GROUP BY kw
),

-- Per-movie top-10 keywords ranked by TF-IDF (desc)
kw_ranked AS (
  SELECT
    m.movie_id,
    ROW_NUMBER() OVER (
      PARTITION BY m.movie_id
      ORDER BY LN((CAST(nt.n AS FLOAT64) + 1.0) / (COALESCE(kw_df.df, 1) + 1.0)) DESC
    ) AS rk,
    -- Value matches featureVector.ts: idf / 10
    LN((CAST(nt.n AS FLOAT64) + 1.0) / (COALESCE(kw_df.df, 1) + 1.0)) / 10.0 AS score
  FROM dedup_movies m
  JOIN UNNEST(m.keywords) AS kw
  CROSS JOIN n_total nt
  LEFT JOIN kw_df ON kw_df.kw = kw
),

kw_top10 AS (
  SELECT movie_id, rk, score
  FROM kw_ranked
  WHERE rk <= 10
),

kw_agg AS (
  SELECT movie_id, ARRAY_AGG(score ORDER BY rk) AS scores
  FROM kw_top10
  GROUP BY movie_id
),

-- Pad to exactly 10 dims; movies with no keywords get all zeros
kw_final AS (
  SELECT
    m.movie_id,
    ARRAY(
      SELECT IF(
        kv.scores IS NOT NULL AND i < ARRAY_LENGTH(kv.scores),
        kv.scores[OFFSET(i)],
        0.0
      )
      FROM UNNEST(GENERATE_ARRAY(0, 9)) AS i
    ) AS kw_vec
  FROM dedup_movies m
  LEFT JOIN kw_agg kv ON kv.movie_id = m.movie_id
)

SELECT
  m.movie_id,
  ARRAY_CONCAT(

    -- [0–18] Genre one-hot (19 genres, order matches GENRE_ORDER in featureVector.ts)
    [
      IF('Action'          IN UNNEST(m.genres), 1.0, 0.0),
      IF('Adventure'       IN UNNEST(m.genres), 1.0, 0.0),
      IF('Animation'       IN UNNEST(m.genres), 1.0, 0.0),
      IF('Comedy'          IN UNNEST(m.genres), 1.0, 0.0),
      IF('Crime'           IN UNNEST(m.genres), 1.0, 0.0),
      IF('Documentary'     IN UNNEST(m.genres), 1.0, 0.0),
      IF('Drama'           IN UNNEST(m.genres), 1.0, 0.0),
      IF('Family'          IN UNNEST(m.genres), 1.0, 0.0),
      IF('Fantasy'         IN UNNEST(m.genres), 1.0, 0.0),
      IF('History'         IN UNNEST(m.genres), 1.0, 0.0),
      IF('Horror'          IN UNNEST(m.genres), 1.0, 0.0),
      IF('Music'           IN UNNEST(m.genres), 1.0, 0.0),
      IF('Mystery'         IN UNNEST(m.genres), 1.0, 0.0),
      IF('Romance'         IN UNNEST(m.genres), 1.0, 0.0),
      IF('Science Fiction' IN UNNEST(m.genres), 1.0, 0.0),
      IF('TV Movie'        IN UNNEST(m.genres), 1.0, 0.0),
      IF('Thriller'        IN UNNEST(m.genres), 1.0, 0.0),
      IF('War'             IN UNNEST(m.genres), 1.0, 0.0),
      IF('Western'         IN UNNEST(m.genres), 1.0, 0.0)
    ],

    -- [19–23] Top-5 cast name hashes (0.0 if fewer than 5 cast members)
    [
      IF(ARRAY_LENGTH(m.cast_names) > 0,
         MOD(ABS(FARM_FINGERPRINT(m.cast_names[OFFSET(0)])), 1000000) / 1000000.0, 0.0),
      IF(ARRAY_LENGTH(m.cast_names) > 1,
         MOD(ABS(FARM_FINGERPRINT(m.cast_names[OFFSET(1)])), 1000000) / 1000000.0, 0.0),
      IF(ARRAY_LENGTH(m.cast_names) > 2,
         MOD(ABS(FARM_FINGERPRINT(m.cast_names[OFFSET(2)])), 1000000) / 1000000.0, 0.0),
      IF(ARRAY_LENGTH(m.cast_names) > 3,
         MOD(ABS(FARM_FINGERPRINT(m.cast_names[OFFSET(3)])), 1000000) / 1000000.0, 0.0),
      IF(ARRAY_LENGTH(m.cast_names) > 4,
         MOD(ABS(FARM_FINGERPRINT(m.cast_names[OFFSET(4)])), 1000000) / 1000000.0, 0.0)
    ],

    -- [24] Director name hash (0.0 if no director)
    [IF(m.director IS NULL OR m.director = '',
        0.0,
        MOD(ABS(FARM_FINGERPRINT(m.director)), 1000000) / 1000000.0)],

    -- [25–34] Top-10 keyword TF-IDF scores (padded to 10 dims)
    kf.kw_vec,

    -- [35] vote_average / 10
    [m.vote_average / 10.0],

    -- [36] ln(popularity+1) normalised by corpus max
    [SAFE_DIVIDE(LN(m.popularity + 1), cs.max_log_pop)],

    -- [37] Release decade: floor((year-1970)/10)*0.1, clamped [0,1]
    --      Matches: Math.max(0, Math.min(1, Math.floor((year-1970)/10)*0.1))
    [GREATEST(0.0, LEAST(1.0,
       FLOOR((CAST(m.release_year AS FLOAT64) - 1970.0) / 10.0) * 0.1
    ))],

    -- [38] runtime / 240, clamped to [0,1]
    [LEAST(SAFE_DIVIDE(CAST(m.runtime AS FLOAT64), 240.0), 1.0)],

    -- [39] Vote count tier: <100→0.25, <1k→0.5, <10k→0.75, ≥10k→1.0
    [CASE
      WHEN m.vote_count <   100 THEN 0.25
      WHEN m.vote_count <  1000 THEN 0.5
      WHEN m.vote_count < 10000 THEN 0.75
      ELSE 1.0
    END]

  ) AS feature_vector,
  1                   AS feature_version,
  CURRENT_TIMESTAMP() AS updated_at

FROM dedup_movies m
CROSS JOIN corpus_stats cs
JOIN kw_final kf ON kf.movie_id = m.movie_id
`;

  await runJob(sql, 'Build feature vectors');
}

/**
 * Job 2 — COMPUTE SIMILARITY via VECTOR_SEARCH
 *
 * Uses BigQuery's native VECTOR_SEARCH (brute-force cosine) to find the
 * top-50 most similar movies for every movie in movie_features.
 * Much faster than the O(n²/2) TypeScript loop — BigQuery parallelises it.
 *
 * Cosine distance ∈ [0, 2]:  similarity_score = 1 − distance
 */
export async function runSimilarityJob(): Promise<void> {
  const sql = `
CREATE OR REPLACE TABLE \`${DS}.movie_similarity\` AS

SELECT
  query.movie_id                                                      AS movie_id,
  base.movie_id                                                       AS similar_movie_id,
  ROUND(1.0 - distance, 8)                                           AS similarity_score,
  CAST(ROW_NUMBER() OVER (
    PARTITION BY query.movie_id ORDER BY distance ASC
  ) AS INT64)                                                         AS rank,
  CAST('' AS STRING)                                                  AS signal_breakdown,
  CURRENT_TIMESTAMP()                                                 AS computed_at

FROM VECTOR_SEARCH(
  TABLE \`${DS}.movie_features\`,
  'feature_vector',
  (SELECT movie_id, feature_vector FROM \`${DS}.movie_features\`),
  top_k            => 51,
  distance_type    => 'COSINE',
  options          => '{"use_brute_force": true}'
)

-- Exclude self-matches (distance ≈ 0) and keep only top-50 per movie
WHERE base.movie_id != query.movie_id
QUALIFY ROW_NUMBER() OVER (PARTITION BY query.movie_id ORDER BY distance ASC) <= 50
`;

  await runJob(sql, 'Compute similarity (VECTOR_SEARCH)');
}
