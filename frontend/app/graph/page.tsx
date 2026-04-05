'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
import { socketEvents } from '@/lib/socket';
import { posterUrl } from '@/lib/formatters';
import { getOrCreateToken } from '@/lib/session';
import { D3UserGraph, type GraphHighlight } from '@/components/graph/D3UserGraph';
import { KruskalPanel } from '@/components/graph/KruskalPanel';
import { DijkstraPanel } from '@/components/graph/DijkstraPanel';
import { FloydWarshallPanel } from '@/components/graph/FloydWarshallPanel';
import type {
  MSTStep, DijkstraStep, FloydStep,
  GraphStepEvent, GraphCompleteEvent,
} from '@/lib/types';

type Tab = 'kruskal' | 'dijkstra' | 'floydWarshall';

const TAB_LABELS: Record<Tab, string> = {
  kruskal:       'Kruskal MST',
  dijkstra:      'Dijkstra Path',
  floydWarshall: 'Floyd-Warshall',
};

export default function GraphPage() {
  const graphSessionIdRef = useRef<string | null>(null);
  const currentUserId = getOrCreateToken();

  // ── Step buffers (refs = no re-renders during streaming) ──
  const kruskalStepsRef  = useRef<MSTStep[]>([]);
  const dijkstraStepsRef = useRef<DijkstraStep[]>([]);
  const floydStepsRef    = useRef<FloydStep[]>([]);

  // ── Graph data (set once on graph:complete) ──
  const [graphData, setGraphData] = useState<{
    userIds: string[];
    similarityMatrix: number[][];
    mstEdges: Array<{ u: string; v: string; weight: number }>;
    communities: string[][];
    dijkstraPath: string[];
    dijkstraTarget: string;
  } | null>(null);

  // ── Total steps per algo (enables Play buttons) ──
  const [kTotalSteps, setKTotalSteps] = useState(0);
  const [dTotalSteps, setDTotalSteps] = useState(0);
  const [fTotalSteps, setFTotalSteps] = useState(0);

  // ── Tab + replay state ──
  const [activeTab, setActiveTab] = useState<Tab>('kruskal');

  const [kPlaying, setKPlaying] = useState(false);
  const [kIndex,   setKIndex]   = useState(0);
  const [kSpeed,   setKSpeed]   = useState(120);

  const [dPlaying, setDPlaying] = useState(false);
  const [dIndex,   setDIndex]   = useState(0);
  const [dSpeed,   setDSpeed]   = useState(120);

  const [fPlaying, setFPlaying] = useState(false);
  const [fIndex,   setFIndex]   = useState(0);
  const [fSpeed,   setFSpeed]   = useState(120);

  // ── D3 highlight state ──
  const [highlight, setHighlight] = useState<GraphHighlight>({
    algorithm: null, step: null, dijkstraPath: [],
  });

  // ── Node expansion ──
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [expandedMovies, setExpandedMovies] = useState<Array<{
    movieId: number; title: string; posterPath: string;
  }>>([]);

  // ── Socket subscription (mount only) ──
  useEffect(() => {
    const offStep = socketEvents.onGraphStep((event: GraphStepEvent) => {
      if (event.graphSessionId !== graphSessionIdRef.current) return;
      if (event.algorithm === 'kruskal')       kruskalStepsRef.current.push(event.step as MSTStep);
      if (event.algorithm === 'dijkstra')      dijkstraStepsRef.current.push(event.step as DijkstraStep);
      if (event.algorithm === 'floydWarshall') floydStepsRef.current.push(event.step as FloydStep);
    });

    const offComplete = socketEvents.onGraphComplete((event: GraphCompleteEvent) => {
      if (event.graphSessionId !== graphSessionIdRef.current) return;
      setGraphData({
        userIds: event.userIds,
        similarityMatrix: event.similarityMatrix,
        mstEdges: event.mstEdges,
        communities: event.communities,
        dijkstraPath: event.dijkstraPath,
        dijkstraTarget: event.dijkstraTarget,
      });
      setKTotalSteps(kruskalStepsRef.current.length);
      setDTotalSteps(dijkstraStepsRef.current.length);
      setFTotalSteps(floydStepsRef.current.length);
    });

    api.computeGraph()
      .then(({ graphSessionId }) => { graphSessionIdRef.current = graphSessionId; })
      .catch(() => { /* backend offline — no-op */ });

    return () => { offStep(); offComplete(); };
  }, []);

  // ── Kruskal replay engine ──
  useEffect(() => {
    if (!kPlaying) return;
    if (kIndex >= kTotalSteps) { setKPlaying(false); return; }
    const step = kruskalStepsRef.current[kIndex];
    if (step) setHighlight({ algorithm: 'kruskal', step, dijkstraPath: [] });
    const t = setTimeout(() => setKIndex(i => i + 1), kSpeed);
    return () => clearTimeout(t);
  }, [kPlaying, kIndex, kTotalSteps, kSpeed]);

  // ── Dijkstra replay engine ──
  useEffect(() => {
    if (!dPlaying) return;
    if (dIndex >= dTotalSteps) { setDPlaying(false); return; }
    const step = dijkstraStepsRef.current[dIndex];
    if (step) setHighlight({ algorithm: 'dijkstra', step, dijkstraPath: step.path });
    const t = setTimeout(() => setDIndex(i => i + 1), dSpeed);
    return () => clearTimeout(t);
  }, [dPlaying, dIndex, dTotalSteps, dSpeed]);

  // ── Floyd-Warshall replay engine ──
  useEffect(() => {
    if (!fPlaying) return;
    if (fIndex >= fTotalSteps) { setFPlaying(false); return; }
    const step = floydStepsRef.current[fIndex];
    if (step) setHighlight({ algorithm: 'floydWarshall', step, dijkstraPath: [] });
    const t = setTimeout(() => setFIndex(i => i + 1), fSpeed);
    return () => clearTimeout(t);
  }, [fPlaying, fIndex, fTotalSteps, fSpeed]);

  // ── Reset highlight when tab changes ──
  useEffect(() => {
    setHighlight({ algorithm: null, step: null, dijkstraPath: [] });
  }, [activeTab]);

  // ── Node expansion ──
  const handleNodeClick = useCallback(async (userId: string) => {
    if (expandedUserId === userId) {
      setExpandedUserId(null);
      setExpandedMovies([]);
      return;
    }
    setExpandedUserId(userId);
    setExpandedMovies([]);
    try {
      const { movies } = await api.getTopMovies(userId);
      setExpandedMovies(movies.map(m => ({
        movieId: m.movieId,
        title: m.title,
        posterPath: m.posterPath,
      })));
    } catch { /* no-op */ }
  }, [expandedUserId]);

  return (
    <main className="min-h-screen pt-16" style={{ backgroundColor: 'var(--color-bg-base)' }}>
      {/* Mobile warning */}
      <div className="lg:hidden flex items-center justify-center min-h-[60vh] px-8 text-center">
        <div>
          <h2 className="text-xl font-bold text-white mb-2">Desktop Only</h2>
          <p style={{ color: 'var(--color-text-secondary)' }}>
            The Graph Explorer requires a desktop screen.
          </p>
        </div>
      </div>

      {/* Desktop layout */}
      <div className="hidden lg:flex flex-col h-[calc(100vh-64px)]">
        {/* Header */}
        <div className="px-8 py-4 flex-shrink-0">
          <h1 className="text-2xl font-bold text-white mb-1">User Similarity Graph</h1>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            User communities via Kruskal MST · Taste paths via Dijkstra · Similarity propagation via Floyd-Warshall
          </p>
        </div>

        {/* Main split */}
        <div className="flex flex-1 min-h-0 px-8 pb-6 gap-4">
          {/* D3 Graph — left 60% */}
          <div
            className="flex-[3] rounded-lg overflow-hidden relative"
            style={{ border: '1px solid var(--color-border)' }}
          >
            {graphData ? (
              <>
                <D3UserGraph
                  userIds={graphData.userIds}
                  similarityMatrix={graphData.similarityMatrix}
                  communities={graphData.communities}
                  mstEdges={graphData.mstEdges}
                  currentUserId={currentUserId}
                  highlight={highlight}
                  expandedUserId={expandedUserId}
                  expandedMovies={expandedMovies}
                  onNodeClick={handleNodeClick}
                />
                {/* Expanded node movie thumbnails */}
                <AnimatePresence>
                  {expandedUserId && expandedMovies.length > 0 && (
                    <motion.div
                      key="expanded"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      className="absolute bottom-4 left-4 flex gap-2"
                    >
                      {expandedMovies.map(m => (
                        <div
                          key={m.movieId}
                          className="flex flex-col items-center gap-1"
                          style={{ width: 56 }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={posterUrl(m.posterPath)}
                            alt={m.title}
                            className="rounded w-full"
                            style={{ border: '1px solid var(--color-border)' }}
                          />
                          <span
                            className="text-center leading-tight"
                            style={{ color: 'var(--color-text-muted)', fontSize: 9 }}
                          >
                            {m.title.slice(0, 16)}
                          </span>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            ) : (
              <div
                className="w-full h-full flex items-center justify-center text-sm"
                style={{ color: 'var(--color-text-muted)' }}
              >
                Computing graph…
              </div>
            )}
          </div>

          {/* Algorithm panels — right 40% */}
          <div
            className="flex-[2] flex flex-col rounded-lg overflow-hidden"
            style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg-card)' }}
          >
            {/* Tabs */}
            <div className="flex border-b flex-shrink-0" style={{ borderColor: 'var(--color-border)' }}>
              {(Object.keys(TAB_LABELS) as Tab[]).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className="flex-1 px-3 py-2.5 text-xs font-medium transition-colors"
                  style={{
                    color: activeTab === tab ? 'var(--color-brand)' : 'var(--color-text-muted)',
                    borderBottom: activeTab === tab ? '2px solid var(--color-brand)' : '2px solid transparent',
                    backgroundColor: 'transparent',
                  }}
                >
                  {TAB_LABELS[tab]}
                </button>
              ))}
            </div>

            {/* Panel content */}
            <div className="flex-1 overflow-hidden p-4 min-h-0">
              {activeTab === 'kruskal' && (
                <KruskalPanel
                  steps={kruskalStepsRef.current}
                  totalSteps={kTotalSteps}
                  playing={kPlaying}
                  index={kIndex}
                  replaySpeedMs={kSpeed}
                  onPlay={() => { if (kIndex >= kTotalSteps) setKIndex(0); setKPlaying(true); }}
                  onPause={() => setKPlaying(false)}
                  onSpeedChange={setKSpeed}
                />
              )}
              {activeTab === 'dijkstra' && (
                <DijkstraPanel
                  steps={dijkstraStepsRef.current}
                  totalSteps={dTotalSteps}
                  playing={dPlaying}
                  index={dIndex}
                  replaySpeedMs={dSpeed}
                  finalPath={graphData?.dijkstraPath ?? []}
                  sourceUserId={currentUserId}
                  targetUserId={graphData?.dijkstraTarget ?? ''}
                  onPlay={() => { if (dIndex >= dTotalSteps) setDIndex(0); setDPlaying(true); }}
                  onPause={() => setDPlaying(false)}
                  onSpeedChange={setDSpeed}
                />
              )}
              {activeTab === 'floydWarshall' && (
                <FloydWarshallPanel
                  steps={floydStepsRef.current}
                  totalSteps={fTotalSteps}
                  playing={fPlaying}
                  index={fIndex}
                  replaySpeedMs={fSpeed}
                  userIds={graphData?.userIds ?? []}
                  onPlay={() => { if (fIndex >= fTotalSteps) setFIndex(0); setFPlaying(true); }}
                  onPause={() => setFPlaying(false)}
                  onSpeedChange={setFSpeed}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
