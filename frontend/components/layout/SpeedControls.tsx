'use client';

export function SpeedControls({
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
