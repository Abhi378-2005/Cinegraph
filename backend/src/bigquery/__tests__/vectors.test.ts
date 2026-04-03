const mockQuery = jest.fn();
jest.mock('../client', () => ({
  bq: { query: mockQuery },
}));

import { getBQVector, getBQVectorBatch, getAllBQVectors } from '../vectors';

const VECTOR = [1, 0, 1, 0.5, 0.8];

describe('getBQVector', () => {
  it('returns a number[] when row exists', async () => {
    mockQuery.mockResolvedValue([[{ movie_id: 1, feature_vector: VECTOR }]]);
    const v = await getBQVector(1);
    expect(v).toEqual(VECTOR);
  });

  it('returns null when no row found', async () => {
    mockQuery.mockResolvedValue([[]]);
    expect(await getBQVector(999)).toBeNull();
  });
});

describe('getBQVectorBatch', () => {
  it('returns a map of movie_id → vector', async () => {
    mockQuery.mockResolvedValue([[{ movie_id: 1, feature_vector: VECTOR }]]);
    const map = await getBQVectorBatch([1]);
    expect(map.get(1)).toEqual(VECTOR);
    expect(map.get(2)).toBeUndefined();
  });
});

describe('getAllBQVectors', () => {
  it('returns a map of all movie_id → vector entries', async () => {
    mockQuery.mockResolvedValue([[
      { movie_id: 1, feature_vector: VECTOR },
      { movie_id: 2, feature_vector: [0, 1, 0] },
    ]]);
    const map = await getAllBQVectors();
    expect(map.size).toBe(2);
    expect(map.get(1)).toEqual(VECTOR);
    expect(map.get(2)).toEqual([0, 1, 0]);
  });
});
