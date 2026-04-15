import { searchMovies, getGenres } from './movies';

const mockRedisGet = jest.fn();
const mockRedisSet = jest.fn();
jest.mock('./client', () => ({
  redis: {
    get: (...args: unknown[]) => mockRedisGet(...args),
    set: (...args: unknown[]) => mockRedisSet(...args),
    hgetall: jest.fn(),
    sadd: jest.fn(),
    hset: jest.fn(),
    smembers: jest.fn(),
    zrange: jest.fn(),
    zadd: jest.fn(),
  },
}));

const mockSearchMoviesBQ = jest.fn();
const mockGetGenresBQ = jest.fn();
jest.mock('../bigquery/search', () => ({
  searchMoviesBQ: (...args: unknown[]) => mockSearchMoviesBQ(...args),
  getGenresBQ: (...args: unknown[]) => mockGetGenresBQ(...args),
}));

// Prevent transitive Redis client init errors
jest.mock('../bigquery/movies', () => ({
  getBQMovie: jest.fn(),
  getBQPopular: jest.fn(),
  rowToMovie: jest.fn(),
}));

const FAKE_MOVIES = [
  {
    id: 1, title: 'Batman Begins', overview: '', posterPath: '/x.jpg',
    backdropPath: undefined, releaseYear: 2005, genres: ['Action'],
    cast: ['Christian Bale'], director: 'Nolan', keywords: [],
    voteAverage: 8.2, voteCount: 15000, popularity: 45, runtime: 140,
  },
];

describe('searchMovies', () => {
  beforeEach(() => {
    mockRedisGet.mockReset();
    mockRedisSet.mockReset();
    mockSearchMoviesBQ.mockReset();
  });

  it('returns cached results on Redis HIT', async () => {
    mockRedisGet.mockResolvedValue(FAKE_MOVIES);
    const results = await searchMovies('batman', '', 20);
    expect(results).toEqual(FAKE_MOVIES);
    expect(mockSearchMoviesBQ).not.toHaveBeenCalled();
  });

  it('calls BigQuery and caches result on Redis MISS', async () => {
    mockRedisGet.mockResolvedValue(null);
    mockSearchMoviesBQ.mockResolvedValue(FAKE_MOVIES);
    const results = await searchMovies('batman', '', 20);
    expect(results).toEqual(FAKE_MOVIES);
    expect(mockSearchMoviesBQ).toHaveBeenCalledWith('batman', '', 20);
    expect(mockRedisSet).toHaveBeenCalledWith('search:batman:', FAKE_MOVIES, { ex: 3600 });
  });

  it('normalizes query and genre to lowercase before cache key', async () => {
    mockRedisGet.mockResolvedValue(null);
    mockSearchMoviesBQ.mockResolvedValue([]);
    await searchMovies('BATMAN', 'ACTION', 20);
    expect(mockRedisGet).toHaveBeenCalledWith('search:batman:action');
  });

  it('falls through to BigQuery when Redis.get throws', async () => {
    mockRedisGet.mockRejectedValue(new Error('Redis down'));
    mockSearchMoviesBQ.mockResolvedValue(FAKE_MOVIES);
    const results = await searchMovies('batman', '', 20);
    expect(results).toEqual(FAKE_MOVIES);
  });
});

describe('getGenres', () => {
  beforeEach(() => {
    mockRedisGet.mockReset();
    mockRedisSet.mockReset();
    mockGetGenresBQ.mockReset();
  });

  it('returns cached genres on Redis HIT', async () => {
    mockRedisGet.mockResolvedValue(['Action', 'Comedy', 'Drama']);
    const genres = await getGenres();
    expect(genres).toEqual(['Action', 'Comedy', 'Drama']);
    expect(mockGetGenresBQ).not.toHaveBeenCalled();
  });

  it('fetches from BigQuery and caches with 24h TTL on Redis MISS', async () => {
    mockRedisGet.mockResolvedValue(null);
    mockGetGenresBQ.mockResolvedValue(['Action', 'Comedy']);
    const genres = await getGenres();
    expect(genres).toEqual(['Action', 'Comedy']);
    expect(mockRedisSet).toHaveBeenCalledWith('movies:genres', ['Action', 'Comedy'], { ex: 86400 });
  });
});
