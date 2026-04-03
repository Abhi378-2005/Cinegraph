import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { preprocessMovie } from '../../src/tmdb/preprocessor';
import type { Movie } from '../../src/types';

const PROXY_BASE = process.env.TMDB_PROXY_URL ?? 'https://proxy-gate-tanendra77.vercel.app/api/proxy';
const API_KEY    = process.env.TMDB_API_KEY;
if (!API_KEY) throw new Error('TMDB_API_KEY environment variable is required');
const DELAY_MS   = 300;
const MAX_RETRIES = 3;

export interface Checkpoint {
  lastPage: number;
  totalFetched: number;
  totalPages: number;
}

const CHECKPOINT_PATH = path.join(process.cwd(), 'data', 'migration', 'checkpoint.json');
const JSONL_PATH      = path.join(process.cwd(), 'data', 'migration', 'movies_raw.jsonl');

export function loadCheckpoint(): Checkpoint | null {
  if (!fs.existsSync(CHECKPOINT_PATH)) return null;
  return JSON.parse(fs.readFileSync(CHECKPOINT_PATH, 'utf-8')) as Checkpoint;
}

function saveCheckpoint(cp: Checkpoint): void {
  fs.mkdirSync(path.dirname(CHECKPOINT_PATH), { recursive: true });
  fs.writeFileSync(CHECKPOINT_PATH, JSON.stringify(cp, null, 2));
}

function appendMovies(movies: Movie[]): void {
  fs.mkdirSync(path.dirname(JSONL_PATH), { recursive: true });
  const lines = movies.map(m => JSON.stringify(m)).join('\n') + '\n';
  fs.appendFileSync(JSONL_PATH, lines);
}

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

async function fetchPage(page: number): Promise<{ movies: Movie[]; totalPages: number }> {
  const tmdbUrl = `https://api.themoviedb.org/3/movie/popular?api_key=${API_KEY}&page=${page}`;
  const url = `${PROXY_BASE}?url=${encodeURIComponent(tmdbUrl)}`;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const { data } = await axios.get(url, { timeout: 15000 });
      const movies = (data.results as unknown[]).map(r =>
        preprocessMovie(r as unknown as Parameters<typeof preprocessMovie>[0])
      );
      return { movies, totalPages: data.total_pages as number };
    } catch (err) {
      if (attempt === MAX_RETRIES) throw err;
      const backoff = attempt * 1000;
      console.warn(`Page ${page} attempt ${attempt} failed, retrying in ${backoff}ms...`);
      await delay(backoff);
    }
  }
  throw new Error(`Failed to fetch page ${page} after ${MAX_RETRIES} attempts`);
}

export async function fetchAllMovies(
  targetPages = 5000,
  resumeFrom = 0
): Promise<void> {
  const resumeCheckpoint = resumeFrom > 0 ? loadCheckpoint() : null;
  let startPage = resumeFrom + 1;
  let totalFetched = resumeCheckpoint?.totalFetched ?? 0;

  console.log(`Starting fetch from page ${startPage} (target: ${targetPages} pages)`);

  for (let page = startPage; page <= targetPages; page++) {
    const { movies, totalPages } = await fetchPage(page);
    appendMovies(movies);
    totalFetched += movies.length;

    saveCheckpoint({ lastPage: page, totalFetched, totalPages });

    if (page % 50 === 0) {
      console.log(`Progress: page ${page}/${Math.min(targetPages, totalPages)} — ${totalFetched} movies`);
    }

    await delay(DELAY_MS);

    if (page >= totalPages) {
      console.log(`Reached last available page (${totalPages}). Done.`);
      break;
    }
  }

  console.log(`Fetch complete. Total movies: ${totalFetched}`);
}

export function loadMoviesFromJsonl(): Movie[] {
  if (!fs.existsSync(JSONL_PATH)) return [];
  return fs.readFileSync(JSONL_PATH, 'utf-8')
    .split('\n')
    .filter(Boolean)
    .map(line => JSON.parse(line) as Movie);
}
