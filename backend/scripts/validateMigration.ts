import 'dotenv/config';
import { bq } from '../src/bigquery/client';

const DS  = `${process.env.GCP_PROJECT_ID ?? 'cinegraph'}.${process.env.GCP_DATASET_ID ?? 'cinegraph'}`;
const LOC = process.env.GCP_LOCATION ?? 'US';

type Row = Record<string, unknown>;

async function q(label: string, query: string): Promise<Row[]> {
  const [job] = await bq.createQueryJob({ query, location: LOC });
  const [rows] = await job.getQueryResults();
  return rows as Row[];
}

function n(v: unknown): number { return Number(v ?? 0); }
function s(v: unknown): string { return String(v ?? ''); }

let passed = 0;
let failed = 0;

function check(label: string, ok: boolean, detail = ''): void {
  const icon = ok ? '✅' : '❌';
  console.log(`${icon}  ${label}${detail ? `  →  ${detail}` : ''}`);
  ok ? passed++ : failed++;
}

async function main(): Promise<void> {
  console.log(`\n${'='.repeat(60)}`);
  console.log('  CineGraph BigQuery Migration Validator');
  console.log(`${'='.repeat(60)}\n`);

  // ── 1. ROW COUNTS ──────────────────────────────────────────────
  console.log('── 1. Row counts ─────────────────────────────────────────\n');

  const [cnt] = await q('counts', `
    SELECT
      (SELECT COUNT(*)          FROM \`${DS}.movies\`)          AS movies_total,
      (SELECT COUNT(DISTINCT movie_id) FROM \`${DS}.movies\`)   AS movies_distinct,
      (SELECT COUNT(*)          FROM \`${DS}.movie_features\`)  AS features_total,
      (SELECT COUNT(DISTINCT movie_id) FROM \`${DS}.movie_features\`) AS features_distinct,
      (SELECT COUNT(*)          FROM \`${DS}.movie_similarity\`) AS similarity_total,
      (SELECT COUNT(DISTINCT movie_id) FROM \`${DS}.movie_similarity\`) AS similarity_distinct
  `);

  const moviesTotal    = n(cnt.movies_total);
  const moviesDistinct = n(cnt.movies_distinct);
  const featTotal      = n(cnt.features_total);
  const featDistinct   = n(cnt.features_distinct);
  const simTotal       = n(cnt.similarity_total);
  const simDistinct    = n(cnt.similarity_distinct);

  console.log(`  movies       total=${moviesTotal}  distinct=${moviesDistinct}`);
  console.log(`  features     total=${featTotal}  distinct=${featDistinct}`);
  console.log(`  similarity   total=${simTotal}  distinct=${simDistinct}\n`);

  check('movies table has rows', moviesTotal > 0, `${moviesTotal} rows`);
  check('movie_features table has rows', featTotal > 0, `${featTotal} rows`);
  check('movie_similarity table has rows', simTotal > 0, `${simTotal} rows`);

  // ── 2. DUPLICATES ─────────────────────────────────────────────
  console.log('\n── 2. Duplicate checks ───────────────────────────────────\n');

  check('No duplicate movie_ids in movies',
    moviesTotal === moviesDistinct,
    moviesTotal !== moviesDistinct ? `${moviesTotal - moviesDistinct} dupes` : 'clean');

  check('No duplicate movie_ids in movie_features',
    featTotal === featDistinct,
    featTotal !== featDistinct ? `${featTotal - featDistinct} dupes` : 'clean');

  const [dupFeat] = await q('dup_features', `
    SELECT COUNT(*) AS cnt FROM (
      SELECT movie_id FROM \`${DS}.movie_features\`
      GROUP BY movie_id HAVING COUNT(*) > 1
    )
  `);
  check('movie_features: 0 movies with >1 feature row', n(dupFeat.cnt) === 0, `${n(dupFeat.cnt)} violators`);

  // ── 3. FEATURE VECTOR INTEGRITY ───────────────────────────────
  console.log('\n── 3. Feature vector integrity ───────────────────────────\n');

  const [dimCheck] = await q('dim_check', `
    SELECT
      MIN(ARRAY_LENGTH(feature_vector)) AS min_dims,
      MAX(ARRAY_LENGTH(feature_vector)) AS max_dims,
      COUNTIF(ARRAY_LENGTH(feature_vector) != 40) AS wrong_dim_count
    FROM \`${DS}.movie_features\`
  `);

  const minDims  = n(dimCheck.min_dims);
  const maxDims  = n(dimCheck.max_dims);
  const wrongDim = n(dimCheck.wrong_dim_count);

  console.log(`  Vector dims: min=${minDims}  max=${maxDims}  wrong=${wrongDim}`);
  check('All feature vectors are 40-dimensional', wrongDim === 0, wrongDim > 0 ? `${wrongDim} bad rows` : 'all 40-dim');

  const [vecRange] = await q('vec_range', `
    SELECT
      MIN(val) AS global_min,
      MAX(val) AS global_max
    FROM \`${DS}.movie_features\`, UNNEST(feature_vector) AS val
  `);
  const vMin = Number(vecRange.global_min ?? 0);
  const vMax = Number(vecRange.global_max ?? 0);
  console.log(`  Vector value range: [${vMin.toFixed(4)}, ${vMax.toFixed(4)}]`);
  check('Feature values in [0, 1]', vMin >= 0 && vMax <= 1.0001,
    `min=${vMin.toFixed(4)} max=${vMax.toFixed(4)}`);

  // ── 4. SIMILARITY INTEGRITY ────────────────────────────────────
  console.log('\n── 4. Similarity integrity ───────────────────────────────\n');

  const [simRange] = await q('sim_range', `
    SELECT
      MIN(similarity_score) AS min_score,
      MAX(similarity_score) AS max_score,
      COUNTIF(similarity_score < 0 OR similarity_score > 1) AS out_of_range,
      COUNTIF(movie_id = similar_movie_id) AS self_matches
    FROM \`${DS}.movie_similarity\`
  `);

  const minSim    = Number(simRange.min_score ?? 0);
  const maxSim    = Number(simRange.max_score ?? 0);
  const outRange  = n(simRange.out_of_range);
  const selfMatch = n(simRange.self_matches);

  console.log(`  Score range: [${minSim.toFixed(4)}, ${maxSim.toFixed(4)}]`);
  check('Similarity scores in [0, 1]', outRange === 0, outRange > 0 ? `${outRange} bad` : 'all valid');
  check('No self-matches (movie_id = similar_movie_id)', selfMatch === 0, `${selfMatch} self-matches`);

  const [rankCheck] = await q('rank_check', `
    SELECT COUNTIF(rank < 1 OR rank > 50) AS bad_ranks
    FROM \`${DS}.movie_similarity\`
  `);
  check('All ranks in [1, 50]', n(rankCheck.bad_ranks) === 0, `${n(rankCheck.bad_ranks)} bad ranks`);

  const [perMovie] = await q('per_movie_sim', `
    SELECT
      MIN(cnt) AS min_similar,
      MAX(cnt) AS max_similar,
      AVG(cnt) AS avg_similar
    FROM (
      SELECT movie_id, COUNT(*) AS cnt
      FROM \`${DS}.movie_similarity\`
      GROUP BY movie_id
    )
  `);
  const minSim2 = n(perMovie.min_similar);
  const maxSim2 = n(perMovie.max_similar);
  const avgSim2 = Number(perMovie.avg_similar ?? 0);
  console.log(`  Similar pairs per movie: min=${minSim2}  max=${maxSim2}  avg=${avgSim2.toFixed(1)}`);
  check('Every movie has ≥1 similar movie', minSim2 >= 1, `min=${minSim2}`);

  // ── 5. REFERENTIAL INTEGRITY ──────────────────────────────────
  console.log('\n── 5. Referential integrity ──────────────────────────────\n');

  const [orphanFeat] = await q('orphan_feat', `
    SELECT COUNT(*) AS cnt
    FROM \`${DS}.movie_features\` f
    LEFT JOIN \`${DS}.movies\` m ON m.movie_id = f.movie_id
    WHERE m.movie_id IS NULL
  `);
  check('All feature rows have a parent movie', n(orphanFeat.cnt) === 0, `${n(orphanFeat.cnt)} orphans`);

  const [orphanSim] = await q('orphan_sim', `
    SELECT COUNT(*) AS cnt
    FROM \`${DS}.movie_similarity\` s
    LEFT JOIN \`${DS}.movies\` m ON m.movie_id = s.movie_id
    WHERE m.movie_id IS NULL
  `);
  check('All similarity rows have a parent movie', n(orphanSim.cnt) === 0, `${n(orphanSim.cnt)} orphans`);

  const [missingFeat] = await q('missing_feat', `
    SELECT COUNT(*) AS cnt
    FROM \`${DS}.movies\` m
    LEFT JOIN \`${DS}.movie_features\` f ON f.movie_id = m.movie_id
    WHERE f.movie_id IS NULL
  `);
  check('Every movie has a feature vector', n(missingFeat.cnt) === 0,
    n(missingFeat.cnt) > 0 ? `${n(missingFeat.cnt)} movies missing vectors` : 'all covered');

  // ── 6. DATA QUALITY ───────────────────────────────────────────
  console.log('\n── 6. Data quality ───────────────────────────────────────\n');

  const [nullCheck] = await q('null_check', `
    SELECT
      COUNTIF(title IS NULL OR title = '')       AS empty_titles,
      COUNTIF(overview IS NULL OR overview = '') AS empty_overviews,
      COUNTIF(ARRAY_LENGTH(genres) = 0)          AS no_genres,
      COUNTIF(release_year IS NULL OR release_year = 0) AS no_year,
      COUNTIF(vote_average IS NULL OR vote_average = 0) AS no_rating
    FROM \`${DS}.movies\`
  `);
  check('No empty titles',     n(nullCheck.empty_titles) === 0,    `${n(nullCheck.empty_titles)} empty`);
  check('Overviews present',   n(nullCheck.empty_overviews) < moviesDistinct * 0.1, `${n(nullCheck.empty_overviews)} empty`);
  check('Genres populated',    n(nullCheck.no_genres) < moviesDistinct * 0.05, `${n(nullCheck.no_genres)} without genres`);
  check('Release years set',   n(nullCheck.no_year) === 0,         `${n(nullCheck.no_year)} missing`);

  // ── 7. SPOT CHECK ─────────────────────────────────────────────
  console.log('\n── 7. Spot check: top-5 most similar pairs ───────────────\n');

  const topPairs = await q('top_pairs', `
    SELECT
      m1.title AS movie,
      m2.title AS similar_movie,
      ROUND(s.similarity_score, 4) AS score
    FROM \`${DS}.movie_similarity\` s
    JOIN \`${DS}.movies\` m1 ON m1.movie_id = s.movie_id
    JOIN \`${DS}.movies\` m2 ON m2.movie_id = s.similar_movie_id
    ORDER BY s.similarity_score DESC
    LIMIT 5
  `);

  for (const row of topPairs) {
    console.log(`  ${s(row.score).padStart(6)}  "${s(row.movie)}"  →  "${s(row.similar_movie)}"`);
  }

  // ── SUMMARY ───────────────────────────────────────────────────
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  Results: ${passed} passed  /  ${failed} failed`);
  console.log(`${'='.repeat(60)}\n`);

  if (failed > 0) process.exit(1);
}

main().catch(err => { console.error('Validator error:', err); process.exit(1); });
