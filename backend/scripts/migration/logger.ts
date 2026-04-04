import fs from 'fs';
import path from 'path';

const LOG_PATH = path.join(process.cwd(), 'data', 'migration', 'migration.log');

function ensureLogDir(): void {
  fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
}

function formatLine(level: string, msg: string): string {
  return `[${new Date().toISOString()}] [${level}] ${msg}`;
}

function write(level: string, msg: string): void {
  const line = formatLine(level, msg);
  ensureLogDir();
  fs.appendFileSync(LOG_PATH, line + '\n');
  if (level === 'ERROR' || level === 'WARN') {
    process.stderr.write(line + '\n');
  } else {
    process.stdout.write(line + '\n');
  }
}

export const logger = {
  info:  (msg: string) => write('INFO',  msg),
  warn:  (msg: string) => write('WARN',  msg),
  error: (msg: string) => write('ERROR', msg),

  /** Log a section header so phases are easy to find in the log file */
  section: (title: string) => {
    const bar = '='.repeat(50);
    write('INFO', bar);
    write('INFO', `  ${title}`);
    write('INFO', bar);
  },
};
