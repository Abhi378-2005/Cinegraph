'use client';

import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SpeedControls } from '@/components/layout/SpeedControls';
import type { FloydStep } from '@/lib/types';

interface FloydWarshallPanelProps {
  steps: FloydStep[];
  totalSteps: number;
  playing: boolean;
  index: number;
  replaySpeedMs: number;
  userIds: string[];
  currentUserId: string;
  onPlay: () => void;
  onPause: () => void;
  onSpeedChange: (ms: number) => void;
}

/** Interpolate dark navy (0) → brand purple (1).
 *  Endpoint rgb(124,58,237) mirrors --color-brand (#7C3AED).
 *  CSS vars cannot be used for programmatic interpolation, so the value is hardcoded here.
 */
function heatColor(value: number): string {
  const v = Math.max(0, Math.min(1, value));
  const r = Math.round(28 + v * (124 - 28));
  const g = Math.round(27 + v * (58  - 27));
  const b = Math.round(75 + v * (237 - 75));
  return `rgb(${r},${g},${b})`;
}

export function FloydWarshallPanel({
  steps, totalSteps, playing, index, replaySpeedMs,
  userIds, currentUserId, onPlay, onPause, onSpeedChange,
}: FloydWarshallPanelProps) {
  // Find the most recent snapshot step at or before current index
  const snapshotStep = useMemo(() => {
    for (let t = index - 1; t >= 0; t--) {
      if (steps[t].matrixSnapshot !== undefined) return steps[t];
    }
    return null;
  }, [steps, index]);

  // Find the snapshot immediately before snapshotStep (for inter-snapshot diff)
  const prevSnapshotMatrix = useMemo(() => {
    if (!snapshotStep) return null;
    const cutoff = steps.indexOf(snapshotStep);
    if (cutoff <= 0) return null;
    for (let t = cutoff - 1; t >= 0; t--) {
      if (steps[t].matrixSnapshot !== undefined) return steps[t].matrixSnapshot ?? null;
    }
    return null;
  }, [steps, snapshotStep]);

  const matrix = snapshotStep?.matrixSnapshot ?? null;
  const currentStep = steps[index - 1] ?? null;
  const progress = totalSteps > 0 ? Math.round((index / totalSteps) * 100) : 0;
  const n = userIds.length;

  // Compute biggestUpdate during render from props only — no state, no refs
  const biggestUpdate = useMemo(() => {
    if (!snapshotStep?.matrixSnapshot) return null;
    const snap = snapshotStep.matrixSnapshot;
    const prev = prevSnapshotMatrix;
    if (!prev) return null;
    let maxDelta = 0;
    let best: { i: number; j: number; k: number; delta: number } | null = null;
    for (let i = 0; i < snap.length; i++) {
      for (let j = 0; j < snap[i].length; j++) {
        if (i === j) continue;
        const delta = snap[i][j] - (prev[i]?.[j] ?? 0);
        if (delta > maxDelta) {
          maxDelta = delta;
          best = { i, j, k: snapshotStep.k, delta };
        }
      }
    }
    return best;
  }, [snapshotStep, prevSnapshotMatrix]);

  // Initial matrix — first snapshot ever received. Stable once steps has its first snapshot.
  const initialMatrix = useMemo(
    () => steps.find(s => s.matrixSnapshot !== undefined)?.matrixSnapshot ?? null,
    [steps],
  );

  const isComplete = totalSteps > 0 && index >= totalSteps;
  const myIdx = userIds.indexOf(currentUserId);
  const finalMatrix = matrix; // matrix = most recent snapshot

  // Top-3 indirect matches for current user
  const topMatches: Array<{ j: number; val: number; isIndirect: boolean }> =
    myIdx >= 0 && finalMatrix && myIdx < finalMatrix.length
      ? finalMatrix[myIdx]
          .map((val, j) => ({
            j,
            val,
            isIndirect: (initialMatrix?.[myIdx]?.[j] ?? 0) < val - 0.001,
          }))
          .filter(entry => entry.j !== myIdx && entry.val > 0.01)
          .sort((a, b) => b.val - a.val)
          .slice(0, 3)
      : [];

  // All-time biggest gain (initial → final) — memoized to avoid O(N²) scan on every replay tick
  const { improvedPairs, allTimeBestDelta, allTimeBestI, allTimeBestJ } = useMemo(() => {
    let improvedPairs = 0, allTimeBestDelta = 0, allTimeBestI = -1, allTimeBestJ = -1;
    if (finalMatrix && initialMatrix) {
      finalMatrix.forEach((row, i) => {
        row.forEach((val, j) => {
          if (j <= i) return;
          const delta = val - (initialMatrix[i]?.[j] ?? 0);
          if (delta > 0.001) improvedPairs++;
          if (delta > allTimeBestDelta) {
            allTimeBestDelta = delta;
            allTimeBestI = i;
            allTimeBestJ = j;
          }
        });
      });
    }
    return { improvedPairs, allTimeBestDelta, allTimeBestI, allTimeBestJ };
  }, [finalMatrix, initialMatrix]);

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Controls */}
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={playing ? onPause : onPlay}
          disabled={totalSteps === 0}
          className="px-3 py-1 rounded text-xs font-medium"
          style={{
            backgroundColor: totalSteps === 0 ? 'var(--color-bg-elevated)' : 'var(--color-brand)',
            color: totalSteps === 0 ? 'var(--color-text-muted)' : 'white',
            cursor: totalSteps === 0 ? 'not-allowed' : 'pointer',
          }}
        >
          {playing ? 'Pause' : (index === 0 && totalSteps > 0 ? 'Play' : 'Resume')}
        </button>
        <SpeedControls replaySpeedMs={replaySpeedMs} onSpeedChange={onSpeedChange} />
        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          {progress}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1 rounded overflow-hidden" style={{ backgroundColor: 'var(--color-bg-elevated)' }}>
        <div
          className="h-full rounded transition-all duration-100"
          style={{ width: `${progress}%`, backgroundColor: 'var(--color-brand)' }}
        />
      </div>

      {/* Status label */}
      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
        {totalSteps === 0
          ? 'Waiting for computation…'
          : currentStep
          ? `Propagating k=${currentStep.k} i=${currentStep.i} j=${currentStep.j}…`
          : 'Complete'}
      </p>

      {/* Matrix section: two-phase with AnimatePresence */}
      <AnimatePresence mode="wait">
        {isComplete && myIdx >= 0 ? (
          /* ── Results phase ── */
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex flex-col gap-3 flex-1 overflow-auto no-scrollbar"
          >
            {/* Ranked indirect matches */}
            <div
              className="rounded p-3 flex flex-col gap-2"
              style={{ backgroundColor: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.18)' }}
            >
              <p className="text-xs font-semibold" style={{ color: 'var(--color-match)' }}>
                Your closest taste matches
              </p>
              {topMatches.length === 0 && (
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  Not enough data — rate more movies to build your similarity profile.
                </p>
              )}
              {topMatches.map(({ j, val, isIndirect }, rank) => (
                <div key={j} className="flex items-center gap-2">
                  {/* Rank badge */}
                  <div
                    className="flex-shrink-0 rounded-full flex items-center justify-center text-white font-bold"
                    style={{
                      width: 20, height: 20, fontSize: 9,
                      backgroundColor: rank === 0 ? 'var(--color-brand)' : rank === 1 ? '#5a2ab0' : '#3a1a70',
                    }}
                  >
                    {rank + 1}
                  </div>
                  {/* User ID */}
                  <span className="text-xs font-mono flex-1" style={{ color: 'var(--color-text-secondary)' }}>
                    {userIds[j]?.slice(0, 12)}
                  </span>
                  {/* Via label */}
                  <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {isIndirect ? 'indirect' : 'direct'}
                  </span>
                  {/* Similarity bar */}
                  <div className="flex items-center gap-1">
                    <div
                      className="rounded overflow-hidden"
                      style={{ width: 48, height: 4, backgroundColor: 'rgba(255,255,255,0.08)' }}
                    >
                      <div
                        className="h-full rounded"
                        style={{
                          width: `${Math.round(val * 100)}%`,
                          backgroundColor: 'var(--color-brand)',
                        }}
                      />
                    </div>
                    <span className="text-xs tabular-nums" style={{ color: 'var(--color-knapsack)', minWidth: 28 }}>
                      {Math.round(val * 100)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Plain-English summary */}
            {allTimeBestI >= 0 && (
              <p className="text-xs" style={{ color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                Propagation improved {improvedPairs} pair{improvedPairs !== 1 ? 's' : ''} · biggest gain:{' '}
                <span style={{ color: 'var(--color-text-secondary)' }}>
                  {userIds[allTimeBestI]?.slice(0, 8)} ↔ {userIds[allTimeBestJ]?.slice(0, 8)}
                </span>{' '}
                <span style={{ color: 'var(--color-match)' }}>+{allTimeBestDelta.toFixed(3)}</span>
              </p>
            )}

            {/* Mini matrix thumbnail */}
            {finalMatrix && n > 0 && (
              <div style={{ opacity: 0.45 }}>
                <p className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Final similarity matrix</p>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`,
                    gap: 1,
                  }}
                >
                  {finalMatrix.map((row, i) =>
                    row.map((val, j) => (
                      <div
                        key={`mini-${i}-${j}`}
                        style={{ aspectRatio: '1', backgroundColor: heatColor(val), borderRadius: 1 }}
                      />
                    ))
                  )}
                </div>
              </div>
            )}
          </motion.div>
        ) : (
          /* ── Heatmap phase (during replay) ── */
          <motion.div
            key="heatmap"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.4 } }}
            className="flex-1 overflow-auto no-scrollbar"
          >
            {matrix && n > 0 ? (
              <>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`,
                    gap: 2,
                  }}
                >
                  {matrix.map((row, i) =>
                    row.map((val, j) => {
                      const isActive = currentStep && currentStep.i === i && currentStep.j === j;
                      const isKRow   = currentStep != null && i === currentStep.k;
                      const isKCol   = currentStep != null && j === currentStep.k;
                      const isKDiag  = isKRow && isKCol;
                      return (
                        <div
                          key={`${i}-${j}`}
                          title={`[${i},${j}] = ${val.toFixed(3)}`}
                          style={{
                            aspectRatio: '1',
                            backgroundColor: heatColor(val),
                            borderRadius: 2,
                            boxShadow: (isKRow || isKCol) && !isKDiag
                              ? 'inset 0 0 0 100px rgba(124,58,237,0.28)'
                              : 'none',
                            outline: isKDiag
                              ? '2px solid white'
                              : isActive
                              ? '2px solid var(--color-brand-bright)'
                              : 'none',
                            transition: 'background-color 0.2s',
                          }}
                        />
                      );
                    })
                  )}
                </div>
                {biggestUpdate && (
                  <div
                    className="mt-2 rounded px-2 py-1 text-xs"
                    style={{
                      backgroundColor: 'rgba(167,139,250,0.1)',
                      border: '1px solid rgba(167,139,250,0.25)',
                      color: 'var(--color-knapsack)',
                    }}
                  >
                    Biggest update: {userIds[biggestUpdate.i]?.slice(0, 8)} ↔ {userIds[biggestUpdate.j]?.slice(0, 8)}
                    {' '}
                    <span style={{ color: 'var(--color-match)' }}>+{biggestUpdate.delta.toFixed(3)}</span>
                    {' '}via {userIds[biggestUpdate.k]?.slice(0, 8)}
                  </div>
                )}
                <p className="text-xs mt-2 text-center" style={{ color: 'var(--color-text-muted)' }}>
                  Indirect similarity matrix ({n}×{n}) · dark = 0 · purple = 1
                </p>
              </>
            ) : (
              <div
                className="flex-1 rounded flex items-center justify-center text-xs"
                style={{ backgroundColor: 'var(--color-bg-elevated)', color: 'var(--color-text-muted)' }}
              >
                {totalSteps > 0 ? 'Propagating…' : 'No data yet'}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
