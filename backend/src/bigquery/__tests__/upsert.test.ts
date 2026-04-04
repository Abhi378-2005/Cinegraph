const mockInsert = jest.fn();
const mockTable  = jest.fn(() => ({ insert: mockInsert }));

jest.mock('../client', () => ({
  dataset: { table: mockTable },
}));

import { upsertMovies } from '../upsert';
import type { Movie } from '../../types';

const makeMovie = (id: number): Movie => ({
  id,
  title:        `Movie ${id}`,
  overview:     'overview',
  posterPath:   '/poster.jpg',
  backdropPath: '',
  releaseYear:  2020,
  popularity:   10,
  voteAverage:  7,
  voteCount:    100,
  runtime:      120,
  genres:       [],
  cast:         [],
  director:     'Director',
  keywords:     [],
});

describe('upsertMovies', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls table.insert for each batch', async () => {
    mockInsert.mockResolvedValue([]);
    await upsertMovies([makeMovie(1), makeMovie(2)]);

    expect(mockTable).toHaveBeenCalledWith('movies');
    expect(mockInsert).toHaveBeenCalledTimes(1);
    const rows = mockInsert.mock.calls[0][0];
    expect(rows).toHaveLength(2);
    expect(rows[0].insertId).toBe('1');
    expect(rows[0].json).toMatchObject({ movie_id: 1, title: 'Movie 1', genres: [] });
  });

  it('handles empty array fields without error', async () => {
    mockInsert.mockResolvedValue([]);
    await expect(upsertMovies([makeMovie(1)])).resolves.toBeUndefined();
  });

  it('maps Movie fields to BigQuery column names', async () => {
    mockInsert.mockResolvedValue([]);
    const movie = makeMovie(42);
    movie.cast = ['Actor A', 'Actor B'];
    movie.director = 'Jane Doe';
    movie.genres = ['Drama', 'Comedy'];

    await upsertMovies([movie]);
    const row = mockInsert.mock.calls[0][0][0];

    expect(row.insertId).toBe('42');
    expect(row.json.movie_id).toBe(42);
    expect(row.json.cast_names).toEqual(['Actor A', 'Actor B']);
    expect(row.json.director).toBe('Jane Doe');
    expect(row.json.genres).toEqual(['Drama', 'Comedy']);
    expect(row.json.poster_path).toBe('/poster.jpg');
  });
});
