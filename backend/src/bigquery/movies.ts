import { bq } from './client';
import type { Movie } from '../types';
import { log, timer } from '../logger';

const DS = `${process.env.GCP_PROJECT_ID ?? 'cinegraph'}.${process.env.GCP_DATASET_ID ?? 'cinegraph'}`;

function rowToMovie(row: Record<string, unknown>): Movie {
  return {
    id:          Number(row.movie_id),
    title:       String(row.title),
    overview:    String(row.overview ?? ''),
    posterPath:  String(row.poster_path ?? ''),
    backdropPath: row.backdrop_path ? String(row.backdrop_path) : undefined,
    releaseYear: Number(row.release_year ?? 0),
    genres:      (row.genres as string[]) ?? [],
    cast:        (row.cast_names as string[]) ?? [],
    director:    String(row.director ?? ''),
    keywords:    (row.keywords as string[]) ?? [],
    voteAverage: Number(row.vote_average ?? 0),
    voteCount:   Number(row.vote_count ?? 0),
    popularity:  Number(row.popularity ?? 0),
    runtime:     Number(row.runtime ?? 0),
  };
}

export async function getBQMovie(id: number): Promise<Movie | null> {
  const elapsed = timer();
  const [rows] = await bq.query({
    query: `SELECT * FROM \`${DS}.movies\` WHERE movie_id = @id LIMIT 1`,
    params: { id },
    parameterMode: 'NAMED',
  });
  log.bq(`getBQMovie(${id}) → ${rows.length} row(s)  (${elapsed()})`);
  return rows.length > 0 ? rowToMovie(rows[0] as Record<string, unknown>) : null;
}

export async function getBQMovieBatch(ids: number[]): Promise<Map<number, Movie>> {
  if (ids.length === 0) return new Map();
  const elapsed = timer();
  const [rows] = await bq.query({
    query: `SELECT * FROM \`${DS}.movies\` WHERE movie_id IN UNNEST(@ids)`,
    params: { ids },
    parameterMode: 'NAMED',
  });
  const map = new Map<number, Movie>();
  for (const row of rows as Record<string, unknown>[]) {
    const m = rowToMovie(row);
    map.set(m.id, m);
  }
  log.bq(`getBQMovieBatch(${ids.length} ids) → ${map.size} found  (${elapsed()})`);
  return map;
}

export async function getBQPopular(genre: string, limit = 50): Promise<Movie[]> {
  const hasGenre = genre.trim().length > 0;
  const elapsed = timer();
  const [rows] = await bq.query({
    query: `
      SELECT *,
        (vote_average * 0.7) + (popularity / 1000.0 * 0.3) AS score
      FROM \`${DS}.movies\`
      WHERE (${hasGenre ? '@genre IN UNNEST(genres)' : 'TRUE'}) AND vote_count > 100
      ORDER BY score DESC
      LIMIT @limit
    `,
    params: hasGenre ? { genre, limit } : { limit },
    parameterMode: 'NAMED',
  });
  log.bq(`getBQPopular(genre="${genre || 'all'}", limit=${limit}) → ${rows.length} movies  (${elapsed()})`);
  return (rows as Record<string, unknown>[]).map(rowToMovie);
}
