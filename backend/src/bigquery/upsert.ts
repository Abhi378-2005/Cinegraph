import { bq } from './client';
import { TABLE_NAMES } from './schema';
import type { Movie } from '../types';

const DS = `${process.env.GCP_PROJECT_ID ?? 'cinegraph'}.${process.env.GCP_DATASET_ID ?? 'cinegraph'}`;
const BATCH = 500;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function upsertMovies(movies: Movie[]): Promise<void> {
  const now = new Date().toISOString();
  const rows = movies.map(m => ({
    movie_id:          m.id,
    title:             m.title,
    original_title:    null,
    overview:          m.overview,
    poster_path:       m.posterPath,
    backdrop_path:     m.backdropPath ?? null,
    release_year:      m.releaseYear,
    original_language: null,
    popularity:        m.popularity,
    vote_average:      m.voteAverage,
    vote_count:        m.voteCount,
    runtime:           m.runtime,
    genres:            m.genres,
    cast_names:        m.cast,
    director:          m.director,
    keywords:          m.keywords,
    updated_at:        now,
  }));

  for (const batch of chunk(rows, BATCH)) {
    await bq.query({
      query: `
        MERGE \`${DS}.${TABLE_NAMES.movies}\` T
        USING UNNEST(@rows) S ON T.movie_id = S.movie_id
        WHEN MATCHED THEN UPDATE SET
          title = S.title, overview = S.overview, poster_path = S.poster_path,
          backdrop_path = S.backdrop_path, popularity = S.popularity,
          vote_average = S.vote_average, vote_count = S.vote_count,
          genres = S.genres, cast_names = S.cast_names, director = S.director,
          keywords = S.keywords, updated_at = S.updated_at
        WHEN NOT MATCHED THEN INSERT ROW
      `,
      params: { rows: batch },
      parameterMode: 'NAMED',
    });
  }
  console.log(`Upserted ${rows.length} movies to BigQuery`);
}

export async function upsertVectors(
  entries: { movieId: number; vector: number[]; version: number }[]
): Promise<void> {
  const now = new Date().toISOString();
  const rows = entries.map(e => ({
    movie_id: e.movieId, feature_vector: e.vector,
    feature_version: e.version, updated_at: now,
  }));

  for (const batch of chunk(rows, BATCH)) {
    await bq.query({
      query: `
        MERGE \`${DS}.${TABLE_NAMES.features}\` T
        USING UNNEST(@rows) S ON T.movie_id = S.movie_id
        WHEN MATCHED THEN UPDATE SET
          feature_vector = S.feature_vector, feature_version = S.feature_version,
          updated_at = S.updated_at
        WHEN NOT MATCHED THEN INSERT ROW
      `,
      params: { rows: batch },
      parameterMode: 'NAMED',
    });
  }
  console.log(`Upserted ${rows.length} feature vectors to BigQuery`);
}

export interface SimilarityRow {
  movieId: number;
  similarMovieId: number;
  score: number;
  rank: number;
  signalBreakdown: string;
}

export async function upsertSimilarity(rows: SimilarityRow[]): Promise<void> {
  const now = new Date().toISOString();
  const bqRows = rows.map(r => ({
    movie_id:         r.movieId,
    similar_movie_id: r.similarMovieId,
    similarity_score: r.score,
    rank:             r.rank,
    signal_breakdown: r.signalBreakdown,
    computed_at:      now,
  }));

  for (const batch of chunk(bqRows, BATCH)) {
    await bq.query({
      query: `
        MERGE \`${DS}.${TABLE_NAMES.similarity}\` T
        USING UNNEST(@rows) S
          ON T.movie_id = S.movie_id AND T.similar_movie_id = S.similar_movie_id
        WHEN MATCHED THEN UPDATE SET
          similarity_score = S.similarity_score, rank = S.rank,
          signal_breakdown = S.signal_breakdown, computed_at = S.computed_at
        WHEN NOT MATCHED THEN INSERT ROW
      `,
      params: { rows: batch },
      parameterMode: 'NAMED',
    });
  }
  console.log(`Upserted ${rows.length} similarity rows to BigQuery`);
}
