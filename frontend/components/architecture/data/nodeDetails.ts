// frontend/components/architecture/data/nodeDetails.ts

export interface NodeDetail {
  title: string;
  description: string;
  facts: { label: string; value: string }[];
  filePath?: string;
}

export const nodeDetails: Record<string, NodeDetail> = {
  'user-search': {
    title: 'Search Bar',
    description: 'Expandable search input in the Navbar. Debounces input 400ms before firing requests. Shows genre chips (empty state) or up to 8 movie result cards. A generation counter prevents stale fetch results from overwriting newer ones.',
    facts: [
      { label: 'Debounce', value: '400ms' },
      { label: 'Max results', value: '8 movies' },
      { label: 'Genre chips', value: 'Substring filtered (e.g. "act" → "Action")' },
      { label: 'Race prevention', value: 'Generation counter (searchGenRef)' },
    ],
    filePath: 'frontend/components/layout/SearchBar.tsx',
  },
  'user-discover': {
    title: 'Discover Page',
    description: 'Main recommendation page. User picks an engine and optional watch-time budget. Fires POST /recommend and immediately gets a sessionId. Listens on Socket.io for algo:step, algo:complete, and recommend:ready to drive the AlgoDrawer and movie list.',
    facts: [
      { label: 'Route', value: '/discover' },
      { label: 'Socket events received', value: 'algo:step, algo:complete, recommend:ready' },
      { label: 'Engines available', value: 'Content, Collaborative, Hybrid, Cold Start' },
    ],
    filePath: 'frontend/app/discover/page.tsx',
  },
  'user-movie': {
    title: 'Movie Page',
    description: 'Full movie detail: poster, overview, cast, director, genres, runtime. GET /movies/:id returns both the movie and top-6 similar movies from BigQuery movie_similarity. User rates 1–5 stars via POST /rate.',
    facts: [
      { label: 'Route', value: '/movie/[id]' },
      { label: 'Endpoints', value: 'GET /movies/:id, POST /rate' },
      { label: 'Similar movies', value: 'Top 6 from BigQuery movie_similarity (always direct)' },
    ],
    filePath: 'frontend/app/movie/[id]/page.tsx',
  },
  'user-graph': {
    title: 'Graph Page',
    description: 'Live D3 user-similarity graph. Fires POST /graph/compute then streams Kruskal, Floyd-Warshall, and Dijkstra steps via Socket.io. Clicking a user node expands to show their top 3 rated movies fetched from /profile/:id/top-movies.',
    facts: [
      { label: 'Route', value: '/graph' },
      { label: 'Max users', value: '20 (capped from users:all set)' },
      { label: 'Socket events', value: 'graph:step, graph:complete' },
      { label: 'Taste path', value: 'Socket.io tastepath:find (direct, no REST)' },
    ],
    filePath: 'frontend/app/graph/page.tsx',
  },
  'fe-searchbar': {
    title: 'SearchBar + SearchDropdown',
    description: 'SearchBar owns expand/collapse animation, debounce timer, query, genre, and result state. SearchDropdown renders genre chips or movie result cards. Click outside (mousedown listener) or Escape collapses and clears. useCallback + generation counter prevent stale closures and race conditions.',
    facts: [
      { label: 'State', value: 'isExpanded, query, genre, results, genres, loading, error' },
      { label: 'Collapse trigger', value: 'Click outside (mousedown) or Escape' },
      { label: 'Stale closure fix', value: 'collapse wrapped in useCallback([])' },
    ],
    filePath: 'frontend/components/layout/SearchBar.tsx',
  },
  'fe-algoDrawer': {
    title: 'AlgoDrawer',
    description: 'Replays MergeSort and Knapsack steps received via Socket.io. Steps are pushed to refs (not state) on each algo:step event — only algo:complete triggers a re-render to enable Play. Two independent useEffect replay loops drive the cursor via setTimeout chains.',
    facts: [
      { label: 'Steps storage', value: 'useRef arrays — zero re-renders per step' },
      { label: 'Play enabled by', value: 'algo:complete sets msTotalSteps/ksTotalSteps state' },
      { label: 'Session correlation', value: 'currentSessionIdRef avoids stale socket handler' },
      { label: 'Animations', value: 'Framer Motion (layout + layoutId on poster cards)' },
    ],
    filePath: 'frontend/components/layout/AlgoDrawer.tsx',
  },
  'fe-d3graph': {
    title: 'D3UserGraph',
    description: 'Force-directed SVG graph. User nodes sized by rating count. MST edges from Kruskal form the backbone. Dijkstra path highlighted. Floyd-Warshall heatmap overlay. tastepath:find is emitted directly on Socket.io — no REST call.',
    facts: [
      { label: 'Library', value: 'D3.js force simulation' },
      { label: 'Communities', value: 'Colored clusters from Kruskal result' },
      { label: 'Node expansion', value: 'GET /profile/:id/top-movies on click' },
      { label: 'Panels', value: 'KruskalPanel, DijkstraPanel, FloydWarshallPanel' },
    ],
    filePath: 'frontend/components/graph/D3UserGraph.tsx',
  },
  'fe-profile': {
    title: 'ProfileDrawer',
    description: 'Slide-in drawer showing user phase, rating count, and all rated movies. Opens on avatar click in the Navbar. Fetches GET /profile on open. Phase badge (COLD / WARMING / FULL) updates in the Navbar after each rating.',
    facts: [
      { label: 'Endpoint', value: 'GET /profile' },
      { label: 'Phases', value: 'cold (<5), warming (5–19), full (≥20)' },
      { label: 'Animation', value: 'Framer Motion slide-in' },
    ],
    filePath: 'frontend/components/layout/ProfileDrawer.tsx',
  },
  'be-moviesRoute': {
    title: 'Movies Route',
    description: 'Three endpoints. Route order matters — /genres and /search are registered before /:id to prevent Express treating them as numeric ID params. search requires at least one of q or genre (400 otherwise). /:id returns movie + top-6 similar, fetching similarity directly from BigQuery.',
    facts: [
      { label: 'GET /movies/genres', value: 'Distinct genre list (Redis-cached, 24h TTL)' },
      { label: 'GET /movies/search', value: '?q= + ?genre=, 400 if both empty' },
      { label: 'GET /movies/:id', value: '{ movie, similar: Movie[] }' },
      { label: 'Similarity cache', value: 'None — movie_similarity always hits BigQuery' },
    ],
    filePath: 'backend/src/routes/movies.ts',
  },
  'be-recommendRoute': {
    title: 'Recommend Route',
    description: 'POST /recommend returns { sessionId } immediately, then runs an async IIFE: getRecommendations → mergeSort → (optional) knapsack → emit recommend:ready via Socket.io. The emitter is set by socketServer after init via setEmitter().',
    facts: [
      { label: 'Pattern', value: 'Fire-and-forget async IIFE' },
      { label: 'Immediate response', value: '{ sessionId }' },
      { label: 'Step delay', value: '16ms between emissions (≈60fps)' },
      { label: 'Socket events', value: 'algo:step, algo:complete, recommend:ready, recommend:error' },
    ],
    filePath: 'backend/src/routes/recommend.ts',
  },
  'be-rateRoute': {
    title: 'Rate Route',
    description: 'POST /rate writes rating to Redis synchronously (blocking), recomputes phase, then fire-and-forgets a BigQuery upsert. Returns { success, newPhase, ratingsCount } immediately after Redis writes complete. BigQuery failure is logged but not surfaced to the client.',
    facts: [
      { label: 'Validation', value: 'zod — movieId: int+, rating: 1–5' },
      { label: 'Redis writes', value: 'user:<id>:ratings hash, users:all set, user:<id>:phase' },
      { label: 'BigQuery', value: 'upsertRating — async, non-blocking, non-fatal' },
      { label: 'Response', value: '{ success, newPhase, ratingsCount }' },
    ],
    filePath: 'backend/src/routes/rate.ts',
  },
  'be-graphRoute': {
    title: 'Graph Route',
    description: 'POST /graph/compute returns { graphSessionId } immediately, then async: fetches ≤20 users from Redis, builds Pearson similarity matrix in-memory (no DB), runs Kruskal → Floyd-Warshall → Dijkstra, streaming graph:step events. Emits graph:complete with full matrix + MST edges + communities.',
    facts: [
      { label: 'Pattern', value: 'Fire-and-forget async IIFE' },
      { label: 'Matrix', value: 'Pearson correlation — computed in-memory, no DB write' },
      { label: 'Floyd steps', value: 'Only matrixSnapshot steps emitted (not all O(V³))' },
      { label: 'Dijkstra target', value: 'Current user → closest neighbour by similarity' },
    ],
    filePath: 'backend/src/routes/graph.ts',
  },
  'be-profileRoute': {
    title: 'Profile Route',
    description: 'GET /profile returns phase, ratingsCount, nextPhaseAt, and full ratedMovies array (sorted by rating desc). GET /profile/:userId/top-movies returns top 3 movies by rating for a user node — used by D3UserGraph node expansion. Both read only from Redis (with movie:<id> BQ fallback).',
    facts: [
      { label: 'GET /profile', value: 'Full rated movie list with poster + metadata' },
      { label: 'GET /profile/:id/top-movies', value: 'Top 3 for D3 node expansion' },
      { label: 'nextPhaseAt', value: 'null if already full, 5 if cold, 20 if warming' },
    ],
    filePath: 'backend/src/routes/profile.ts',
  },
  'be-socket': {
    title: 'Socket.io Server',
    description: 'Maintains a userId → socketId map. Auth middleware validates handshake.auth.token. Wires two emitter functions to REST routes via setEmitter / setGraphEmitter. Also handles tastepath:find events directly — builds Pearson matrix inline and runs Dijkstra, emitting steps back to the same socket.',
    facts: [
      { label: 'Auth', value: 'handshake.auth.token (session UUID)' },
      { label: 'Emitters wired', value: 'setEmitter (recommend), setGraphEmitter (graph)' },
      { label: 'Direct event', value: 'tastepath:find → Dijkstra → tastepath:result' },
      { label: 'CORS', value: 'FRONTEND_URL env var (Railway)' },
    ],
    filePath: 'backend/src/socket/socketServer.ts',
  },
  'be-mergeSort': {
    title: 'MergeSort',
    description: 'Sorts recommendations by score descending. Each split, compare, merge, and place operation is recorded as a MergeSortStep. The AlgoDrawer replays these with Framer Motion layout animations on poster cards.',
    facts: [
      { label: 'Complexity', value: 'O(n log n)' },
      { label: 'Input', value: 'Recommendation[] unsorted' },
      { label: 'Output', value: '{ sorted: Recommendation[], steps: MergeSortStep[] }' },
      { label: 'Step types', value: 'split, merge, compare, place' },
    ],
    filePath: 'backend/src/algorithms/mergeSort.ts',
  },
  'be-knapsack': {
    title: '0/1 Knapsack',
    description: 'Selects the subset of sorted recommendations that maximises total score within a watch-time budget (minutes). Bottom-up DP. Each cell fill emits a KnapsackStep showing row, col, value, decision, and a dpSnapshot matrix.',
    facts: [
      { label: 'Complexity', value: 'O(n × budget)' },
      { label: 'Weight', value: 'movie.runtime (minutes)' },
      { label: 'Value', value: 'recommendation.score' },
      { label: 'Triggered when', value: 'budget param provided in POST /recommend' },
    ],
    filePath: 'backend/src/algorithms/knapsack.ts',
  },
  'be-dijkstra': {
    title: 'Dijkstra',
    description: 'Used in two contexts: (1) Graph route — finds shortest similarity path from current user to their closest neighbour. (2) Socket.io tastepath:find — finds path between any two selected users. Edge weight = 1 − similarity (lower = closer). Each step emits visitedUserId, distance, frontier, path.',
    facts: [
      { label: 'Complexity', value: 'O((V+E) log V)' },
      { label: 'Edge weight', value: '1 − similarity score' },
      { label: 'Context 1', value: 'graph route — current user to closest neighbour' },
      { label: 'Context 2', value: 'tastepath:find — any source to any target' },
    ],
    filePath: 'backend/src/algorithms/dijkstra.ts',
  },
  'be-floyd': {
    title: 'Floyd-Warshall',
    description: 'All-pairs shortest paths on the user similarity graph. Full O(V³) runs but only matrixSnapshot steps are emitted (not every iteration) to keep visualization manageable. FloydWarshallPanel renders the distance matrix as a heatmap.',
    facts: [
      { label: 'Complexity', value: 'O(V³)' },
      { label: 'Emitted steps', value: 'matrixSnapshot steps only' },
      { label: 'Visualized in', value: 'FloydWarshallPanel.tsx (heatmap grid)' },
    ],
    filePath: 'backend/src/algorithms/floydWarshall.ts',
  },
  'be-kruskal': {
    title: "Kruskal's MST",
    description: "Builds the minimum spanning tree of the user similarity graph. Used to detect communities (clusters of similar users). Union-Find with path compression. MST edges become the backbone of D3UserGraph. Communities color the node clusters.",
    facts: [
      { label: 'Complexity', value: 'O(E log E)' },
      { label: 'Data structure', value: 'Union-Find (path compression)' },
      { label: 'Output', value: '{ mstEdges, communities: string[][], steps: MSTStep[] }' },
      { label: 'Step types', value: 'add, reject, consider' },
    ],
    filePath: 'backend/src/algorithms/kruskal.ts',
  },
  'be-content': {
    title: 'Content-Based Engine',
    description: "Active when phase='warming' or engine='content'. Reads user ratings from Redis, then for each rated movie queries BigQuery's movie_similarity table directly (no Redis cache for similarity). Scores candidate movies by similarity × (rating/5). Returns top-N by blended score.",
    facts: [
      { label: 'Phase', value: 'warming (5–19 ratings)' },
      { label: 'Similarity', value: 'BigQuery movie_similarity — always direct, no cache' },
      { label: 'Candidates', value: 'Top 50 similar per rated movie' },
      { label: 'Scoring', value: 'similarity_score × (rating / 5)' },
    ],
    filePath: 'backend/src/ml/contentBased.ts',
  },
  'be-collab': {
    title: 'Collaborative Engine',
    description: "Active when engine='collaborative'. Computes Pearson correlation between current user and every user in Redis users:all. Takes top K=10 neighbours. Predicts unseen movie ratings with weighted-sum CF formula. Pure Redis — no BigQuery queries.",
    facts: [
      { label: 'Algorithm', value: 'Pearson CF, top-K=10 neighbours' },
      { label: 'Data source', value: 'Redis only (user:*:ratings hashes)' },
      { label: 'Formula', value: 'user_mean + Σ(sim × deviation) / Σ|sim|' },
    ],
    filePath: 'backend/src/ml/collaborative.ts',
  },
  'be-hybrid': {
    title: 'Hybrid Engine',
    description: "Active when phase='full' or engine='hybrid'. Runs content-based and collaborative in parallel via Promise.all, then round-robin interleaves results (content[0], collab[0], content[1], collab[1], …). Deduplicates by movieId. Returns top-N from the blended list.",
    facts: [
      { label: 'Phase', value: 'full (≥20 ratings)' },
      { label: 'Parallelism', value: 'Promise.all([contentBased, collaborative])' },
      { label: 'Blend', value: 'Round-robin interleave, dedup by movieId' },
    ],
    filePath: 'backend/src/ml/hybrid.ts',
  },
  'be-coldStart': {
    title: 'Cold Start Engine',
    description: "Active when phase='cold' (<5 ratings) or engine='cold_start'. Reads preferred genres from Redis (set during onboarding). Fetches popular:<genre> sorted sets from Redis (BQ fallback). Scores movies by voteAverage×0.7 + popularity/1000×0.3. Defaults to Action + Drama if no genres set.",
    facts: [
      { label: 'Phase', value: 'cold (<5 ratings)' },
      { label: 'Data', value: 'Redis popular:<genre> sorted sets' },
      { label: 'BQ fallback', value: 'getBQPopular() if Redis MISS' },
      { label: 'Score', value: 'voteAverage × 0.7 + (popularity/1000) × 0.3' },
    ],
    filePath: 'backend/src/ml/contentBased.ts',
  },
  'data-redis': {
    title: 'Redis — Upstash',
    description: 'Primary hot-path store. All reads go here first. Upstash serverless Redis via REST API. Stores movies, user ratings and phases, search results cache, genre list cache, and popularity sorted sets. Falls back to BigQuery on MISS and caches the result.',
    facts: [
      { label: 'Hosting', value: 'Upstash (serverless REST)' },
      { label: 'movie:<id>', value: 'Hash — full movie object' },
      { label: 'user:<id>:ratings', value: 'Hash — movieId → rating' },
      { label: 'user:<id>:phase', value: 'String — cold / warming / full' },
      { label: 'search:<q>:<g>', value: 'JSON Movie[] — TTL 1h' },
      { label: 'movies:genres', value: 'JSON string[] — TTL 24h' },
      { label: 'popular:<genre>', value: 'Sorted set — movieId by popularity score' },
      { label: 'users:all', value: 'Set — all session tokens' },
    ],
    filePath: 'backend/src/redis/client.ts',
  },
  'data-bigquery': {
    title: 'BigQuery — GCP',
    description: 'Cold/compute path. Holds the full movie catalogue, precomputed 40-dim feature vectors, and top-50 similarity entries per movie computed by VECTOR_SEARCH. Redis falls back to BigQuery on MISS and caches the result. movie_similarity is always queried directly — no Redis cache for it.',
    facts: [
      { label: 'Hosting', value: 'GCP (US region)' },
      { label: 'movies', value: 'Full catalogue — title, cast, genres, overview, vectors' },
      { label: 'movie_features', value: '40-dim vectors: 19 genre one-hots + cast + keywords + stats' },
      { label: 'movie_similarity', value: 'Top-50 similar per movie — always queried directly' },
    ],
    filePath: 'backend/src/bigquery/client.ts',
  },
  'data-tmdb': {
    title: 'TMDB API',
    description: 'The Movie Database. Used only during seeding/migration — not at runtime. Fetches movie metadata (title, overview, cast, genres, poster, keywords) which is processed and uploaded to BigQuery. After seeding, TMDB is not required for app operation.',
    facts: [
      { label: 'Usage', value: 'Seeding / migration only (not runtime)' },
      { label: 'Data', value: 'Title, overview, cast, director, genres, keywords, poster_path' },
      { label: 'Rate limit', value: '40 req / 10s (free tier)' },
      { label: 'Image base URL', value: 'https://image.tmdb.org/t/p/w500' },
    ],
    filePath: 'backend/src/tmdb/fetcher.ts',
  },
};
