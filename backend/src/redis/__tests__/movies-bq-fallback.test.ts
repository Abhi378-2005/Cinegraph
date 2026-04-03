// backend/src/redis/__tests__/movies-bq-fallback.test.ts
const mockHgetall  = jest.fn();
const mockHset     = jest.fn();
const mockSadd     = jest.fn();
const mockZrange   = jest.fn();
const mockSet      = jest.fn();

jest.mock('../client', () => ({
  redis: {
    hgetall: mockHgetall,
    hset: mockHset,
    sadd: mockSadd,
    zrange: mockZrange,
    set: mockSet,
  },
}));

const mockGetBQMovie  = jest.fn();
const mockGetBQPopular = jest.fn();
jest.mock('../../bigquery/movies', () => ({
  getBQMovie:   mockGetBQMovie,
  getBQPopular: mockGetBQPopular,
}));

import { getMovie, getPopularMovieIds } from '../movies';

const MOVIE = {
  id: 1, title: 'Dune', overview: 'Epic', posterPath: '/d.jpg',
  releaseYear: 2021, genres: ['Sci-Fi'], cast: [], director: 'Denis',
  keywords: [], voteAverage: 7.8, voteCount: 15000, popularity: 88, runtime: 155,
};

describe('getMovie with BigQuery fallback', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns cached Redis value without calling BigQuery', async () => {
    mockHgetall.mockResolvedValue({
      title: 'Dune', overview: 'Epic', posterPath: '/d.jpg', backdropPath: '',
      releaseYear: '2021', genres: '["Sci-Fi"]', cast: '[]', director: 'Denis',
      keywords: '[]', voteAverage: '7.8', voteCount: '15000',
      popularity: '88', runtime: '155',
    });
    const result = await getMovie(1);
    expect(result?.title).toBe('Dune');
    expect(mockGetBQMovie).not.toHaveBeenCalled();
  });

  it('falls back to BigQuery on Redis miss and populates Redis', async () => {
    mockHgetall.mockResolvedValue(null);
    mockGetBQMovie.mockResolvedValue(MOVIE);
    mockHset.mockResolvedValue(1);
    mockSadd.mockResolvedValue(1);

    const result = await getMovie(1);
    expect(result?.title).toBe('Dune');
    expect(mockGetBQMovie).toHaveBeenCalledWith(1);
    expect(mockHset).toHaveBeenCalled(); // Redis was populated
  });

  it('returns null when neither Redis nor BigQuery has the movie', async () => {
    mockHgetall.mockResolvedValue(null);
    mockGetBQMovie.mockResolvedValue(null);
    expect(await getMovie(1)).toBeNull();
  });
});
