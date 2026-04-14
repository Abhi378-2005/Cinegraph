import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { redis } from './redis/client';
import { moviesRouter } from './routes/movies';
import { rateRouter } from './routes/rate';
import { recommendRouter } from './routes/recommend';
import { similarityRouter } from './routes/similarity';
import { profileRouter } from './routes/profile';
import { graphRouter } from './routes/graph';
import { initSocketServer } from './socket/socketServer';
import { ensureTables } from './bigquery/client';
import { log, timer } from './logger';

export const app = express();
export const httpServer = createServer(app);

app.use(cors({ origin: process.env.FRONTEND_URL ?? 'http://localhost:3000', credentials: true }));
app.use(express.json());

// Request/response logging
app.use((req, _res, next) => {
  const elapsed = timer();
  _res.on('finish', () => {
    log.http(`${req.method} ${req.path} → ${_res.statusCode}  (${elapsed()})`);
  });
  next();
});

app.get('/health', async (_req, res) => {
  let redisOk = false;
  try { await redis.ping(); redisOk = true; } catch { /* offline */ }
  log.http(`health  redis=${redisOk}  uptime=${process.uptime().toFixed(1)}s`);
  res.json({ status: 'ok', redis: redisOk, uptime: process.uptime() });
});

app.use('/movies', moviesRouter);
app.use('/rate', rateRouter);
app.use('/recommend', recommendRouter);
app.use('/similarity', similarityRouter);
app.use('/profile', profileRouter);
app.use('/graph', graphRouter);

// Initialize Socket.io — must be called before httpServer.listen
initSocketServer(httpServer);

const PORT = process.env.PORT ?? 3001;
httpServer.listen(PORT, () => {
  console.log(`CineGraph backend running on port ${PORT}`);
  // Ensure all BQ tables exist (including user_ratings) — fire-and-forget
  ensureTables().catch(err => console.error('ensureTables failed:', err?.message ?? err));
});
