import { mergeSort } from './mergeSort';
import type { Recommendation } from '../types';

function makeRec(id: number, score: number): Recommendation {
  return {
    movie: {
      id, title: `Movie${id}`, overview: '', posterPath: '', releaseYear: 2020,
      genres: [], cast: [], director: '', keywords: [],
      voteAverage: score, voteCount: 0, popularity: 0, runtime: 90,
    },
    score, matchPercent: score * 20, reason: '', engine: 'content',
  };
}

test('sorts descending by score', () => {
  const { sorted } = mergeSort([makeRec(1, 3), makeRec(2, 5), makeRec(3, 1), makeRec(4, 4)]);
  expect(sorted.map(r => r.score)).toEqual([5, 4, 3, 1]);
});

test('returns steps array with at least one step', () => {
  const { steps } = mergeSort([makeRec(1, 2), makeRec(2, 1)]);
  expect(steps.length).toBeGreaterThan(0);
});

test('steps include split and merge types', () => {
  const { steps } = mergeSort([makeRec(1, 3), makeRec(2, 1), makeRec(3, 2)]);
  const types = new Set(steps.map(s => s.type));
  expect(types.has('split')).toBe(true);
  expect(types.has('merge')).toBe(true);
});

test('empty array returns empty sorted and empty steps', () => {
  const { sorted, steps } = mergeSort([]);
  expect(sorted).toEqual([]);
  expect(steps).toEqual([]);
});

test('single element returns that element unchanged', () => {
  const rec = makeRec(1, 4.5);
  const { sorted } = mergeSort([rec]);
  expect(sorted).toHaveLength(1);
  expect(sorted[0].score).toBe(4.5);
});

test('already sorted input produces correct output', () => {
  const { sorted } = mergeSort([makeRec(1, 5), makeRec(2, 4), makeRec(3, 3)]);
  expect(sorted.map(r => r.score)).toEqual([5, 4, 3]);
});
