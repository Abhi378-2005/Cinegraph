import { dataset, bq } from './client';
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
    movie_id:     m.id,
    title:        m.title,
    overview:     m.overview,
    poster_path:  m.posterPath,
    backdrop_path: m.backdropPath ?? '',
    release_year: m.releaseYear,
    popularity:   m.popularity,
    vote_average: m.voteAverage,
    vote_count:   m.voteCount,
    runtime:      m.runtime,
    genres:       m.genres,
    cast_names:   m.cast,
    director:     m.director,
    keywords:     m.keywords,
    updated_at:   now,
  }));

  const table = dataset.table(TABLE_NAMES.movies);
  for (const batch of chunk(rows, BATCH)) {
    // DELETE existing rows for this batch first, then INSERT — true upsert idempotency.
    // Streaming insert insertId only dedupes within a short window; DELETE+INSERT is
    // correct for re-runs hours/days later.
    const ids = batch.map(r => r.movie_id).join(',');
    await bq.query({ query: `DELETE FROM \`${DS}.${TABLE_NAMES.movies}\` WHERE movie_id IN (${ids})` });

    try {
      await table.insert(
        batch.map(row => ({ json: row })),
        { ignoreUnknownValues: true, skipInvalidRows: false },
      );
    } catch (err: unknown) {
      // PartialFailureError: some rows rejected — log details and re-throw so the
      // caller knows bad rows were NOT inserted (skipInvalidRows is false).
      if (err && typeof err === 'object' && 'name' in err && (err as {name: string}).name === 'PartialFailureError') {
        const pfe = err as { errors?: Array<{ row: unknown; errors: Array<{ reason: string; message: string }> }> };
        const rowErrors = pfe.errors ?? [];
        console.error(`PartialFailureError: ${rowErrors.length} row(s) rejected in batch`);
        for (const { row, errors } of rowErrors.slice(0, 5)) {
          const id = (row as Record<string, unknown>)?.movie_id;
          console.error(`  movie_id=${id}: ${errors.map(e => `${e.reason}: ${e.message}`).join('; ')}`);
        }
        if (rowErrors.length > 5) console.error(`  ... and ${rowErrors.length - 5} more`);
        throw err;
      }
      throw err;
    }
  }
  console.log(`Upserted ${rows.length} movies to BigQuery`);
}
