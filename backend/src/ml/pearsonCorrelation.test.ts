import { pearsonCorrelation } from './pearsonCorrelation';

test('perfect positive correlation', () => {
  const a = { 1: 1, 2: 2, 3: 3 };
  const b = { 1: 2, 2: 4, 3: 6 };
  expect(pearsonCorrelation(a, b)).toBeCloseTo(1);
});
test('perfect negative correlation', () => {
  const a = { 1: 5, 2: 4, 3: 1 };
  const b = { 1: 1, 2: 2, 3: 5 };
  expect(pearsonCorrelation(a, b)).toBeCloseTo(-1);
});
test('no co-rated movies returns 0', () => {
  expect(pearsonCorrelation({ 1: 5 }, { 2: 5 })).toBe(0);
});
test('fewer than 2 co-rated returns 0', () => {
  expect(pearsonCorrelation({ 1: 5 }, { 1: 3 })).toBe(0);
});
test('identical ratings return 0 (constant series has no variance)', () => {
  expect(pearsonCorrelation({ 1: 3, 2: 3 }, { 1: 4, 2: 4 })).toBe(0);
});
