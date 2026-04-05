'use client';

import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import type { MSTStep, DijkstraStep, FloydStep } from '@/lib/types';

interface GraphNode {
  id: string;
  ratingCount: number;
  communityIdx: number;
  isCurrent: boolean;
}

interface GraphEdge {
  source: string;
  target: string;
  weight: number;
  isMst: boolean;
}

export interface GraphHighlight {
  algorithm: 'kruskal' | 'dijkstra' | 'floydWarshall' | null;
  step: MSTStep | DijkstraStep | FloydStep | null;
  dijkstraPath: string[];
}

interface Props {
  userIds: string[];
  similarityMatrix: number[][];
  communities: string[][];
  mstEdges: Array<{ u: string; v: string; weight: number }>;
  currentUserId: string;
  highlight: GraphHighlight;
  expandedUserId: string | null;
  expandedMovies: Array<{ movieId: number; title: string; posterPath: string }>;
  onNodeClick: (userId: string) => void;
}

const COMMUNITY_COLORS = [
  '--viz-color-1',
  '--viz-color-2',
  '--viz-color-3',
  '--viz-color-4',
  '--viz-color-5',
  '--viz-node-default',
];

function resolveCssVar(varName: string): string {
  if (typeof window === 'undefined') return '#7C3AED';
  return getComputedStyle(document.documentElement)
    .getPropertyValue(varName)
    .trim() || '#7C3AED';
}

function communityColor(idx: number): string {
  return resolveCssVar(COMMUNITY_COLORS[idx % COMMUNITY_COLORS.length]);
}

export function D3UserGraph({
  userIds, similarityMatrix, communities, mstEdges,
  currentUserId, highlight, onNodeClick,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);

  // Build community lookup: userId → communityIdx
  const communityMap = new Map<string, number>();
  communities.forEach((group, gi) => group.forEach(uid => communityMap.set(uid, gi)));

  const mstSet = new Set(mstEdges.map(e => `${e.u}||${e.v}`));

  const nodes: GraphNode[] = userIds.map(id => ({
    id,
    ratingCount: 3,
    communityIdx: communityMap.get(id) ?? 5,
    isCurrent: id === currentUserId,
  }));

  const edges: GraphEdge[] = [];
  for (let i = 0; i < userIds.length; i++) {
    for (let j = i + 1; j < userIds.length; j++) {
      const w = similarityMatrix[i]?.[j] ?? 0;
      if (w > 0.3) {
        edges.push({
          source: userIds[i],
          target: userIds[j],
          weight: w,
          isMst: mstSet.has(`${userIds[i]}||${userIds[j]}`) || mstSet.has(`${userIds[j]}||${userIds[i]}`),
        });
      }
    }
  }

  // Build/rebuild simulation when graph data changes
  useEffect(() => {
    if (!svgRef.current || userIds.length === 0) return;

    const svg = d3.select(svgRef.current);
    const width = svgRef.current.clientWidth || 600;
    const height = svgRef.current.clientHeight || 400;

    svg.selectAll('*').remove();

    const g = svg.append('g');

    svg.call(
      d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.4, 3])
        .on('zoom', (event) => g.attr('transform', event.transform))
    );

    type SimNode = GraphNode & d3.SimulationNodeDatum;
    const simNodes: SimNode[] = nodes.map(n => ({ ...n }));
    const nodeById = new Map(simNodes.map(n => [n.id, n]));

    type SimEdge = {
      source: SimNode;
      target: SimNode;
      weight: number;
      isMst: boolean;
    };
    const simEdges: SimEdge[] = edges
      .map(e => {
        const s = nodeById.get(e.source);
        const t = nodeById.get(e.target);
        if (!s || !t) return null;
        return { source: s, target: t, weight: e.weight, isMst: e.isMst };
      })
      .filter((e): e is SimEdge => e !== null);

    const sim = d3.forceSimulation(simNodes)
      .force('link', d3.forceLink<SimNode, SimEdge>(simEdges)
        .id(d => d.id)
        .distance(80)
        .strength(0.4))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide(22));

    const link = g.append('g')
      .selectAll<SVGLineElement, SimEdge>('line')
      .data(simEdges)
      .join('line')
      .attr('stroke-opacity', d => 0.2 + d.weight * 0.6)
      .attr('stroke-width', d => d.isMst ? 2.5 : 1)
      .attr('stroke', d => d.isMst ? resolveCssVar('--viz-mst-edge') : resolveCssVar('--viz-node-default'));

    const node = g.append('g')
      .selectAll<SVGGElement, SimNode>('g')
      .data(simNodes)
      .join('g')
      .attr('cursor', 'pointer')
      .call(
        d3.drag<SVGGElement, SimNode>()
          .on('start', (event, d) => {
            if (!event.active) sim.alphaTarget(0.3).restart();
            d.fx = d.x; d.fy = d.y;
          })
          .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y; })
          .on('end', (event, d) => {
            if (!event.active) sim.alphaTarget(0);
            d.fx = null; d.fy = null;
          })
      )
      .on('click', (_event, d) => onNodeClick(d.id));

    node.append('circle')
      .attr('r', d => d.isCurrent ? 16 : 12)
      .attr('fill', d => communityColor(d.communityIdx))
      .attr('fill-opacity', 0.9)
      .attr('stroke', d => d.isCurrent ? resolveCssVar('--color-brand-bright') : resolveCssVar('--color-bg-base'))
      .attr('stroke-width', d => d.isCurrent ? 3 : 1.5);

    node.append('text')
      .text(d => d.id.slice(0, 4))
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('fill', 'white')
      .attr('font-size', 8)
      .attr('font-weight', '600')
      .attr('pointer-events', 'none');

    node.append('title').text(d => d.id);

    sim.on('tick', () => {
      link
        .attr('x1', d => (d.source as SimNode).x ?? 0)
        .attr('y1', d => (d.source as SimNode).y ?? 0)
        .attr('x2', d => (d.target as SimNode).x ?? 0)
        .attr('y2', d => (d.target as SimNode).y ?? 0);
      node.attr('transform', d => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    return () => { sim.stop(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userIds.join(','), JSON.stringify(mstEdges), communities.length]);

  // Apply highlight overlays — separate effect, no simulation restart
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);

    if (!highlight.algorithm) {
      // Reset edges to default colors
      svg.selectAll<SVGLineElement, GraphEdge>('line')
        .attr('stroke', d => d.isMst ? resolveCssVar('--viz-mst-edge') : resolveCssVar('--viz-node-default'));
      return;
    }

    if (highlight.algorithm === 'dijkstra') {
      const pathSet = new Set(highlight.dijkstraPath);
      const step = highlight.step as DijkstraStep | null;
      svg.selectAll<SVGCircleElement, GraphNode>('circle')
        .attr('fill', d => {
          if (step?.visitedUserId === d.id) return resolveCssVar('--color-brand');
          if (pathSet.has(d.id)) return resolveCssVar('--viz-dijkstra-path');
          return communityColor(d.communityIdx);
        });
    }

    if (highlight.algorithm === 'kruskal') {
      const step = highlight.step as MSTStep | null;
      if (step) {
        svg.selectAll<SVGLineElement, SimEdgeLike>('line')
          .attr('stroke', d => {
            const su = typeof d.source === 'object' ? (d.source as GraphNode).id : d.source as string;
            const sv = typeof d.target === 'object' ? (d.target as GraphNode).id : d.target as string;
            const matches = (su === step.edge.u && sv === step.edge.v) ||
                            (su === step.edge.v && sv === step.edge.u);
            if (!matches) return d.isMst ? resolveCssVar('--viz-mst-edge') : resolveCssVar('--viz-node-default');
            if (step.type === 'consider') return resolveCssVar('--color-star-active');
            if (step.type === 'add')      return resolveCssVar('--color-match');
            return resolveCssVar('--color-exclude');
          });
      }
    }
  }, [highlight]);

  return (
    <svg
      ref={svgRef}
      width="100%"
      height="100%"
      style={{ display: 'block', background: 'var(--color-bg-base)' }}
    />
  );
}

// Type alias for D3-mutated edge nodes (source/target become SimNode after layout)
type SimEdgeLike = { source: unknown; target: unknown; isMst: boolean };
