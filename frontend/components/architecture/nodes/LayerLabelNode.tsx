'use client';
// frontend/components/architecture/nodes/LayerLabelNode.tsx

import { type NodeProps } from 'reactflow';
import type { NodeData } from '@/components/architecture/data/graphData';
import { LAYER_COLORS } from './layerColors';

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
