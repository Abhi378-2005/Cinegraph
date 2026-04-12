'use client';
// frontend/components/architecture/nodes/ComponentNode.tsx

import { Handle, Position, type NodeProps } from 'reactflow';
import type { NodeData } from '@/components/architecture/data/graphData';

const LAYER_COLORS: Record<string, string> = {
  user:     '#3B82F6',
  frontend: '#10B981',
  backend:  '#7C3AED',
  data:     '#F59E0B',
};

// Nodes fade in layer-by-layer on page load via the arch-fade-in keyframe in globals.css
const LAYER_DELAY: Record<string, string> = {
  user:     '0ms',
  frontend: '150ms',
  backend:  '300ms',
  data:     '450ms',
};

export function ComponentNode({ data }: NodeProps<NodeData>) {
  const color    = LAYER_COLORS[data.layer] ?? '#888';
  const delay    = LAYER_DELAY[data.layer] ?? '0ms';
  const selected = data.isSelected ?? false;

  return (
    <>
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: color, width: 6, height: 6, border: 'none' }}
      />
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: color, width: 6, height: 6, border: 'none' }}
      />
      <div
        style={{
          position: 'relative',
          minWidth: 160,
          padding: '8px 14px 8px 18px',
          borderRadius: 8,
          border: `1.5px solid ${selected ? color : `${color}55`}`,
          backgroundColor: selected ? `${color}22` : 'var(--color-bg-card)',
          boxShadow: selected ? `0 0 14px ${color}55` : 'none',
          cursor: 'pointer',
          transition: 'border-color 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease',
          animationDelay: delay,
        }}
      >
        {/* Left accent bar */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 3,
            borderRadius: '8px 0 0 8px',
            backgroundColor: color,
          }}
        />
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-primary)' }}>
          {data.label}
        </div>
        {data.sublabel && (
          <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 2 }}>
            {data.sublabel}
          </div>
        )}
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: color, width: 6, height: 6, border: 'none' }}
      />
      <Handle
        type="source"
        position={Position.Right}
        style={{ background: color, width: 6, height: 6, border: 'none' }}
      />
    </>
  );
}
