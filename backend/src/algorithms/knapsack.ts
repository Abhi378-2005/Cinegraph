import type { Recommendation, KnapsackStep } from '../types';

export interface KnapsackResult {
  selected: Recommendation[];
  totalScore: number;
  steps: KnapsackStep[];
}

/**
 * 0/1 Knapsack — selects movies that maximise total score within a time budget.
 *
 * Weight = movie.runtime (minutes), defaulting to 90 when missing.
 * Value  = Math.round(recommendation.score * 10)  — integer so dp stays exact.
 * Budget is capped at 600 minutes to keep the dp table manageable.
 */
export function knapsack(
  movies: Recommendation[],
  budgetMinutes: number
): KnapsackResult {
  // Edge-case guards
  if (budgetMinutes <= 0 || movies.length === 0) {
    return { selected: [], totalScore: 0, steps: [] };
  }

  const budget = Math.min(budgetMinutes, 600);
  const n = movies.length;
  const steps: KnapsackStep[] = [];

  // Pre-compute integer weights and values
  const weights: number[] = movies.map(rec => Math.max(1, rec.movie.runtime ?? 90));
  const values: number[]  = movies.map(rec => Math.round(rec.score * 10));

  // Allocate dp table: dp[i][w] = max value using first i items within w minutes
  // Initialise row 0 (no items) to all zeros
  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    new Array<number>(budget + 1).fill(0)
  );

  // Fill DP table
  for (let i = 1; i <= n; i++) {
    const w_i = weights[i - 1];
    const v_i = values[i - 1];

    for (let w = 0; w <= budget; w++) {
      // Can we include item i?
      if (w_i <= w) {
        const withItem    = dp[i - 1][w - w_i] + v_i;
        const withoutItem = dp[i - 1][w];
        dp[i][w] = Math.max(withItem, withoutItem);
      } else {
        // Item is too heavy — must exclude
        dp[i][w] = dp[i - 1][w];
      }

      steps.push({
        row:      i,
        col:      w,
        value:    dp[i][w],
        decision: dp[i][w] !== dp[i - 1][w] ? 'include' : 'exclude',
        // dpSnapshot omitted on fill steps (too large)
      });
    }
  }

  // Backtrack to identify which movies were selected
  const selected: Recommendation[] = [];
  let w = budget;

  for (let i = n; i >= 1; i--) {
    // Record a backtrack step for every cell visited
    steps.push({
      row:      i,
      col:      w,
      value:    dp[i][w],
      decision: 'exclude', // tentative — overwritten below if movie is chosen
    });

    if (dp[i][w] !== dp[i - 1][w]) {
      // This movie was selected — overwrite the last step with 'include' + snapshot
      const snapshot: number[][] = dp.map(row => [...row]);
      steps[steps.length - 1] = {
        row:         i,
        col:         w,
        value:       dp[i][w],
        decision:    'include',
        dpSnapshot:  snapshot,
      };
      selected.unshift(movies[i - 1]);
      w -= weights[i - 1];
    }
  }

  return {
    selected,
    totalScore: dp[n][budget],
    steps,
  };
}
