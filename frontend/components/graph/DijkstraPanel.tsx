'use client';

import { Fragment } from 'react';
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

      {/* Visual path chain */}
      <div>
        <p className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Current path</p>
        <div className="overflow-x-auto">
          <div className="flex items-center gap-1 pb-1" style={{ minWidth: 'max-content' }}>
            {pathToShow.length === 0 ? (
              <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>—</span>
            ) : (
              pathToShow.map((uid, i) => {
                const isFirst = i === 0;
                const isLast  = i === pathToShow.length - 1 && pathToShow.length > 1;
                return (
                  <Fragment key={i}>
                    <span
                      className="px-2 py-0.5 rounded text-xs font-mono flex-shrink-0"
                      style={{
                        backgroundColor: isFirst
                          ? 'var(--color-brand)'
                          : isLast
                          ? 'rgba(74,222,128,0.2)'
                          : 'rgba(124,58,237,0.35)',
                        color: isFirst ? 'white' : isLast ? 'var(--color-match)' : 'var(--color-knapsack)',
                        border: isLast ? '1px solid var(--color-match)' : 'none',
                        fontWeight: isFirst || isLast ? 700 : 400,
                      }}
                    >
                      {isFirst ? 'YOU' : uid.slice(0, 8)}{isLast ? ' ●' : ''}
                    </span>
                    {i < pathToShow.length - 1 && (
                      <span style={{ color: 'var(--color-match)', fontSize: 14, lineHeight: 1 }}>→</span>
                    )}
                  </Fragment>
                );
              })
            )}
          </div>
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

      {/* Similarity distance bar + visiting label */}
      {currentStep && currentStep.distance !== Infinity && (
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-xs" style={{ color: 'var(--color-text-muted)' }}>
            <span>distance: {currentStep.distance.toFixed(3)}</span>
            <span style={{ color: 'var(--color-match)' }}>
              similarity: {Math.round((1 - Math.min(1, currentStep.distance)) * 100)}%
            </span>
          </div>
          <div
            className="rounded overflow-hidden"
            style={{ height: 6, backgroundColor: 'rgba(255,255,255,0.08)' }}
          >
            <div
              className="h-full rounded transition-all duration-150"
              style={{
                width: `${Math.min(100, currentStep.distance * 100)}%`,
                background: 'linear-gradient(to right, var(--color-brand), var(--color-match))',
              }}
            />
          </div>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Visiting: <span style={{ color: 'var(--color-brand)' }}>{currentStep.visitedUserId.slice(0, 12)}</span>
          </p>
        </div>
      )}
      {currentStep && currentStep.distance === Infinity && (
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          Visiting: <span style={{ color: 'var(--color-brand)' }}>{currentStep.visitedUserId.slice(0, 12)}</span>
          {' '}(unreachable)
        </p>
      )}
    </div>
  );
}
