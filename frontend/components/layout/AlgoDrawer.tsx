'use client';
// frontend/components/layout/AlgoDrawer.tsx

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { socketEvents } from '@/lib/socket';
import { posterUrl } from '@/lib/formatters';
import { SpeedControls } from '@/components/layout/SpeedControls';
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
              ? 'var(--shadow-compare)'
              : cardState === 'merge'
              ? 'var(--shadow-merge)'
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
              : '1px solid var(--color-card-border)',
          backgroundColor: 'var(--color-bg-card)',
        }}
      >
        {rec.movie.posterPath && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={posterUrl(rec.movie.posterPath)}
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
          color: cardState === 'compare' ? 'var(--color-knapsack)' : 'var(--color-text-muted)',
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
  msIndex: number;
  totalSteps: number;
  msPlaying: boolean;
  msDone: boolean;
  onPlay: () => void;
  onPause: () => void;
  replaySpeedMs: number;
  onSpeedChange: (ms: number) => void;
}

function MergeSortPanel({
  currentStep,
  msIndex,
  totalSteps,
  msPlaying,
  msDone,
  onPlay,
  onPause,
  replaySpeedMs,
  onSpeedChange,
}: MergeSortPanelProps) {
  // Show placeholder only when no steps have arrived yet
  if (!currentStep && totalSteps === 0) {
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

  const items = currentStep?.array ?? [];

  return (
    <div className="p-4 flex flex-col gap-3">
      <p className="text-sm font-semibold" style={{ color: 'var(--color-brand)' }}>
        Merge Sort — Recommendation Ranking
      </p>

      {/* Animated card row */}
      <div className="overflow-x-auto">
        {items.length === 0 ? (
          <p className="text-xs py-2" style={{ color: 'var(--color-text-muted)' }}>
            {totalSteps} steps ready — press ▶ Play to start
          </p>
        ) : (
        <motion.div
          layout
          className="flex gap-2 pb-1"
          style={{ minWidth: 'max-content' }}
        >
          {items.map((rec, idx) => {
            const isCompare =
              currentStep?.type === 'compare' &&
              (idx === currentStep.leftIndex || idx === currentStep.rightIndex);
            const isMerge =
              currentStep?.type === 'merge' &&
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
        )}
      </div>

      {/* Step description */}
      {currentStep && (
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
      )}

      {/* Footer */}
      <div
        className="flex items-center gap-3 text-xs"
        style={{ color: 'var(--color-text-muted)' }}
      >
        <span className="tabular-nums">
          step {msIndex} / {totalSteps}
        </span>
        <span style={{ color: msDone ? 'var(--color-match)' : 'var(--color-brand)' }}>
          {msDone ? 'Complete ✓' : msPlaying ? 'Sorting…' : msIndex > 0 ? 'Paused' : ''}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {msPlaying ? (
            <button
              onClick={onPause}
              className="px-2 py-0.5 rounded text-xs"
              style={{ backgroundColor: 'var(--color-brand)', color: 'white' }}
            >
              ⏸ Pause
            </button>
          ) : (
            <button
              onClick={onPlay}
              disabled={totalSteps === 0}
              className="px-2 py-0.5 rounded text-xs disabled:opacity-40"
              style={{ backgroundColor: 'var(--color-brand)', color: 'white' }}
            >
              {msDone ? '▶ Replay' : msIndex > 0 ? '▶ Resume' : '▶ Play'}
            </button>
          )}
          <SpeedControls replaySpeedMs={replaySpeedMs} onSpeedChange={onSpeedChange} />
        </div>
      </div>
    </div>
  );
}

// ─── Knapsack panel (placeholder — viz added in Task 9) ──────────────────────

interface KnapsackPanelProps {
  currentStep: KnapsackStep | null;
  knapsackSteps: KnapsackStep[];
  vizRecs: Recommendation[];   // full sorted list — used to map step.row → movie
  budget?: number;             // budget in minutes for the progress bar
  ksIndex: number;
  ksPlaying: boolean;
  ksDone: boolean;
  onPlay: () => void;
  onPause: () => void;
  replaySpeedMs: number;
  onSpeedChange: (ms: number) => void;
}

function KnapsackPanel({
  currentStep,
  knapsackSteps,
  vizRecs,
  budget,
  ksIndex,
  ksPlaying,
  ksDone,
  onPlay,
  onPause,
  replaySpeedMs,
  onSpeedChange,
}: KnapsackPanelProps) {
  // n = total items knapsack evaluated (full sorted list, NOT the post-selection count)
  const n = vizRecs.length;
  // Forward steps: one per movie row (0..n-1), ascending
  const forwardSteps   = knapsackSteps.slice(0, n);
  // Backtrack steps: one per movie row (n..end), descending — resolves which are selected
  const backtrackSteps = knapsackSteps.slice(n);

  const isPhase2       = ksIndex >= n;
  const backtrackShown = Math.max(0, ksIndex - n);

  // Only show movies the algorithm has CONFIRMED as selected (no ✗ noise)
  const selectedCards = backtrackSteps.slice(0, backtrackShown).filter(s => s.decision === 'include');
  const totalRuntime  = selectedCards.reduce((acc, s) => acc + (vizRecs[s.row - 1]?.movie.runtime ?? 90), 0);
  const budgetPct     = budget ? Math.min(100, Math.round((totalRuntime / budget) * 100)) : 0;

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
          /* ── Phase 1: DP evaluation table ── */
          <motion.div
            key="phase1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.6 } }}
            className="overflow-x-auto"
          >
            <table className="w-full text-xs border-collapse" style={{ minWidth: '360px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}>
                  <th className="text-left py-1 px-2 font-medium">#</th>
                  <th className="text-left py-1 px-2 font-medium">Movie</th>
                  <th className="text-right py-1 px-2 font-medium">Runtime</th>
                  <th className="text-right py-1 px-2 font-medium">Score</th>
                  <th className="text-right py-1 px-2 font-medium">dp[i]</th>
                  <th className="text-center py-1 px-2 font-medium">Decision</th>
                </tr>
              </thead>
              <tbody>
                {forwardSteps.slice(0, ksIndex + 1).map((step, i) => {
                  const rec    = vizRecs[step.row - 1];
                  const movie  = rec?.movie;
                  if (!movie) return null;
                  const isActive = i === Math.min(ksIndex, forwardSteps.length - 1);
                  const included = step.decision === 'include';
                  return (
                    <motion.tr
                      key={movie.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.15 }}
                      style={{
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        backgroundColor: isActive ? 'rgba(167,139,250,0.08)' : 'transparent',
                      }}
                    >
                      <td className="py-1 px-2 tabular-nums" style={{ color: 'var(--color-text-muted)' }}>
                        {step.row}
                      </td>
                      <td
                        className="py-1 px-2 truncate max-w-0"
                        style={{
                          width: '120px',
                          color: isActive ? 'var(--color-knapsack)' : 'var(--color-text-secondary)',
                          fontWeight: isActive ? 600 : 400,
                        }}
                      >
                        {movie.title}
                      </td>
                      <td className="py-1 px-2 text-right tabular-nums" style={{ color: 'var(--color-text-muted)' }}>
                        {movie.runtime}m
                      </td>
                      <td className="py-1 px-2 text-right tabular-nums" style={{ color: 'var(--color-text-secondary)' }}>
                        {rec.score.toFixed(2)}
                      </td>
                      <td
                        className="py-1 px-2 text-right tabular-nums font-mono"
                        style={{ color: included ? 'var(--color-match)' : 'var(--color-text-muted)' }}
                      >
                        {step.value}
                      </td>
                      <td className="py-1 px-2 text-center">
                        <span
                          className="inline-block px-1.5 rounded"
                          style={{
                            fontSize: '10px',
                            backgroundColor: included ? 'rgba(74,222,128,0.12)' : 'rgba(255,255,255,0.05)',
                            color: included ? 'var(--color-match)' : 'var(--color-text-muted)',
                          }}
                        >
                          {included ? '✓ include' : '· skip'}
                        </span>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </motion.div>
        ) : (
          /* ── Phase 2: Backtrack — show only confirmed picks ── */
          <motion.div
            key="phase2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col gap-3"
          >
            {/* Budget bar */}
            {budget !== undefined && (
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  <span>{totalRuntime} min used</span>
                  <span>{budget} min budget</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: 'var(--color-match)' }}
                    initial={{ width: 0 }}
                    animate={{ width: `${budgetPct}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </div>
            )}

            {/* Selected count */}
            <p className="text-xs" style={{ color: 'var(--color-match)' }}>
              {selectedCards.length > 0
                ? `${selectedCards.length} movie${selectedCards.length !== 1 ? 's' : ''} selected`
                : 'Backtracking…'}
            </p>

            {/* Only selected movie cards — no ✗ noise */}
            <div className="flex gap-3 flex-wrap">
              {selectedCards.map((step, i) => {
                const rec = vizRecs[step.row - 1];
                if (!rec) return null;
                return (
                  <motion.div
                    key={`ks-card-${rec.movie.id}-${i}`}
                    initial={{ scale: 0.7, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.2 }}
                    className="flex flex-col items-center gap-1"
                    style={{ width: '44px' }}
                  >
                    <div
                      className="relative rounded overflow-hidden"
                      style={{
                        width: '44px',
                        height: '64px',
                        border: '2px solid var(--color-match)',
                        boxShadow: 'var(--shadow-include)',
                        backgroundColor: 'var(--color-bg-card)',
                      }}
                    >
                      {rec.movie.posterPath && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={posterUrl(rec.movie.posterPath)}
                          alt={rec.movie.title}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      )}
                    </div>
                    <span
                      className="truncate text-center block"
                      style={{ fontSize: '9px', color: 'var(--color-match)', width: '44px' }}
                    >
                      {rec.movie.title}
                    </span>
                  </motion.div>
                );
              })}
              {selectedCards.length === 0 && (
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  Checking each movie against remaining budget…
                </p>
              )}
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
          {ksIndex} / {knapsackSteps.length}
        </span>
        <span style={{ color: ksDone ? 'var(--color-match)' : 'var(--color-knapsack)' }}>
          {ksDone ? 'Complete ✓' : ksPlaying ? 'Running…' : ksIndex > 0 ? 'Paused' : ''}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {ksPlaying ? (
            <button
              onClick={onPause}
              className="px-2 py-0.5 rounded text-xs"
              style={{ backgroundColor: 'var(--color-knapsack)', color: 'white' }}
            >
              ⏸ Pause
            </button>
          ) : (
            <button
              onClick={onPlay}
              disabled={knapsackSteps.length === 0}
              className="px-2 py-0.5 rounded text-xs disabled:opacity-40"
              style={{ backgroundColor: 'var(--color-knapsack)', color: 'white' }}
            >
              {ksDone ? '▶ Replay' : ksIndex > 0 ? '▶ Resume' : '▶ Play'}
            </button>
          )}
          <SpeedControls replaySpeedMs={replaySpeedMs} onSpeedChange={onSpeedChange} />
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
  budget?: number;
}

export function AlgoDrawer({
  sessionId,
  open,
  onOpenChange,
  budgetEnabled,
  budget,
}: AlgoDrawerProps) {
  const [activeTab, setActiveTab] = useState<DrawerTab>('mergesort');
  const [replaySpeedMs, setReplaySpeedMs] = useState(120);

  // Per-panel independent playback state
  const [msIndex, setMsIndex]           = useState(0);  // step cursor into mergeSortStepsRef (0 = not started)
  const [msPlaying, setMsPlaying]       = useState(false);
  const [msDone, setMsDone]             = useState(false);
  const [msTotalSteps, setMsTotalSteps] = useState(0);  // set on algo:complete to trigger re-render
  const [ksIndex, setKsIndex]           = useState(0);  // step cursor into knapsackStepsRef
  const [ksPlaying, setKsPlaying]       = useState(false);
  const [ksDone, setKsDone]             = useState(false);
  const [ksTotalSteps, setKsTotalSteps] = useState(0);

  // Step buffers — not state; don't trigger re-render on push
  const mergeSortStepsRef  = useRef<MergeSortStep[]>([]);
  const knapsackStepsRef   = useRef<KnapsackStep[]>([]);
  const recommendationsRef = useRef<Recommendation[]>([]);
  // Full sorted list sent by backend for knapsack viz (step.row → movie mapping).
  // Separate from recommendationsRef which holds the post-knapsack display list.
  const vizRecsRef         = useRef<Recommendation[]>([]);

  // Ref that stays in sync with sessionId prop so the stable ([] deps) socket
  // handler can read the current value without stale closure issues — same
  // pattern used in discover/page.tsx for its own recommend:ready handler.
  const currentSessionIdRef = useRef<string | null>(sessionId);
  currentSessionIdRef.current = sessionId;

  // ── Reset on new sessionId ──────────────────────────────────────────────────
  const prevSessionIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (sessionId === prevSessionIdRef.current) return;
    prevSessionIdRef.current = sessionId;
    mergeSortStepsRef.current  = [];
    knapsackStepsRef.current   = [];
    recommendationsRef.current = [];
    vizRecsRef.current         = [];
    setMsIndex(0);
    setMsPlaying(false);
    setMsDone(false);
    setMsTotalSteps(0);
    setKsIndex(0);
    setKsPlaying(false);
    setKsDone(false);
    setKsTotalSteps(0);
    setActiveTab('mergesort');
  }, [sessionId]);

  // ── Socket subscriptions ────────────────────────────────────────────────────
  // Stable handlers ([] deps) — use currentSessionIdRef to avoid stale closures.
  // Steps can arrive in the render gap between setSessionId() and the new prop
  // reaching this component; reading the ref avoids dropping those early events.
  useEffect(() => {
    const unsubStep = socketEvents.onAlgoStep((event: AlgoStepEvent) => {
      if (event.sessionId !== currentSessionIdRef.current) return;
      if (event.algorithm === 'mergeSort') {
        mergeSortStepsRef.current.push(event.step as MergeSortStep);
      } else if (event.algorithm === 'knapsack') {
        knapsackStepsRef.current.push(event.step as KnapsackStep);
      }
    });

    const unsubComplete = socketEvents.onAlgoComplete((event: AlgoCompleteEvent) => {
      if (event.sessionId !== currentSessionIdRef.current) return;
      // Trigger re-render so Play button enables and totalSteps shows correctly
      if (event.algorithm === 'mergeSort') {
        setMsTotalSteps(mergeSortStepsRef.current.length);
      } else if (event.algorithm === 'knapsack') {
        setKsTotalSteps(knapsackStepsRef.current.length);
      }
    });

    const unsubReady = socketEvents.onRecommendReady((event: RecommendReadyEvent) => {
      if (event.sessionId !== currentSessionIdRef.current) return;
      recommendationsRef.current = event.recommendations;
      // vizRecs = full sorted list (sent by backend when budget used).
      // Falls back to recommendations when no knapsack ran (same list anyway).
      vizRecsRef.current = event.vizRecs ?? event.recommendations;
    });

    return () => { unsubStep(); unsubComplete(); unsubReady(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── MergeSort replay engine ─────────────────────────────────────────────────
  useEffect(() => {
    if (!msPlaying) return;
    if (msIndex >= mergeSortStepsRef.current.length) {
      setMsPlaying(false);
      setMsDone(true);
      return;
    }
    const id = setTimeout(() => setMsIndex(i => i + 1), replaySpeedMs);
    return () => clearTimeout(id);
  }, [msPlaying, msIndex, replaySpeedMs]);

  // ── Knapsack replay engine ──────────────────────────────────────────────────
  useEffect(() => {
    if (!ksPlaying) return;
    if (ksIndex >= knapsackStepsRef.current.length) {
      setKsPlaying(false);
      setKsDone(true);
      return;
    }
    const id = setTimeout(() => setKsIndex(i => i + 1), replaySpeedMs);
    return () => clearTimeout(id);
  }, [ksPlaying, ksIndex, replaySpeedMs]);

  // ── Tab list ────────────────────────────────────────────────────────────────
  const TABS: { id: DrawerTab; label: string }[] = [
    { id: 'mergesort', label: 'Merge Sort' },
    ...(budgetEnabled ? [{ id: 'knapsack' as DrawerTab, label: 'Knapsack' }] : []),
    { id: 'overview',  label: 'Overview' },
  ];

  const hasActivity = msTotalSteps > 0 || ksTotalSteps > 0;

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
                currentStep={msIndex > 0 ? (mergeSortStepsRef.current[msIndex - 1] ?? null) : null}
                msIndex={msIndex}
                totalSteps={msTotalSteps}
                msPlaying={msPlaying}
                msDone={msDone}
                onPlay={() => {
                  if (msDone) { setMsIndex(0); setMsDone(false); }
                  setMsPlaying(true);
                }}
                onPause={() => setMsPlaying(false)}
                replaySpeedMs={replaySpeedMs}
                onSpeedChange={setReplaySpeedMs}
              />
            )}
            {activeTab === 'knapsack' && budgetEnabled && (
              <KnapsackPanel
                currentStep={ksIndex > 0 ? (knapsackStepsRef.current[ksIndex - 1] ?? null) : null}
                knapsackSteps={knapsackStepsRef.current.slice(0, ksTotalSteps)}
                vizRecs={vizRecsRef.current}
                budget={budget}
                ksIndex={ksIndex}
                ksPlaying={ksPlaying}
                ksDone={ksDone}
                onPlay={() => {
                  if (ksDone) { setKsIndex(0); setKsDone(false); }
                  setKsPlaying(true);
                }}
                onPause={() => setKsPlaying(false)}
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
