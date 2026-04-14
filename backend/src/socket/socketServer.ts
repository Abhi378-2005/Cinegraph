import { Server, type Socket } from 'socket.io';
import type { Server as HTTPServer } from 'http';
import { setEmitter } from '../routes/recommend';
import { setGraphEmitter } from '../routes/graph';
import { dijkstra } from '../algorithms/dijkstra';
import { getAllUserIds, getUserRatings } from '../redis/ratings';
import { pearsonCorrelation } from '../ml/pearsonCorrelation';
import { log, timer } from '../logger';

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
    log.socket(`CONNECT  user=${userId.slice(0, 12)}  socketId=${socket.id}  online=${userSocketMap.size}`);

    socket.on('disconnect', (reason) => {
      userSocketMap.delete(userId);
      log.socket(`DISCONNECT  user=${userId.slice(0, 12)}  reason=${reason}  online=${userSocketMap.size}`);
    });

    socket.on('recommend:start', ({ engine, budget }: { engine: string; budget?: number }) => {
      log.socket(`recommend:start  user=${userId.slice(0, 12)}  engine=${engine}  budget=${budget ?? 'none'}`);
    });

    socket.on('similarity:compute', () => {
      log.socket(`similarity:compute  user=${userId.slice(0, 12)}`);
    });

    socket.on('tastepath:find', async ({ sourceUserId, targetUserId }: { sourceUserId: string; targetUserId: string }) => {
      const elapsed = timer();
      log.socket(`tastepath:find  src=${sourceUserId.slice(0, 12)}  tgt=${targetUserId.slice(0, 12)}`);
      try {
        const allIds = await getAllUserIds();
        const capped = allIds.slice(0, 20);

        const sourceIdx = capped.indexOf(sourceUserId);
        const targetIdx = capped.indexOf(targetUserId);

        if (sourceIdx === -1 || targetIdx === -1) {
          log.socket(`tastepath:find  src or tgt not in user graph`);
          socket.emit('tastepath:error', { message: 'User not found in similarity graph' });
          return;
        }

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

        const { path, distance, steps } = dijkstra(matrix, capped, sourceIdx, targetIdx);
        log.socket(`tastepath:find  path=${path.length} hops  dist=${distance.toFixed(3)}  steps=${steps.length}  (${elapsed()})`);

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
      // Skip per-step logging — algo:step fires hundreds of times and floods logs
      if (event !== 'algo:step') {
        log.socket(`EMIT  event=${event}  user=${userId.slice(0, 12)}  socketId=${socketId}`);
      }
      io.to(socketId).emit(event, data);
    } else {
      // Only warn for meaningful events, not individual steps
      if (event !== 'algo:step') {
        log.socket(`EMIT MISSED  event=${event}  user=${userId.slice(0, 12)}  — no socket connected`);
      }
    }
  });

  setGraphEmitter((userId: string, event: string, data: unknown) => {
    const socketId = userSocketMap.get(userId);
    if (socketId) {
      if (event !== 'graph:step') {
        log.socket(`EMIT  event=${event}  user=${userId.slice(0, 12)}  socketId=${socketId}`);
      }
      io.to(socketId).emit(event, data);
    } else {
      if (event !== 'graph:step') {
        log.socket(`EMIT MISSED  event=${event}  user=${userId.slice(0, 12)}  — no socket connected`);
      }
    }
  });

  console.log('[socket] Socket.io server initialized');
}
