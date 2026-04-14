'use client';

import { SpeedControls } from '@/components/layout/SpeedControls';
import type { MSTStep } from '@/lib/types';

interface KruskalPanelProps {
  steps: MSTStep[];
  totalSteps: number;
  playing: boolean;
  index: number;
  replaySpeedMs: number;
  onPlay: () => void;
  onPause: () => void;
  onSpeedChange: (ms: number) => void;
}

const BADGE: Record<MSTStep['type'], { label: string; color: string }> = {
  consider: { label: 'CONSIDER', color: 'var(--color-text-muted)' },
  add:      { label: 'ADD',      color: 'var(--color-match)' },
  reject:   { label: 'REJECT',   color: 'var(--color-exclude)' },
};

export function KruskalPanel({
  steps, totalSteps, playing, index, replaySpeedMs, onPlay, onPause, onSpeedChange,
}: KruskalPanelProps) {
  const currentStep = steps[index - 1] ?? null;
  const communities = currentStep?.communities ?? [];

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

      {/* Edge log */}
      <div
        className="flex-1 overflow-y-auto rounded p-2 space-y-1 text-xs font-mono no-scrollbar"
        style={{ backgroundColor: 'var(--color-bg-elevated)', minHeight: 0 }}
      >
        {steps.slice(0, index).map((step, i) => {
          const badge = BADGE[step.type];
          return (
            <div key={i} className="flex items-center gap-2">
              <span style={{ color: badge.color, minWidth: 60 }}>{badge.label}</span>
              <span style={{ color: 'var(--color-text-secondary)' }}>
                {step.edge.u.slice(0, 8)} — {step.edge.v.slice(0, 8)}
              </span>
              <span style={{ color: 'var(--color-text-muted)', marginLeft: 'auto' }}>
                {step.edge.weight.toFixed(3)}
              </span>
            </div>
          );
        })}
        {totalSteps === 0 && (
          <p style={{ color: 'var(--color-text-muted)' }}>Waiting for computation…</p>
        )}
      </div>

      {/* Community chips */}
      <div>
        <p className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Communities</p>
        <div className="flex flex-wrap gap-1">
          {communities.map((group, gi) => {
            const colors = [
              'var(--viz-color-1)', 'var(--viz-color-2)',
              'var(--viz-color-3)', 'var(--viz-color-4)',
            ];
            const color = colors[gi % colors.length];
            return (
              <span
                key={gi}
                className="px-1.5 py-0.5 rounded text-xs"
                style={{ backgroundColor: color + '33', color, border: `1px solid ${color}55` }}
              >
                {group.length} users
              </span>
            );
          })}
          {communities.length === 0 && (
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>—</span>
          )}
        </div>
      </div>
    </div>
  );
}
