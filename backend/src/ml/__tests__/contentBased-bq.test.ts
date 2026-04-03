jest.mock('../../redis/ratings', () => ({
  getUserRatings:    jest.fn(),
  getPreferredGenres: jest.fn(),
}));
jest.mock('../../redis/movies', () => ({
  getMovie: jest.fn(),
  getPopularMovieIds: jest.fn(),
}));
jest.mock('../../redis/vectors', () => ({
  getVector: jest.fn(),
}));
jest.mock('../../bigquery/similarity', () => ({
  getTopSimilar: jest.fn(),
}));

import { getUserRatings } from '../../redis/ratings';
import { getMovie } from '../../redis/movies';
import { getVector } from '../../redis/vectors';
import { getTopSimilar } from '../../bigquery/similarity';
import { contentBasedRecommend } from '../contentBased';

const mockGetUserRatings  = getUserRatings as jest.Mock;
const mockGetMovie        = getMovie as jest.Mock;
const mockGetVector       = getVector as jest.Mock;
const mockGetTopSimilar   = getTopSimilar as jest.Mock;

const MOVIE = (id: number) => ({
  id, title: `Movie ${id}`, overview: '', posterPath: '',
  releaseYear: 2020, genres: ['Action'], cast: [], director: '',
  keywords: [], voteAverage: 7.5, voteCount: 1000, popularity: 50, runtime: 120,
});

const VECTOR = [1, 0, 0, 0.5];

describe('contentBasedRecommend', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns empty array when user has no ratings', async () => {
    mockGetUserRatings.mockResolvedValue({});
    expect(await contentBasedRecommend('user1')).toEqual([]);
  });

  it('returns recommendations using pre-computed similarity', async () => {
    mockGetUserRatings.mockResolvedValue({ 1: 4 });
    mockGetVector.mockResolvedValue(VECTOR);
    mockGetTopSimilar.mockResolvedValue([
      { movieId: 1, similarMovieId: 2, score: 0.9, rank: 1, signalBreakdown: 'genre:0.9' },
      { movieId: 1, similarMovieId: 3, score: 0.8, rank: 2, signalBreakdown: 'genre:0.8' },
    ]);
    mockGetMovie.mockImplementation((id: number) => Promise.resolve(MOVIE(id)));

    const recs = await contentBasedRecommend('user1', 10);
    expect(recs.length).toBeGreaterThan(0);
    expect(recs[0].engine).toBe('content');
    // Rated movie (id=1) must NOT appear in recommendations
    expect(recs.every(r => r.movie.id !== 1)).toBe(true);
    expect(mockGetTopSimilar).toHaveBeenCalledWith(1, 50);
  });
});
