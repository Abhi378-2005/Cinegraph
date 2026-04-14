'use client';
// frontend/lib/socket.ts

import { io, type Socket } from 'socket.io-client';
import { getOrCreateToken } from '@/lib/session';
import type {
  AlgoStepEvent,
  AlgoCompleteEvent,
  RecommendReadyEvent,
  CommunityUpdateEvent,
  GraphStepEvent,
  GraphCompleteEvent,
} from '@/lib/types';

let _socket: Socket | null = null;

export function getSocket(): Socket {
  if (!_socket) {
    const url = process.env.NEXT_PUBLIC_SOCKET_URL ?? '';
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
  onRecommendError:   (cb: (d: { message: string }) => void): Unsubscribe => safeOn('recommend:error', cb),
  onCommunityUpdate:  (cb: (d: CommunityUpdateEvent) => void): Unsubscribe=> safeOn('community:update', cb),
  onGraphStep:        (cb: (d: GraphStepEvent) => void): Unsubscribe      => safeOn('graph:step', cb),
  onGraphComplete:    (cb: (d: GraphCompleteEvent) => void): Unsubscribe  => safeOn('graph:complete', cb),
  emitRecommendStart: (engine: string, budget?: number) => safeEmit('recommend:start', { engine, budget }),
  emitTastePathFind:  (src: string, tgt: string)        => safeEmit('tastepath:find', { sourceUserId: src, targetUserId: tgt }),
  emitSimilarityCompute: (userIds: string[])            => safeEmit('similarity:compute', { userIds }),
};
