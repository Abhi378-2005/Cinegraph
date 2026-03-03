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
