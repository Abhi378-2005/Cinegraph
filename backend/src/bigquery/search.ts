import { bq } from './client';
import { rowToMovie } from './movies';
import type { Movie } from '../types';
import { log, timer } from '../logger';

const DS = `${process.env.GCP_PROJECT_ID ?? 'cinegraph'}.${process.env.GCP_DATASET_ID ?? 'cinegraph'}`;

export async function searchMoviesBQ(
  query: string,
  genre: string,
  limit = 20
): Promise<Movie[]> {
  const elapsed = timer();
  const [rows] = await bq.query({
    query: `
      SELECT movie_id, title, overview, poster_path, backdrop_path, release_year,
             genres, cast_names, director, keywords,
             vote_average, vote_count, popularity, runtime
      FROM \`${DS}.movies\`
      WHERE (@query = '' OR LOWER(title) LIKE CONCAT('%', @query, '%'))
        AND (@genre = '' OR EXISTS (
          SELECT 1 FROM UNNEST(genres) g WHERE LOWER(g) LIKE CONCAT('%', @genre, '%')
        ))
      LIMIT @limit
    `,
    params: { query, genre, limit },
    parameterMode: 'NAMED',
  });
  log.bq(`searchMoviesBQ(q="${query}", genre="${genre}") → ${rows.length} rows  (${elapsed()})`);
  return (rows as Record<string, unknown>[]).map(rowToMovie);
}

export async function getGenresBQ(): Promise<string[]> {
  const elapsed = timer();
  const [rows] = await bq.query({
    query: `
      SELECT DISTINCT g AS genre
      FROM \`${DS}.movies\`, UNNEST(genres) AS g
      ORDER BY g
    `,
    parameterMode: 'NAMED',
    params: {},
  });
  log.bq(`getGenresBQ() → ${rows.length} genres  (${elapsed()})`);
  return (rows as { genre: string }[]).map(r => r.genre);
}
