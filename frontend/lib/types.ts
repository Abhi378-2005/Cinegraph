// frontend/lib/types.ts

export interface Movie {
  id: number;
  title: string;
  overview: string;
  posterPath: string;
  backdropPath?: string;
  releaseYear: number;
  genres: string[];
  cast: string[];
  director: string;
  keywords: string[];
  voteAverage: number;
  voteCount: number;
  popularity: number;
  runtime: number;
  featureVector?: number[];
}

export interface User {
  id: string;
  preferredGenres: string[];
  ratings: Record<number, number>;
  phase: Phase;
  ratingCount: number;
}

export type Phase = 'cold' | 'warming' | 'full';

export interface Recommendation {
  movie: Movie;
  score: number;
  matchPercent: number;
  reason: string;
  engine: 'content' | 'collaborative' | 'hybrid' | 'cold_start';
  similarUsers?: string[];
  similarMovies?: number[];
}

export interface FloydStep {
  k: number; i: number; j: number;
  oldVal: number; newVal: number;
  updated: boolean;
  matrixSnapshot: number[][];
}

export interface DijkstraStep {
  visitedUserId: string;
  distance: number;
  frontier: string[];
  path: string[];
}

export interface MSTStep {
  algorithm: 'kruskal' | 'prim';
  type: 'add' | 'reject' | 'consider';
  edge: { u: string; v: string; weight: number };
  communities: string[][];
  totalCost: number;
}

export interface MergeSortStep {
  type: 'split' | 'merge' | 'compare' | 'place';
  array: Recommendation[];
  leftIndex: number;
  rightIndex: number;
}

export interface KnapsackStep {
  row: number;
  col: number;
  value: number;
  decision: 'include' | 'exclude';
  dpSnapshot: number[][];
}

export type AlgoStep = FloydStep | DijkstraStep | MSTStep | MergeSortStep | KnapsackStep;

export interface AlgoStepEvent { sessionId: string; algorithm: string; step: AlgoStep; }
export interface AlgoCompleteEvent { sessionId: string; algorithm: string; durationMs: number; totalSteps: number; }
export interface RecommendReadyEvent { sessionId: string; recommendations: Recommendation[]; engine: string; }
export interface CommunityUpdateEvent { communities: string[][]; mstEdges: { u: string; v: string }[]; }
