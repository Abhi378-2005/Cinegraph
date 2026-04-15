// frontend/components/architecture/data/graphData.ts
import type { Node, Edge } from 'reactflow';

export type LayerType = 'user' | 'frontend' | 'backend' | 'data';

export interface NodeData {
  label: string;
  layer: LayerType;
  sublabel?: string;
  isSelected?: boolean; // managed by ArchitectureFlow, read by ComponentNode
}

export interface EdgeData {
  flowGroup: string;
  variant?: 'default' | 'dashed' | 'bold';
}

// ─── Layout constants ─────────────────────────────────────────────────────────
const Y = {
  user:      60,
  frontend:  220,
  beRoutes:  400,
  beAlgo:    560,
  beEngines: 720,
  data:      880,
};
const X0 = 190; // first node column (label occupies 0–170)
const DX = 215; // horizontal step between nodes

// ─── Nodes ───────────────────────────────────────────────────────────────────
export const initialNodes: Node<NodeData>[] = [
  // ── Layer labels (non-interactive) ──────────────────────────────────────
  { id: 'label-user',     type: 'layerLabel', position: { x: 10, y: Y.user },     data: { label: 'USER',     layer: 'user' } },
  { id: 'label-frontend', type: 'layerLabel', position: { x: 10, y: Y.frontend }, data: { label: 'FRONTEND', layer: 'frontend' } },
  { id: 'label-backend',  type: 'layerLabel', position: { x: 10, y: Y.beRoutes }, data: { label: 'BACKEND',  layer: 'backend' } },
  { id: 'label-data',     type: 'layerLabel', position: { x: 10, y: Y.data },     data: { label: 'DATA',     layer: 'data' } },

  // ── User layer ───────────────────────────────────────────────────────────
  { id: 'user-search',   type: 'component', position: { x: X0,          y: Y.user }, data: { label: 'Search Bar',   layer: 'user', sublabel: 'Navbar' } },
  { id: 'user-discover', type: 'component', position: { x: X0 + DX,     y: Y.user }, data: { label: 'Discover',     layer: 'user', sublabel: '/discover' } },
  { id: 'user-movie',    type: 'component', position: { x: X0 + DX * 2, y: Y.user }, data: { label: 'Movie Page',   layer: 'user', sublabel: '/movie/[id]' } },
  { id: 'user-graph',    type: 'component', position: { x: X0 + DX * 3, y: Y.user }, data: { label: 'Graph Page',   layer: 'user', sublabel: '/graph' } },

  // ── Frontend layer ───────────────────────────────────────────────────────
  { id: 'fe-searchbar',  type: 'component', position: { x: X0,          y: Y.frontend }, data: { label: 'SearchBar',     layer: 'frontend', sublabel: 'SearchBar.tsx' } },
  { id: 'fe-algoDrawer', type: 'component', position: { x: X0 + DX,     y: Y.frontend }, data: { label: 'AlgoDrawer',    layer: 'frontend', sublabel: 'AlgoDrawer.tsx' } },
  { id: 'fe-d3graph',    type: 'component', position: { x: X0 + DX * 2, y: Y.frontend }, data: { label: 'D3UserGraph',   layer: 'frontend', sublabel: 'D3UserGraph.tsx' } },
  { id: 'fe-profile',    type: 'component', position: { x: X0 + DX * 3, y: Y.frontend }, data: { label: 'ProfileDrawer', layer: 'frontend', sublabel: 'ProfileDrawer.tsx' } },

  // ── Backend — routes + socket ────────────────────────────────────────────
  { id: 'be-moviesRoute',    type: 'component', position: { x: X0,          y: Y.beRoutes }, data: { label: 'Movies Route',    layer: 'backend', sublabel: '/movies/*' } },
  { id: 'be-recommendRoute', type: 'component', position: { x: X0 + DX,     y: Y.beRoutes }, data: { label: 'Recommend Route', layer: 'backend', sublabel: 'POST /recommend' } },
  { id: 'be-rateRoute',      type: 'component', position: { x: X0 + DX * 2, y: Y.beRoutes }, data: { label: 'Rate Route',      layer: 'backend', sublabel: 'POST /rate' } },
  { id: 'be-graphRoute',     type: 'component', position: { x: X0 + DX * 3, y: Y.beRoutes }, data: { label: 'Graph Route',     layer: 'backend', sublabel: 'POST /graph/compute' } },
  { id: 'be-profileRoute',   type: 'component', position: { x: X0 + DX * 4, y: Y.beRoutes }, data: { label: 'Profile Route',   layer: 'backend', sublabel: 'GET /profile' } },
  { id: 'be-socket',         type: 'component', position: { x: X0 + DX * 5, y: Y.beRoutes }, data: { label: 'Socket.io Server', layer: 'backend', sublabel: 'socketServer.ts' } },

  // ── Backend — algorithms ─────────────────────────────────────────────────
  { id: 'be-mergeSort', type: 'component', position: { x: X0,          y: Y.beAlgo }, data: { label: 'MergeSort',      layer: 'backend', sublabel: 'O(n log n)' } },
  { id: 'be-knapsack',  type: 'component', position: { x: X0 + DX,     y: Y.beAlgo }, data: { label: 'Knapsack 0/1',   layer: 'backend', sublabel: 'O(n × budget)' } },
  { id: 'be-dijkstra',  type: 'component', position: { x: X0 + DX * 2, y: Y.beAlgo }, data: { label: 'Dijkstra',       layer: 'backend', sublabel: 'O((V+E) log V)' } },
  { id: 'be-floyd',     type: 'component', position: { x: X0 + DX * 3, y: Y.beAlgo }, data: { label: 'Floyd-Warshall', layer: 'backend', sublabel: 'O(V³)' } },
  { id: 'be-kruskal',   type: 'component', position: { x: X0 + DX * 4, y: Y.beAlgo }, data: { label: 'Kruskal MST',    layer: 'backend', sublabel: 'O(E log E)' } },

  // ── Backend — ML engines ─────────────────────────────────────────────────
  { id: 'be-content',   type: 'component', position: { x: X0,          y: Y.beEngines }, data: { label: 'Content Engine',  layer: 'backend', sublabel: 'phase: warming' } },
  { id: 'be-collab',    type: 'component', position: { x: X0 + DX,     y: Y.beEngines }, data: { label: 'Collab Engine',   layer: 'backend', sublabel: 'Pearson CF' } },
  { id: 'be-hybrid',    type: 'component', position: { x: X0 + DX * 2, y: Y.beEngines }, data: { label: 'Hybrid Engine',   layer: 'backend', sublabel: 'content + collab' } },
  { id: 'be-coldStart', type: 'component', position: { x: X0 + DX * 3, y: Y.beEngines }, data: { label: 'Cold Start',      layer: 'backend', sublabel: 'genre popularity' } },

  // ── Data layer ───────────────────────────────────────────────────────────
  { id: 'data-redis',    type: 'component', position: { x: X0,          y: Y.data }, data: { label: 'Redis',    layer: 'data', sublabel: 'Upstash (hot path)' } },
  { id: 'data-bigquery', type: 'component', position: { x: X0 + DX,     y: Y.data }, data: { label: 'BigQuery', layer: 'data', sublabel: 'GCP (cold/compute)' } },
  { id: 'data-tmdb',     type: 'component', position: { x: X0 + DX * 2, y: Y.data }, data: { label: 'TMDB API', layer: 'data', sublabel: 'Seeding source' } },
];

// ─── Edge helper ─────────────────────────────────────────────────────────────
function e(
  id: string,
  source: string,
  target: string,
  flowGroup: string,
  opts: { variant?: EdgeData['variant']; label?: string } = {}
): Edge<EdgeData> {
  return {
    id,
    source,
    target,
    type: 'animated',
    label: opts.label,
    data: { flowGroup, variant: opts.variant ?? 'default' },
  };
}

// ─── Edges ───────────────────────────────────────────────────────────────────
export const initialEdges: Edge<EdgeData>[] = [
  // ── Search flow ──────────────────────────────────────────────────────────
  e('s1', 'user-search',   'fe-searchbar',   'search'),
  e('s2', 'fe-searchbar',  'be-moviesRoute', 'search', { label: 'GET /movies/search' }),
  e('s3', 'be-moviesRoute','data-redis',     'search', { label: 'search:<q>:<g>' }),
  e('s4', 'data-redis',    'data-bigquery',  'search', { variant: 'dashed', label: 'MISS → LIKE query' }),
  e('s5', 'data-bigquery', 'data-redis',     'search', { variant: 'dashed', label: 'SETEX 3600s' }),
  e('s6', 'fe-searchbar',  'be-moviesRoute', 'search', { label: 'GET /movies/genres' }),
  e('s7', 'be-moviesRoute','data-redis',     'search', { label: 'movies:genres' }),
  e('s8', 'data-redis',    'data-bigquery',  'search', { variant: 'dashed', label: 'MISS → DISTINCT genres' }),
  e('s9', 'data-bigquery', 'data-redis',     'search', { variant: 'dashed', label: 'SETEX 86400s' }),

  // ── Movie detail flow ─────────────────────────────────────────────────────
  e('m1', 'user-movie',    'be-moviesRoute', 'movie-detail', { label: 'GET /movies/:id' }),
  e('m2', 'be-moviesRoute','data-redis',     'movie-detail', { label: 'movie:<id>' }),
  e('m3', 'data-redis',    'data-bigquery',  'movie-detail', { variant: 'dashed', label: 'MISS fallback' }),
  e('m4', 'be-moviesRoute','data-bigquery',  'movie-detail', { variant: 'bold', label: 'movie_similarity (always direct)' }),

  // ── Recommendation flow ───────────────────────────────────────────────────
  e('r1',  'user-discover',     'be-recommendRoute', 'recommend', { label: 'POST /recommend' }),
  e('r2',  'be-recommendRoute', 'be-content',        'recommend'),
  e('r3',  'be-recommendRoute', 'be-collab',         'recommend'),
  e('r4',  'be-recommendRoute', 'be-hybrid',         'recommend'),
  e('r5',  'be-recommendRoute', 'be-coldStart',      'recommend'),
  e('r6',  'be-hybrid',        'be-content',         'recommend', { label: 'parallel' }),
  e('r7',  'be-hybrid',        'be-collab',          'recommend', { label: 'parallel' }),
  e('r8',  'be-content',       'data-redis',         'recommend', { label: 'user ratings' }),
  e('r9',  'be-content',       'data-bigquery',      'recommend', { variant: 'bold', label: 'movie_similarity' }),
  e('r10', 'be-collab',        'data-redis',         'recommend', { label: 'all user ratings' }),
  e('r11', 'be-coldStart',     'data-redis',         'recommend', { label: 'popular:<genre>' }),
  e('r12', 'be-recommendRoute','be-mergeSort',       'recommend'),
  e('r13', 'be-mergeSort',     'be-knapsack',        'recommend', { label: 'if budget' }),
  e('r14', 'be-mergeSort',     'be-socket',          'recommend', { variant: 'bold', label: 'algo:step' }),
  e('r15', 'be-knapsack',      'be-socket',          'recommend', { variant: 'bold', label: 'algo:step' }),
  e('r16', 'be-socket',        'fe-algoDrawer',      'recommend', { variant: 'bold', label: 'recommend:ready' }),

  // ── Rating flow ───────────────────────────────────────────────────────────
  e('rt1', 'user-movie',  'be-rateRoute',  'rating', { label: 'POST /rate' }),
  e('rt2', 'be-rateRoute','data-redis',    'rating', { label: 'user:ratings + phase' }),
  e('rt3', 'be-rateRoute','data-bigquery', 'rating', { variant: 'dashed', label: 'async upsert (fire-and-forget)' }),

  // ── Graph compute flow ────────────────────────────────────────────────────
  e('g1', 'user-graph',   'be-graphRoute', 'graph', { label: 'POST /graph/compute' }),
  e('g2', 'be-graphRoute','data-redis',    'graph', { label: 'users:all + ratings' }),
  e('g3', 'be-graphRoute','be-kruskal',    'graph'),
  e('g4', 'be-graphRoute','be-floyd',      'graph'),
  e('g5', 'be-graphRoute','be-dijkstra',   'graph'),
  e('g6', 'be-kruskal',   'be-socket',     'graph', { variant: 'bold', label: 'graph:step' }),
  e('g7', 'be-floyd',     'be-socket',     'graph', { variant: 'bold', label: 'graph:step' }),
  e('g8', 'be-dijkstra',  'be-socket',     'graph', { variant: 'bold', label: 'graph:step' }),
  e('g9', 'be-socket',    'fe-d3graph',    'graph', { variant: 'bold', label: 'graph:complete' }),

  // ── Taste path flow (Socket.io direct) ───────────────────────────────────
  e('tp1', 'fe-d3graph', 'be-socket',   'tastepath', { variant: 'bold', label: 'tastepath:find' }),
  e('tp2', 'be-socket',  'data-redis',  'tastepath', { label: 'users + ratings' }),
  e('tp3', 'be-socket',  'be-dijkstra', 'tastepath'),
  e('tp4', 'be-socket',  'fe-d3graph',  'tastepath', { variant: 'bold', label: 'tastepath:result' }),

  // ── Profile flow ──────────────────────────────────────────────────────────
  e('p1', 'fe-profile',     'be-profileRoute', 'profile', { label: 'GET /profile' }),
  e('p2', 'be-profileRoute','data-redis',      'profile', { label: 'ratings + phase' }),
  e('p3', 'data-redis',     'data-bigquery',   'profile', { variant: 'dashed', label: 'MISS fallback' }),

  // ── Node expansion (top movies) ───────────────────────────────────────────
  e('ne1', 'fe-d3graph',    'be-profileRoute', 'node-expansion', { label: 'GET /profile/:id/top-movies' }),
  e('ne2', 'be-profileRoute','data-redis',     'node-expansion', { label: 'user ratings' }),

  // ── TMDB seeding (dashed — not runtime) ──────────────────────────────────
  e('tm1', 'data-tmdb', 'data-bigquery', 'seeding', { variant: 'dashed', label: 'seed migration only' }),
];
