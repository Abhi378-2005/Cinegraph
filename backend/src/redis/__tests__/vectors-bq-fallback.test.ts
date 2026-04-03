const mockGet = jest.fn();
const mockSet = jest.fn();

jest.mock('../client', () => ({
  redis: { get: mockGet, set: mockSet },
}));

const mockGetBQVector = jest.fn();
jest.mock('../../bigquery/vectors', () => ({
  getBQVector: mockGetBQVector,
}));

import { getVector } from '../vectors';

const VECTOR = [1, 0, 0.5, 0.8];

describe('getVector with BigQuery fallback', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns cached Redis vector without calling BigQuery', async () => {
    mockGet.mockResolvedValue(JSON.stringify(VECTOR));
    const v = await getVector(1);
    expect(v).toEqual(VECTOR);
    expect(mockGetBQVector).not.toHaveBeenCalled();
  });

  it('falls back to BigQuery on Redis miss and populates Redis', async () => {
    mockGet.mockResolvedValue(null);
    mockGetBQVector.mockResolvedValue(VECTOR);
    mockSet.mockResolvedValue('OK');

    const v = await getVector(1);
    expect(v).toEqual(VECTOR);
    expect(mockGetBQVector).toHaveBeenCalledWith(1);
    expect(mockSet).toHaveBeenCalledWith(
      'movie:vector:1', JSON.stringify(VECTOR), { ex: 86400 }
    );
  });

  it('returns null when neither Redis nor BigQuery has the vector', async () => {
    mockGet.mockResolvedValue(null);
    mockGetBQVector.mockResolvedValue(null);
    expect(await getVector(1)).toBeNull();
  });
});
