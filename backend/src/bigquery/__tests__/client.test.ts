const mockExists = jest.fn();
const mockCreate = jest.fn();
const mockTable = jest.fn(() => ({ exists: mockExists, create: mockCreate }));
const mockDataset = jest.fn(() => ({ table: mockTable }));

jest.mock('@google-cloud/bigquery', () => ({
  BigQuery: jest.fn().mockImplementation(() => ({
    dataset: mockDataset,
  })),
}));

import { ensureTables } from '../client';
import { TABLE_NAMES } from '../schema';

describe('ensureTables', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a table when it does not exist', async () => {
    mockExists.mockResolvedValue([false]);
    mockCreate.mockResolvedValue([{}]);

    await ensureTables();

    expect(mockCreate).toHaveBeenCalledTimes(
      Object.keys(TABLE_NAMES).length
    );
  });

  it('skips creation when table already exists', async () => {
    mockExists.mockResolvedValue([true]);

    await ensureTables();

    expect(mockCreate).not.toHaveBeenCalled();
  });
});
