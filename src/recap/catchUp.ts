// How much would you need to play someone to make them your #1?
//
// Spotify doesn't share play counts, only ranked lists. So this assumes your
// listening follows a Zipf curve, which is how music listening usually looks:
// your #1 gets about twice the plays of #2, three times #3, and so on, over
// your top 50. With your daily listening time, that turns ranks into minutes.

const LIST_SIZE = 50;
const HARMONIC = Array.from({ length: LIST_SIZE }, (_, i) => 1 / (i + 1)).reduce((a, b) => a + b, 0);

/** Share of listening that goes to the artist (or song) at `rank`; 0 when unranked. */
export function zipfShare(rank: number | null): number {
  if (rank === null || rank < 1 || rank > LIST_SIZE) return 0;
  return 1 / rank / HARMONIC;
}

const DAY = 86_400_000;

/**
 * Spotify stops counting for its recap around mid-November. After that,
 * anything you play counts toward next year's.
 */
export function recapWindow(now: number): { elapsedDays: number; daysLeft: number; year: number } {
  const date = new Date(now);
  const year = date.getFullYear();
  const start = new Date(year, 0, 1).getTime();
  const cutoff = new Date(year, 10, 15).getTime();
  if (now <= cutoff) {
    return { elapsedDays: (now - start) / DAY, daysLeft: Math.max(1, (cutoff - now) / DAY), year };
  }
  const nextStart = new Date(year + 1, 0, 1).getTime();
  const nextCutoff = new Date(year + 1, 10, 15).getTime();
  // Days until next year starts still count as nothing, so plan over next year's window.
  return { elapsedDays: 0, daysLeft: (nextCutoff - nextStart) / DAY, year: year + 1 };
}

export interface CatchUp {
  /** Extra minutes a day of only this artist/song, on top of your usual listening. */
  minutesPerDay: number;
  daysLeft: number;
  year: number;
  /** Estimated minutes your current #1 will have by the cutoff. */
  leaderMinutes: number;
  /** Estimated minutes the pick has so far. */
  currentMinutes: number;
}

/**
 * Minutes a day of extra listening to the pick (currently at `rank`, or null if
 * outside your top 50) needed to pass your #1 by the recap cutoff, assuming the
 * rest of your listening keeps its shape.
 */
export function catchUp(rank: number | null, dailyMinutes: number, now: number): CatchUp {
  const { elapsedDays, daysLeft, year } = recapWindow(now);
  const leaderMinutes = dailyMinutes * (elapsedDays + daysLeft) * zipfShare(1);
  const currentMinutes = dailyMinutes * elapsedDays * zipfShare(rank);
  // The pick also keeps earning its usual share over the days left.
  const usualAhead = dailyMinutes * daysLeft * zipfShare(rank);
  const gap = Math.max(0, leaderMinutes - currentMinutes - usualAhead);
  return { minutesPerDay: rank === 1 ? 0 : gap / daysLeft, daysLeft, year, leaderMinutes, currentMinutes };
}
