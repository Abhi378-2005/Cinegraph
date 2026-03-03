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
