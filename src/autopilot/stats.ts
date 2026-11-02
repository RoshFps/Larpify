import { readJson, writeJson } from '../lib/storage';

const KEY = 'larpify.stats';

interface DailyStats {
  day: string;
  ms: number;
}

function today(now: number): string {
  const d = new Date(now);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export function readTodayMs(now = Date.now()): number {
  const stats = readJson<DailyStats>(KEY);
  return stats?.day === today(now) ? stats.ms : 0;
}

export function addListening(ms: number, now = Date.now()): number {
  const total = readTodayMs(now) + ms;
  writeJson(KEY, { day: today(now), ms: total } satisfies DailyStats);
  return total;
}
