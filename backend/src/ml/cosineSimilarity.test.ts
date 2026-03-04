import { cosineSimilarity } from './cosineSimilarity';

test('identical vectors return 1', () => {
  expect(cosineSimilarity([1, 0, 1], [1, 0, 1])).toBeCloseTo(1);
});
test('orthogonal vectors return 0', () => {
  expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
});
test('zero vector returns 0', () => {
  expect(cosineSimilarity([0, 0], [1, 1])).toBe(0);
});
test('partial similarity', () => {
  const sim = cosineSimilarity([1, 1, 0], [1, 0, 0]);
  expect(sim).toBeGreaterThan(0);
  expect(sim).toBeLessThan(1);
});
