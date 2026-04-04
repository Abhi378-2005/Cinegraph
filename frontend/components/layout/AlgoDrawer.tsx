'use client';
// frontend/components/layout/AlgoDrawer.tsx

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { socketEvents } from '@/lib/socket';
import type {
  AlgoStepEvent,
  AlgoCompleteEvent,
  RecommendReadyEvent,
  MergeSortStep,
  KnapsackStep,
  Recommendation,
} from '@/lib/types';

// ─── Shared types ─────────────────────────────────────────────────────────────

type DrawerTab = 'mergesort' | 'knapsack' | 'overview';

interface ReplayItem {
  type: 'mergesort' | 'knapsack';
  step: MergeSortStep | KnapsackStep;
}

// ─── Speed controls (shared by both panels) ───────────────────────────────────

function SpeedControls({
  replaySpeedMs,
  onSpeedChange,
}: {
  replaySpeedMs: number;
  onSpeedChange: (ms: number) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => onSpeedChange(Math.min(300, replaySpeedMs + 60))}
        className="px-1.5 py-0.5 rounded text-xs"
        style={{ backgroundColor: 'var(--color-bg-card)', color: 'var(--color-text-muted)' }}
      >
        ◀ slower
      </button>
      <button
        onClick={() => onSpeedChange(Math.max(60, replaySpeedMs - 60))}
        className="px-1.5 py-0.5 rounded text-xs"
        style={{ backgroundColor: 'var(--color-bg-card)', color: 'var(--color-text-muted)' }}
      >
        faster ▶
      </button>
    </div>
  );
}

// ─── Poster helper ────────────────────────────────────────────────────────────

const POSTER_BASE = process.env.NEXT_PUBLIC_TMDB_IMAGE_BASE ?? '';

// ─── SortCard ────────────────────────────────────────────────────────────────

type CardState = 'normal' | 'compare' | 'merge';

function SortCard({
  rec,
  cardState,
}: {
  rec: Recommendation;
  cardState: CardState;
}) {
  return (
    <div
      className="flex flex-col items-center gap-1 flex-shrink-0"
      style={{ width: '44px' }}
    >
      <motion.div
        layout
        layoutId={`ms-card-${rec.movie.id}`}
        animate={{
          scale: cardState === 'compare' ? 1.1 : 1,
          boxShadow:
            cardState === 'compare'
              ? '0 0 10px rgba(124,58,237,0.8)'
              : cardState === 'merge'
              ? '0 0 8px rgba(74,222,128,0.6)'
              : 'none',
        }}
        transition={{ duration: 0.12 }}
        className="relative rounded overflow-hidden"
        style={{
          width: '44px',
          height: '64px',
          border:
            cardState === 'compare'
              ? '2px solid var(--color-brand)'
              : cardState === 'merge'
              ? '2px solid var(--color-match)'
              : '1px solid #333',
          backgroundColor: 'var(--color-bg-card)',
        }}
      >
        {rec.movie.posterPath && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`${POSTER_BASE}${rec.movie.posterPath}`}
            alt={rec.movie.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        )}
        {/* Score badge */}
        <div
          className="absolute top-0.5 right-0.5 rounded px-0.5"
          style={{
            background: 'rgba(0,0,0,0.85)',
            color: 'var(--color-knapsack)',
            fontSize: '8px',
            lineHeight: '14px',
          }}
        >
          {rec.score.toFixed(1)}
        </div>
      </motion.div>
      <span
        className="truncate text-center block"
        style={{
          fontSize: '9px',
          color: cardState === 'compare' ? 'var(--color-knapsack)' : '#555',
          width: '44px',
        }}
      >
        {rec.movie.title}
      </span>
    </div>
  );
}

// ─── MergeSort panel (placeholder — viz added in Task 8) ─────────────────────

interface MergeSortPanelProps {
  currentStep: MergeSortStep | null;
  replayIndex: number;
  totalSteps: number;
  replayDone: boolean;
  isReplaying: boolean;
  onReplay: () => void;
  replaySpeedMs: number;
  onSpeedChange: (ms: number) => void;
}

function MergeSortPanel({
  currentStep,
  replayIndex,
  totalSteps,
  replayDone,
  isReplaying,
  onReplay,
  replaySpeedMs,
  onSpeedChange,
}: MergeSortPanelProps) {
  if (!currentStep) {
    return (
      <div className="p-4">
        <p className="text-sm font-semibold mb-2" style={{ color: 'var(--color-brand)' }}>
          Merge Sort — Recommendation Ranking
        </p>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Sorts recommendations by predicted score (O(n log n)).
          Steps appear here when the engine runs.
        </p>
      </div>
    );
  }

  const items = currentStep.array;

  return (
    <div className="p-4 flex flex-col gap-3">
      <p className="text-sm font-semibold" style={{ color: 'var(--color-brand)' }}>
        Merge Sort — Recommendation Ranking
      </p>

      {/* Animated card row */}
      <div className="overflow-x-auto">
        <motion.div
          layout
          className="flex gap-2 pb-1"
          style={{ minWidth: 'max-content' }}
        >
          {items.map((rec, idx) => {
            const isCompare =
              currentStep.type === 'compare' &&
              (idx === currentStep.leftIndex || idx === currentStep.rightIndex);
            const isMerge =
              currentStep.type === 'merge' &&
              idx >= currentStep.leftIndex &&
              idx <= currentStep.rightIndex;
            return (
              <SortCard
                key={rec.movie.id}
                rec={rec}
                cardState={isCompare ? 'compare' : isMerge ? 'merge' : 'normal'}
              />
            );
          })}
        </motion.div>
      </div>

      {/* Step description */}
      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
        {currentStep.type === 'compare' &&
          `Comparing positions ${currentStep.leftIndex} and ${currentStep.rightIndex}`}
        {currentStep.type === 'place' &&
          `Placing item at position ${currentStep.leftIndex}`}
        {currentStep.type === 'split' &&
          `Splitting subarray [${currentStep.leftIndex}…${currentStep.rightIndex}]`}
        {currentStep.type === 'merge' &&
          `Merging into positions [${currentStep.leftIndex}…${currentStep.rightIndex}]`}
      </p>

      {/* Footer */}
      <div
        className="flex items-center gap-3 text-xs"
        style={{ color: 'var(--color-text-muted)' }}
      >
        <span className="tabular-nums">
          step {replayIndex} / {totalSteps}
        </span>
        <span
          style={{ color: replayDone ? 'var(--color-match)' : 'var(--color-brand)' }}
        >
          {replayDone ? 'Complete ✓' : isReplaying ? 'Sorting…' : ''}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {replayDone && (
            <button
              onClick={onReplay}
              className="px-2 py-0.5 rounded text-xs"
              style={{ backgroundColor: 'var(--color-brand)', color: 'white' }}
            >
              ▶ Replay
            </button>
          )}
          <SpeedControls
            replaySpeedMs={replaySpeedMs}
            onSpeedChange={onSpeedChange}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Knapsack panel (placeholder — viz added in Task 9) ──────────────────────

interface KnapsackPanelProps {
  currentStep: KnapsackStep | null;
  knapsackSteps: KnapsackStep[];
  recommendations: Recommendation[];
  knapsackReplayIndex: number;
  replayDone: boolean;
  isReplaying: boolean;
  onReplay: () => void;
  replaySpeedMs: number;
  onSpeedChange: (ms: number) => void;
}

function KnapsackPanel({
  currentStep,
  knapsackSteps,
  recommendations,
  knapsackReplayIndex,
  replayDone,
  isReplaying,
  onReplay,
  replaySpeedMs,
  onSpeedChange,
}: KnapsackPanelProps) {
  const n = recommendations.length;
  // Forward steps: indices 0..n-1 (one per movie, ascending row)
  const forwardSteps   = knapsackSteps.slice(0, n);
  // Backtrack steps: indices n..end (descending row, resolves selection)
  const backtrackSteps = knapsackSteps.slice(n);

  const isPhase2       = knapsackReplayIndex >= n;
  const backtrackShown = Math.max(0, knapsackReplayIndex - n);
  const resolvedCards  = backtrackSteps.slice(0, backtrackShown);

  const maxValue = Math.max(...forwardSteps.map(s => s.value), 1);

  if (!currentStep && knapsackSteps.length === 0) {
    return (
      <div className="p-4">
        <p className="text-sm font-semibold mb-2" style={{ color: 'var(--color-knapsack)' }}>
          0/1 Knapsack — Watch Budget Optimizer
        </p>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Selects movies maximizing score within your watch-time budget.
          Steps appear here when the engine runs.
        </p>
      </div>
    );
  }

  const includedCards = resolvedCards.filter(s => s.decision === 'include');
  const totalRuntime  = includedCards.reduce((acc, s) => {
    return acc + (recommendations[s.row - 1]?.movie.runtime ?? 90);
  }, 0);
  const latestValue   = currentStep?.value ?? 0;

  return (
    <div className="p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center gap-3">
        <p className="text-sm font-semibold" style={{ color: 'var(--color-knapsack)' }}>
          0/1 Knapsack — Watch Budget Optimizer
        </p>
        <span
          className="text-xs px-2 py-0.5 rounded"
          style={{
            backgroundColor: isPhase2
              ? 'rgba(74,222,128,0.15)'
              : 'rgba(167,139,250,0.15)',
            color: isPhase2 ? 'var(--color-match)' : 'var(--color-knapsack)',
          }}
        >
          {isPhase2 ? 'Phase 2: Selecting' : 'Phase 1: Evaluating'}
        </span>
      </div>

      <AnimatePresence mode="wait">
        {!isPhase2 ? (
          /* ── Phase 1: DP evaluation rows ── */
          <motion.div
            key="phase1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.6 } }}
            className="flex flex-col gap-1"
          >
            {forwardSteps.slice(0, knapsackReplayIndex + 1).map((step, i) => {
              const movie = recommendations[step.row - 1]?.movie;
              if (!movie) return null;
              const proportion = step.value / maxValue;
              const isActive   = i === knapsackReplayIndex;
              return (
                <motion.div
                  key={movie.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-2"
                >
                  <span
                    className="truncate flex-shrink-0 text-xs"
                    style={{
                      width: '84px',
                      color: isActive ? 'var(--color-knapsack)' : 'var(--color-text-secondary)',
                    }}
                  >
                    {movie.title}
                  </span>
                  <div
                    className="flex-1 h-3 rounded overflow-hidden"
                    style={{ backgroundColor: 'var(--viz-ks-bg)' }}
                  >
                    <motion.div
                      className="h-full rounded"
                      animate={{ width: `${proportion * 100}%` }}
                      transition={{ duration: 0.15 }}
                      style={{
                        backgroundColor: isActive
                          ? 'var(--color-knapsack)'
                          : step.decision === 'include'
                          ? 'var(--color-brand)'
                          : 'var(--viz-ks-low)',
                        boxShadow: isActive ? `0 0 6px var(--color-knapsack)` : 'none',
                      }}
                    />
                  </div>
                  <span
                    className="flex-shrink-0 text-center"
                    style={{
                      width: '14px',
                      fontSize: '10px',
                      color: step.decision === 'include' ? 'var(--color-match)' : '#444',
                    }}
                  >
                    {step.decision === 'include' ? '✓' : '·'}
                  </span>
                </motion.div>
              );
            })}
          </motion.div>
        ) : (
          /* ── Phase 2: Card selection ── */
          <motion.div
            key="phase2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col gap-3"
          >
            {/* Running total */}
            <p className="text-xs" style={{ color: 'var(--color-match)' }}>
              Selected {includedCards.length} movie
              {includedCards.length !== 1 ? 's' : ''} · {totalRuntime} min
              {latestValue > 0 ? ` · score ${latestValue}` : ''}
            </p>
            {/* Cards */}
            <div className="flex gap-3 flex-wrap">
              {resolvedCards.map((step, i) => {
                const rec = recommendations[step.row - 1];
                if (!rec) return null;
                const included = step.decision === 'include';
                return (
                  <motion.div
                    key={`ks-card-${rec.movie.id}-${i}`}
                    initial={{ x: -30, opacity: 0 }}
                    animate={{ x: 0, opacity: included ? 1 : 0.2 }}
                    transition={{ duration: 0.25 }}
                    className="flex flex-col items-center gap-1"
                    style={{ width: '44px' }}
                  >
                    <div
                      className="relative rounded overflow-hidden"
                      style={{
                        width: '44px',
                        height: '64px',
                        border: included ? `2px solid var(--color-match)` : '1px solid #333',
                        boxShadow: included
                          ? '0 0 8px rgba(74,222,128,0.5)'
                          : 'none',
                        backgroundColor: 'var(--color-bg-card)',
                      }}
                    >
                      {rec.movie.posterPath && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`${POSTER_BASE}${rec.movie.posterPath}`}
                          alt={rec.movie.title}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      )}
                    </div>
                    <span
                      style={{
                        fontSize: '9px',
                        color: included ? 'var(--color-match)' : 'var(--color-exclude)',
                      }}
                    >
                      {included ? '✓' : '✗'}
                    </span>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <div
        className="flex items-center gap-3 text-xs mt-auto"
        style={{ color: 'var(--color-text-muted)' }}
      >
        <span className="tabular-nums">
          {knapsackReplayIndex} / {knapsackSteps.length}
        </span>
        <span style={{ color: replayDone ? 'var(--color-match)' : 'var(--color-knapsack)' }}>
          {replayDone ? 'Complete ✓' : isReplaying ? 'Running…' : ''}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {replayDone && (
            <button
              onClick={onReplay}
              className="px-2 py-0.5 rounded text-xs"
              style={{ backgroundColor: 'var(--color-knapsack)', color: 'white' }}
            >
              ▶ Replay
            </button>
          )}
          <SpeedControls
            replaySpeedMs={replaySpeedMs}
            onSpeedChange={onSpeedChange}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Main drawer ──────────────────────────────────────────────────────────────

interface AlgoDrawerProps {
  sessionId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  budgetEnabled: boolean;
}

export function AlgoDrawer({
  sessionId,
  open,
  onOpenChange,
  budgetEnabled,
}: AlgoDrawerProps) {
  const [activeTab, setActiveTab]         = useState<DrawerTab>('mergesort');
  const [replayIndex, setReplayIndex]     = useState(0);
  const [isReplaying, setIsReplaying]     = useState(false);
  const [replayDone, setReplayDone]       = useState(false);
  const [hasAutoPlayed, setHasAutoPlayed] = useState(false);
  const [replaySpeedMs, setReplaySpeedMs] = useState(120);

  // Step buffers — not state; don't trigger re-render on push
  const mergeSortStepsRef  = useRef<MergeSortStep[]>([]);
  const knapsackStepsRef   = useRef<KnapsackStep[]>([]);
  const recommendationsRef = useRef<Recommendation[]>([]);

  // Current display snapshot (state — triggers re-render)
  const [currentItem, setCurrentItem]           = useState<ReplayItem | null>(null);
  const [totalReplaySteps, setTotalReplaySteps] = useState(0);

  // ── Reset on new sessionId ──────────────────────────────────────────────────
  const prevSessionIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (sessionId === prevSessionIdRef.current) return;
    prevSessionIdRef.current = sessionId;
    mergeSortStepsRef.current  = [];
    knapsackStepsRef.current   = [];
    recommendationsRef.current = [];
    setCurrentItem(null);
    setReplayIndex(0);
    setIsReplaying(false);
    setReplayDone(false);
    setHasAutoPlayed(false);
    setTotalReplaySteps(0);
    setActiveTab('mergesort');
  }, [sessionId]);

  // ── Socket subscriptions ────────────────────────────────────────────────────
  useEffect(() => {
    const unsubStep = socketEvents.onAlgoStep((event: AlgoStepEvent) => {
      if (event.sessionId !== sessionId) return;
      if (event.algorithm === 'mergeSort') {
        mergeSortStepsRef.current.push(event.step as MergeSortStep);
      } else if (event.algorithm === 'knapsack') {
        knapsackStepsRef.current.push(event.step as KnapsackStep);
      }
    });

    const unsubComplete = socketEvents.onAlgoComplete((event: AlgoCompleteEvent) => {
      if (event.sessionId !== sessionId) return;
      // Replay drives off ref buffers; no explicit action needed here
    });

    const unsubReady = socketEvents.onRecommendReady((event: RecommendReadyEvent) => {
      if (event.sessionId !== sessionId) return;
      recommendationsRef.current = event.recommendations;
    });

    return () => { unsubStep(); unsubComplete(); unsubReady(); };
  }, [sessionId]);

  // ── Auto-play on first open ─────────────────────────────────────────────────
  useEffect(() => {
    if (open && !hasAutoPlayed && mergeSortStepsRef.current.length > 0) {
      startReplay();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, hasAutoPlayed]);

  // ── Replay engine ───────────────────────────────────────────────────────────
  function buildAllSteps(): ReplayItem[] {
    return [
      ...mergeSortStepsRef.current.map(s => ({ type: 'mergesort' as const, step: s })),
      ...(budgetEnabled
        ? knapsackStepsRef.current.map(s => ({ type: 'knapsack' as const, step: s }))
        : []),
    ];
  }

  function startReplay() {
    setHasAutoPlayed(true);
    setReplayDone(false);
    setReplayIndex(0);
    setIsReplaying(true);
    setActiveTab('mergesort');
  }

  useEffect(() => {
    if (!isReplaying) return;
    const allSteps = buildAllSteps();
    setTotalReplaySteps(allSteps.length);

    if (replayIndex >= allSteps.length) {
      setIsReplaying(false);
      setReplayDone(true);
      return;
    }

    const item = allSteps[replayIndex];
    setCurrentItem(item);
    if (item.type === 'mergesort') setActiveTab('mergesort');
    else if (item.type === 'knapsack') setActiveTab('knapsack');

    const id = setTimeout(() => setReplayIndex(i => i + 1), replaySpeedMs);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReplaying, replayIndex, replaySpeedMs, budgetEnabled]);

  // ── Tab list ────────────────────────────────────────────────────────────────
  const TABS: { id: DrawerTab; label: string }[] = [
    { id: 'mergesort', label: 'Merge Sort' },
    ...(budgetEnabled ? [{ id: 'knapsack' as DrawerTab, label: 'Knapsack' }] : []),
    { id: 'overview',  label: 'Overview' },
  ];

  const hasActivity =
    mergeSortStepsRef.current.length > 0 || knapsackStepsRef.current.length > 0;

  const mergeSortCount = mergeSortStepsRef.current.length;
  const knapsackReplayIndex = Math.max(0, replayIndex - mergeSortCount);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40"
      style={{ borderTop: '2px solid var(--color-brand)' }}
    >
      {/* Tab bar — always visible */}
      <div
        className="flex items-center px-4 h-12 gap-1"
        style={{ backgroundColor: 'var(--color-bg-elevated)' }}
      >
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => {
              if (activeTab === id && open) {
                onOpenChange(false);
              } else {
                setActiveTab(id);
                onOpenChange(true);
              }
            }}
            className="px-3 py-1 rounded text-xs font-medium transition-colors duration-150"
            style={{
              backgroundColor: activeTab === id && open ? 'var(--color-brand)' : 'transparent',
              color: activeTab === id && open ? 'white' : 'var(--color-text-secondary)',
            }}
          >
            {label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          {hasActivity && !open && (
            <span className="text-xs animate-pulse" style={{ color: 'var(--color-brand)' }}>
              ● live
            </span>
          )}
          <button
            onClick={() => onOpenChange(!open)}
            className="text-xs"
            style={{ color: 'var(--color-text-muted)' }}
            aria-label={open ? 'Collapse algo drawer' : 'Expand algo drawer'}
          >
            {open ? '▼ Collapse' : '▲ Algorithms'}
          </button>
        </div>
      </div>

      {/* Expandable content */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: '40vh', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            style={{ backgroundColor: 'var(--color-bg-elevated)', overflowY: 'auto' }}
          >
            {activeTab === 'mergesort' && (
              <MergeSortPanel
                currentStep={
                  currentItem?.type === 'mergesort'
                    ? (currentItem.step as MergeSortStep)
                    : null
                }
                replayIndex={Math.min(replayIndex, mergeSortCount)}
                totalSteps={mergeSortCount}
                replayDone={replayDone}
                isReplaying={isReplaying}
                onReplay={startReplay}
                replaySpeedMs={replaySpeedMs}
                onSpeedChange={setReplaySpeedMs}
              />
            )}
            {activeTab === 'knapsack' && budgetEnabled && (
              <KnapsackPanel
                currentStep={
                  currentItem?.type === 'knapsack'
                    ? (currentItem.step as KnapsackStep)
                    : null
                }
                knapsackSteps={knapsackStepsRef.current}
                recommendations={recommendationsRef.current}
                knapsackReplayIndex={knapsackReplayIndex}
                replayDone={replayDone}
                isReplaying={isReplaying}
                onReplay={startReplay}
                replaySpeedMs={replaySpeedMs}
                onSpeedChange={setReplaySpeedMs}
              />
            )}
            {activeTab === 'overview' && (
              <div className="p-4">
                <p
                  className="text-sm font-semibold mb-2"
                  style={{ color: 'var(--color-brand)' }}
                >
                  Active Engine
                </p>
                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  CineGraph runs three recommendation engines: Content-Based (cosine
                  similarity on 50-dimensional feature vectors), Collaborative
                  (Floyd-Warshall transitive similarity + Pearson correlation), and
                  Hybrid (phases based on your rating history).
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
