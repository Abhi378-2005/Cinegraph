# CineGraph — Frontend Implementation Plan

> **Scope:** This document covers the complete implementation plan for the `frontend/` folder of CineGraph. The frontend is a Next.js 16 (App Router) application with **zero business logic** — all ML, algorithms, and data processing live in the separate Express backend.

---

## Architecture Principles

| Rule | Detail |
|---|---|
| **No API routes** | `app/api/` folder does not exist. All data comes from `NEXT_PUBLIC_API_URL` (backend) |
| **lib/ = UI helpers only** | No cosine similarity, Floyd-Warshall, or Redis in `lib/` |
| **Socket.io = receive only** | Frontend only listens to algorithm step events; backend drives all computation |
| **Session = Cookie + Token** | UUID token written to both a persistent cookie AND localStorage; survives page refresh, tab close, and SSR |
| **No login required** | All user tracking is anonymous — token is the sole identity; no username/password ever collected |
| **SSR where possible** | Static page shells via Next.js; dynamic data fetched client-side after hydration |

---

## Design System — Netflix-Inspired (Purple Edition)

> CineGraph's visual language mirrors Netflix: full-bleed dark backgrounds, horizontal scroll rows, cinematic hero banners, and bold hover interactions — with **purple replacing every instance of Netflix red**.

---

### Color Palette

```css
/* globals.css — CSS custom properties */
:root {
  /* === PRIMARY BRAND — Purple (replaces Netflix red) === */
  --color-brand:          #7C3AED;   /* Violet-600 — primary actions, CTAs */
  --color-brand-bright:   #9333EA;   /* Purple-600 — hover states, glows */
  --color-brand-dim:      #4C1D95;   /* Violet-900 — pressed states, active bg */
  --color-brand-glow:     rgba(124, 58, 237, 0.35); /* glow/shadow */

  /* === BACKGROUNDS (dark layers like Netflix) === */
  --color-bg-base:        #141414;   /* Pure near-black — page background */
  --color-bg-card:        #1A1A1A;   /* Movie card background */
  --color-bg-elevated:    #232323;   /* Drawer, modals, tooltips */
  --color-bg-navbar:      rgba(20, 20, 20, 0.96); /* Frosted navbar bg */
  --color-bg-overlay:     rgba(0, 0, 0, 0.65);    /* Hero image overlay */

  /* === TEXT === */
  --color-text-primary:   #FFFFFF;
  --color-text-secondary: #B3B3B3;   /* Netflix grey — subtitles, metadata */
  --color-text-muted:     #6B7280;   /* Timestamps, minor labels */

  /* === SEMANTIC ACCENTS === */
  --color-match-high:     #A78BFA;   /* Purple-400 — high match % badge */
  --color-match-mid:      #7C3AED;   /* Mid match */
  --color-star-active:    #F59E0B;   /* Amber — rating stars (same as IMDB) */
  --color-star-inactive:  #374151;

  /* === BORDERS / SEPARATORS === */
  --color-border:         rgba(255, 255, 255, 0.08);
  --color-border-focus:   #7C3AED;

  /* === VISUALIZATION PALETTE (for D3 graphs) === */
  --viz-color-1:  #7C3AED;  /* Community cluster 1 */
  --viz-color-2:  #2563EB;  /* Cluster 2 */
  --viz-color-3:  #059669;  /* Cluster 3 */
  --viz-color-4:  #D97706;  /* Cluster 4 */
  --viz-color-5:  #DC2626;  /* Cluster 5 */
  --viz-node-default: #4B5563;
  --viz-node-current: #7C3AED;  /* Current user node — purple */
  --viz-mst-edge: rgba(124, 58, 237, 0.6);
  --viz-dijkstra-path: #A78BFA;
  --viz-heatmap-low:  #1E1B4B;  /* Dark indigo */
  --viz-heatmap-high: #7C3AED;  /* Bright purple */
}
```

---

### Typography

**Font:** [Inter](https://fonts.google.com/specimen/Inter) from Google Fonts — loaded via `next/font/google`.

```
Headings    → Inter, weight 700-800, letter-spacing -0.02em
Body        → Inter, weight 400, line-height 1.5
UI Labels   → Inter, weight 500-600
Movie Title → Inter, weight 700, size clamp(1.2rem, 2vw, 1.8rem)
```

```typescript
// app/layout.tsx
import { Inter } from 'next/font/google';
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
```

---

### Navbar — `components/layout/Navbar.tsx`

Matches Netflix's top navbar exactly, purple-accented:

| Property | Value |
|---|---|
| Background | `rgba(20,20,20,0.96)` + `backdrop-filter: blur(8px)` |
| Position | `fixed top-0 w-full z-50` |
| Left | CineGraph logo — "Cine**Graph**" with `Graph` in `--color-brand` |
| Center | Navigation links: Discover · Graph · My List |
| Right | Phase badge (`COLD` / `WARMING` / `FULL`) + avatar circle |
| Active link | `--color-brand` underline + `--color-brand` text color |
| Scroll behavior | Transparent at top of page → dark bg after 80px scroll (like Netflix) |

---

### Movie Card — `components/movies/MovieCard.tsx`

Netflix-style card with purple interaction states:

```
┌─────────────────────────┐
│   [POSTER IMAGE]        │  ← 2:3 aspect ratio, object-cover
│                         │
│  ░░░░░░░░░░░░░░░░░░░░░  │  ← Subtle gradient overlay bottom
│  ██ MATCH 94%           │  ← Purple badge top-right on hover
└─────────────────────────┘
  Movie Title              ← Bold white, 1 line truncated
  2023 · Action · 2h 18m  ← --color-text-secondary, small

HOVER STATE:
- Scale up 1.08× (transform)
- Purple glow ring: box-shadow 0 0 0 2px var(--color-brand)
- Bottom info panel slides up (Framer Motion): synopsis excerpt + rate stars
- Z-index elevated so it overlaps siblings (Netflix card expand behavior)
```

---

### Hero Banner — used on `/discover` and `/movie/[id]`

Full-width cinematic banner, Netflix-style:

```
┌──────────────────────────────────────────────────────────┐
│  [FULL-BLEED BACKDROP IMAGE — opacity 0.5]               │
│  ░░░░░░░░░░░░░░ gradient overlay from bottom ░░░░░░░░░░  │
│                                                           │
│  Top 10 in CineGraph Today                               │  ← small label, purple
│  THE DARK KNIGHT                                         │  ← massive title, bold
│  Action · Crime · 2008    ★ 9.0    2h 32m                │
│  Christopher Nolan directs...  [truncated overview]      │
│                                                           │
│  [▶ Play Now]   [+ My List]   [ⓘ More Info]             │  ← purple filled / ghost btns
└──────────────────────────────────────────────────────────┘
```

Gradient: `linear-gradient(to top, #141414 0%, rgba(20,20,20,0.6) 50%, transparent 100%)`

---

### Movie Row (Horizontal Scroll) — used in `/discover`

Netflix's signature horizontal scroll rows grouped by category:

```
Recommended For You
  ← [Card][Card][Card][Card][Card][Card] →

Because You Liked Inception
  ← [Card][Card][Card][Card][Card][Card] →

Top in Sci-Fi
  ← [Card][Card][Card][Card][Card][Card] →
```

- Row title: `--color-text-primary`, weight 600, `text-lg`
- Row scroll: `overflow-x: auto`, `scrollbar-width: none` (hidden scrollbar)
- Navigation arrows appear on row hover (left/right chevrons, purple tinted)
- Cards: `min-width: 200px` on desktop, `160px` on mobile

---

### Buttons

```css
/* Primary — filled purple */
.btn-primary {
  background: var(--color-brand);
  color: white;
  border-radius: 4px;
  padding: 0.5rem 1.5rem;
  font-weight: 600;
  transition: background 0.15s, box-shadow 0.15s;
}
.btn-primary:hover {
  background: var(--color-brand-bright);
  box-shadow: 0 0 16px var(--color-brand-glow);
}

/* Ghost — Netflix's white outline style */
.btn-ghost {
  background: rgba(255,255,255,0.15);
  color: white;
  border: 1px solid rgba(255,255,255,0.3);
  border-radius: 4px;
  backdrop-filter: blur(4px);
}
.btn-ghost:hover { background: rgba(255,255,255,0.25); }
```

---

### Engine Selector Tabs — `components/recommendation/EngineSelector.tsx`

Three-tab pill selector, styled like Netflix's content filter row:

```
[ Content-Based ]  [ Collaborative ]  [ Hybrid ]
```

- Inactive: `bg-[#333]` text `--color-text-secondary`
- Active: `bg-[--color-brand]` text white, slight glow shadow
- Tab switch: Framer Motion `layoutId` shared layout animation (sliding pill)

---

### Genre Picker — `components/onboarding/GenrePicker.tsx`

Landing page: full-screen dark background with genre tiles in a grid:

```
Each tile:
┌──────────────────────┐
│ [backdrop image]     │  ← blurred TMDB genre placeholder image
│ ░░░░░ gradient ░░░░░ │
│   🎬 ACTION          │  ← genre name centered, bold white
└──────────────────────┘

SELECTED state:
- Purple border: 3px solid var(--color-brand)
- Checkmark overlay ✓ in purple circle (top-right)
- Brightness increased slightly
```

Grid: `grid-cols-4` on desktop, `grid-cols-2` on mobile.

---

### Algorithm Drawer — `components/layout/AlgoDrawer.tsx`

Slides up from the bottom like a Netflix info panel:

- Background: `--color-bg-elevated` (`#232323`) with top purple border `2px solid var(--color-brand)`
- Tab bar inside: `[ Merge Sort ] [ Knapsack ] [ Overview ]` — matching engine selector style
- Collapsed height: `48px` (tab bar only visible)
- Expanded height: `40vh`, smooth spring animation

---

### D3 Visualization Colours

| Element | Color | CSS Var |
|---|---|---|
| Default user node | `#4B5563` | `--viz-node-default` |
| Current user node | `#7C3AED` | `--viz-node-current` |
| Community 1 (Action) | `#7C3AED` | `--viz-color-1` |
| Community 2 (Drama) | `#2563EB` | `--viz-color-2` |
| Community 3 (Sci-Fi) | `#059669` | `--viz-color-3` |
| Community 4 (Horror) | `#D97706` | `--viz-color-4` |
| MST edges | `rgba(124,58,237,0.6)` | `--viz-mst-edge` |
| Dijkstra path | `#A78BFA` | `--viz-dijkstra-path` |
| Heatmap low | `#1E1B4B` | `--viz-heatmap-low` |
| Heatmap high | `#7C3AED` | `--viz-heatmap-high` |

Graph background: `#141414` (same as page). Grid guides: `rgba(255,255,255,0.03)`.

---

### Micro-Animations Summary

| Interaction | Animation |
|---|---|
| Movie card hover | `scale(1.08)` + purple glow ring — `transition: 200ms ease` |
| Card info panel reveal | Framer Motion `y: 20 → 0`, `opacity: 0 → 1`, `duration: 0.2s` |
| Recommendation feed entry | Framer Motion stagger — cards animate in one-by-one (Merge Sort steps) |
| Engine tab switch | Shared layout animation (sliding purple pill) |
| Hero banner | Framer Motion fade-in `opacity: 0 → 1` 600ms on page load |
| Algorithm drawer | Spring animation, `stiffness: 300, damping: 30` |
| Page transitions | `opacity: 0 → 1`, `y: 8 → 0`, 300ms on route change |
| Star rating hover | Individual stars scale + amber glow on hover left→right fill |
| Phase unlock toast | Slide-in from top-right, purple accent, auto-dismiss 4s |

---

### Responsive Breakpoints

| Breakpoint | Layout |
|---|---|
| `< 640px` (mobile) | 1-column feed, 2-col genre grid, hidden graph page (warning shown) |
| `640px–1024px` (tablet) | 2-column feed, 3-col genre grid, simplified navbar |
| `> 1024px` (desktop) | Full horizontal rows, 4-col genre grid, graph page enabled |

---

## Folder Structure

```
frontend/
├── app/
│   ├── layout.tsx                  # Root layout: fonts, global providers, navbar
│   ├── globals.css                 # Tailwind base + custom CSS variables
│   ├── page.tsx                    # / — Landing: genre picker (cold start onboarding)
│   ├── discover/
│   │   └── page.tsx                # /discover — Recommendation feed
│   ├── graph/
│   │   └── page.tsx                # /graph — User similarity graph explorer
│   └── movie/
│       └── [id]/
│           └── page.tsx            # /movie/[id] — Movie detail page
│
├── components/
│   ├── layout/
│   │   ├── Navbar.tsx              # Top navigation with session indicator
│   │   └── AlgoDrawer.tsx          # Bottom slide-up panel for algorithm visualizations
│   ├── movies/
│   │   ├── MovieCard.tsx           # Poster, title, match %, rating badge
│   │   ├── MovieGrid.tsx           # Responsive grid of MovieCards
│   │   └── RatingStars.tsx         # 1-5 star interactive rating input
│   ├── recommendation/
│   │   ├── EngineSelector.tsx      # Toggle: Content / Collaborative / Hybrid
│   │   ├── RecommendationFeed.tsx  # Merge-sort animated result list
│   │   ├── WatchBudget.tsx         # Slider for watch time budget (minutes)
│   │   └── AlgoExplainer.tsx       # Contextual explanation of active algorithm
│   ├── visualizations/
│   │   ├── SimilarityMatrix.tsx    # D3 heatmap — Floyd-Warshall matrix steps
│   │   ├── UserGraph.tsx           # D3 force layout — user similarity nodes
│   │   ├── MSTOverlay.tsx          # Kruskal MST edges rendered on UserGraph
│   │   ├── DijkstraPath.tsx        # Dijkstra path highlight animation on graph
│   │   └── KnapsackPanel.tsx       # DP table grid for watch-budget optimizer
│   └── onboarding/
│       └── GenrePicker.tsx         # Cold start: 3-genre selection grid
│
├── lib/
│   ├── api.ts                      # All backend HTTP calls (fetch wrappers)
│   ├── socket.ts                   # Socket.io client: connect, event subscriptions
│   ├── session.ts                  # getOrCreateUserId() via localStorage
│   ├── formatters.ts               # formatRuntime, formatScore, formatGenres helpers
│   └── types.ts                    # TypeScript interfaces (mirrored from backend)
│
├── public/
│   └── og-image.png                # Open Graph preview image
│
├── .env.local                      # NEXT_PUBLIC_API_URL, NEXT_PUBLIC_SOCKET_URL
├── next.config.ts
├── postcss.config.mjs
├── tsconfig.json
└── package.json
```

---

## Pages — Detailed Spec

### Page 1: Landing (`/`)
**File:** `app/page.tsx`  
**Rendering:** Client component (needs localStorage on mount)

**Flow:**
1. On mount → call `session.getOrCreateUserId()` to get/create UUID
2. If user already has ratings (phase = warming/full) → redirect to `/discover`
3. Render `GenrePicker` — visual grid of all 28 TMDB genres with movie poster backgrounds
4. User selects exactly 3 genres → "Find My Movies" CTA enabled
5. On submit → call `api.startColdStart({ userId, genres })` → POST `/recommend` with engine: 'cold_start'
6. Redirect to `/discover`

**Components used:** `GenrePicker`

---

### Page 2: Discover (`/discover`)
**File:** `app/discover/page.tsx`  
**Rendering:** Client component

**Layout:**
```
[Navbar]
[EngineSelector] [WatchBudget slider]
[RecommendationFeed — full grid with merge sort entry animation]
[AlgoDrawer — bottom drawer with KnapsackPanel | algo step log | AlgoExplainer]
```

**Flow:**
1. On mount → get `userId` from session, connect Socket.io via `socket.ts`
2. Emit `recommend:start` with current engine and budget
3. Listen `algo:step` → forward steps to active visualization component
4. Listen `recommend:ready` → populate `RecommendationFeed`
5. `RecommendationFeed` animates cards in via Merge Sort steps (Framer Motion)
6. Engine change → re-emit `recommend:start` → new recommendations stream in

**Components used:**
- `EngineSelector` — toggle content/collaborative/hybrid
- `WatchBudget` — slider 60–300 mins
- `RecommendationFeed` — animates cards using `MergeSortStep` events
- `MovieCard` — individual movie tile
- `AlgoDrawer` — bottom panel
- `KnapsackPanel` — DP table inside drawer
- `AlgoExplainer` — contextual text

---

### Page 3: Graph Explorer (`/graph`)
**File:** `app/graph/page.tsx`  
**Rendering:** Client component (D3 requires browser DOM)  
**Note:** Desktop-only. Show warning on mobile.

**Flow:**
1. On mount → connect Socket.io, emit `similarity:compute` with current user set
2. Listen `community:update` → render `UserGraph` with colored clusters
3. Listen `algo:step` (MST type) → `MSTOverlay` animates Kruskal edges
4. Click node → emit `tastepath:find` → listen `algo:step` (Dijkstra type) → `DijkstraPath` animates
5. Hover node → show tooltip with user's top 5 movies

**Components used:**
- `UserGraph` — D3 force layout (max 50 nodes)
- `MSTOverlay` — SVG path overlay on UserGraph
- `DijkstraPath` — highlighted path animation

---

### Page 4: Movie Detail (`/movie/[id]`)
**File:** `app/movie/[id]/page.tsx`  
**Rendering:** Client component (dynamic ID, needs API fetch)

**Flow:**
1. Fetch `GET /movies/:id` → movie data + similar movies list
2. Render movie hero (poster, title, overview, runtime, genres)
3. Render "Similar Movies" section — use `MovieGrid` sorted by cosine similarity
4. Render "Users who loved this" — graph neighbor avatars
5. `RatingStars` → on rate → `api.rateMovie()` → POST `/rate` → response tells new phase
6. If phase changed → toast notification ("You've unlocked collaborative filtering!")

**Components used:**
- `RatingStars`
- `MovieGrid`
- `MovieCard`

---

## Session & Identity Management

> CineGraph has **no login system**. User identity is an anonymous UUID token that persists across sessions via a **browser cookie** (primary) and **localStorage** (fast client-side fallback). The token is sent as a request header on every API call and as Socket.io auth metadata.

### Strategy Overview

```
First visit:
  1. Generate crypto.randomUUID() → token (e.g. "a3b2c1d4-...")
  2. Write to cookie:       cg_token=<uuid>; Max-Age=2592000; SameSite=Lax; Secure
  3. Write to localStorage: cg_token=<uuid>
  4. Send to backend via:   X-Session-Token: <uuid>  (every API request)
                            socket.auth = { token: <uuid> }  (Socket.io handshake)

Subsequent visits:
  - Cookie survives tab close / browser restart → user identity preserved
  - localStorage fallback if cookie is blocked
  - Backend uses token to look up Redis key  user:<token>:*
```

### Token Lifecycle

| Event | Behaviour |
|---|---|
| First visit | Token created, written to cookie + localStorage |
| Page refresh | Cookie read → same token, no new UUID |
| New tab | Cookie shared across tabs → same identity |
| Browser restart | Cookie persists 30 days → same identity |
| localStorage cleared | Cookie fallback used; token recovered |
| Cookie + localStorage both cleared | New UUID generated (fresh anonymous user) |
| 30 days inactivity | Cookie expires → new UUID on next visit |

---

## `lib/` — Implementation Details

### `lib/session.ts`

Full implementation — dual write on create, cookie-first read:

```typescript
const TOKEN_KEY = 'cg_token';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days in seconds

// --- Cookie helpers (client-side only) ---

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie
    .split('; ')
    .find(row => row.startsWith(name + '='));
  return match ? match.split('=')[1] : null;
}

function setCookie(name: string, value: string, maxAge: number): void {
  if (typeof document === 'undefined') return;
  // SameSite=Lax: safe for navigation, blocks cross-site POST
  // Secure: only sent over HTTPS (works on localhost too in modern browsers)
  document.cookie =
    `${name}=${value}; Max-Age=${maxAge}; SameSite=Lax; Secure; Path=/`;
}

function deleteCookie(name: string): void {
  document.cookie = `${name}=; Max-Age=0; Path=/`;
}

// --- Public API ---

/**
 * Returns the current user's anonymous token.
 * Priority: cookie → localStorage → generate new.
 * On generation, writes to BOTH cookie and localStorage.
 */
export function getOrCreateToken(): string {
  // 1. Try cookie first (survives browser restart)
  const fromCookie = getCookie(TOKEN_KEY);
  if (fromCookie) {
    // Refresh cookie TTL on each visit
    setCookie(TOKEN_KEY, fromCookie, COOKIE_MAX_AGE);
    localStorage.setItem(TOKEN_KEY, fromCookie); // keep in sync
    return fromCookie;
  }

  // 2. Fallback to localStorage (cookie may be blocked)
  const fromStorage = localStorage.getItem(TOKEN_KEY);
  if (fromStorage) {
    setCookie(TOKEN_KEY, fromStorage, COOKIE_MAX_AGE); // restore cookie
    return fromStorage;
  }

  // 3. First visit — generate fresh UUID
  const token = crypto.randomUUID();
  setCookie(TOKEN_KEY, token, COOKIE_MAX_AGE);
  localStorage.setItem(TOKEN_KEY, token);
  return token;
}

/**
 * Reads the token synchronously without creating one.
 * Useful for SSR-safe checks where we don't want side effects.
 */
export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return getCookie(TOKEN_KEY) ?? localStorage.getItem(TOKEN_KEY);
}

/**
 * Clears the session entirely (e.g., user clicks "Reset My Data").
 * A new anonymous token will be created on next getOrCreateToken() call.
 */
export function clearSession(): void {
  deleteCookie(TOKEN_KEY);
  localStorage.removeItem(TOKEN_KEY);
}

/**
 * Stores the user's current recommendation phase in localStorage.
 * Avoids an extra API call on every page load.
 */
export type Phase = 'cold' | 'warming' | 'full';

export function getPhase(): Phase {
  return (localStorage.getItem('cg_phase') as Phase) ?? 'cold';
}

export function setPhase(phase: Phase): void {
  localStorage.setItem('cg_phase', phase);
}
```

---

### `lib/api.ts`

Every request auto-injects the token as `X-Session-Token` header. No caller needs to handle the token manually:

```typescript
import { getOrCreateToken } from './session';

const BASE = process.env.NEXT_PUBLIC_API_URL;

// Base fetch wrapper — injects token on every call
async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getOrCreateToken();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Session-Token': token,          // ← token injected here
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
  return res.json() as Promise<T>;
}

// Public API functions (token is handled internally)
export const api = {
  getRecommendations: (engine: string, budget?: number) =>
    apiFetch<{ sessionId: string }>('/recommend', {
      method: 'POST',
      body: JSON.stringify({ engine, budget }),
    }),

  rateMovie: (movieId: number, rating: number) =>
    apiFetch<{ newPhase: string; ratingsCount: number }>('/rate', {
      method: 'POST',
      body: JSON.stringify({ movieId, rating }),
    }),

  searchMovies: (query: string) =>
    apiFetch<{ movies: Movie[] }>(`/movies/search?q=${encodeURIComponent(query)}`),

  getMovie: (id: number) =>
    apiFetch<{ movie: Movie; similar: Movie[] }>(`/movies/${id}`),

  startColdStart: (genres: string[]) =>
    apiFetch<{ sessionId: string }>('/recommend', {
      method: 'POST',
      body: JSON.stringify({ engine: 'cold_start', genres }),
    }),

  getSimilarityMatrix: () =>
    apiFetch<{ matrix: number[][]; userIds: string[]; sessionId: string }>('/similarity?type=user'),
};
```

> **Note:** The backend reads `X-Session-Token` from every request and uses it as the Redis key prefix `user:<token>:*`. No `userId` is ever passed in the request body.

---

### `lib/socket.ts`

Token sent in Socket.io auth handshake so the backend can associate socket connections to the same user:

```typescript
import { io, Socket } from 'socket.io-client';
import { getOrCreateToken } from './session';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(process.env.NEXT_PUBLIC_SOCKET_URL!, {
      auth: { token: getOrCreateToken() },  // ← token in handshake
      transports: ['websocket'],
      reconnectionAttempts: 5,
    });

    socket.on('connect_error', (err) => {
      console.error('[Socket] Connection error:', err.message);
    });
  }
  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}

// Typed event helpers
export const socketEvents = {
  onAlgoStep:        (cb: (d: AlgoStepEvent) => void)        => getSocket().on('algo:step', cb),
  onAlgoComplete:    (cb: (d: AlgoCompleteEvent) => void)    => getSocket().on('algo:complete', cb),
  onRecommendReady:  (cb: (d: RecommendReadyEvent) => void)  => getSocket().on('recommend:ready', cb),
  onCommunityUpdate: (cb: (d: CommunityUpdateEvent) => void) => getSocket().on('community:update', cb),
  emitRecommendStart: (engine: string, budget?: number)      => getSocket().emit('recommend:start', { engine, budget }),
  emitTastePathFind:  (sourceId: string, targetId: string)   => getSocket().emit('tastepath:find', { sourceUserId: sourceId, targetUserId: targetId }),
  emitSimilarityCompute: (userIds: string[])                 => getSocket().emit('similarity:compute', { userIds }),
};
```

---

### `lib/types.ts`
Mirror of `backend/src/types.ts` — all interfaces (`Movie`, `User`, `Recommendation`, `FloydStep`, `DijkstraStep`, `MSTStep`, `MergeSortStep`, `KnapsackStep`).

---

## Dependencies to Install

```bash
cd frontend
npm install socket.io-client d3 framer-motion
npm install -D @types/d3
```

> Tailwind CSS v4 already installed. No additional CSS framework needed.

---

## Environment Variables (`frontend/.env.local`)

```bash
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
NEXT_PUBLIC_TMDB_IMAGE_BASE=https://image.tmdb.org/t/p/w500
```

---

## Build Order (Week-by-Week)

| Week | Frontend Tasks |
|---|---|
| 1 | Setup `globals.css` design tokens, `Navbar`, `MovieCard`, `lib/session.ts` |
| 2 | `lib/api.ts` (getRecommendations, getMovie), `/discover` page shell, `MovieGrid` |
| 3 | `lib/socket.ts`, `RecommendationFeed` with Framer Motion merge-sort animation |
| 4 | Landing page `/`, `GenrePicker`, cold-start flow, `RatingStars`, `/movie/[id]` |
| 5 | `SimilarityMatrix` D3 heatmap, Socket.io Floyd-Warshall step rendering |
| 6 | `UserGraph` D3 force layout, `MSTOverlay`, `/graph` page, community colors |
| 7 | `DijkstraPath` animation, `KnapsackPanel` DP table, `AlgoDrawer`, `WatchBudget` slider |
| 8 | `EngineSelector`, `AlgoExplainer`, `StatsPanel`, responsive polish, Vercel deploy |

---

## Key Design Decisions

| Decision | Rationale |
|---|---|
| No Next.js API routes | Backend owns all logic; avoids splitting algorithm code across two runtimes |
| Cookie + localStorage dual write | Cookie survives browser restart / tab close; localStorage is instant to read without parsing. Cookie is authoritative, localStorage is the fast-path fallback |
| `X-Session-Token` header (not body) | Keeps request bodies clean; backend can extract identity in a single Express middleware before any route handler runs |
| Token in Socket.io `auth` handshake | Backend socket middleware reads `socket.handshake.auth.token` — same identity as REST calls, no duplicate plumbing |
| Cookie: `SameSite=Lax; Secure` | Lax allows normal navigation links to carry the cookie; blocks CSRF from cross-site POSTs. Secure ensures HTTPS-only in production |
| Phase cached in localStorage | Avoids an extra `/phase` API fetch on every page load; backend is always the source of truth and overwrites on `rateMovie` response |
| No login required | Keeps demo instantly accessible for interviewers; real auth would swap the UUID for a JWT but the `X-Session-Token` header plumbing stays identical |
| D3 in client components | D3 requires DOM; wrap in `useEffect` with `'use client'` directive |
| Framer Motion for card animation | Declarative animation that maps cleanly to `MergeSortStep` array indices |
| Single Socket.io singleton | Prevents duplicate connections across page navigations |
| Tailwind v4 only | Already installed; sufficient for all UI needs — no extra CSS framework |
