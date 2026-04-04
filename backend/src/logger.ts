// src/logger.ts — central logger, writes to stdout + logs/app.log
import fs from 'fs';
import path from 'path';

// Ensure logs/ directory exists
const LOG_DIR  = path.resolve(__dirname, '../../logs');
const LOG_FILE = path.join(LOG_DIR, 'app.log');
fs.mkdirSync(LOG_DIR, { recursive: true });
const logStream = fs.createWriteStream(LOG_FILE, { flags: 'a' });

function ts(): string {
  return new Date().toISOString().slice(0, 23).replace('T', ' '); // YYYY-MM-DD HH:MM:SS.mmm
}

const TAGS: Record<string, string> = {
  http:       '[http      ]',
  redis:      '[redis     ]',
  bq:         '[bigquery  ]',
  ml:         '[ml        ]',
  recommend:  '[recommend ]',
  socket:     '[socket    ]',
  rate:       '[rate      ]',
  similarity: '[similarity]',
  seed:       '[seed      ]',
};

function write(tag: string, msg: string): void {
  const line = `${ts()}  ${TAGS[tag] ?? `[${tag}]`}  ${msg}`;
  console.log(line);
  logStream.write(line + '\n');
}

export function timer(): () => string {
  const start = Date.now();
  return () => `${Date.now() - start}ms`;
}

export const log = {
  http:       (msg: string) => write('http', msg),
  redis:      (msg: string) => write('redis', msg),
  bq:         (msg: string) => write('bq', msg),
  ml:         (msg: string) => write('ml', msg),
  recommend:  (msg: string) => write('recommend', msg),
  socket:     (msg: string) => write('socket', msg),
  rate:       (msg: string) => write('rate', msg),
  similarity: (msg: string) => write('similarity', msg),
};
