import { dataset } from './client';
import { TABLE_NAMES } from './schema';
import type { Movie } from '../types';

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
    try {
      await table.insert(
        batch.map(row => ({ insertId: String(row.movie_id), json: row })),
        { ignoreUnknownValues: true, skipInvalidRows: true, raw: true },
      );
    } catch (err: unknown) {
      // PartialFailureError: some rows rejected — log details, skip bad rows
      if (err && typeof err === 'object' && 'name' in err && (err as {name: string}).name === 'PartialFailureError') {
        const pfe = err as { errors?: Array<{ row: unknown; errors: Array<{ reason: string; message: string }> }> };
        const rowErrors = pfe.errors ?? [];
        console.error(`PartialFailureError: ${rowErrors.length} row(s) rejected in batch`);
        for (const { row, errors } of rowErrors.slice(0, 5)) {
          const id = (row as Record<string, unknown>)?.movie_id;
          console.error(`  movie_id=${id}: ${errors.map(e => `${e.reason}: ${e.message}`).join('; ')}`);
        }
        if (rowErrors.length > 5) console.error(`  ... and ${rowErrors.length - 5} more`);
        // Continue — accepted rows were still inserted
        continue;
      }
      throw err;
    }
  }
  console.log(`Upserted ${rows.length} movies to BigQuery`);
}
