import type { Recommendation, MergeSortStep } from '../types';

function merge(
  left: Recommendation[],
  right: Recommendation[],
  steps: MergeSortStep[],
  leftOffset: number,
  rightOffset: number
): Recommendation[] {
  const result: Recommendation[] = [];
  let i = 0, j = 0;

  while (i < left.length && j < right.length) {
    steps.push({
      type: 'compare',
      array: [...left, ...right],
      leftIndex: leftOffset + i,
      rightIndex: rightOffset + j,
    });
    if (left[i].score >= right[j].score) {
      steps.push({ type: 'place', array: [...left, ...right], leftIndex: leftOffset + i, rightIndex: rightOffset + j });
      result.push(left[i++]);
    } else {
      steps.push({ type: 'place', array: [...left, ...right], leftIndex: leftOffset + i, rightIndex: rightOffset + j });
      result.push(right[j++]);
    }
  }
  while (i < left.length) result.push(left[i++]);
  while (j < right.length) result.push(right[j++]);

  steps.push({ type: 'merge', array: result, leftIndex: leftOffset, rightIndex: leftOffset + result.length - 1 });
  return result;
}

function mergeSortHelper(
  arr: Recommendation[],
  steps: MergeSortStep[],
  offset = 0
): Recommendation[] {
  if (arr.length <= 1) return arr;
  const mid = Math.floor(arr.length / 2);
  steps.push({ type: 'split', array: arr, leftIndex: offset, rightIndex: offset + arr.length - 1 });

  const left  = mergeSortHelper(arr.slice(0, mid), steps, offset);
  const right = mergeSortHelper(arr.slice(mid), steps, offset + mid);
  return merge(left, right, steps, offset, offset + mid);
}

export function mergeSort(
  items: Recommendation[]
): { sorted: Recommendation[]; steps: MergeSortStep[] } {
  const steps: MergeSortStep[] = [];
  const sorted = mergeSortHelper([...items], steps);
  return { sorted, steps };
}
