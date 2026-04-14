'use client';
// frontend/components/recommendation/WatchBudget.tsx

import { formatRuntime } from '@/lib/formatters';

interface WatchBudgetProps {
  value: number | undefined;
  onChange: (mins: number | undefined) => void;
}

export function WatchBudget({ value, onChange }: WatchBudgetProps) {
  const enabled = value !== undefined;
  const sliderValue = value ?? 240;

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm whitespace-nowrap" style={{ color: 'var(--color-text-secondary)' }}>
        Watch Budget
      </span>
      {/* Toggle pill */}
      <button
        role="switch"
        aria-checked={enabled}
        onClick={() => onChange(enabled ? undefined : 240)}
        className="relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200 focus:outline-none"
        style={{ backgroundColor: enabled ? 'var(--color-brand)' : '#374151' }}
        aria-label="Enable watch budget"
      >
        <span
          className="pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200"
          style={{
            margin: '2px',
            transform: enabled ? 'translateX(16px)' : 'translateX(0)',
          }}
        />
      </button>
      {enabled && (
        <>
          <input
            type="range"
            min={60}
            max={300}
            step={30}
            value={sliderValue}
            onChange={e => onChange(Number(e.target.value))}
            className="w-32 accent-violet-600"
            aria-label="Watch time budget in minutes"
          />
          <span className="text-sm font-medium w-14 text-white">
            {formatRuntime(sliderValue)}
          </span>
        </>
      )}
    </div>
  );
}
