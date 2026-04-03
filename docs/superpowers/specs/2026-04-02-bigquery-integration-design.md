# BigQuery Integration Design

**Date:** 2026-04-02
**Branch:** feature/backend
**Scope:** Add Google BigQuery as primary data store for movies, feature vectors, and pre-computed similarity. Redis remains as hot cache. One-time migration script fetches 100k movies from TMDB proxy, builds feature vectors, computes top-50 similarity per movie, and uploads everything to BigQuery via upsert.

---

## Decisions Made

| Question | Decision |
|---|---|
| BigQuery role | Primary store for movies, features, similarity scores |
| Redis role | Hot cache (cache-aside) in front of BigQuery — unchanged for user ratings/sessions |
| Movie count | ~100k movies (5,000 pages × 20/page from TMDB proxy) |
| Similarity approach | Pre-computed top-50 per movie stored in BigQuery (not computed at request time) |
| Migration strategy | Upsert (MERGE by movie_id) — re-run safe, no duplicates, incremental update support |
| Language | TypeScript — consistent with existing backend |
| Algorithm visualization | Untouched — all DSA algorithms, Socket.io streaming unchanged |
| ML layer | Untouched except `contentBased.ts` switches from full-scan to pre-computed lookup |

---

## Section 1: BigQuery Schema

Dataset: `cinegraph` (region: `us-central1`)

### Table: `movies`

| Column | Type | Notes |
|---|---|---|
| `movie_id` | INTEGER | TMDB id, primary key |
| `title` | STRING | |
| `original_title` | STRING | |
| `overview` | STRING | |
| `poster_path` | STRING | |
| `backdrop_path` | STRING | |
| `release_date` | DATE | |
| `original_language` | STRING | |
| `popularity` | FLOAT64 | |
| `vote_average` | FLOAT64 | |
| `vote_count` | INTEGER | |
| `adult` | BOOL | |
| `genre_ids` | ARRAY\<INTEGER\> | |
| `updated_at` | TIMESTAMP | Set on every upsert |

### Table: `movie_features`

| Column | Type | Notes |
|---|---|---|
| `movie_id` | INTEGER | FK → movies |
| `genre_vector` | ARRAY\<FLOAT64\> | 28-dim one-hot (TMDB genres) |
| `popularity_norm` | FLOAT64 | Min-max normalized 0–1 across corpus |
| `vote_norm` | FLOAT64 | Min-max normalized 0–1 across corpus |
| `decade` | INTEGER | e.g. 2020 |
| `cast_ids` | ARRAY\<INTEGER\> | Top-5 TMDB person IDs |
| `director_id` | INTEGER | TMDB person ID |
| `keyword_ids` | ARRAY\<INTEGER\> | Top-20 TMDB keyword IDs |
| `feature_version` | INTEGER | Incremented on each re-run |
| `updated_at` | TIMESTAMP | |

### Table: `movie_similarity`

| Column | Type | Notes |
|---|---|---|
| `movie_id` | INTEGER | Source movie |
| `similar_movie_id` | INTEGER | Similar movie |
| `similarity_score` | FLOAT64 | Cosine similarity 0–1 |
| `rank` | INTEGER | 1–50 (1 = most similar) |
| `signal_breakdown` | STRING | e.g. `"genre:0.8,decade:0.1,cast:0.1"` |
| `computed_at` | TIMESTAMP | When similarity was last computed |

~5M rows for 100k movies × top-50 → ~300MB

### Table: `user_ratings`

| Column | Type | Notes |
|---|---|---|
| `session_token` | STRING | Anonymous UUID |
| `movie_id` | INTEGER | |
| `rating` | FLOAT64 | 1.0–5.0 |
| `rated_at` | TIMESTAMP | |

Partitioned by `rated_at` (DATE), clustered by `session_token`, `movie_id`.

**Note:** This table holds synthetic seed ratings (50 pre-generated users from `data/seed/synthetic_ratings.json`) used by collaborative filtering. Real user ratings from the live app are written to Redis by `redis/ratings.ts` as before — BigQuery's `user_ratings` is the seed corpus, not the live write target.

---

## Section 2: Migration Script

**Location:** `backend/scripts/migrateToBigQuery.ts`

**Run commands:**
```bash
npm run migrate               # full run
npm run migrate:resume        # resume from checkpoint after crash
npm run migrate:similarity-only  # recompute similarity only (movies already in BQ)
```

### Flow

```
1. FETCH PHASE — fetchMovies.ts
   - Pages 1–5000 from TMDB proxy (throttle: 1 req / 300ms)
   - Retry failed pages up to 3x with exponential backoff
   - Write checkpoint to data/migration/checkpoint.json (resume on crash)
   - Append raw records to data/migration/movies_raw.jsonl

2. ENRICH PHASE — enrichMovies.ts
   - GET /movie/{id}?append_to_response=credits,keywords for each movie
   - Extract: top-5 cast IDs, director ID, top-20 keyword IDs
   - Same 300ms throttle

3. FEATURE VECTOR PHASE — buildFeatures.ts
   - Genre one-hot (28 TMDB genres → 28-dim vector)
   - Normalize popularity + vote_average (min-max across full corpus)
   - Extract release decade
   - Output: movie_features rows with feature_version incremented

4. UPSERT TO BIGQUERY — bigqueryClient.ts
   - MERGE INTO movies USING staging ON movie_id
   - MERGE INTO movie_features USING staging ON movie_id
   - Batch size: 500 rows per insert (BigQuery streaming quota)

5. SIMILARITY BATCH JOB — computeSimilarity.ts
   - Load all feature vectors from BigQuery in batches of 1000
   - Compute cosine similarity between all pairs (chunked to avoid memory blow-up)
   - Keep top-50 per movie
   - Build signal_breakdown string per pair
   - MERGE INTO movie_similarity (upsert by movie_id + similar_movie_id)
```

### Checkpoint / Resume

```
data/migration/
├── checkpoint.json        ← { lastPage: 3421, totalFetched: 68420 }
├── movies_raw.jsonl       ← line-delimited, append-only during fetch
└── migration.log          ← timestamped run log
```

### Re-run behaviour

| Scenario | Result |
|---|---|
| Movie already in BigQuery | MERGE updates title, overview, votes, popularity, `updated_at` |
| New movie not in BigQuery | MERGE inserts as new row |
| Feature version bumped | Updates `movie_features`, triggers similarity recompute for changed movies only |
| Similarity already computed for unchanged movies | Skipped via `computed_at` check |

---

## Section 3: Backend Integration

### What changes vs. what stays untouched

| File | Change |
|---|---|
| `algorithms/*` | **Untouched** |
| `socket/socketServer.ts` | **Untouched** |
| `routes/*` | **Untouched** |
| `ml/hybrid.ts`, `collaborative.ts` | **Untouched** |
| `ml/contentBased.ts` | **One function updated** — use pre-computed similarity lookup |
| `redis/movies.ts` | **Extended** — BigQuery cache-aside fallback on cache miss |
| `redis/vectors.ts` | **Extended** — BigQuery cache-aside fallback on cache miss |
| `redis/ratings.ts` | **Untouched** — user ratings stay in Redis |

### New files

```
backend/src/bigquery/
├── client.ts         ← BigQuery SDK init (GCP service account from env)
├── movies.ts         ← getBQMovie(id), getBQMovieBatch(ids), getBQPopular(genre, limit)
├── vectors.ts        ← getBQVector(id), getBQVectorBatch(ids)
└── similarity.ts     ← getTopSimilar(movieId, limit=50) → pre-computed row lookup

backend/scripts/
└── migrateToBigQuery.ts
```

### Cache-aside pattern

`getMovie(id)` in `redis/movies.ts`:
```
1. Check Redis key "movie:{id}"
   → HIT:  return immediately (unchanged fast path)
   → MISS: query BigQuery getBQMovie(id)
           write to Redis (TTL 24h)
           return result
```

Same pattern for `getVector(id)` in `redis/vectors.ts`.

The ML layer (`contentBased.ts`, `collaborative.ts`, `hybrid.ts`) calls the same Redis functions — BigQuery is invisible to it.

### `contentBased.ts` change

| | Before | After |
|---|---|---|
| Logic | `getAllMovieIds()` → loop 100k movies → compute cosine similarity live | Per rated movie → `getTopSimilar(movieId)` → fetch pre-computed top-50 → blend |
| Speed | O(100k) Redis calls per request | O(rated_count × 50) lookups |
| Quality | Same corpus | Same corpus, pre-computed over full 100k |

### Redis key schema (additions)

| Key | Value | TTL |
|---|---|---|
| `movie:{id}` | Movie JSON | 24h (existing, unchanged) |
| `movie:vector:{id}` | Feature vector JSON | 24h (existing, unchanged) |
| `rec:content:{movieId}` | Top-50 similar movies | 10 min |
| `rec:collab:{token}` | Collaborative recs for user | 5 min |
| `rec:cold:{genres_hash}` | Cold start results | 30 min |

### New environment variables (`backend/.env`)

```
GCP_PROJECT_ID=cinegraph-xxxxx
GCP_DATASET_ID=cinegraph
GOOGLE_APPLICATION_CREDENTIALS=./secrets/gcp-service-account.json
```

`backend/secrets/` is gitignored.

---

## Section 4: GCP Setup (One-Time)

1. **Create GCP project** — note Project ID → `GCP_PROJECT_ID`
2. **Enable BigQuery API** — APIs & Services → Enable → "BigQuery API"
3. **Create dataset** — BigQuery → Create Dataset → ID: `cinegraph`, region: `us-central1`
4. **Create service account** — IAM → Service Accounts → `cinegraph-backend`
   - Roles: BigQuery Data Editor + BigQuery Job User
   - Download JSON key → save as `backend/secrets/gcp-service-account.json`
5. **Tables** — auto-created by migration script on first run

### Free tier headroom

| Limit | Free amount | CineGraph usage |
|---|---|---|
| Storage | 10 GB | ~500 MB for 100k movies |
| Queries | 1 TB/month | Lookup queries are tiny — well under |
| Streaming inserts | $0.01/200MB | One-time migration only |

---

## Build Order

```
1. GCP setup (Section 4) — create project, dataset, service account
2. Add @google-cloud/bigquery to backend dependencies
3. backend/src/bigquery/ — client + movies + vectors + similarity
4. backend/scripts/migrateToBigQuery.ts — fetch + enrich + upsert + similarity batch
5. Extend redis/movies.ts + redis/vectors.ts with cache-aside fallback
6. Update ml/contentBased.ts — pre-computed similarity lookup
7. Run migration script (VPN on)
8. Smoke test: GET /movies, POST /recommend — verify data flows end to end
```
