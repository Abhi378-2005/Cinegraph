import type { Movie } from '../types';

// Fixed genre order — 19 TMDB movie genres, one-hot encoded at indices 0-18
export const GENRE_ORDER = [
  'Action', 'Adventure', 'Animation', 'Comedy', 'Crime',
  'Documentary', 'Drama', 'Family', 'Fantasy', 'History',
  'Horror', 'Music', 'Mystery', 'Romance', 'Science Fiction',
  'TV Movie', 'Thriller', 'War', 'Western',
];

// djb2 hash → normalized 0-1 float
function hashToFloat(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) & 0x7fffffff;
  }
  return h / 0x7fffffff;
}

/**
 * Builds a 40-dimensional feature vector for a movie.
 * Dimensions:
 *   [0-18]  Genre one-hot (19 genres)
 *   [19-23] Top 5 cast hashed to 0-1
 *   [24]    Director hashed
 *   [25-34] Top 10 keywords TF-IDF weighted
 *   [35]    vote_average / 10
 *   [36]    log(popularity+1) normalized
 *   [37]    release decade (1970=0.1 … 2020=0.6)
 *   [38]    runtime / 240 (clamped)
 *   [39]    vote count tier
 */
export function buildFeatureVector(
  movie: Movie,
  idf: Map<string, number>,
  maxLogPop = 10
): number[] {
  const vec = new Array<number>(40).fill(0);

  // [0-18] Genre one-hot
  for (const genre of movie.genres) {
    const idx = GENRE_ORDER.indexOf(genre);
    if (idx !== -1) vec[idx] = 1;
  }

  // [19-23] Cast hash
  for (let i = 0; i < 5; i++) {
    vec[19 + i] = movie.cast[i] ? hashToFloat(movie.cast[i]) : 0;
  }

  // [24] Director hash
  vec[24] = movie.director ? hashToFloat(movie.director) : 0;

  // [25-34] Top 10 keywords TF-IDF
  const topKws = movie.keywords.slice(0, 10);
  for (let i = 0; i < 10; i++) {
    if (topKws[i]) {
      const idfVal = idf.get(topKws[i]) ?? 0;
      vec[25 + i] = idfVal / 10; // normalize IDF to ~0-1 range
    }
  }

  // [35] vote_average
  vec[35] = movie.voteAverage / 10;

  // [36] log-scaled popularity
  vec[36] = Math.log(movie.popularity + 1) / maxLogPop;

  // [37] release decade
  const decade = Math.floor((movie.releaseYear - 1970) / 10);
  vec[37] = Math.max(0, Math.min(1, decade * 0.1));

  // [38] runtime
  vec[38] = Math.min(1, movie.runtime / 240);

  // [39] vote count tier
  vec[39] = movie.voteCount < 100 ? 0.25
    : movie.voteCount < 1000 ? 0.5
    : movie.voteCount < 10000 ? 0.75
    : 1.0;

  return vec;
}
