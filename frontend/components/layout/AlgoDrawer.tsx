'use client';
// frontend/components/layout/AlgoDrawer.tsx

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { socketEvents } from '@/lib/socket';
import type { AlgoStepEvent, AlgoCompleteEvent } from '@/lib/types';

type DrawerTab = 'mergesort' | 'knapsack' | 'overview';

const TABS: { id: DrawerTab; label: string }[] = [
  { id: 'mergesort', label: 'Merge Sort' },
  { id: 'knapsack',  label: 'Knapsack' },
  { id: 'overview',  label: 'Overview' },
];

interface AlgoState {
  steps: number;
  totalSteps: number;
  done: boolean;
  lastDecision?: string;
  lastRow?: number;
}

const EMPTY: AlgoState = { steps: 0, totalSteps: 0, done: false };

export function AlgoDrawer() {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<DrawerTab>('mergesort');
  const [mergeState, setMergeState] = useState<AlgoState>(EMPTY);
  const [knapsackState, setKnapsackState] = useState<AlgoState>(EMPTY);

  // Auto-open drawer when first algo:step arrives
  const hasAutoOpened = useRef(false);

  useEffect(() => {
    const unsubStep = socketEvents.onAlgoStep((event: AlgoStepEvent) => {
      if (!hasAutoOpened.current) {
        hasAutoOpened.current = true;
        setOpen(true);
      }

      if (event.algorithm === 'mergeSort') {
        setActiveTab('mergesort');
        setMergeState(prev => ({
          ...prev,
          steps: prev.steps + 1,
          done: false,
          lastDecision: (event.step as { type?: string }).type ?? undefined,
        }));
      } else if (event.algorithm === 'knapsack') {
        setActiveTab('knapsack');
        const step = event.step as { row?: number; decision?: string };
        setKnapsackState(prev => ({
          ...prev,
          steps: prev.steps + 1,
          done: false,
          lastRow: step.row,
          lastDecision: step.decision,
        }));
      }
    });

    const unsubComplete = socketEvents.onAlgoComplete((event: AlgoCompleteEvent) => {
      if (event.algorithm === 'mergeSort') {
        setMergeState(prev => ({ ...prev, totalSteps: event.totalSteps, done: true }));
      } else if (event.algorithm === 'knapsack') {
        setKnapsackState(prev => ({ ...prev, totalSteps: event.totalSteps, done: true }));
      }
    });

    return () => { unsubStep(); unsubComplete(); };
  }, []);

  const renderMerge = () => (
    <div className="p-4 space-y-3">
      <p className="text-sm font-semibold" style={{ color: 'var(--color-brand)' }}>
        Merge Sort — Recommendation Ranking
      </p>
      {mergeState.steps === 0 ? (
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Sorts your recommendations by predicted score using Merge Sort (O(n log n)).
          Steps will appear here when the engine runs.
        </p>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <div className="flex-1 rounded-full h-2 overflow-hidden" style={{ backgroundColor: 'var(--color-bg-card)' }}>
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: 'var(--color-brand)' }}
                animate={{ width: mergeState.done ? '100%' : `${Math.min(100, (mergeState.steps / Math.max(mergeState.totalSteps || mergeState.steps, 1)) * 100)}%` }}
                transition={{ duration: 0.1 }}
              />
            </div>
            <span className="text-xs tabular-nums" style={{ color: 'var(--color-text-muted)' }}>
              {mergeState.steps} steps
            </span>
          </div>
          <div className="flex gap-4 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            <span>Status: <span style={{ color: mergeState.done ? '#4ade80' : 'var(--color-brand)' }}>{mergeState.done ? 'Complete ✓' : 'Running…'}</span></span>
            {mergeState.lastDecision && (
              <span>Last op: <span className="font-mono" style={{ color: 'var(--color-brand)' }}>{mergeState.lastDecision}</span></span>
            )}
            {mergeState.done && mergeState.totalSteps > 0 && (
              <span>Total: {mergeState.totalSteps} steps</span>
            )}
          </div>
        </>
      )}
    </div>
  );

  const renderKnapsack = () => (
    <div className="p-4 space-y-3">
      <p className="text-sm font-semibold" style={{ color: 'var(--color-brand)' }}>
        0/1 Knapsack — Watch Budget Optimizer
      </p>
      {knapsackState.steps === 0 ? (
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Selects movies maximizing enjoyment within your watch-time budget.
          DP table steps will appear here when the engine runs.
        </p>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <div className="flex-1 rounded-full h-2 overflow-hidden" style={{ backgroundColor: 'var(--color-bg-card)' }}>
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: '#a78bfa' }}
                animate={{ width: knapsackState.done ? '100%' : `${Math.min(100, (knapsackState.steps / Math.max(knapsackState.totalSteps || knapsackState.steps, 1)) * 100)}%` }}
                transition={{ duration: 0.1 }}
              />
            </div>
            <span className="text-xs tabular-nums" style={{ color: 'var(--color-text-muted)' }}>
              row {knapsackState.lastRow ?? 0}
            </span>
          </div>
          <div className="flex gap-4 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            <span>Status: <span style={{ color: knapsackState.done ? '#4ade80' : '#a78bfa' }}>{knapsackState.done ? 'Complete ✓' : 'Running…'}</span></span>
            {knapsackState.lastDecision && (
              <span>
                Decision:{' '}
                <span style={{ color: knapsackState.lastDecision === 'include' ? '#4ade80' : 'var(--color-text-muted)' }}>
                  {knapsackState.lastDecision}
                </span>
              </span>
            )}
            {knapsackState.done && knapsackState.totalSteps > 0 && (
              <span>Total: {knapsackState.totalSteps} items evaluated</span>
            )}
          </div>
        </>
      )}
    </div>
  );

  const renderOverview = () => (
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
  );

  const tabContent: Record<DrawerTab, React.ReactNode> = {
    mergesort: renderMerge(),
    knapsack:  renderKnapsack(),
    overview:  renderOverview(),
  };

  const hasActivity = mergeState.steps > 0 || knapsackState.steps > 0;

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
        <div className="ml-auto flex items-center gap-2">
          {hasActivity && !open && (
            <span className="text-xs animate-pulse" style={{ color: 'var(--color-brand)' }}>● live</span>
          )}
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
            {tabContent[activeTab]}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
