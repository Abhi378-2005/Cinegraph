# CineGraph Frontend Design

**Date:** 2026-03-03
**Scope:** Complete `frontend/` implementation — Netflix-inspired dark UI with purple brand, no backend dependency (mock fallback), all 4 pages.

## Decisions Made

| Question | Decision |
|---|---|
| Backend not ready | Real API calls + graceful fallback to local mock JSON |
| D3 visualizations | Placeholder static versions now; full animations when backend ships |
| Merge Sort card animation | Skip for now; cards populate without stagger |
| Cold start onboarding | Enforced on first visit only; existing session skips straight to `/discover` |
| Mock data source | `public/mock/movies.json` (~20 movies, full `Movie` shape) |
| Build strategy | Bottom-up: design tokens → lib/ → components → pages |
| Environment variables | All from `frontend/.env.local` via `NEXT_PUBLIC_` prefix |

## Build Order

```
1. Install deps + .env.local
2. globals.css (design tokens)
3. public/mock/movies.json
4. lib/ (types → session → formatters → api → socket)
5. Components (Navbar → MovieCard → MovieRow → RatingStars → EngineSelector → AlgoDrawer → GenrePicker)
6. Pages (layout.tsx → / → /discover → /movie/[id] → /graph)
```

## Dependencies

```bash
cd frontend
npm install socket.io-client framer-motion d3
npm install -D @types/d3
```

## Environment Variables (`frontend/.env.local`)

```
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
NEXT_PUBLIC_TMDB_IMAGE_BASE=https://image.tmdb.org/t/p/w500
```

---

## Section 1: Foundation

### `globals.css`
Full Netflix/purple design system as CSS custom properties consumed by Tailwind v4 via `@theme`:

- `--color-brand: #7C3AED` — primary actions, active states
- `--color-brand-bright: #9333EA` — hover
- `--color-brand-dim: #4C1D95` — pressed/active bg
- `--color-brand-glow: rgba(124,58,237,0.35)` — shadows
- `--color-bg-base: #141414` — page background
- `--color-bg-card: #1A1A1A` — card background
- `--color-bg-elevated: #232323` — drawers, modals
- `--color-bg-navbar: rgba(20,20,20,0.96)` — frosted navbar
- `--color-text-primary: #FFFFFF`
- `--color-text-secondary: #B3B3B3`
- `--color-text-muted: #6B7280`
- `--color-star-active: #F59E0B` — amber rating stars
- D3 viz palette: 5 community colors + MST edge + Dijkstra path + heatmap gradient
- Scrollbar hidden globally (`scrollbar-width: none`)

### `lib/types.ts`
All TypeScript interfaces: `Movie`, `User`, `Recommendation`, `Phase`, `FloydStep`, `DijkstraStep`, `MSTStep`, `MergeSortStep`, `KnapsackStep`, socket event types.

### `lib/session.ts`
- `getOrCreateToken()` — cookie-first → localStorage fallback → generate new UUID
- `getToken()` — read-only, SSR-safe
- `clearSession()` — wipes both cookie and localStorage
- `getPhase()` / `setPhase(phase)` — localStorage cache of `'cold' | 'warming' | 'full'`
- Cookie: `cg_token`, `Max-Age=2592000`, `SameSite=Lax; Secure; Path=/`

### `lib/formatters.ts`
- `formatRuntime(mins: number): string` — e.g. `"2h 18m"`
- `formatScore(score: number): string` — e.g. `"4.2 / 5"`
- `formatYear(dateStr: string): number` — extract year
- `formatGenres(genres: string[], max?: number): string` — comma-joined, truncated

### `lib/api.ts`
- `apiFetch<T>()` — base wrapper: injects `X-Session-Token`, falls back to mock on error
- `api.getRecommendations(engine, budget?)` → `POST /recommend` → fallback: mock movies as recommendations
- `api.rateMovie(movieId, rating)` → `POST /rate` → fallback: `{ newPhase: 'cold', ratingsCount: 0 }`
- `api.searchMovies(query)` → `GET /movies/search?q=` → fallback: filtered mock movies
- `api.getMovie(id)` → `GET /movies/:id` → fallback: find in mock JSON
- `api.startColdStart(genres)` → `POST /recommend` → fallback: mock session ID

### `lib/socket.ts`
- Singleton pattern: one `Socket` instance across all navigations
- Auth: `socket.auth = { token: getOrCreateToken() }`
- `connect_error` caught silently
- `socketEvents` typed helpers: `onAlgoStep`, `onAlgoComplete`, `onRecommendReady`, `onCommunityUpdate`, `emitRecommendStart`, `emitTastePathFind`, `emitSimilarityCompute`
- All listeners are no-ops when socket is disconnected

### `public/mock/movies.json`
~20 movies, real TMDB IDs, covering Action, Drama, Sci-Fi, Horror, Comedy, Thriller. Full `Movie` shape including `posterPath` (resolved via `NEXT_PUBLIC_TMDB_IMAGE_BASE`).

---

## Section 2: Components

### `components/layout/Navbar.tsx`
- `position: fixed; top: 0; width: 100%; z-index: 50`
- Transparent → `rgba(20,20,20,0.96) + backdrop-blur-sm` after 80px scroll
- Left: "Cine**Graph**" — `Graph` in `--color-brand`
- Center: Discover · Graph · My List links; active link = purple underline
- Right: phase badge (`COLD`/`WARMING`/`FULL`) + avatar circle
- Hidden on `/` (landing) via `usePathname`

### `components/movies/MovieCard.tsx`
- 2:3 aspect ratio, `object-cover` poster
- Bottom gradient overlay always visible
- Hover: `scale(1.08)`, `box-shadow: 0 0 0 2px #7C3AED`, `z-index` elevated
- Match % badge (purple) slides in top-right on hover
- Info panel (title, year · genre · runtime) below poster
- Clicking → `router.push('/movie/[id]')`

### `components/movies/MovieRow.tsx`
- Section title (`text-lg font-semibold text-white`)
- `overflow-x: auto; scrollbar-width: none`
- Left/right chevron arrows on row hover (purple tinted)
- `MovieCard` min-width: `200px` desktop, `160px` mobile

### `components/movies/RatingStars.tsx`
- 5 stars, hover fills left-to-right in amber (`#F59E0B`)
- Inactive: `#374151`
- Click: call `api.rateMovie()`, invoke `onRate(newPhase)` callback
- Show spinner while request in-flight

### `components/onboarding/GenrePicker.tsx`
- Full-screen dark grid: `grid-cols-4` desktop / `grid-cols-2` mobile
- Each tile: blurred backdrop + gradient + genre name (bold white, centered)
- Selected: `3px solid #7C3AED` border + purple checkmark badge top-right
- Max 3 selections enforced
- "Find My Movies" CTA: disabled until exactly 3 selected, purple filled button

### `components/recommendation/EngineSelector.tsx`
- Three-tab pill: `Content-Based · Collaborative · Hybrid`
- Framer Motion `layoutId` shared layout animation (sliding purple pill)
- Inactive: `bg-[#333] text-[--color-text-secondary]`
- Active: `bg-[--color-brand] text-white`

### `components/recommendation/WatchBudget.tsx`
- Range slider: 60–300 mins, step 30
- Label: "Watch Budget: 2h 30m" (formatted)
- Purple thumb + track fill

### `components/layout/AlgoDrawer.tsx`
- Pinned bottom, `position: fixed`
- Collapsed: 48px (tab bar: `Merge Sort · Knapsack · Overview`)
- Expanded: 40vh, spring animation `stiffness: 300, damping: 30`
- `2px solid #7C3AED` top border
- Placeholder content in each tab (static text/diagrams for now)

---

## Section 3: Pages

### `app/layout.tsx`
- Font: Inter (`next/font/google`, variable `--font-inter`) — replaces scaffold Geist
- Metadata: title "CineGraph", description set
- `<Navbar />` rendered inside layout, hidden on `/`
- `SocketProvider` context wraps children (initializes singleton, cleans up on unmount)

### `app/page.tsx` — Landing (`/`)
- `'use client'`
- On mount: `getOrCreateToken()`; if `cg_token` cookie existed before this visit → `router.push('/discover')`
- Renders `<GenrePicker>` for first-time visitors
- On submit: `api.startColdStart(genres)` → `router.push('/discover')`
- No Navbar

### `app/discover/page.tsx`
- `'use client'`
- `<EngineSelector>` + `<WatchBudget>` in top bar
- Multiple `<MovieRow>`s: "Recommended For You", "Because You Liked [title]", genre-based rows
- Data: `api.getRecommendations(engine, budget)` → mock fallback
- Engine/budget change triggers re-fetch
- `<AlgoDrawer>` pinned at bottom
- Socket.io connected; idle if backend offline

### `app/movie/[id]/page.tsx`
- `'use client'`
- Hero banner: full-bleed backdrop, `linear-gradient(to top, #141414 0%, rgba(20,20,20,0.6) 50%, transparent)`, title, metadata, Play/List buttons
- "Similar Movies" `<MovieRow>`
- "Users who loved this" avatar strip (placeholder: mock user avatars)
- `<RatingStars>` → on phase change: toast notification (slide-in from top-right, purple, 4s auto-dismiss)

### `app/graph/page.tsx`
- `'use client'`
- Mobile (`< 1024px`): centered warning card "Graph Explorer is desktop-only"
- Desktop: static placeholder SVG with ~20 colored nodes in rough clusters
  - Action cluster: purple nodes
  - Drama: blue, Sci-Fi: green, Horror: amber
- Node hover: tooltip showing user's top genres
- Click node: "Live taste-path visualization coming soon" tooltip
- Full D3 force layout wired later when backend ready

---

## Section 4: Mock Data & Fallback

### `public/mock/movies.json`
Real TMDB movie IDs, poster paths, genres, cast, director. Enough variety to populate all `/discover` rows and support `/movie/[id]` similar movies. Poster images served via `NEXT_PUBLIC_TMDB_IMAGE_BASE`.

### Fallback Strategy
- `api.ts`: wraps every `apiFetch` in try/catch; on error returns pre-shaped mock slice
- `socket.ts`: `connect_error` caught silently; all `on*` helpers no-op when disconnected
- User never sees an error state — feed populates from local data seamlessly

---

## Key Constraints (from spec)
- No `app/api/` routes — all backend logic in Express
- `lib/` contains zero business logic (no cosine similarity, no Floyd-Warshall)
- D3 components: `'use client'` + initialize in `useEffect`
- Tailwind v4 only — no additional CSS framework
- Graph explorer: desktop-only (`>= 1024px`)
- Mobile: feed and movie detail work; graph shows warning
