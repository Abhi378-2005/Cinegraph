'use client';
// frontend/components/layout/AlgoDrawer.tsx

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

type DrawerTab = 'mergesort' | 'knapsack' | 'overview';

const TABS: { id: DrawerTab; label: string }[] = [
  { id: 'mergesort', label: 'Merge Sort' },
  { id: 'knapsack',  label: 'Knapsack' },
  { id: 'overview',  label: 'Overview' },
];

const TAB_CONTENT: Record<DrawerTab, React.ReactNode> = {
  mergesort: (
    <div className="p-4">
      <p className="text-sm font-semibold mb-2" style={{ color: 'var(--color-brand)' }}>
        Merge Sort — Recommendation Ranking
      </p>
      <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
        Your recommendations are sorted by predicted score using Merge Sort (O(n log n)).
        When the backend is live, each comparison and merge step will animate here in real time.
      </p>
    </div>
  ),
  knapsack: (
    <div className="p-4">
      <p className="text-sm font-semibold mb-2" style={{ color: 'var(--color-brand)' }}>
        0/1 Knapsack — Watch Budget Optimizer
      </p>
      <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
        Given your watch time budget, the knapsack DP selects the optimal set of movies
        maximizing your predicted total enjoyment. The DP table will visualize here live.
      </p>
    </div>
  ),
  overview: (
    <div className="p-4">
      <p className="text-sm font-semibold mb-2" style={{ color: 'var(--color-brand)' }}>
        Active Engine
      </p>
      <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
        CineGraph runs three recommendation engines: Content-Based (cosine similarity on
        50-dimensional feature vectors), Collaborative (Floyd-Warshall transitive similarity
        + Pearson correlation), and Hybrid (phases based on your rating history).
      </p>
    </div>
  ),
};

export function AlgoDrawer() {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<DrawerTab>('mergesort');

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40" style={{ borderTop: '2px solid var(--color-brand)' }}>
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
                setOpen(false);
              } else {
                setActiveTab(id);
                setOpen(true);
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
        <div className="ml-auto">
          <button
            onClick={() => setOpen(o => !o)}
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
            style={{
              backgroundColor: 'var(--color-bg-elevated)',
              overflowY: 'auto',
            }}
          >
            {TAB_CONTENT[activeTab]}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
