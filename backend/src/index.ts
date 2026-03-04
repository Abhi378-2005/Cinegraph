import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { redis } from './redis/client';
import { moviesRouter } from './routes/movies';
import { rateRouter } from './routes/rate';
import { recommendRouter } from './routes/recommend';
import { similarityRouter } from './routes/similarity';
import { initSocketServer } from './socket/socketServer';

export const app = express();
export const httpServer = createServer(app);

app.use(cors({ origin: process.env.FRONTEND_URL ?? 'http://localhost:3000', credentials: true }));
app.use(express.json());

app.get('/health', async (_req, res) => {
  let redisOk = false;
  try { await redis.ping(); redisOk = true; } catch { /* offline */ }
  res.json({ status: 'ok', redis: redisOk, uptime: process.uptime() });
});

app.use('/movies', moviesRouter);
app.use('/rate', rateRouter);
app.use('/recommend', recommendRouter);
app.use('/similarity', similarityRouter);

// Initialize Socket.io — must be called before httpServer.listen
initSocketServer(httpServer);

const PORT = process.env.PORT ?? 3001;
httpServer.listen(PORT, () => {
  console.log(`CineGraph backend running on port ${PORT}`);
});
