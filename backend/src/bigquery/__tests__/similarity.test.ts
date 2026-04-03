const mockQuery = jest.fn();
jest.mock('../client', () => ({
  bq: { query: mockQuery },
}));

import { getTopSimilar } from '../similarity';

const ROWS = [
  { movie_id: 1, similar_movie_id: 10, similarity_score: 0.95, rank: 1, signal_breakdown: 'genre:0.8' },
  { movie_id: 1, similar_movie_id: 20, similarity_score: 0.87, rank: 2, signal_breakdown: 'genre:0.7' },
];

describe('getTopSimilar', () => {
  it('returns results ordered by rank', async () => {
    mockQuery.mockResolvedValue([ROWS]);
    const results = await getTopSimilar(1, 50);
    expect(results).toHaveLength(2);
    expect(results[0].similarMovieId).toBe(10);
    expect(results[1].similarMovieId).toBe(20);
    expect(results[0].score).toBeCloseTo(0.95);
  });

  it('returns empty array when no similarity rows found', async () => {
    mockQuery.mockResolvedValue([[]]);
    expect(await getTopSimilar(999, 50)).toEqual([]);
  });

  it('respects the limit parameter', async () => {
    mockQuery.mockResolvedValue([ROWS]);
    const results = await getTopSimilar(1, 1);
    // limit is passed to BQ query, so BQ returns at most 1 row
    expect(mockQuery).toHaveBeenCalledWith(
      expect.objectContaining({ params: expect.objectContaining({ limit: 1 }) })
    );
  });
});
