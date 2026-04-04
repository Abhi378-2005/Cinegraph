import fs from 'fs';
import path from 'path';
import { tmdbClient } from '../../src/tmdb/client';
import { preprocessMovie } from '../../src/tmdb/preprocessor';
import { logger } from './logger';
import type { Movie } from '../../src/types';
import { loadMoviesFromJsonl } from './fetchMovies';

const DELAY_MS    = 300;
const MAX_RETRIES = 3;

export const ENRICH_CHECKPOINT_PATH = path.join(process.cwd(), 'data', 'migration', 'enrich_checkpoint.json');
export const ENRICHED_PATH          = path.join(process.cwd(), 'data', 'migration', 'movies_enriched.jsonl');

interface EnrichCheckpoint { lastIndex: number; totalEnriched: number; }

export function loadEnrichCheckpoint(): EnrichCheckpoint | null {
  if (!fs.existsSync(ENRICH_CHECKPOINT_PATH)) return null;
  return JSON.parse(fs.readFileSync(ENRICH_CHECKPOINT_PATH, 'utf-8')) as EnrichCheckpoint;
}

function saveEnrichCheckpoint(cp: EnrichCheckpoint): void {
  fs.mkdirSync(path.dirname(ENRICH_CHECKPOINT_PATH), { recursive: true });
  fs.writeFileSync(ENRICH_CHECKPOINT_PATH, JSON.stringify(cp, null, 2));
}

function appendEnriched(movies: Movie[]): void {
  fs.mkdirSync(path.dirname(ENRICHED_PATH), { recursive: true });
  fs.appendFileSync(ENRICHED_PATH, movies.map(m => JSON.stringify(m)).join('\n') + '\n');
}

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

async function fetchDetail(movieId: number): Promise<Movie> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const { data } = await tmdbClient.get(`/movie/${movieId}`, {
        params: { append_to_response: 'credits,keywords' },
      });
      return preprocessMovie(data, data.credits, data.keywords);
    } catch (err) {
      if (attempt === MAX_RETRIES) throw err;
      const backoff = attempt * 1000;
      logger.warn(`Movie ${movieId} attempt ${attempt} failed, retrying in ${backoff}ms...`);
      await delay(backoff);
    }
  }
  throw new Error(`Failed to fetch detail for movie ${movieId}`);
}

export async function enrichMovies(startIndex = 0): Promise<void> {
  const rawMovies = loadMoviesFromJsonl();
  if (rawMovies.length === 0) {
    logger.warn('No raw movies found — run fetch phase first.');
    return;
  }

  const remaining = rawMovies.length - startIndex;
  logger.info(`Enriching ${remaining} movies (index ${startIndex}–${rawMovies.length - 1})`);
  logger.info(`Estimated time: ~${Math.ceil(remaining * DELAY_MS / 60000)} minutes`);

  let totalEnriched = startIndex;

  for (let i = startIndex; i < rawMovies.length; i++) {
    const raw = rawMovies[i];
    try {
      const enriched = await fetchDetail(raw.id);
      appendEnriched([enriched]);
    } catch (err) {
      logger.warn(`Movie ${raw.id} detail fetch failed, falling back to raw data: ${err}`);
      appendEnriched([raw]);
    }
    totalEnriched++;
    saveEnrichCheckpoint({ lastIndex: i, totalEnriched });

    if (totalEnriched % 100 === 0) {
      logger.info(`Enrich progress: ${totalEnriched}/${rawMovies.length}`);
    }

    if (i < rawMovies.length - 1) await delay(DELAY_MS);
  }

  logger.info(`Enrich complete. ${totalEnriched} movies written to movies_enriched.jsonl`);
}

export function loadEnrichedMovies(): Movie[] {
  if (!fs.existsSync(ENRICHED_PATH)) return [];
  return fs.readFileSync(ENRICHED_PATH, 'utf-8')
    .split('\n')
    .filter(Boolean)
    .map(line => JSON.parse(line) as Movie);
}
