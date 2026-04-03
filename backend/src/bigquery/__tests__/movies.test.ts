const mockQuery = jest.fn();
jest.mock('../client', () => ({
  bq: { query: mockQuery },
}));

import { getBQMovie, getBQMovieBatch, getBQPopular } from '../movies';
import type { Movie } from '../../types';

const BQ_ROW = {
  movie_id: 1,
  title: 'Dune',
  original_title: 'Dune',
  overview: 'Epic sci-fi',
  poster_path: '/dune.jpg',
  backdrop_path: '/bg.jpg',
  release_year: 2021,
  original_language: 'en',
  popularity: 88.5,
  vote_average: 7.8,
  vote_count: 15000,
  runtime: 155,
  genres: ['Science Fiction', 'Adventure'],
  cast_names: ['Timothée Chalamet'],
  director: 'Denis Villeneuve',
  keywords: ['desert', 'prophecy'],
  updated_at: { value: '2026-01-01T00:00:00Z' },
};

const EXPECTED_MOVIE: Movie = {
  id: 1,
  title: 'Dune',
  overview: 'Epic sci-fi',
  posterPath: '/dune.jpg',
  backdropPath: '/bg.jpg',
  releaseYear: 2021,
  genres: ['Science Fiction', 'Adventure'],
  cast: ['Timothée Chalamet'],
  director: 'Denis Villeneuve',
  keywords: ['desert', 'prophecy'],
  voteAverage: 7.8,
  voteCount: 15000,
  popularity: 88.5,
  runtime: 155,
};

describe('getBQMovie', () => {
  it('returns a Movie when row exists', async () => {
    mockQuery.mockResolvedValue([[BQ_ROW]]);
    const movie = await getBQMovie(1);
    expect(movie).toEqual(EXPECTED_MOVIE);
  });

  it('returns null when no row found', async () => {
    mockQuery.mockResolvedValue([[]]);
    expect(await getBQMovie(999)).toBeNull();
  });
});

describe('getBQMovieBatch', () => {
  it('returns a map of movie_id → Movie', async () => {
    mockQuery.mockResolvedValue([[BQ_ROW]]);
    const map = await getBQMovieBatch([1]);
    expect(map.get(1)).toEqual(EXPECTED_MOVIE);
  });

  it('returns empty map for empty ids without querying BQ', async () => {
    mockQuery.mockClear();
    const map = await getBQMovieBatch([]);
    expect(map.size).toBe(0);
    expect(mockQuery).not.toHaveBeenCalled();
  });
});

describe('getBQPopular', () => {
  it('returns movies sorted by weighted score', async () => {
    mockQuery.mockResolvedValue([[BQ_ROW]]);
    const movies = await getBQPopular('Science Fiction', 10);
    expect(movies).toHaveLength(1);
    expect(movies[0].id).toBe(1);
  });
});
