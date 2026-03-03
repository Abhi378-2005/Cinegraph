# CineGraph Frontend Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the complete CineGraph frontend — Netflix-inspired dark UI with purple brand, four pages, all components, lib utilities with mock fallback, no backend dependency.

**Architecture:** Bottom-up: design tokens → lib → shared components → pages. Every API call falls back to `public/mock/movies.json` when the backend is offline. Socket.io initializes but silently no-ops when disconnected. Session is an anonymous UUID stored in cookie + localStorage (`cg_token`).

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, Framer Motion, socket.io-client, D3 (placeholder only)

**Alias:** `@/*` maps to `frontend/` root (e.g. `@/lib/types`, `@/components/movies/MovieCard`)

---

## Task 1: Install Dependencies + Create `.env.local`

**Files:**
- Modify: `frontend/package.json` (via npm install)
- Create: `frontend/.env.local`

**Step 1: Install runtime dependencies**

```bash
cd frontend
npm install socket.io-client framer-motion d3
npm install -D @types/d3
```

Expected: `package.json` updated, no peer dependency errors.

**Step 2: Create `.env.local`**

Create `frontend/.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
NEXT_PUBLIC_TMDB_IMAGE_BASE=https://image.tmdb.org/t/p/w500
```

**Step 3: Verify dev server starts**

```bash
npm run dev
```

Expected: Next.js starts on port 3000, no errors in terminal.

---

## Task 2: Design Tokens — `app/globals.css`

**Files:**
- Modify: `frontend/app/globals.css`

**Step 1: Replace globals.css entirely**

```css
@import "tailwindcss";

@theme inline {
  --font-inter: var(--font-inter);
}

:root {
  /* Brand — Purple */
  --color-brand:        #7C3AED;
  --color-brand-bright: #9333EA;
  --color-brand-dim:    #4C1D95;
  --color-brand-glow:   rgba(124, 58, 237, 0.35);

  /* Backgrounds */
  --color-bg-base:      #141414;
  --color-bg-card:      #1A1A1A;
  --color-bg-elevated:  #232323;
  --color-bg-navbar:    rgba(20, 20, 20, 0.96);
  --color-bg-overlay:   rgba(0, 0, 0, 0.65);

  /* Text */
  --color-text-primary:   #FFFFFF;
  --color-text-secondary: #B3B3B3;
  --color-text-muted:     #6B7280;

  /* Semantic */
  --color-match-high:     #A78BFA;
  --color-star-active:    #F59E0B;
  --color-star-inactive:  #374151;
  --color-border:         rgba(255, 255, 255, 0.08);

  /* D3 Viz */
  --viz-color-1:          #7C3AED;
  --viz-color-2:          #2563EB;
  --viz-color-3:          #059669;
  --viz-color-4:          #D97706;
  --viz-color-5:          #DC2626;
  --viz-node-default:     #4B5563;
  --viz-node-current:     #7C3AED;
  --viz-mst-edge:         rgba(124, 58, 237, 0.6);
  --viz-dijkstra-path:    #A78BFA;
  --viz-heatmap-low:      #1E1B4B;
  --viz-heatmap-high:     #7C3AED;
}

* {
  box-sizing: border-box;
}

html {
  scrollbar-width: none;
}

html::-webkit-scrollbar {
  display: none;
}

body {
  background-color: var(--color-bg-base);
  color: var(--color-text-primary);
  font-family: var(--font-inter), system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
}

/* Utility: hide scrollbar on overflow-x containers */
.no-scrollbar {
  scrollbar-width: none;
}
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
```

**Step 2: Verify no CSS errors**

```bash
npm run dev
```

Expected: Page loads with `#141414` dark background, no Tailwind errors.

---

## Task 3: Mock Data — `public/mock/movies.json`

**Files:**
- Create: `frontend/public/mock/movies.json`

**Step 1: Create mock movies file**

```json
[
  {
    "id": 155,
    "title": "The Dark Knight",
    "overview": "Batman raises the stakes in his war on crime. When a criminal mastermind known as the Joker emerges, he wreaks havoc and chaos on the people of Gotham.",
    "posterPath": "/qJ2tW6WMUDux911r6m7haRef0WH.jpg",
    "backdropPath": "/hqkIcbrOHL86UncnHIsHVcVmzue.jpg",
    "releaseYear": 2008,
    "genres": ["Action", "Crime", "Drama", "Thriller"],
    "cast": ["Christian Bale", "Heath Ledger", "Aaron Eckhart", "Michael Caine", "Gary Oldman"],
    "director": "Christopher Nolan",
    "keywords": ["dc comics", "vigilante", "joker", "gotham city", "batman"],
    "voteAverage": 9.0,
    "voteCount": 31000,
    "popularity": 123.5,
    "runtime": 152
  },
  {
    "id": 27205,
    "title": "Inception",
    "overview": "Cobb, a skilled thief who commits corporate espionage by infiltrating the subconscious of his targets, is offered a chance to regain his old life.",
    "posterPath": "/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg",
    "backdropPath": "/s3TBrRGB1iav7gFOCNx3H31MoES.jpg",
    "releaseYear": 2010,
    "genres": ["Action", "Science Fiction", "Adventure"],
    "cast": ["Leonardo DiCaprio", "Joseph Gordon-Levitt", "Elliot Page", "Tom Hardy", "Ken Watanabe"],
    "director": "Christopher Nolan",
    "keywords": ["dream", "subconscious", "spy", "heist", "mind"],
    "voteAverage": 8.8,
    "voteCount": 35000,
    "popularity": 98.7,
    "runtime": 148
  },
  {
    "id": 157336,
    "title": "Interstellar",
    "overview": "A group of explorers make use of a newly discovered wormhole to surpass the limitations on human space travel and conquer the vast distances of an interstellar voyage.",
    "posterPath": "/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg",
    "backdropPath": "/rAiYTfKGqDCRIIqo664sY9XZIvQ.jpg",
    "releaseYear": 2014,
    "genres": ["Adventure", "Drama", "Science Fiction"],
    "cast": ["Matthew McConaughey", "Anne Hathaway", "Jessica Chastain", "Michael Caine", "Matt Damon"],
    "director": "Christopher Nolan",
    "keywords": ["space", "wormhole", "time travel", "nasa", "black hole"],
    "voteAverage": 8.6,
    "voteCount": 33000,
    "popularity": 112.3,
    "runtime": 169
  },
  {
    "id": 278,
    "title": "The Shawshank Redemption",
    "overview": "Framed for double murder, banker Andy Dufresne begins a new life at Shawshank State Penitentiary, where he puts his skills to work for an amoral warden.",
    "posterPath": "/lyQBXzOQSuE59IsHyhrp0qIiPAz.jpg",
    "backdropPath": "/iNh3BivHyg5sQRPP1KOkzguEX0H.jpg",
    "releaseYear": 1994,
    "genres": ["Drama", "Crime"],
    "cast": ["Tim Robbins", "Morgan Freeman", "Bob Gunton", "William Sadler", "Clancy Brown"],
    "director": "Frank Darabont",
    "keywords": ["prison", "friendship", "hope", "redemption", "escape"],
    "voteAverage": 8.7,
    "voteCount": 26000,
    "popularity": 87.2,
    "runtime": 142
  },
  {
    "id": 496243,
    "title": "Parasite",
    "overview": "All unemployed, Ki-taek's family takes peculiar interest in the wealthy Park family and infiltrates their household in an increasingly sinister scheme.",
    "posterPath": "/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg",
    "backdropPath": "/TU9NIjwzjoKPwQHoHshkFcQUCG.jpg",
    "releaseYear": 2019,
    "genres": ["Comedy", "Thriller", "Drama"],
    "cast": ["Song Kang-ho", "Lee Sun-kyun", "Cho Yeo-jeong", "Choi Woo-shik", "Park So-dam"],
    "director": "Bong Joon-ho",
    "keywords": ["class divide", "family", "korea", "dark comedy", "social commentary"],
    "voteAverage": 8.5,
    "voteCount": 17000,
    "popularity": 76.4,
    "runtime": 132
  },
  {
    "id": 299534,
    "title": "Avengers: Endgame",
    "overview": "After Thanos' devastating snap, the remaining Avengers must assemble once more to undo his actions and restore order to the universe.",
    "posterPath": "/or06FN3Dka5tukK1e9sl16pB3iy.jpg",
    "backdropPath": "/7RyHsO4yDXtBv1zUU3mTpHeQ0d5.jpg",
    "releaseYear": 2019,
    "genres": ["Adventure", "Science Fiction", "Action"],
    "cast": ["Robert Downey Jr.", "Chris Evans", "Mark Ruffalo", "Chris Hemsworth", "Scarlett Johansson"],
    "director": "Anthony Russo",
    "keywords": ["marvel", "avengers", "time travel", "superhero", "infinity stones"],
    "voteAverage": 8.3,
    "voteCount": 23000,
    "popularity": 145.2,
    "runtime": 181
  },
  {
    "id": 475557,
    "title": "Joker",
    "overview": "During the 1980s, a failed comedian is driven insane and turns to a life of crime and chaos in Gotham City, becoming an infamous psychopathic crime figure.",
    "posterPath": "/udDclJoHjfjb8Ekgsd4FDteOkCU.jpg",
    "backdropPath": "/n6bUvigpRFqSwmPp1ZOR9yw0plB.jpg",
    "releaseYear": 2019,
    "genres": ["Crime", "Drama", "Thriller"],
    "cast": ["Joaquin Phoenix", "Robert De Niro", "Zazie Beetz", "Frances Conroy", "Brett Cullen"],
    "director": "Todd Phillips",
    "keywords": ["joker", "villain", "gotham", "origin story", "mental illness"],
    "voteAverage": 8.2,
    "voteCount": 25000,
    "popularity": 92.1,
    "runtime": 122
  },
  {
    "id": 603,
    "title": "The Matrix",
    "overview": "A computer hacker joins underground insurgents fighting the vast and powerful computers that now rule the earth in the 22nd century.",
    "posterPath": "/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg",
    "backdropPath": "/fNG7i7RqMErkcqhohV2a6cV1Ehy.jpg",
    "releaseYear": 1999,
    "genres": ["Action", "Science Fiction"],
    "cast": ["Keanu Reeves", "Laurence Fishburne", "Carrie-Anne Moss", "Hugo Weaving", "Gloria Foster"],
    "director": "Lana Wachowski",
    "keywords": ["virtual reality", "hacker", "simulation", "artificial intelligence", "dystopia"],
    "voteAverage": 8.7,
    "voteCount": 25000,
    "popularity": 88.5,
    "runtime": 136
  },
  {
    "id": 438631,
    "title": "Dune",
    "overview": "Paul Atreides must travel to the most dangerous planet in the universe to ensure the future of his family and his people.",
    "posterPath": "/d5NXSklXo0qyIYkgV94XAgMIckC.jpg",
    "backdropPath": "/iopYFB1b6Bh7FWZh3onQhph1sih.jpg",
    "releaseYear": 2021,
    "genres": ["Science Fiction", "Adventure"],
    "cast": ["Timothée Chalamet", "Rebecca Ferguson", "Oscar Isaac", "Zendaya", "Jason Momoa"],
    "director": "Denis Villeneuve",
    "keywords": ["desert", "prophecy", "politics", "spice", "space opera"],
    "voteAverage": 7.8,
    "voteCount": 12000,
    "popularity": 134.6,
    "runtime": 155
  },
  {
    "id": 545611,
    "title": "Everything Everywhere All at Once",
    "overview": "An aging Chinese immigrant is swept up in an insane adventure where she alone can save the world by exploring other universes.",
    "posterPath": "/w3LxiVYdWWRvEVdn5RYq6jIqkb1.jpg",
    "backdropPath": "/feSiISwgEpVzR1v3zv2n2LuUmWh.jpg",
    "releaseYear": 2022,
    "genres": ["Action", "Adventure", "Science Fiction", "Comedy"],
    "cast": ["Michelle Yeoh", "Ke Huy Quan", "Jamie Lee Curtis", "Stephanie Hsu", "James Hong"],
    "director": "Daniel Kwan",
    "keywords": ["multiverse", "laundromat", "existentialism", "family", "absurdism"],
    "voteAverage": 7.9,
    "voteCount": 9000,
    "popularity": 78.3,
    "runtime": 139
  },
  {
    "id": 419430,
    "title": "Get Out",
    "overview": "Chris reads his girlfriend's family overly accommodating behavior as nervous attempts to deal with their daughter's interracial relationship — then things turn sinister.",
    "posterPath": "/tFXcEccSQMf3lfhfXKSU9iRBpa3.jpg",
    "backdropPath": "/dEkzEwuqKdxBWFnMDYci5aTkNpq.jpg",
    "releaseYear": 2017,
    "genres": ["Horror", "Mystery", "Thriller"],
    "cast": ["Daniel Kaluuya", "Allison Williams", "Catherine Keener", "Bradley Whitford", "LilRel Howery"],
    "director": "Jordan Peele",
    "keywords": ["race", "hypnosis", "social horror", "sunken place", "racism"],
    "voteAverage": 7.7,
    "voteCount": 13000,
    "popularity": 65.4,
    "runtime": 104
  },
  {
    "id": 238,
    "title": "The Godfather",
    "overview": "When organized crime patriarch Vito Corleone barely survives an assassination attempt, his youngest son Michael steps in to handle the would-be killers.",
    "posterPath": "/3bhkrj58Vtu7enYsLowi7HCH2PJ.jpg",
    "backdropPath": "/tmU7GeKVPlXBF3K6Kp51B2AdoGX.jpg",
    "releaseYear": 1972,
    "genres": ["Drama", "Crime"],
    "cast": ["Marlon Brando", "Al Pacino", "James Caan", "Richard Castellano", "Robert Duvall"],
    "director": "Francis Ford Coppola",
    "keywords": ["mafia", "crime family", "loyalty", "power", "corruption"],
    "voteAverage": 8.7,
    "voteCount": 20000,
    "popularity": 72.8,
    "runtime": 175
  },
  {
    "id": 680,
    "title": "Pulp Fiction",
    "overview": "A burger-loving hit man, his philosophical partner, a drug-addled gangster's moll and a washed-up boxer converge in this sprawling, comedic crime caper.",
    "posterPath": "/d5iIlFn5s0ImszYzBPb8JPIfbXD.jpg",
    "backdropPath": "/suaEOtk1N1sgg2MTM7oZd2cfVp3.jpg",
    "releaseYear": 1994,
    "genres": ["Thriller", "Crime"],
    "cast": ["John Travolta", "Samuel L. Jackson", "Uma Thurman", "Bruce Willis", "Harvey Keitel"],
    "director": "Quentin Tarantino",
    "keywords": ["nonlinear", "hitman", "crime", "los angeles", "dark comedy"],
    "voteAverage": 8.5,
    "voteCount": 27000,
    "popularity": 79.1,
    "runtime": 154
  },
  {
    "id": 493922,
    "title": "Hereditary",
    "overview": "When the Graham family matriarch passes away, her daughter's family begins to unravel cryptic and terrifying secrets about their ancestry.",
    "posterPath": "/p9S1P9dEQgNjn7gRoGEFnFBRNs.jpg",
    "backdropPath": "/4lDInmEMdEyHmkGQaWdRzMp6sdj.jpg",
    "releaseYear": 2018,
    "genres": ["Horror", "Drama", "Mystery"],
    "cast": ["Toni Collette", "Alex Wolff", "Milly Shapiro", "Gabriel Byrne", "Ann Dowd"],
    "director": "Ari Aster",
    "keywords": ["grief", "family trauma", "occult", "supernatural", "inheritance"],
    "voteAverage": 7.3,
    "voteCount": 8000,
    "popularity": 45.2,
    "runtime": 127
  },
  {
    "id": 76341,
    "title": "Mad Max: Fury Road",
    "overview": "In a stark desert landscape where humanity is broken, a woman rebels against a tyrannical ruler in search of her homeland with the aid of a group of female prisoners and a drifter named Max.",
    "posterPath": "/8tZYtuWezp8JbcsvHYO0O46tFbo.jpg",
    "backdropPath": "/phszHPFnhJKPVHoAlPVBkUxjoBH.jpg",
    "releaseYear": 2015,
    "genres": ["Action", "Adventure", "Science Fiction"],
    "cast": ["Tom Hardy", "Charlize Theron", "Nicholas Hoult", "Hugh Keays-Byrne", "Rosie Huntington-Whiteley"],
    "director": "George Miller",
    "keywords": ["post-apocalyptic", "desert", "car chase", "survival", "feminist"],
    "voteAverage": 7.6,
    "voteCount": 20000,
    "popularity": 84.3,
    "runtime": 120
  },
  {
    "id": 313369,
    "title": "La La Land",
    "overview": "An aspiring actress and a jazz musician share a passionate love affair while pursuing their dreams in Los Angeles.",
    "posterPath": "/uDO8zWDhfWwoFdKS4fzkUJt0Rf0.jpg",
    "backdropPath": "/nadTlnTE8bNZkQTFcBMOhLPGRob.jpg",
    "releaseYear": 2016,
    "genres": ["Drama", "Music", "Romance", "Comedy"],
    "cast": ["Ryan Gosling", "Emma Stone", "John Legend", "Rosemarie DeWitt", "J.K. Simmons"],
    "director": "Damien Chazelle",
    "keywords": ["jazz", "love", "dreams", "los angeles", "musical"],
    "voteAverage": 7.9,
    "voteCount": 15000,
    "popularity": 68.7,
    "runtime": 128
  },
  {
    "id": 335984,
    "title": "Blade Runner 2049",
    "overview": "A new blade runner unearths a long-buried secret that has the potential to plunge what remains of society into chaos.",
    "posterPath": "/gajva2L0rPYkEWjzgFlBXCAVBE5.jpg",
    "backdropPath": "/eilAGAHqjZHJbdlTLpXkFzqyXTO.jpg",
    "releaseYear": 2017,
    "genres": ["Science Fiction", "Drama"],
    "cast": ["Ryan Gosling", "Harrison Ford", "Ana de Armas", "Sylvia Hoeks", "Robin Wright"],
    "director": "Denis Villeneuve",
    "keywords": ["android", "dystopia", "neo-noir", "identity", "artificial intelligence"],
    "voteAverage": 8.0,
    "voteCount": 14000,
    "popularity": 73.2,
    "runtime": 164
  },
  {
    "id": 244786,
    "title": "Whiplash",
    "overview": "Under a ruthless instructor, a talented young drummer pursues perfection at any cost, even his humanity.",
    "posterPath": "/7fn624j5lj3xTme2SgiLCeuedmO.jpg",
    "backdropPath": "/6bbZ6XyvgfjhQwbplnUh1LSj1ej.jpg",
    "releaseYear": 2014,
    "genres": ["Drama", "Music"],
    "cast": ["Miles Teller", "J.K. Simmons", "Melissa Benoist", "Paul Reiser", "Austin Stowell"],
    "director": "Damien Chazelle",
    "keywords": ["music school", "drums", "obsession", "teacher", "ambition"],
    "voteAverage": 8.4,
    "voteCount": 16000,
    "popularity": 58.9,
    "runtime": 107
  },
  {
    "id": 530915,
    "title": "1917",
    "overview": "Two young British soldiers must cross enemy territory to deliver a message that will stop 1,600 men from walking into a deadly trap.",
    "posterPath": "/iZf0KyrE25z1sage4SYFLCCrMi9.jpg",
    "backdropPath": "/nX5CVJHQ8C1W0r1KlFC2l2WicgU.jpg",
    "releaseYear": 2019,
    "genres": ["War", "Drama", "Action"],
    "cast": ["George MacKay", "Dean-Charles Chapman", "Mark Strong", "Andrew Scott", "Richard Madden"],
    "director": "Sam Mendes",
    "keywords": ["world war i", "mission", "race against time", "single take", "trench warfare"],
    "voteAverage": 8.2,
    "voteCount": 11000,
    "popularity": 62.4,
    "runtime": 119
  }
]
```

**Step 2: Verify it loads**

Open `http://localhost:3000/mock/movies.json` in browser.
Expected: JSON array of 20 movies displayed.

---

## Task 4: `lib/types.ts`

**Files:**
- Create: `frontend/lib/types.ts`

**Step 1: Create types file**

```typescript
// frontend/lib/types.ts

export interface Movie {
  id: number;
  title: string;
  overview: string;
  posterPath: string;
  backdropPath?: string;
  releaseYear: number;
  genres: string[];
  cast: string[];
  director: string;
  keywords: string[];
  voteAverage: number;
  voteCount: number;
  popularity: number;
  runtime: number;
  featureVector?: number[];
}

export interface User {
  id: string;
  preferredGenres: string[];
  ratings: Record<number, number>;
  phase: Phase;
  ratingCount: number;
}

export type Phase = 'cold' | 'warming' | 'full';

export interface Recommendation {
  movie: Movie;
  score: number;
  matchPercent: number;
  reason: string;
  engine: 'content' | 'collaborative' | 'hybrid' | 'cold_start';
  similarUsers?: string[];
  similarMovies?: number[];
}

export interface FloydStep {
  k: number; i: number; j: number;
  oldVal: number; newVal: number;
  updated: boolean;
  matrixSnapshot: number[][];
}

export interface DijkstraStep {
  visitedUserId: string;
  distance: number;
  frontier: string[];
  path: string[];
}

export interface MSTStep {
  algorithm: 'kruskal' | 'prim';
  type: 'add' | 'reject' | 'consider';
  edge: { u: string; v: string; weight: number };
  communities: string[][];
  totalCost: number;
}

export interface MergeSortStep {
  type: 'split' | 'merge' | 'compare' | 'place';
  array: Recommendation[];
  leftIndex: number;
  rightIndex: number;
}

export interface KnapsackStep {
  row: number;
  col: number;
  value: number;
  decision: 'include' | 'exclude';
  dpSnapshot: number[][];
}

export type AlgoStep = FloydStep | DijkstraStep | MSTStep | MergeSortStep | KnapsackStep;

export interface AlgoStepEvent { algorithm: string; step: AlgoStep; }
export interface AlgoCompleteEvent { algorithm: string; durationMs: number; totalSteps: number; }
export interface RecommendReadyEvent { recommendations: Recommendation[]; engine: string; }
export interface CommunityUpdateEvent { communities: string[][]; mstEdges: { u: string; v: string }[]; }
```

**Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

---

## Task 5: `lib/session.ts`

**Files:**
- Create: `frontend/lib/session.ts`

**Step 1: Create session utility**

```typescript
// frontend/lib/session.ts

export type Phase = 'cold' | 'warming' | 'full';

const TOKEN_KEY = 'cg_token';
const PHASE_KEY = 'cg_phase';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days in seconds

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie
    .split('; ')
    .find(row => row.startsWith(name + '='));
  return match ? decodeURIComponent(match.split('=')[1]) : null;
}

function setCookie(name: string, value: string, maxAge: number): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${maxAge}; SameSite=Lax; Path=/`;
}

function deleteCookie(name: string): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=; Max-Age=0; Path=/`;
}

/** Returns token, creating one if needed. Cookie-first, localStorage fallback. */
export function getOrCreateToken(): string {
  const fromCookie = getCookie(TOKEN_KEY);
  if (fromCookie) {
    // Refresh TTL on each visit
    setCookie(TOKEN_KEY, fromCookie, COOKIE_MAX_AGE);
    try { localStorage.setItem(TOKEN_KEY, fromCookie); } catch { /* storage blocked */ }
    return fromCookie;
  }
  try {
    const fromStorage = localStorage.getItem(TOKEN_KEY);
    if (fromStorage) {
      setCookie(TOKEN_KEY, fromStorage, COOKIE_MAX_AGE);
      return fromStorage;
    }
  } catch { /* storage blocked */ }

  const token = crypto.randomUUID();
  setCookie(TOKEN_KEY, token, COOKIE_MAX_AGE);
  try { localStorage.setItem(TOKEN_KEY, token); } catch { /* storage blocked */ }
  return token;
}

/** Read-only; SSR-safe (returns null on server). */
export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return getCookie(TOKEN_KEY) ?? localStorage.getItem(TOKEN_KEY);
  } catch {
    return getCookie(TOKEN_KEY);
  }
}

/**
 * Returns true if the user had an existing cg_token cookie BEFORE
 * this call. Call this BEFORE getOrCreateToken() on the landing page
 * to decide whether to redirect to /discover.
 */
export function hasExistingToken(): boolean {
  return getCookie(TOKEN_KEY) !== null;
}

/** Wipes session entirely. Next getOrCreateToken() generates a fresh UUID. */
export function clearSession(): void {
  deleteCookie(TOKEN_KEY);
  deleteCookie(PHASE_KEY);
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(PHASE_KEY);
  } catch { /* storage blocked */ }
}

export function getPhase(): Phase {
  try {
    return (localStorage.getItem(PHASE_KEY) as Phase) ?? 'cold';
  } catch {
    return 'cold';
  }
}

export function setPhase(phase: Phase): void {
  try { localStorage.setItem(PHASE_KEY, phase); } catch { /* storage blocked */ }
}
```

**Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

---

## Task 6: `lib/formatters.ts`

**Files:**
- Create: `frontend/lib/formatters.ts`

**Step 1: Create formatters**

```typescript
// frontend/lib/formatters.ts

export function formatRuntime(mins: number): string {
  if (!mins || mins <= 0) return 'N/A';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function formatScore(score: number): string {
  return score.toFixed(1);
}

export function formatYear(releaseYear: number | string): string {
  if (typeof releaseYear === 'number') return String(releaseYear);
  const d = new Date(releaseYear);
  const y = d.getFullYear();
  return isNaN(y) ? String(releaseYear) : String(y);
}

export function formatGenres(genres: string[], max = 3): string {
  return genres.slice(0, max).join(' · ');
}

export function posterUrl(posterPath: string): string {
  const base = process.env.NEXT_PUBLIC_TMDB_IMAGE_BASE ?? 'https://image.tmdb.org/t/p/w500';
  return `${base}${posterPath}`;
}

export function backdropUrl(backdropPath: string): string {
  const base = (process.env.NEXT_PUBLIC_TMDB_IMAGE_BASE ?? 'https://image.tmdb.org/t/p/w500')
    .replace('/w500', '/original');
  return `${base}${backdropPath}`;
}
```

**Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

---

## Task 7: `lib/api.ts`

**Files:**
- Create: `frontend/lib/api.ts`

**Step 1: Create API client with mock fallback**

```typescript
// frontend/lib/api.ts

import { getOrCreateToken } from '@/lib/session';
import type { Movie, Phase } from '@/lib/types';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

let _mockCache: Movie[] | null = null;

async function loadMock(): Promise<Movie[]> {
  if (_mockCache) return _mockCache;
  try {
    const res = await fetch('/mock/movies.json');
    _mockCache = (await res.json()) as Movie[];
    return _mockCache;
  } catch {
    return [];
  }
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getOrCreateToken();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Session-Token': token,
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
  return res.json() as Promise<T>;
}

export const api = {
  /** Returns a socket session ID. Falls back silently to mock. */
  async getRecommendations(
    engine: string,
    budget?: number
  ): Promise<{ sessionId: string }> {
    try {
      return await apiFetch('/recommend', {
        method: 'POST',
        body: JSON.stringify({ engine, budget }),
      });
    } catch {
      return { sessionId: 'mock-session' };
    }
  },

  /** Returns movie + similar list. Falls back to mock JSON. */
  async getMovie(id: number): Promise<{ movie: Movie; similar: Movie[] }> {
    try {
      return await apiFetch(`/movies/${id}`);
    } catch {
      const movies = await loadMock();
      const movie = movies.find(m => m.id === id) ?? movies[0];
      const similar = movies.filter(m => m.id !== movie.id).slice(0, 6);
      return { movie, similar };
    }
  },

  /** Full-text search. Falls back to client-side mock filter. */
  async searchMovies(query: string): Promise<{ movies: Movie[] }> {
    try {
      return await apiFetch(`/movies/search?q=${encodeURIComponent(query)}`);
    } catch {
      const movies = await loadMock();
      const q = query.toLowerCase();
      return {
        movies: movies.filter(
          m =>
            m.title.toLowerCase().includes(q) ||
            m.genres.some(g => g.toLowerCase().includes(q))
        ),
      };
    }
  },

  /** Rate a movie 1-5. Falls back to cold-phase mock response. */
  async rateMovie(
    movieId: number,
    rating: number
  ): Promise<{ newPhase: Phase; ratingsCount: number }> {
    try {
      return await apiFetch('/rate', {
        method: 'POST',
        body: JSON.stringify({ movieId, rating }),
      });
    } catch {
      return { newPhase: 'cold', ratingsCount: 0 };
    }
  },

  /** Cold-start: submit genre preferences. Falls back silently. */
  async startColdStart(genres: string[]): Promise<{ sessionId: string }> {
    try {
      return await apiFetch('/recommend', {
        method: 'POST',
        body: JSON.stringify({ engine: 'cold_start', genres }),
      });
    } catch {
      return { sessionId: 'mock-session' };
    }
  },

  /** Direct access to mock movies for components that need to populate without a backend. */
  async getMockMovies(): Promise<Movie[]> {
    return loadMock();
  },
};
```

**Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

---

## Task 8: `lib/socket.ts`

**Files:**
- Create: `frontend/lib/socket.ts`

**Step 1: Create Socket.io singleton**

```typescript
// frontend/lib/socket.ts
'use client';

import { io, type Socket } from 'socket.io-client';
import { getOrCreateToken } from '@/lib/session';
import type {
  AlgoStepEvent,
  AlgoCompleteEvent,
  RecommendReadyEvent,
  CommunityUpdateEvent,
} from '@/lib/types';

let _socket: Socket | null = null;

export function getSocket(): Socket {
  if (!_socket) {
    const url = process.env.NEXT_PUBLIC_SOCKET_URL ?? 'http://localhost:3001';
    _socket = io(url, {
      auth: { token: getOrCreateToken() },
      transports: ['websocket'],
      reconnectionAttempts: 5,
      timeout: 5000,
    });
    _socket.on('connect_error', () => {
      // Expected when backend is not running — fail silently
    });
  }
  return _socket;
}

export function disconnectSocket(): void {
  _socket?.disconnect();
  _socket = null;
}

type Unsubscribe = () => void;

function safeOn<T>(event: string, cb: (data: T) => void): Unsubscribe {
  try {
    const s = getSocket();
    s.on(event, cb);
    return () => s.off(event, cb);
  } catch {
    return () => {};
  }
}

function safeEmit(event: string, data?: unknown): void {
  try {
    const s = getSocket();
    if (s.connected) s.emit(event, data);
  } catch { /* no-op if socket unavailable */ }
}

export const socketEvents = {
  onAlgoStep:         (cb: (d: AlgoStepEvent) => void): Unsubscribe       => safeOn('algo:step', cb),
  onAlgoComplete:     (cb: (d: AlgoCompleteEvent) => void): Unsubscribe   => safeOn('algo:complete', cb),
  onRecommendReady:   (cb: (d: RecommendReadyEvent) => void): Unsubscribe => safeOn('recommend:ready', cb),
  onCommunityUpdate:  (cb: (d: CommunityUpdateEvent) => void): Unsubscribe=> safeOn('community:update', cb),
  emitRecommendStart: (engine: string, budget?: number) => safeEmit('recommend:start', { engine, budget }),
  emitTastePathFind:  (src: string, tgt: string)        => safeEmit('tastepath:find', { sourceUserId: src, targetUserId: tgt }),
  emitSimilarityCompute: (userIds: string[])            => safeEmit('similarity:compute', { userIds }),
};
```

**Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

---

## Task 9: `components/layout/Navbar.tsx`

**Files:**
- Create: `frontend/components/layout/Navbar.tsx`

**Step 1: Create Navbar**

```tsx
// frontend/components/layout/Navbar.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getPhase } from '@/lib/session';
import type { Phase } from '@/lib/types';

const PHASE_LABELS: Record<Phase, string> = {
  cold: 'COLD',
  warming: 'WARMING',
  full: 'FULL',
};

const PHASE_COLORS: Record<Phase, string> = {
  cold: 'bg-blue-600',
  warming: 'bg-amber-500',
  full: 'bg-violet-600',
};

const NAV_LINKS = [
  { href: '/discover', label: 'Discover' },
  { href: '/graph', label: 'Graph' },
];

export function Navbar() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [phase, setPhase] = useState<Phase>('cold');

  useEffect(() => {
    setPhase(getPhase());
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 h-16 transition-all duration-300"
      style={{
        backgroundColor: scrolled ? 'var(--color-bg-navbar)' : 'transparent',
        backdropFilter: scrolled ? 'blur(8px)' : 'none',
      }}
    >
      {/* Logo */}
      <Link href="/discover" className="text-xl font-bold tracking-tight text-white select-none">
        Cine<span style={{ color: 'var(--color-brand)' }}>Graph</span>
      </Link>

      {/* Nav links */}
      <div className="flex items-center gap-6">
        {NAV_LINKS.map(({ href, label }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className="text-sm font-medium transition-colors duration-150"
              style={{
                color: active ? 'var(--color-brand)' : 'var(--color-text-secondary)',
                borderBottom: active ? '2px solid var(--color-brand)' : '2px solid transparent',
                paddingBottom: '2px',
              }}
            >
              {label}
            </Link>
          );
        })}
      </div>

      {/* Right: Phase badge + avatar */}
      <div className="flex items-center gap-3">
        <span
          className={`text-xs font-bold px-2 py-1 rounded ${PHASE_COLORS[phase]} text-white tracking-wider`}
        >
          {PHASE_LABELS[phase]}
        </span>
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
          style={{ backgroundColor: 'var(--color-brand)' }}
        >
          CG
        </div>
      </div>
    </nav>
  );
}
```

**Step 2: Verify dev server has no errors**

```bash
npm run dev
```

Expected: No TypeScript or import errors.

---

## Task 10: `components/movies/MovieCard.tsx`

**Files:**
- Create: `frontend/components/movies/MovieCard.tsx`

**Step 1: Create MovieCard**

```tsx
// frontend/components/movies/MovieCard.tsx
'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { formatGenres, formatRuntime, formatYear, posterUrl } from '@/lib/formatters';
import type { Movie } from '@/lib/types';

interface MovieCardProps {
  movie: Movie;
  matchPercent?: number;
  reason?: string;
}

export function MovieCard({ movie, matchPercent, reason }: MovieCardProps) {
  const [hovered, setHovered] = useState(false);
  const router = useRouter();

  const imgSrc = posterUrl(movie.posterPath);

  return (
    <div
      className="relative flex-shrink-0 cursor-pointer select-none"
      style={{
        width: '200px',
        transition: 'transform 200ms ease, box-shadow 200ms ease, z-index 0ms',
        transform: hovered ? 'scale(1.08)' : 'scale(1)',
        zIndex: hovered ? 10 : 1,
        boxShadow: hovered
          ? '0 0 0 2px var(--color-brand), 0 8px 32px rgba(0,0,0,0.6)'
          : 'none',
        borderRadius: '4px',
        overflow: 'visible',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => router.push(`/movie/${movie.id}`)}
    >
      {/* Poster */}
      <div
        className="relative rounded overflow-hidden"
        style={{ aspectRatio: '2/3', backgroundColor: 'var(--color-bg-elevated)' }}
      >
        <Image
          src={imgSrc}
          alt={movie.title}
          fill
          sizes="200px"
          className="object-cover"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = '/placeholder-poster.jpg';
          }}
        />

        {/* Bottom gradient always visible */}
        <div
          className="absolute bottom-0 left-0 right-0 h-16"
          style={{
            background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%)',
          }}
        />

        {/* Match % badge — visible on hover */}
        {matchPercent !== undefined && hovered && (
          <div
            className="absolute top-2 right-2 text-xs font-bold px-2 py-0.5 rounded"
            style={{ backgroundColor: 'var(--color-brand)', color: 'white' }}
          >
            {matchPercent}% Match
          </div>
        )}
      </div>

      {/* Info below poster */}
      <div className="mt-2 px-0.5">
        <p
          className="text-sm font-semibold truncate"
          style={{ color: 'var(--color-text-primary)' }}
        >
          {movie.title}
        </p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
          {formatYear(movie.releaseYear)} · {formatGenres(movie.genres, 2)} · {formatRuntime(movie.runtime)}
        </p>
        {reason && hovered && (
          <p className="text-xs mt-1 truncate" style={{ color: 'var(--color-text-muted)' }}>
            {reason}
          </p>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

---

## Task 11: `components/movies/MovieRow.tsx`

**Files:**
- Create: `frontend/components/movies/MovieRow.tsx`

**Step 1: Create MovieRow**

```tsx
// frontend/components/movies/MovieRow.tsx
'use client';

import { useRef, useState } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from './ChevronIcons';
import { MovieCard } from './MovieCard';
import type { Movie } from '@/lib/types';

interface MovieRowProps {
  title: string;
  movies: Movie[];
  matchPercents?: Record<number, number>;
}

export function MovieRow({ title, movies, matchPercents }: MovieRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(true);
  const [hoveringRow, setHoveringRow] = useState(false);

  const scroll = (dir: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const amount = 600;
    scrollRef.current.scrollBy({ left: dir === 'left' ? -amount : amount, behavior: 'smooth' });
  };

  const onScroll = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setShowLeft(scrollLeft > 10);
    setShowRight(scrollLeft + clientWidth < scrollWidth - 10);
  };

  return (
    <div
      className="relative"
      onMouseEnter={() => setHoveringRow(true)}
      onMouseLeave={() => setHoveringRow(false)}
    >
      {/* Row title */}
      <h2
        className="text-lg font-semibold mb-3 px-8"
        style={{ color: 'var(--color-text-primary)' }}
      >
        {title}
      </h2>

      {/* Left chevron */}
      {hoveringRow && showLeft && (
        <button
          onClick={() => scroll('left')}
          className="absolute left-0 top-8 bottom-0 z-20 flex items-center px-2 opacity-90 hover:opacity-100"
          style={{ background: 'linear-gradient(to right, rgba(20,20,20,0.9), transparent)' }}
          aria-label="Scroll left"
        >
          <ChevronLeftIcon />
        </button>
      )}

      {/* Scrollable row */}
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="no-scrollbar flex gap-3 overflow-x-auto px-8 pb-2"
        style={{ scrollSnapType: 'x mandatory' }}
      >
        {movies.map(movie => (
          <div key={movie.id} style={{ scrollSnapAlign: 'start' }}>
            <MovieCard
              movie={movie}
              matchPercent={matchPercents?.[movie.id]}
            />
          </div>
        ))}
      </div>

      {/* Right chevron */}
      {hoveringRow && showRight && (
        <button
          onClick={() => scroll('right')}
          className="absolute right-0 top-8 bottom-0 z-20 flex items-center px-2 opacity-90 hover:opacity-100"
          style={{ background: 'linear-gradient(to left, rgba(20,20,20,0.9), transparent)' }}
          aria-label="Scroll right"
        >
          <ChevronRightIcon />
        </button>
      )}
    </div>
  );
}
```

**Step 2: Create `ChevronIcons.tsx` (used by MovieRow)**

Create `frontend/components/movies/ChevronIcons.tsx`:

```tsx
// frontend/components/movies/ChevronIcons.tsx

export function ChevronLeftIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-brand)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

export function ChevronRightIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-brand)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}
```

**Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

---

## Task 12: `components/movies/RatingStars.tsx`

**Files:**
- Create: `frontend/components/movies/RatingStars.tsx`

**Step 1: Create RatingStars**

```tsx
// frontend/components/movies/RatingStars.tsx
'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { setPhase } from '@/lib/session';
import type { Phase } from '@/lib/types';

interface RatingStarsProps {
  movieId: number;
  initialRating?: number;
  onRate?: (newPhase: Phase) => void;
}

export function RatingStars({ movieId, initialRating = 0, onRate }: RatingStarsProps) {
  const [rating, setRating] = useState(initialRating);
  const [hover, setHover] = useState(0);
  const [loading, setLoading] = useState(false);

  const handleClick = async (star: number) => {
    if (loading) return;
    setLoading(true);
    setRating(star);
    try {
      const { newPhase } = await api.rateMovie(movieId, star);
      setPhase(newPhase);
      onRate?.(newPhase);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map(star => {
        const filled = star <= (hover || rating);
        return (
          <button
            key={star}
            disabled={loading}
            onClick={() => handleClick(star)}
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(0)}
            className="transition-transform duration-100 hover:scale-125 disabled:opacity-50"
            aria-label={`Rate ${star} star${star !== 1 ? 's' : ''}`}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill={filled ? 'var(--color-star-active)' : 'var(--color-star-inactive)'}
              stroke={filled ? 'var(--color-star-active)' : 'var(--color-star-inactive)'}
              strokeWidth="1"
            >
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </button>
        );
      })}
      {loading && (
        <span className="text-xs ml-2" style={{ color: 'var(--color-text-muted)' }}>
          Saving…
        </span>
      )}
    </div>
  );
}
```

---

## Task 13: `components/onboarding/GenrePicker.tsx`

**Files:**
- Create: `frontend/components/onboarding/GenrePicker.tsx`

**Step 1: Create GenrePicker**

```tsx
// frontend/components/onboarding/GenrePicker.tsx
'use client';

import { useState } from 'react';

const GENRES = [
  { name: 'Action',        color: '#7C3AED' },
  { name: 'Adventure',     color: '#2563EB' },
  { name: 'Animation',     color: '#059669' },
  { name: 'Comedy',        color: '#D97706' },
  { name: 'Crime',         color: '#DC2626' },
  { name: 'Documentary',   color: '#0891B2' },
  { name: 'Drama',         color: '#7C3AED' },
  { name: 'Fantasy',       color: '#9333EA' },
  { name: 'Horror',        color: '#DC2626' },
  { name: 'Music',         color: '#059669' },
  { name: 'Mystery',       color: '#4B5563' },
  { name: 'Romance',       color: '#DB2777' },
  { name: 'Science Fiction', color: '#2563EB' },
  { name: 'Thriller',      color: '#B45309' },
  { name: 'War',           color: '#374151' },
  { name: 'Western',       color: '#92400E' },
];

interface GenrePickerProps {
  onSubmit: (genres: string[]) => void;
  loading?: boolean;
}

export function GenrePicker({ onSubmit, loading = false }: GenrePickerProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (genre: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(genre)) {
        next.delete(genre);
      } else if (next.size < 3) {
        next.add(genre);
      }
      return next;
    });
  };

  return (
    <div className="flex flex-col items-center gap-8 px-4 py-12 min-h-screen"
      style={{ backgroundColor: 'var(--color-bg-base)' }}>
      {/* Header */}
      <div className="text-center">
        <h1 className="text-4xl font-bold text-white mb-2">
          Cine<span style={{ color: 'var(--color-brand)' }}>Graph</span>
        </h1>
        <p className="text-lg" style={{ color: 'var(--color-text-secondary)' }}>
          Pick 3 genres you love to get started
        </p>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
          {selected.size}/3 selected
        </p>
      </div>

      {/* Genre grid */}
      <div className="grid grid-cols-2 gap-3 w-full max-w-2xl sm:grid-cols-3 lg:grid-cols-4">
        {GENRES.map(({ name, color }) => {
          const isSelected = selected.has(name);
          return (
            <button
              key={name}
              onClick={() => toggle(name)}
              className="relative h-24 rounded-lg overflow-hidden flex items-center justify-center font-bold text-white text-sm transition-all duration-150"
              style={{
                backgroundColor: color,
                opacity: !isSelected && selected.size === 3 ? 0.4 : 1,
                boxShadow: isSelected
                  ? `0 0 0 3px white, 0 0 0 5px var(--color-brand)`
                  : 'none',
                transform: isSelected ? 'scale(1.03)' : 'scale(1)',
              }}
            >
              {/* Gradient overlay */}
              <div className="absolute inset-0"
                style={{ background: 'linear-gradient(135deg, rgba(0,0,0,0.2), rgba(0,0,0,0.5))' }} />

              <span className="relative z-10 uppercase tracking-wide">{name}</span>

              {/* Checkmark */}
              {isSelected && (
                <div
                  className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: 'var(--color-brand)' }}
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <polyline points="1.5 5 4 7.5 8.5 2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* CTA */}
      <button
        onClick={() => onSubmit(Array.from(selected))}
        disabled={selected.size < 3 || loading}
        className="px-10 py-3 rounded text-white font-semibold text-base transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
        style={{
          backgroundColor: 'var(--color-brand)',
          boxShadow: selected.size === 3 ? '0 0 20px var(--color-brand-glow)' : 'none',
        }}
      >
        {loading ? 'Loading…' : 'Find My Movies →'}
      </button>
    </div>
  );
}
```

---

## Task 14: `components/recommendation/EngineSelector.tsx` + `WatchBudget.tsx`

**Files:**
- Create: `frontend/components/recommendation/EngineSelector.tsx`
- Create: `frontend/components/recommendation/WatchBudget.tsx`

**Step 1: Create EngineSelector**

```tsx
// frontend/components/recommendation/EngineSelector.tsx
'use client';

import { motion } from 'framer-motion';

export type Engine = 'content' | 'collaborative' | 'hybrid';

const ENGINES: { id: Engine; label: string }[] = [
  { id: 'content',       label: 'Content-Based' },
  { id: 'collaborative', label: 'Collaborative' },
  { id: 'hybrid',        label: 'Hybrid' },
];

interface EngineSelectorProps {
  value: Engine;
  onChange: (engine: Engine) => void;
}

export function EngineSelector({ value, onChange }: EngineSelectorProps) {
  return (
    <div
      className="flex items-center gap-1 rounded-full p-1"
      style={{ backgroundColor: '#333' }}
    >
      {ENGINES.map(({ id, label }) => {
        const active = value === id;
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            className="relative px-4 py-1.5 rounded-full text-sm font-medium transition-colors duration-150"
            style={{
              color: active ? 'white' : 'var(--color-text-secondary)',
              zIndex: 1,
            }}
          >
            {active && (
              <motion.div
                layoutId="engine-pill"
                className="absolute inset-0 rounded-full"
                style={{ backgroundColor: 'var(--color-brand)' }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
            <span className="relative z-10">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
```

**Step 2: Create WatchBudget**

```tsx
// frontend/components/recommendation/WatchBudget.tsx
'use client';

import { formatRuntime } from '@/lib/formatters';

interface WatchBudgetProps {
  value: number; // minutes
  onChange: (mins: number) => void;
}

export function WatchBudget({ value, onChange }: WatchBudgetProps) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm whitespace-nowrap" style={{ color: 'var(--color-text-secondary)' }}>
        Budget:
      </span>
      <input
        type="range"
        min={60}
        max={300}
        step={30}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-32 accent-violet-600"
        aria-label="Watch time budget"
      />
      <span className="text-sm font-medium w-14 text-white">{formatRuntime(value)}</span>
    </div>
  );
}
```

---

## Task 15: `components/layout/AlgoDrawer.tsx`

**Files:**
- Create: `frontend/components/layout/AlgoDrawer.tsx`

**Step 1: Create AlgoDrawer**

```tsx
// frontend/components/layout/AlgoDrawer.tsx
'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

type DrawerTab = 'mergesort' | 'knapsack' | 'overview';

const TABS: { id: DrawerTab; label: string }[] = [
  { id: 'mergesort', label: 'Merge Sort' },
  { id: 'knapsack',  label: 'Knapsack' },
  { id: 'overview',  label: 'Overview' },
];

const TAB_CONTENT: Record<DrawerTab, React.ReactNode> = {
  mergesort: (
    <div className="p-4">
      <p className="text-sm font-semibold mb-2" style={{ color: 'var(--color-brand)' }}>
        Merge Sort — Recommendation Ranking
      </p>
      <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
        Your recommendations are sorted by predicted score using Merge Sort (O(n log n)).
        When the backend is live, each comparison and merge step will animate here in real time.
      </p>
    </div>
  ),
  knapsack: (
    <div className="p-4">
      <p className="text-sm font-semibold mb-2" style={{ color: 'var(--color-brand)' }}>
        0/1 Knapsack — Watch Budget Optimizer
      </p>
      <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
        Given your watch time budget, the knapsack DP selects the optimal set of movies
        maximizing your predicted total enjoyment. The DP table will visualize here live.
      </p>
    </div>
  ),
  overview: (
    <div className="p-4">
      <p className="text-sm font-semibold mb-2" style={{ color: 'var(--color-brand)' }}>
        Active Engine
      </p>
      <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
        CineGraph runs three recommendation engines: Content-Based (cosine similarity on
        50-dimensional feature vectors), Collaborative (Floyd-Warshall transitive similarity
        + Pearson correlation), and Hybrid (phases based on your rating history).
      </p>
    </div>
  ),
};

export function AlgoDrawer() {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<DrawerTab>('mergesort');

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40" style={{ borderTop: '2px solid var(--color-brand)' }}>
      {/* Tab bar — always visible */}
      <div
        className="flex items-center px-4 h-12 gap-1"
        style={{ backgroundColor: 'var(--color-bg-elevated)' }}
      >
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => {
              if (activeTab === id && open) {
                setOpen(false);
              } else {
                setActiveTab(id);
                setOpen(true);
              }
            }}
            className="px-3 py-1 rounded text-xs font-medium transition-colors duration-150"
            style={{
              backgroundColor: activeTab === id && open ? 'var(--color-brand)' : 'transparent',
              color: activeTab === id && open ? 'white' : 'var(--color-text-secondary)',
            }}
          >
            {label}
          </button>
        ))}
        <div className="ml-auto">
          <button
            onClick={() => setOpen(o => !o)}
            className="text-xs"
            style={{ color: 'var(--color-text-muted)' }}
            aria-label={open ? 'Collapse algo drawer' : 'Expand algo drawer'}
          >
            {open ? '▼ Collapse' : '▲ Algorithms'}
          </button>
        </div>
      </div>

      {/* Expandable content */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: '40vh', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            style={{
              backgroundColor: 'var(--color-bg-elevated)',
              overflowY: 'auto',
            }}
          >
            {TAB_CONTENT[activeTab]}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

---

## Task 16: `app/layout.tsx` — Root Layout

**Files:**
- Modify: `frontend/app/layout.tsx`

**Step 1: Replace layout with Inter font + Navbar**

```tsx
// frontend/app/layout.tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { NavbarWrapper } from '@/components/layout/NavbarWrapper';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'CineGraph — Watch algorithms discover what you\'ll love next',
  description:
    'A movie recommendation engine that makes its internals transparent — see the graph similarity matrix build, community clusters form, and ranking sort execute.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="antialiased">
        <NavbarWrapper />
        {children}
      </body>
    </html>
  );
}
```

**Step 2: Create `NavbarWrapper` (hides Navbar on landing page)**

Create `frontend/components/layout/NavbarWrapper.tsx`:

```tsx
// frontend/components/layout/NavbarWrapper.tsx
'use client';

import { usePathname } from 'next/navigation';
import { Navbar } from './Navbar';

export function NavbarWrapper() {
  const pathname = usePathname();
  if (pathname === '/') return null;
  return <Navbar />;
}
```

**Step 3: Verify dev server starts cleanly**

```bash
npm run dev
```

Expected: Page loads, `#141414` dark background, Inter font applied.

---

## Task 17: Landing Page — `app/page.tsx`

**Files:**
- Modify: `frontend/app/page.tsx`

**Step 1: Replace scaffold page with cold-start landing**

```tsx
// frontend/app/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { hasExistingToken, getOrCreateToken } from '@/lib/session';
import { api } from '@/lib/api';
import { GenrePicker } from '@/components/onboarding/GenrePicker';

export default function LandingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    // If user already has a session cookie → skip onboarding
    if (hasExistingToken()) {
      router.replace('/discover');
      return;
    }
    // Create token for the first-time visitor
    getOrCreateToken();
    setChecked(true);
  }, [router]);

  const handleSubmit = async (genres: string[]) => {
    setLoading(true);
    await api.startColdStart(genres);
    router.push('/discover');
  };

  if (!checked) return null; // Wait for session check before rendering

  return <GenrePicker onSubmit={handleSubmit} loading={loading} />;
}
```

**Step 2: Test flow manually**

1. Clear cookies → open `http://localhost:3000` → GenrePicker should appear
2. Select 3 genres → click "Find My Movies" → should navigate to `/discover`
3. Refresh `http://localhost:3000` → should redirect straight to `/discover` (cookie now exists)

---

## Task 18: Discover Page — `app/discover/page.tsx`

**Files:**
- Create: `frontend/app/discover/`
- Create: `frontend/app/discover/page.tsx`

**Step 1: Create discover page**

```tsx
// frontend/app/discover/page.tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { MovieRow } from '@/components/movies/MovieRow';
import { EngineSelector, type Engine } from '@/components/recommendation/EngineSelector';
import { WatchBudget } from '@/components/recommendation/WatchBudget';
import { AlgoDrawer } from '@/components/layout/AlgoDrawer';
import { api } from '@/lib/api';
import { socketEvents } from '@/lib/socket';
import type { Movie, RecommendReadyEvent } from '@/lib/types';

function groupByGenre(movies: Movie[]): Record<string, Movie[]> {
  const groups: Record<string, Movie[]> = {};
  for (const movie of movies) {
    const genre = movie.genres[0] ?? 'Other';
    if (!groups[genre]) groups[genre] = [];
    groups[genre].push(movie);
  }
  return groups;
}

export default function DiscoverPage() {
  const [engine, setEngine] = useState<Engine>('hybrid');
  const [budget, setBudget] = useState(120);
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRecommendations = useCallback(async () => {
    setLoading(true);
    try {
      await api.getRecommendations(engine, budget);
      // Real recommendations come via Socket.io recommend:ready event
      // Load mock data immediately as fallback
      const mock = await api.getMockMovies();
      setMovies(mock);
    } finally {
      setLoading(false);
    }
  }, [engine, budget]);

  useEffect(() => {
    fetchRecommendations();
  }, [fetchRecommendations]);

  // Listen for real recommendations from backend via Socket.io
  useEffect(() => {
    const unsub = socketEvents.onRecommendReady((event: RecommendReadyEvent) => {
      setMovies(event.recommendations.map(r => r.movie));
      setLoading(false);
    });
    return unsub;
  }, []);

  const genreGroups = groupByGenre(movies);
  const topMovies = movies.slice(0, 6);

  return (
    <main
      className="min-h-screen pt-20 pb-20"
      style={{ backgroundColor: 'var(--color-bg-base)' }}
    >
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4 px-8 mb-8">
        <EngineSelector value={engine} onChange={setEngine} />
        <WatchBudget value={budget} onChange={setBudget} />
      </div>

      {/* Movie rows */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div
            className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: 'var(--color-brand) transparent transparent transparent' }}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-10">
          {topMovies.length > 0 && (
            <MovieRow title="Recommended For You" movies={topMovies} />
          )}
          {Object.entries(genreGroups)
            .filter(([, ms]) => ms.length >= 2)
            .slice(0, 4)
            .map(([genre, ms]) => (
              <MovieRow key={genre} title={`Top in ${genre}`} movies={ms} />
            ))}
        </div>
      )}

      {/* Algorithm drawer pinned at bottom */}
      <AlgoDrawer />
    </main>
  );
}
```

**Step 2: Test manually**

Open `http://localhost:3000/discover`.
Expected: Navbar visible, engine selector and budget slider, movie rows populated from mock JSON.

---

## Task 19: Movie Detail — `app/movie/[id]/page.tsx`

**Files:**
- Create: `frontend/app/movie/[id]/page.tsx`
- Create: `frontend/components/layout/Toast.tsx`

**Step 1: Create Toast component**

```tsx
// frontend/components/layout/Toast.tsx
'use client';

import { useEffect, useState } from 'react';

interface ToastProps {
  message: string;
  onDismiss: () => void;
}

export function Toast({ message, onDismiss }: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div
      className="fixed top-20 right-4 z-50 px-4 py-3 rounded shadow-lg text-sm font-medium text-white"
      style={{
        backgroundColor: 'var(--color-brand)',
        borderLeft: '4px solid var(--color-brand-bright)',
        maxWidth: '320px',
      }}
    >
      {message}
    </div>
  );
}
```

**Step 2: Create movie detail page**

```tsx
// frontend/app/movie/[id]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { setPhase } from '@/lib/session';
import { backdropUrl, formatGenres, formatRuntime, formatScore, formatYear, posterUrl } from '@/lib/formatters';
import { RatingStars } from '@/components/movies/RatingStars';
import { MovieRow } from '@/components/movies/MovieRow';
import { Toast } from '@/components/layout/Toast';
import type { Movie, Phase } from '@/lib/types';

const PHASE_MESSAGES: Partial<Record<Phase, string>> = {
  warming: '🎉 You\'ve unlocked Content-Based recommendations! Rate 5 more movies to activate Collaborative filtering.',
  full: '🚀 Full Collaborative Filtering unlocked! Your taste graph is now active.',
};

export default function MovieDetailPage() {
  const params = useParams();
  const movieId = Number(params.id);

  const [movie, setMovie] = useState<Movie | null>(null);
  const [similar, setSimilar] = useState<Movie[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!movieId) return;
    api.getMovie(movieId).then(({ movie, similar }) => {
      setMovie(movie);
      setSimilar(similar);
      setLoading(false);
    });
  }, [movieId]);

  const handleRate = (newPhase: Phase) => {
    setPhase(newPhase);
    const msg = PHASE_MESSAGES[newPhase];
    if (msg) setToast(msg);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-bg-base)' }}>
        <div className="w-8 h-8 rounded-full border-2 animate-spin"
          style={{ borderColor: 'var(--color-brand) transparent transparent transparent' }} />
      </div>
    );
  }

  if (!movie) return null;

  const backdrop = movie.backdropPath ? backdropUrl(movie.backdropPath) : posterUrl(movie.posterPath);

  return (
    <main className="min-h-screen" style={{ backgroundColor: 'var(--color-bg-base)' }}>
      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}

      {/* Hero banner */}
      <div className="relative w-full" style={{ height: '70vh' }}>
        <Image
          src={backdrop}
          alt={movie.title}
          fill
          priority
          className="object-cover object-center"
          style={{ opacity: 0.5 }}
        />
        {/* Gradient overlay */}
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(to top, #141414 0%, rgba(20,20,20,0.6) 50%, transparent 100%)' }}
        />
        {/* Hero content */}
        <div className="absolute bottom-0 left-0 px-8 pb-10 max-w-2xl">
          <p className="text-xs font-semibold mb-2 uppercase tracking-widest" style={{ color: 'var(--color-brand)' }}>
            {formatGenres(movie.genres, 2)}
          </p>
          <h1 className="text-4xl font-bold text-white leading-tight mb-3">{movie.title}</h1>
          <div className="flex items-center gap-4 text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
            <span>⭐ {formatScore(movie.voteAverage)}</span>
            <span>{formatYear(movie.releaseYear)}</span>
            <span>{formatRuntime(movie.runtime)}</span>
            <span>Dir. {movie.director}</span>
          </div>
          <p className="text-sm leading-relaxed mb-6 line-clamp-3" style={{ color: 'var(--color-text-secondary)' }}>
            {movie.overview}
          </p>
          <div className="flex items-center gap-4">
            <button
              className="px-6 py-2.5 rounded font-semibold text-white text-sm"
              style={{ backgroundColor: 'var(--color-brand)' }}
            >
              ▶ Play Now
            </button>
            <button
              className="px-6 py-2.5 rounded font-semibold text-white text-sm"
              style={{ backgroundColor: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)' }}
            >
              + My List
            </button>
          </div>
        </div>
      </div>

      {/* Rate this movie */}
      <div className="px-8 py-6 flex items-center gap-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <span className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
          Rate this movie:
        </span>
        <RatingStars movieId={movie.id} onRate={handleRate} />
      </div>

      {/* Cast */}
      <div className="px-8 py-6">
        <p className="text-sm mb-2" style={{ color: 'var(--color-text-secondary)' }}>
          <span className="font-semibold text-white">Cast: </span>
          {movie.cast.slice(0, 5).join(', ')}
        </p>
      </div>

      {/* Similar movies */}
      {similar.length > 0 && (
        <div className="py-4">
          <MovieRow title="Similar Movies" movies={similar} />
        </div>
      )}
    </main>
  );
}
```

**Step 3: Test manually**

Click any MovieCard → should navigate to `/movie/[id]` with hero banner and details.
Rate a movie → "Saving…" appears briefly, no crash.

---

## Task 20: Graph Explorer — `app/graph/page.tsx`

**Files:**
- Create: `frontend/app/graph/`
- Create: `frontend/app/graph/page.tsx`

**Step 1: Create placeholder graph page**

```tsx
// frontend/app/graph/page.tsx
'use client';

import { useEffect, useRef } from 'react';

// Static placeholder nodes with community clusters
const NODES = [
  // Action cluster (purple) — top-left
  { id: 'u1', x: 180, y: 140, community: 0, label: 'User 1' },
  { id: 'u2', x: 240, y: 100, community: 0, label: 'User 2' },
  { id: 'u3', x: 150, y: 200, community: 0, label: 'User 3' },
  { id: 'u4', x: 280, y: 160, community: 0, label: 'User 4' },
  // Drama cluster (blue) — top-right
  { id: 'u5', x: 480, y: 120, community: 1, label: 'User 5' },
  { id: 'u6', x: 540, y: 80,  community: 1, label: 'User 6' },
  { id: 'u7', x: 510, y: 170, community: 1, label: 'User 7' },
  { id: 'u8', x: 580, y: 130, community: 1, label: 'User 8' },
  // Sci-Fi cluster (green) — bottom-left
  { id: 'u9',  x: 160, y: 360, community: 2, label: 'User 9' },
  { id: 'u10', x: 220, y: 320, community: 2, label: 'User 10' },
  { id: 'u11', x: 180, y: 420, community: 2, label: 'User 11' },
  { id: 'u12', x: 260, y: 390, community: 2, label: 'User 12' },
  // Horror cluster (amber) — bottom-right
  { id: 'u13', x: 480, y: 380, community: 3, label: 'User 13' },
  { id: 'u14', x: 540, y: 330, community: 3, label: 'User 14' },
  { id: 'u15', x: 560, y: 420, community: 3, label: 'User 15' },
  { id: 'u16', x: 500, y: 450, community: 3, label: 'User 16' },
  // Mixed — center bridge nodes
  { id: 'u17', x: 340, y: 200, community: 4, label: 'User 17' },
  { id: 'u18', x: 380, y: 280, community: 4, label: 'User 18' },
  { id: 'u19', x: 340, y: 350, community: 4, label: 'User 19' },
  { id: 'u20', x: 400, y: 200, community: 4, label: 'User 20' },
];

// MST-style edges between nodes (simulated)
const EDGES = [
  ['u1','u2'], ['u2','u3'], ['u3','u4'], ['u1','u4'],
  ['u5','u6'], ['u6','u7'], ['u7','u8'], ['u5','u8'],
  ['u9','u10'], ['u10','u11'], ['u11','u12'], ['u9','u12'],
  ['u13','u14'], ['u14','u15'], ['u15','u16'], ['u13','u16'],
  ['u4','u17'], ['u5','u20'], ['u17','u18'], ['u18','u19'],
  ['u19','u12'], ['u20','u18'],
];

const COMMUNITY_COLORS = [
  'var(--viz-color-1)', // purple
  'var(--viz-color-2)', // blue
  'var(--viz-color-3)', // green
  'var(--viz-color-4)', // amber
  'var(--viz-node-default)', // grey
];

const COMMUNITY_LABELS = ['Action', 'Drama', 'Sci-Fi', 'Horror', 'Mixed'];

export default function GraphPage() {
  const svgRef = useRef<SVGSVGElement>(null);

  // Mobile guard
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;

  if (isMobile) {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-8 text-center"
        style={{ backgroundColor: 'var(--color-bg-base)' }}
      >
        <div>
          <div className="text-5xl mb-4">🖥️</div>
          <h2 className="text-xl font-bold text-white mb-2">Desktop Only</h2>
          <p style={{ color: 'var(--color-text-secondary)' }}>
            The Graph Explorer requires a desktop screen (1024px+) for the D3 force layout visualization.
          </p>
        </div>
      </div>
    );
  }

  return (
    <main
      className="min-h-screen pt-16"
      style={{ backgroundColor: 'var(--color-bg-base)' }}
    >
      {/* Header */}
      <div className="px-8 py-6">
        <h1 className="text-2xl font-bold text-white mb-1">User Similarity Graph</h1>
        <p style={{ color: 'var(--color-text-secondary)' }} className="text-sm">
          User communities detected via Kruskal's MST · Taste paths via Dijkstra
          · <span style={{ color: 'var(--color-brand)' }}>Live D3 visualization coming when backend is live</span>
        </p>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 px-8 mb-6">
        {COMMUNITY_LABELS.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COMMUNITY_COLORS[i] }} />
            <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
          </div>
        ))}
        <div className="flex items-center gap-2">
          <div className="w-6 h-0.5" style={{ backgroundColor: 'var(--viz-mst-edge)' }} />
          <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>MST Edge</span>
        </div>
      </div>

      {/* Placeholder SVG graph */}
      <div className="px-8">
        <div
          className="rounded-lg overflow-hidden"
          style={{ backgroundColor: '#0D0D0D', border: '1px solid var(--color-border)' }}
        >
          <svg
            ref={svgRef}
            width="100%"
            viewBox="0 0 740 540"
            style={{ display: 'block' }}
          >
            {/* MST edges */}
            {EDGES.map(([a, b], i) => {
              const na = NODES.find(n => n.id === a)!;
              const nb = NODES.find(n => n.id === b)!;
              return (
                <line
                  key={i}
                  x1={na.x} y1={na.y} x2={nb.x} y2={nb.y}
                  stroke="var(--viz-mst-edge)"
                  strokeWidth="1.5"
                  strokeOpacity="0.7"
                />
              );
            })}

            {/* Nodes */}
            {NODES.map(node => (
              <g key={node.id}>
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={14}
                  fill={COMMUNITY_COLORS[node.community]}
                  opacity={0.9}
                  className="cursor-pointer"
                  style={{ transition: 'opacity 150ms' }}
                >
                  <title>{`${node.label} · Click for taste path (live when backend is running)`}</title>
                </circle>
                <text
                  x={node.x}
                  y={node.y + 1}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="white"
                  fontSize="8"
                  fontWeight="600"
                  pointerEvents="none"
                >
                  {node.id.replace('u', '')}
                </text>
              </g>
            ))}
          </svg>
        </div>

        {/* Placeholder note */}
        <div
          className="mt-4 p-4 rounded text-sm"
          style={{ backgroundColor: 'var(--color-bg-elevated)', color: 'var(--color-text-secondary)' }}
        >
          <strong style={{ color: 'var(--color-brand)' }}>Placeholder visualization.</strong>{' '}
          When the backend is running, this will become a live D3 force-directed graph with
          Kruskal's MST community detection, animated edge building, and Dijkstra taste-path
          animation on node click.
        </div>
      </div>
    </main>
  );
}
```

**Step 2: Add `next.config.ts` image domain for TMDB**

```ts
// frontend/next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'image.tmdb.org',
        pathname: '/t/p/**',
      },
    ],
  },
};

export default nextConfig;
```

**Step 3: Final build check**

```bash
npm run build
```

Expected: Build succeeds with no TypeScript or ESLint errors. Review any warnings.

**Step 4: Test all pages manually**

| URL | Expected |
|---|---|
| `http://localhost:3000/` | Genre picker (first visit) or redirect to /discover |
| `http://localhost:3000/discover` | Navbar, engine selector, movie rows from mock JSON |
| `http://localhost:3000/movie/155` | Dark Knight hero banner, similar movies, rating stars |
| `http://localhost:3000/graph` | Placeholder SVG node graph with community colors |

---

## Summary

| Task | File(s) Created/Modified |
|---|---|
| 1 | `package.json`, `.env.local` |
| 2 | `app/globals.css` |
| 3 | `public/mock/movies.json` |
| 4 | `lib/types.ts` |
| 5 | `lib/session.ts` |
| 6 | `lib/formatters.ts` |
| 7 | `lib/api.ts` |
| 8 | `lib/socket.ts` |
| 9 | `components/layout/Navbar.tsx` |
| 10 | `components/movies/MovieCard.tsx` |
| 11 | `components/movies/MovieRow.tsx`, `ChevronIcons.tsx` |
| 12 | `components/movies/RatingStars.tsx` |
| 13 | `components/onboarding/GenrePicker.tsx` |
| 14 | `components/recommendation/EngineSelector.tsx`, `WatchBudget.tsx` |
| 15 | `components/layout/AlgoDrawer.tsx` |
| 16 | `app/layout.tsx`, `components/layout/NavbarWrapper.tsx` |
| 17 | `app/page.tsx` |
| 18 | `app/discover/page.tsx` |
| 19 | `app/movie/[id]/page.tsx`, `components/layout/Toast.tsx` |
| 20 | `app/graph/page.tsx`, `next.config.ts` |
