import type { TableField } from '@google-cloud/bigquery';

export const MOVIES_SCHEMA: TableField[] = [
  { name: 'movie_id',           type: 'INTEGER',   mode: 'REQUIRED' },
  { name: 'title',              type: 'STRING',    mode: 'REQUIRED' },
  { name: 'original_title',     type: 'STRING',    mode: 'NULLABLE' },
  { name: 'overview',           type: 'STRING',    mode: 'NULLABLE' },
  { name: 'poster_path',        type: 'STRING',    mode: 'NULLABLE' },
  { name: 'backdrop_path',      type: 'STRING',    mode: 'NULLABLE' },
  { name: 'release_year',       type: 'INTEGER',   mode: 'NULLABLE' },
  { name: 'original_language',  type: 'STRING',    mode: 'NULLABLE' },
  { name: 'popularity',         type: 'FLOAT64',   mode: 'NULLABLE' },
  { name: 'vote_average',       type: 'FLOAT64',   mode: 'NULLABLE' },
  { name: 'vote_count',         type: 'INTEGER',   mode: 'NULLABLE' },
  { name: 'runtime',            type: 'INTEGER',   mode: 'NULLABLE' },
  { name: 'genres',             type: 'STRING',    mode: 'REPEATED' },
  { name: 'cast_names',         type: 'STRING',    mode: 'REPEATED' },
  { name: 'director',           type: 'STRING',    mode: 'NULLABLE' },
  { name: 'keywords',           type: 'STRING',    mode: 'REPEATED' },
  { name: 'updated_at',         type: 'TIMESTAMP', mode: 'REQUIRED' },
];

export const MOVIE_FEATURES_SCHEMA: TableField[] = [
  { name: 'movie_id',         type: 'INTEGER',  mode: 'REQUIRED' },
  { name: 'feature_vector',   type: 'FLOAT64',  mode: 'REPEATED' },
  { name: 'feature_version',  type: 'INTEGER',  mode: 'REQUIRED' },
  { name: 'updated_at',       type: 'TIMESTAMP',mode: 'REQUIRED' },
];

export const MOVIE_SIMILARITY_SCHEMA: TableField[] = [
  { name: 'movie_id',          type: 'INTEGER',  mode: 'REQUIRED' },
  { name: 'similar_movie_id',  type: 'INTEGER',  mode: 'REQUIRED' },
  { name: 'similarity_score',  type: 'FLOAT64',  mode: 'REQUIRED' },
  { name: 'rank',              type: 'INTEGER',  mode: 'REQUIRED' },
  { name: 'signal_breakdown',  type: 'STRING',   mode: 'NULLABLE' },
  { name: 'computed_at',       type: 'TIMESTAMP',mode: 'REQUIRED' },
];

export const USER_RATINGS_SCHEMA: TableField[] = [
  { name: 'session_token', type: 'STRING',    mode: 'REQUIRED' },
  { name: 'movie_id',      type: 'INTEGER',   mode: 'REQUIRED' },
  { name: 'rating',        type: 'FLOAT64',   mode: 'REQUIRED' },
  { name: 'rated_at',      type: 'TIMESTAMP', mode: 'REQUIRED' },
];

export const TABLE_NAMES = {
  movies:     'movies',
  features:   'movie_features',
  similarity: 'movie_similarity',
  ratings:    'user_ratings',
} as const;
