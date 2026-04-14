'use client';

import { SpeedControls } from '@/components/layout/SpeedControls';
import type { DijkstraStep } from '@/lib/types';

interface DijkstraPanelProps {
  steps: DijkstraStep[];
  totalSteps: number;
  playing: boolean;
  index: number;
  replaySpeedMs: number;
  finalPath: string[];
  sourceUserId: string;
  targetUserId: string;
  onPlay: () => void;
  onPause: () => void;
  onSpeedChange: (ms: number) => void;
}

export function DijkstraPanel({
  steps, totalSteps, playing, index, replaySpeedMs,
  finalPath, sourceUserId, targetUserId,
  onPlay, onPause, onSpeedChange,
}: DijkstraPanelProps) {
  const currentStep = steps[index - 1] ?? null;
  const pathToShow = index > 0 && totalSteps > 0 && index === totalSteps
    ? finalPath
    : (currentStep?.path ?? []);

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
          {index}/{totalSteps}
        </span>
      </div>

      {/* Source → Target header */}
      <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
        <span style={{ color: 'var(--color-brand)' }}>{sourceUserId.slice(0, 10)}</span>
        {' → '}
        <span style={{ color: 'var(--viz-dijkstra-path)' }}>{targetUserId.slice(0, 10)}</span>
      </div>

      {/* Current path chain */}
      <div>
        <p className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Current path</p>
        <div className="flex flex-wrap gap-1">
          {pathToShow.map((uid, i) => (
            <span
              key={i}
              className="px-1.5 py-0.5 rounded text-xs font-mono"
              style={{
                backgroundColor: 'var(--color-brand)' + '33',
                color: 'var(--viz-dijkstra-path)',
                border: '1px solid var(--color-brand)',
              }}
            >
              {uid.slice(0, 8)}
            </span>
          ))}
          {pathToShow.length === 0 && (
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>—</span>
          )}
        </div>
      </div>

      {/* Frontier queue */}
      <div>
        <p className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Frontier queue</p>
        <div
          className="rounded p-2 text-xs font-mono space-y-1 overflow-y-auto no-scrollbar"
          style={{ backgroundColor: 'var(--color-bg-elevated)', maxHeight: 120 }}
        >
          {currentStep?.frontier.map((uid, i) => (
            <div key={i} className="flex justify-between">
              <span style={{ color: 'var(--color-text-secondary)' }}>{uid.slice(0, 12)}</span>
            </div>
          ))}
          {(!currentStep || currentStep.frontier.length === 0) && (
            <span style={{ color: 'var(--color-text-muted)' }}>
              {totalSteps === 0 ? 'Waiting…' : 'Empty'}
            </span>
          )}
        </div>
      </div>

      {/* Visited node */}
      {currentStep && (
        <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          Visiting: <span style={{ color: 'var(--color-brand)' }}>{currentStep.visitedUserId.slice(0, 12)}</span>
          {' '}(dist: {currentStep.distance === Infinity ? '∞' : currentStep.distance.toFixed(3)})
        </div>
      )}
    </div>
  );
}
