'use client';
// frontend/app/graph/page.tsx

import { useRef } from 'react';

// Static placeholder nodes with community clusters
const NODES = [
  // Action cluster (purple) — top-left
  { id: 'u1', x: 180, y: 140, community: 0, label: 'User 1' },
  { id: 'u2', x: 240, y: 100, community: 0, label: 'User 2' },
  { id: 'u3', x: 150, y: 200, community: 0, label: 'User 3' },
  { id: 'u4', x: 280, y: 160, community: 0, label: 'User 4' },
  // Drama cluster (blue) — top-right
  { id: 'u5', x: 480, y: 120, community: 1, label: 'User 5' },
  { id: 'u6', x: 540, y: 80,  community: 1, label: 'User 6' },
  { id: 'u7', x: 510, y: 170, community: 1, label: 'User 7' },
  { id: 'u8', x: 580, y: 130, community: 1, label: 'User 8' },
  // Sci-Fi cluster (green) — bottom-left
  { id: 'u9',  x: 160, y: 360, community: 2, label: 'User 9' },
  { id: 'u10', x: 220, y: 320, community: 2, label: 'User 10' },
  { id: 'u11', x: 180, y: 420, community: 2, label: 'User 11' },
  { id: 'u12', x: 260, y: 390, community: 2, label: 'User 12' },
  // Horror cluster (amber) — bottom-right
  { id: 'u13', x: 480, y: 380, community: 3, label: 'User 13' },
  { id: 'u14', x: 540, y: 330, community: 3, label: 'User 14' },
  { id: 'u15', x: 560, y: 420, community: 3, label: 'User 15' },
  { id: 'u16', x: 500, y: 450, community: 3, label: 'User 16' },
  // Mixed — center bridge nodes
  { id: 'u17', x: 340, y: 200, community: 4, label: 'User 17' },
  { id: 'u18', x: 380, y: 280, community: 4, label: 'User 18' },
  { id: 'u19', x: 340, y: 350, community: 4, label: 'User 19' },
  { id: 'u20', x: 400, y: 200, community: 4, label: 'User 20' },
];

const EDGES = [
  ['u1','u2'], ['u2','u3'], ['u3','u4'], ['u1','u4'],
  ['u5','u6'], ['u6','u7'], ['u7','u8'], ['u5','u8'],
  ['u9','u10'], ['u10','u11'], ['u11','u12'], ['u9','u12'],
  ['u13','u14'], ['u14','u15'], ['u15','u16'], ['u13','u16'],
  ['u4','u17'], ['u5','u20'], ['u17','u18'], ['u18','u19'],
  ['u19','u12'], ['u20','u18'],
];

const COMMUNITY_COLORS = [
  'var(--viz-color-1)',     // purple
  'var(--viz-color-2)',     // blue
  'var(--viz-color-3)',     // green
  'var(--viz-color-4)',     // amber
  'var(--viz-node-default)', // grey
];

const COMMUNITY_LABELS = ['Action', 'Drama', 'Sci-Fi', 'Horror', 'Mixed'];

export default function GraphPage() {
  const svgRef = useRef<SVGSVGElement>(null);

  return (
    <main
      className="min-h-screen pt-16"
      style={{ backgroundColor: 'var(--color-bg-base)' }}
    >
      {/* Mobile warning */}
      <div className="lg:hidden flex items-center justify-center min-h-[60vh] px-8 text-center">
        <div>
          <div className="text-5xl mb-4">🖥️</div>
          <h2 className="text-xl font-bold text-white mb-2">Desktop Only</h2>
          <p style={{ color: 'var(--color-text-secondary)' }}>
            The Graph Explorer requires a desktop screen for the D3 force layout visualization.
          </p>
        </div>
      </div>

      {/* Desktop content */}
      <div className="hidden lg:block">
        {/* Header */}
        <div className="px-8 py-6">
          <h1 className="text-2xl font-bold text-white mb-1">User Similarity Graph</h1>
          <p style={{ color: 'var(--color-text-secondary)' }} className="text-sm">
            User communities detected via Kruskal&apos;s MST · Taste paths via Dijkstra ·{' '}
            <span style={{ color: 'var(--color-brand)' }}>
              Live D3 visualization coming when backend is live
            </span>
          </p>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 px-8 mb-6">
          {COMMUNITY_LABELS.map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COMMUNITY_COLORS[i] }} />
              <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <div className="w-6 h-0.5" style={{ backgroundColor: 'var(--viz-mst-edge)' }} />
            <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>MST Edge</span>
          </div>
        </div>

        {/* Placeholder SVG graph */}
        <div className="px-8">
          <div
            className="rounded-lg overflow-hidden"
            style={{ backgroundColor: 'var(--color-bg-base)', border: '1px solid var(--color-border)' }}
          >
            <svg
              ref={svgRef}
              width="100%"
              viewBox="0 0 740 540"
              style={{ display: 'block' }}
            >
              {/* MST edges */}
              {EDGES.map(([a, b], i) => {
                const na = NODES.find(n => n.id === a)!;
                const nb = NODES.find(n => n.id === b)!;
                return (
                  <line
                    key={i}
                    x1={na.x} y1={na.y} x2={nb.x} y2={nb.y}
                    stroke="var(--viz-mst-edge)"
                    strokeWidth="1.5"
                    strokeOpacity="0.7"
                  />
                );
              })}

              {/* Nodes */}
              {NODES.map(node => (
                <g key={node.id}>
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={14}
                    fill={COMMUNITY_COLORS[node.community]}
                    opacity={0.9}
                    className="cursor-pointer"
                  >
                    <title>{`${node.label} · Click for taste path (live when backend is running)`}</title>
                  </circle>
                  <text
                    x={node.x}
                    y={node.y + 1}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="white"
                    fontSize="8"
                    fontWeight="600"
                    pointerEvents="none"
                  >
                    {node.id.replace('u', '')}
                  </text>
                </g>
              ))}
            </svg>
          </div>

          {/* Placeholder note */}
          <div
            className="mt-4 p-4 rounded text-sm"
            style={{ backgroundColor: 'var(--color-bg-elevated)', color: 'var(--color-text-secondary)' }}
          >
            <strong style={{ color: 'var(--color-brand)' }}>Placeholder visualization.</strong>{' '}
            When the backend is running, this will become a live D3 force-directed graph with
            Kruskal&apos;s MST community detection, animated edge building, and Dijkstra taste-path
            animation on node click.
          </div>
        </div>
      </div>
    </main>
  );
}
