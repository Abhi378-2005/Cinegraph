import { Server, type Socket } from 'socket.io';
import type { Server as HTTPServer } from 'http';
import { setEmitter } from '../routes/recommend';
import { dijkstra } from '../algorithms/dijkstra';
import { getAllUserIds, getUserRatings } from '../redis/ratings';
import { pearsonCorrelation } from '../ml/pearsonCorrelation';

// Map userId → socketId for targeting specific users
const userSocketMap = new Map<string, string>();

export function initSocketServer(httpServer: HTTPServer): void {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
      credentials: true,
    },
  });

  // Auth middleware — require non-empty token
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token || typeof token !== 'string') {
      return next(new Error('Missing auth token'));
    }
    (socket as Socket & { userId: string }).userId = token;
    next();
  });

  io.on('connection', (socket) => {
    const userId = (socket as Socket & { userId: string }).userId;
    userSocketMap.set(userId, socket.id);

    socket.on('disconnect', () => {
      userSocketMap.delete(userId);
    });

    // 'recommend:start' — client can re-subscribe, but actual job is launched by REST route
    socket.on('recommend:start', ({ engine, budget }: { engine: string; budget?: number }) => {
      console.log(`[socket] recommend:start userId=${userId} engine=${engine}`);
    });

    // 'similarity:compute' — client requests Floyd-Warshall computation
    // (The REST route kicks off the actual job; this is for direct socket-triggered computation)
    socket.on('similarity:compute', async ({ userIds }: { userIds?: string[] }) => {
      console.log(`[socket] similarity:compute userId=${userId}`);
      // The actual computation is handled by GET /similarity REST route
      // This event is acknowledged but computation is REST-driven
    });

    // 'tastepath:find' — Dijkstra between two users, streamed step by step
    socket.on('tastepath:find', async ({ sourceUserId, targetUserId }: { sourceUserId: string; targetUserId: string }) => {
      try {
        const allIds = await getAllUserIds();
        const capped = allIds.slice(0, 20);

        const sourceIdx = capped.indexOf(sourceUserId);
        const targetIdx = capped.indexOf(targetUserId);

        if (sourceIdx === -1 || targetIdx === -1) {
          socket.emit('tastepath:error', { message: 'User not found in similarity graph' });
          return;
        }

        // Build Pearson similarity matrix for capped users
        const n = capped.length;
        const ratingsMap: Record<string, Record<number, number>> = {};
        const ratings = await Promise.all(capped.map(uid => getUserRatings(uid)));
        capped.forEach((uid, i) => { ratingsMap[uid] = ratings[i]; });

        const matrix: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
        for (let i = 0; i < n; i++) {
          matrix[i][i] = 1;
          for (let j = i + 1; j < n; j++) {
            const sim = Math.max(0, pearsonCorrelation(ratingsMap[capped[i]], ratingsMap[capped[j]]));
            matrix[i][j] = matrix[j][i] = sim;
          }
        }

        // Run Dijkstra and stream steps
        const { path, distance, steps } = dijkstra(matrix, capped, sourceIdx, targetIdx);

        for (const step of steps) {
          if (!socket.connected) break;
          socket.emit('algo:step', { algorithm: 'dijkstra', step });
          await new Promise(r => setTimeout(r, 16));
        }

        socket.emit('tastepath:result', { path, distance });
      } catch (err) {
        console.error('[socket] tastepath:find error:', err);
        socket.emit('tastepath:error', { message: 'Taste path computation failed' });
      }
    });
  });

  // Wire emitter so REST routes can emit to specific users by userId
  setEmitter((userId: string, event: string, data: unknown) => {
    const socketId = userSocketMap.get(userId);
    if (socketId) {
      io.to(socketId).emit(event, data);
    } else {
      console.warn(`[socket] emitToUser: no socket for userId=${userId}`);
    }
  });

  console.log('[socket] Socket.io server initialized');
}
