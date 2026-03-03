'use client';
// frontend/components/recommendation/EngineSelector.tsx

import { motion } from 'framer-motion';

export type Engine = 'content' | 'collaborative' | 'hybrid';

const ENGINES: { id: Engine; label: string }[] = [
  { id: 'content',       label: 'Content-Based' },
  { id: 'collaborative', label: 'Collaborative' },
  { id: 'hybrid',        label: 'Hybrid' },
];

interface EngineSelectorProps {
  value: Engine;
  onChange: (engine: Engine) => void;
}

export function EngineSelector({ value, onChange }: EngineSelectorProps) {
  return (
    <div
      className="flex items-center gap-1 rounded-full p-1"
      style={{ backgroundColor: 'var(--color-bg-elevated)' }}
    >
      {ENGINES.map(({ id, label }) => {
        const active = value === id;
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            className="relative px-4 py-1.5 rounded-full text-sm font-medium transition-colors duration-150"
            style={{
              color: active ? 'white' : 'var(--color-text-secondary)',
              zIndex: 1,
            }}
          >
            {active && (
              <motion.div
                layoutId="engine-pill"
                className="absolute inset-0 rounded-full"
                style={{ backgroundColor: 'var(--color-brand)' }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
            <span className="relative z-10">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
