// Spotify doesn't say how Wrapped is computed. What it does expose is your top
// artists and songs over three windows. Wrapped covers roughly January to
// mid-November, so a weighted blend of those windows is a decent stand-in:
// the 6-month list overlaps it most, the 12-month list covers the start of the
// year, and the 4-week list shows where things are heading.

export interface RankedList<T> {
  items: readonly T[];
  weight: number;
}

export interface Prediction<T> {
  item: T;
  rank: number;
  score: number;
  /** Points from each input list, in the order the lists were given. */
  parts: number[];
}

export const RANGE_WEIGHTS = { long_term: 0.3, medium_term: 0.5, short_term: 0.2 } as const;

/** Spotify's top lists hold at most 50 items; points are spread over that scale. */
const LIST_SIZE = 50;

/**
 * Each list awards points by position (first place gets the most), scaled by
 * the list's weight. Using a fixed scale means a short list, from someone who
 * hasn't listened much lately, doesn't hand its last place full marks.
 * Items are matched by `id`; the first copy seen is kept.
 */
export function blendRankings<T extends { id: string }>(lists: readonly RankedList<T>[], limit = 50): Prediction<T>[] {
  const scores = new Map<string, { item: T; score: number; parts: number[] }>();
  lists.forEach(({ items, weight }, listIndex) => {
    items.forEach((item, index) => {
      const points = weight * Math.max(0, (LIST_SIZE - index) / LIST_SIZE);
      let entry = scores.get(item.id);
      if (!entry) {
        entry = { item, score: 0, parts: lists.map(() => 0) };
        scores.set(item.id, entry);
      }
      entry.score += points;
      entry.parts[listIndex] = points;
    });
  });
  return [...scores.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

/**
 * Positions moved since `previousIds` (positive = climbed). Null when the item
 * wasn't ranked before, which the UI shows as "new".
 */
export function movement(id: string, rank: number, previousIds: readonly string[] | null): number | null {
  if (!previousIds) return 0;
  const before = previousIds.indexOf(id);
  return before === -1 ? null : before + 1 - rank;
}
