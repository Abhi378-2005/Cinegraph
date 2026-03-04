import { tmdbClient } from './client';
import { preprocessMovie } from './preprocessor';
import type { Movie } from '../types';

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

export async function fetchPopularMovies(pages = 20): Promise<Movie[]> {
  const movies: Movie[] = [];
  for (let page = 1; page <= pages; page++) {
    const { data } = await tmdbClient.get('/movie/popular', { params: { page } });
    for (const raw of data.results) {
      await delay(260); // stay under 40 req/s free tier limit
      try {
        const [creditsRes, keywordsRes] = await Promise.all([
          tmdbClient.get(`/movie/${raw.id}/credits`),
          tmdbClient.get(`/movie/${raw.id}/keywords`),
        ]);
        movies.push(preprocessMovie(raw, creditsRes.data, keywordsRes.data));
      } catch {
        movies.push(preprocessMovie(raw));
      }
    }
    console.log(`Fetched page ${page}/${pages} — ${movies.length} movies total`);
  }
  return movies;
}

export async function fetchMovieById(id: number): Promise<Movie | null> {
  try {
    const [movie, credits, keywords] = await Promise.all([
      tmdbClient.get(`/movie/${id}`),
      tmdbClient.get(`/movie/${id}/credits`),
      tmdbClient.get(`/movie/${id}/keywords`),
    ]);
    return preprocessMovie(movie.data, credits.data, keywords.data);
  } catch { return null; }
}
