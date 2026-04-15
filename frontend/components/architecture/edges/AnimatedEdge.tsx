'use client';
// frontend/components/architecture/edges/AnimatedEdge.tsx

import { getBezierPath, type EdgeProps } from 'reactflow';
import type { EdgeData } from '@/components/architecture/data/graphData';

const FLOW_COLORS: Record<string, string> = {
  search:           '#3B82F6',
  'movie-detail':   '#10B981',
  recommend:        '#7C3AED',
  rating:           '#F59E0B',
  graph:            '#EC4899',
  tastepath:        '#06B6D4',
  profile:          '#84CC16',
  'node-expansion': '#84CC16',
  seeding:          '#6B7280',
};

export function AnimatedEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
  markerEnd,
}: EdgeProps<EdgeData>) {
  const [edgePath] = getBezierPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
  });

  const flowGroup    = data?.flowGroup ?? 'default';
  const variant      = data?.variant ?? 'default';
  const color        = FLOW_COLORS[flowGroup] ?? '#555555';
  const strokeWidth  = variant === 'bold' ? 2.5 : 1.5;
  const strokeDash   = variant === 'dashed' ? '6 4' : undefined;
  const baseOpacity  = selected ? 1 : 0.3;
  const dotOpacity   = selected ? 1 : 0.45;
  const animDuration = variant === 'bold' ? '1.2s' : '2s';

  return (
    <>
      {/* Base path */}
      <path
        id={id}
        d={edgePath}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={strokeDash}
        opacity={baseOpacity}
        markerEnd={markerEnd}
        style={{ transition: 'opacity 0.25s ease' }}
      />
      {/* Travelling dot */}
      <circle r={3} fill={color} opacity={dotOpacity}>
        <animateMotion
          dur={animDuration}
          repeatCount="indefinite"
          path={edgePath}
          keyPoints="0;1"
          keyTimes="0;1"
          calcMode="linear"
        />
      </circle>
    </>
  );
}
