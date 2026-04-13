'use client';

import { useMemo } from 'react';
import { SpeedControls } from '@/components/layout/SpeedControls';
import type { FloydStep } from '@/lib/types';

interface FloydWarshallPanelProps {
  steps: FloydStep[];
  totalSteps: number;
  playing: boolean;
  index: number;
  replaySpeedMs: number;
  userIds: string[];
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
  userIds, onPlay, onPause, onSpeedChange,
}: FloydWarshallPanelProps) {
  // Find the most recent snapshot step at or before current index
  const snapshotStep = useMemo(
    () => [...steps.slice(0, index)].reverse().find(s => s.matrixSnapshot !== undefined) ?? null,
    [steps, index],
  );

  // Find the snapshot immediately before snapshotStep (for inter-snapshot diff)
  const prevSnapshotMatrix = useMemo(() => {
    if (!snapshotStep) return null;
    const cutoff = steps.indexOf(snapshotStep);
    if (cutoff <= 0) return null;
    return (
      [...steps.slice(0, cutoff)].reverse().find(s => s.matrixSnapshot !== undefined)
        ?.matrixSnapshot ?? null
    );
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

      {/* Heatmap matrix */}
      {matrix && n > 0 ? (
        <div className="flex-1 overflow-auto no-scrollbar">
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
        </div>
      ) : (
        <div
          className="flex-1 rounded flex items-center justify-center text-xs"
          style={{ backgroundColor: 'var(--color-bg-elevated)', color: 'var(--color-text-muted)' }}
        >
          {totalSteps > 0 ? 'Propagating…' : 'No data yet'}
        </div>
      )}
    </div>
  );
}
