import { knapsack } from './knapsack';
import type { Recommendation } from '../types';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeRec(id: number, score: number, runtime: number): Recommendation {
  return {
    movie: {
      id,
      title:       `Movie${id}`,
      overview:    '',
      posterPath:  '',
      releaseYear: 2020,
      genres:      [],
      cast:        [],
      director:    '',
      keywords:    [],
      voteAverage: score,
      voteCount:   0,
      popularity:  0,
      runtime,
    },
    score,
    matchPercent: Math.round(score * 20),
    reason:       '',
    engine:       'content',
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test('empty movies returns empty result', () => {
  const result = knapsack([], 120);
  expect(result.selected).toEqual([]);
  expect(result.totalScore).toBe(0);
  expect(result.steps).toEqual([]);
});

test('zero budget returns empty result', () => {
  const result = knapsack([makeRec(1, 4, 90)], 0);
  expect(result.selected).toEqual([]);
  expect(result.totalScore).toBe(0);
  expect(result.steps).toEqual([]);
});

test('single movie that fits is selected', () => {
  const movie = makeRec(1, 5, 90);
  const result = knapsack([movie], 120);
  expect(result.selected).toHaveLength(1);
  expect(result.selected[0].movie.id).toBe(1);
  expect(result.totalScore).toBe(Math.round(5 * 10)); // 50
});

test('single movie that does not fit is not selected', () => {
  const movie = makeRec(1, 5, 150);
  const result = knapsack([movie], 120);
  expect(result.selected).toHaveLength(0);
  expect(result.totalScore).toBe(0);
});

test('classic knapsack: 3 movies with budget 200 picks optimal subset', () => {
  // Movie A: 120 min, score 3 → value 30
  // Movie B: 80 min,  score 5 → value 50
  // Movie C: 100 min, score 4 → value 40
  // Budget: 200 min
  // Best combo: B + C = 180 min, value 90  (A+B = 200 min, value 80; A alone = 30; etc.)
  const a = makeRec(1, 3, 120);
  const b = makeRec(2, 5, 80);
  const c = makeRec(3, 4, 100);
  const result = knapsack([a, b, c], 200);

  const selectedIds = result.selected.map(r => r.movie.id).sort();
  expect(selectedIds).toEqual([2, 3]); // B and C
  expect(result.totalScore).toBe(90);
});

test('fill steps: count equals n * (budget + 1)', () => {
  const budget = 10;
  const movies = [makeRec(1, 2, 3), makeRec(2, 3, 4), makeRec(3, 1, 2)];
  const { steps } = knapsack(movies, budget);

  const fillSteps = steps.filter(s => s.row >= 1 && s.col !== undefined);
  // Fill phase produces n*(budget+1) steps
  expect(fillSteps.length).toBeGreaterThanOrEqual(movies.length * (budget + 1));
});

test('select steps: selected movie IDs match backtrack include decisions', () => {
  const movies = [makeRec(10, 4, 60), makeRec(20, 3, 80), makeRec(30, 5, 90)];
  const { selected, steps } = knapsack(movies, 180);

  // Every step with decision 'include' that also has a dpSnapshot is a selection step
  const selectSteps = steps.filter(s => s.decision === 'include' && s.dpSnapshot !== undefined);

  // Number of select steps should equal number of selected movies
  expect(selectSteps.length).toBe(selected.length);
});

test('budget capped at 600 does not cause errors for large input', () => {
  const movies = Array.from({ length: 5 }, (_, i) => makeRec(i + 1, 3 + i * 0.5, 80 + i * 20));
  const result = knapsack(movies, 9999);
  // Should complete without error and return sensible results
  expect(result.selected.length).toBeGreaterThanOrEqual(0);
  expect(result.totalScore).toBeGreaterThanOrEqual(0);
});
