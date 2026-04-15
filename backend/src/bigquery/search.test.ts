import { searchMoviesBQ, getGenresBQ } from './search';

const mockQuery = jest.fn();
jest.mock('./client', () => ({
  bq: { query: (...args: unknown[]) => mockQuery(...args) },
}));

const FAKE_ROW = {
  movie_id: 1,
  title: 'Batman Begins',
  overview: 'Bruce Wayne becomes Batman.',
  poster_path: '/batman.jpg',
  backdrop_path: '/batman_bd.jpg',
  release_year: 2005,
  genres: ['Action', 'Drama'],
  cast_names: ['Christian Bale'],
  director: 'Christopher Nolan',
  keywords: ['superhero'],
  vote_average: 8.2,
  vote_count: 15000,
  popularity: 45.3,
  runtime: 140,
};

describe('searchMoviesBQ', () => {
  beforeEach(() => mockQuery.mockReset());

  it('returns mapped Movie objects on match', async () => {
    mockQuery.mockResolvedValue([[FAKE_ROW]]);
    const results = await searchMoviesBQ('batman', '', 20);
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(1);
    expect(results[0].title).toBe('Batman Begins');
    expect(results[0].genres).toEqual(['Action', 'Drama']);
    expect(results[0].cast).toEqual(['Christian Bale']);
  });

  it('returns empty array when BQ returns no rows', async () => {
    mockQuery.mockResolvedValue([[]]);
    const results = await searchMoviesBQ('xyz', '', 20);
    expect(results).toHaveLength(0);
  });

  it('passes normalized query and genre params', async () => {
    mockQuery.mockResolvedValue([[FAKE_ROW]]);
    await searchMoviesBQ('batman', 'action', 20);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        params: expect.objectContaining({ query: 'batman', genre: 'action', limit: 20 }),
      })
    );
  });
});

describe('getGenresBQ', () => {
  beforeEach(() => mockQuery.mockReset());

  it('returns genre strings from rows', async () => {
    mockQuery.mockResolvedValue([[{ genre: 'Action' }, { genre: 'Comedy' }]]);
    const genres = await getGenresBQ();
    expect(genres).toEqual(['Action', 'Comedy']);
  });

  it('returns empty array when no genres found', async () => {
    mockQuery.mockResolvedValue([[]]);
    const genres = await getGenresBQ();
    expect(genres).toEqual([]);
  });
});
