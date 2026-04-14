import type { Movie } from '../types';

export const GENRE_MAP: Record<number, string> = {
  28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy',
  80: 'Crime', 99: 'Documentary', 18: 'Drama', 10751: 'Family',
  14: 'Fantasy', 36: 'History', 27: 'Horror', 10402: 'Music',
  9648: 'Mystery', 10749: 'Romance', 878: 'Science Fiction',
  10770: 'TV Movie', 53: 'Thriller', 10752: 'War', 37: 'Western',
};

interface TMDBRaw {
  id: number; title: string; overview: string;
  poster_path: string | null; backdrop_path: string | null;
  release_date: string; genre_ids?: number[];
  genres?: { id: number; name: string }[];
  vote_average: number; vote_count: number;
  popularity: number; runtime?: number | null;
}
interface TMDBCredits {
  cast: { name: string; order: number }[];
  crew: { name: string; job: string }[];
}
interface TMDBKeywords { keywords: { name: string }[]; }

export function preprocessMovie(
  raw: TMDBRaw,
  credits?: TMDBCredits,
  keywords?: TMDBKeywords
): Movie {
  const genreIds = raw.genre_ids ?? raw.genres?.map(g => g.id) ?? [];
  const genres = genreIds.map(id => GENRE_MAP[id]).filter(Boolean);
  const cast = credits
    ? credits.cast.sort((a, b) => a.order - b.order).slice(0, 5).map(c => c.name)
    : [];
  const director = credits?.crew.find(c => c.job === 'Director')?.name ?? '';
  const kws = keywords?.keywords.slice(0, 20).map(k => k.name) ?? [];

  return {
    id: raw.id, title: raw.title, overview: raw.overview ?? '',
    posterPath: raw.poster_path ?? '',
    backdropPath: raw.backdrop_path ?? undefined,
    releaseYear: raw.release_date ? Number(raw.release_date.slice(0, 4)) : 0,
    genres, cast, director, keywords: kws,
    voteAverage: raw.vote_average, voteCount: raw.vote_count,
    popularity: raw.popularity, runtime: raw.runtime ?? 0,
  };
}
