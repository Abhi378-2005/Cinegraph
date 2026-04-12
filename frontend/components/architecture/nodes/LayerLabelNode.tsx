'use client';
// frontend/components/architecture/nodes/LayerLabelNode.tsx

import { type NodeProps } from 'reactflow';
import type { NodeData } from '@/components/architecture/data/graphData';

const LAYER_COLORS: Record<string, string> = {
  user:     '#3B82F6',
  frontend: '#10B981',
  backend:  '#7C3AED',
  data:     '#F59E0B',
};

export function LayerLabelNode({ data }: NodeProps<NodeData>) {
  const color = LAYER_COLORS[data.layer] ?? '#888';
  return (
    <div
      style={{
        width: 140,
        padding: '6px 12px',
        borderRadius: 6,
        border: `1px solid ${color}44`,
        backgroundColor: `${color}11`,
        color,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.1em',
        userSelect: 'none',
        pointerEvents: 'none',
      }}
    >
      {data.label}
    </div>
  );
}
