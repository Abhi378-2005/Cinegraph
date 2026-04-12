'use client';
// frontend/components/architecture/ArchitectureFlow.tsx

import { useCallback, useState } from 'react';
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type NodeMouseHandler,
  type EdgeMouseHandler,
  type Node,
  type Edge,
} from 'reactflow';
import 'reactflow/dist/style.css';

import {
  initialNodes,
  initialEdges,
  type NodeData,
  type EdgeData,
} from '@/components/architecture/data/graphData';
import { ComponentNode }    from '@/components/architecture/nodes/ComponentNode';
import { LayerLabelNode }   from '@/components/architecture/nodes/LayerLabelNode';
import { AnimatedEdge }     from '@/components/architecture/edges/AnimatedEdge';
import { NodeDetailDrawer } from '@/components/architecture/NodeDetailDrawer';

const nodeTypes = {
  component:  ComponentNode,
  layerLabel: LayerLabelNode,
} as const;

const edgeTypes = {
  animated: AnimatedEdge,
} as const;

export function ArchitectureFlow() {
  const [nodes, , onNodesChange] = useNodesState<NodeData>(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState<EdgeData>(initialEdges);

  const [selectedNodeId,    setSelectedNodeId]    = useState<string | null>(null);
  const [selectedFlowGroup, setSelectedFlowGroup] = useState<string | null>(null);

  // Node click: toggle drawer; clear flow highlight
  const onNodeClick: NodeMouseHandler = useCallback((_evt, node: Node<NodeData>) => {
    if (node.type === 'layerLabel') return;
    setSelectedNodeId(prev => prev === node.id ? null : node.id);
    setSelectedFlowGroup(null);
  }, []);

  // Edge click: toggle flow highlight; close drawer
  const onEdgeClick: EdgeMouseHandler = useCallback((_evt, edge: Edge<EdgeData>) => {
    const group = edge.data?.flowGroup ?? null;
    setSelectedFlowGroup(prev => prev === group ? null : group);
    setSelectedNodeId(null);
  }, []);

  // Click on empty canvas: clear everything
  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedFlowGroup(null);
  }, []);

  // Derive display nodes: inject isSelected into data, apply flow-dim opacity
  const displayNodes = nodes.map(node => {
    const inFlow = selectedFlowGroup
      ? edges.some(e => e.data?.flowGroup === selectedFlowGroup && (e.source === node.id || e.target === node.id))
      : true;
    return {
      ...node,
      data: { ...node.data, isSelected: node.id === selectedNodeId },
      style: {
        ...node.style,
        opacity:    selectedFlowGroup ? (inFlow ? 1 : 0.15) : 1,
        transition: 'opacity 0.2s ease',
      },
    };
  });

  // Derive display edges: selected edge group fully opaque, rest dimmed
  const displayEdges = edges.map(edge => ({
    ...edge,
    selected: selectedFlowGroup ? edge.data?.flowGroup === selectedFlowGroup : false,
    style: {
      ...edge.style,
      opacity:    selectedFlowGroup ? (edge.data?.flowGroup === selectedFlowGroup ? 1 : 0.06) : 1,
      transition: 'opacity 0.2s ease',
    },
  }));

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>

      {/* Flow name label shown when a flow group is selected */}
      {selectedFlowGroup && (
        <div
          style={{
            position:        'absolute',
            top:             80,
            left:            '50%',
            transform:       'translateX(-50%)',
            zIndex:          10,
            backgroundColor: 'var(--color-bg-elevated)',
            border:          '1px solid var(--color-card-border)',
            borderRadius:    8,
            padding:         '6px 18px',
            fontSize:        12,
            fontWeight:      600,
            color:           'var(--color-text-primary)',
            letterSpacing:   '0.05em',
            textTransform:   'capitalize',
            pointerEvents:   'none',
          }}
        >
          {selectedFlowGroup.replace(/-/g, ' ')} flow — click canvas to clear
        </div>
      )}

      <ReactFlow
        nodes={displayNodes}
        edges={displayEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        fitView
        fitViewOptions={{ padding: 0.12 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        defaultEdgeOptions={{ type: 'animated' }}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#2a2a2a" />
        <Controls
          showInteractive={false}
          style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-card-border)' }}
        />
        <MiniMap
          nodeColor={(n) => {
            const layer = (n.data as NodeData)?.layer;
            const map: Record<string, string> = {
              user: '#3B82F6', frontend: '#10B981', backend: '#7C3AED', data: '#F59E0B',
            };
            return map[layer ?? ''] ?? '#444';
          }}
          style={{ backgroundColor: '#111', border: '1px solid var(--color-card-border)' }}
          maskColor="rgba(0,0,0,0.6)"
        />
      </ReactFlow>

      <NodeDetailDrawer nodeId={selectedNodeId} onClose={() => setSelectedNodeId(null)} />
    </div>
  );
}
