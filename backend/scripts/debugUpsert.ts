import 'dotenv/config';
import { dataset } from '../src/bigquery/client';
import { TABLE_NAMES } from '../src/bigquery/schema';
import { loadEnrichedMovies } from './migration/enrichMovies';

async function main(): Promise<void> {
  const movies = loadEnrichedMovies();
  if (movies.length === 0) { console.error('No enriched movies found'); process.exit(1); }

  const m = movies[0];
  const now = new Date().toISOString();

  const row = {
    movie_id:      m.id,
    title:         m.title,
    overview:      m.overview,
    poster_path:   m.posterPath,
    backdrop_path: m.backdropPath ?? '',
    release_year:  m.releaseYear,
    popularity:    m.popularity,
    vote_average:  m.voteAverage,
    vote_count:    m.voteCount,
    runtime:       m.runtime,
    genres:        m.genres,
    cast_names:    m.cast,
    director:      m.director,
    keywords:      m.keywords,
    updated_at:    now,
  };

  console.log('=== Row being inserted ===');
  console.log(JSON.stringify(row, null, 2));
  console.log('');
  console.log('Field types:');
  for (const [k, v] of Object.entries(row)) {
    console.log(`  ${k}: ${Array.isArray(v) ? `Array(${(v as unknown[]).length})` : typeof v} = ${JSON.stringify(v)?.slice(0, 60)}`);
  }

  console.log('\n=== Attempting insert ===');
  try {
    const table = dataset.table(TABLE_NAMES.movies);
    await table.insert([{ insertId: String(row.movie_id), json: row }], { ignoreUnknownValues: true, raw: true });
    console.log('SUCCESS — row inserted');
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'name' in err && (err as {name: string}).name === 'PartialFailureError') {
      const pfe = err as { errors?: Array<{ row: unknown; errors: Array<{ reason: string; message: string; location: string }> }> };
      console.error('PARTIAL FAILURE — row errors:');
      for (const { errors } of (pfe.errors ?? [])) {
        for (const e of errors) {
          console.error(`  reason: ${e.reason}`);
          console.error(`  location: ${e.location}`);
          console.error(`  message: ${e.message}`);
        }
      }
    } else {
      console.error('ERROR:', err);
    }
  }
}

main();
