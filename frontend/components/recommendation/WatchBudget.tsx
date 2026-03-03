'use client';
// frontend/components/recommendation/WatchBudget.tsx

import { formatRuntime } from '@/lib/formatters';

interface WatchBudgetProps {
  value: number; // minutes
  onChange: (mins: number) => void;
}

export function WatchBudget({ value, onChange }: WatchBudgetProps) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm whitespace-nowrap" style={{ color: 'var(--color-text-secondary)' }}>
        Budget:
      </span>
      <input
        type="range"
        min={60}
        max={300}
        step={30}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-32 accent-violet-600"
        aria-label="Watch time budget"
      />
      <span className="text-sm font-medium w-14 text-white">{formatRuntime(value)}</span>
    </div>
  );
}
