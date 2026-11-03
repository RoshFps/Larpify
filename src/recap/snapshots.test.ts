import { describe, expect, it } from 'vitest';
import { dayKey, previousSnapshot, withSnapshot, type Snapshot } from './snapshots';

const snap = (day: string, artists: string[] = []): Snapshot => ({ day, artists, tracks: [] });
const NOV_3 = new Date(2026, 10, 3, 12).getTime();

describe('recap snapshots', () => {
  it('formats sortable day keys', () => {
    expect(dayKey(NOV_3)).toBe('2026-11-03');
  });

  it('compares against the latest earlier day, not today', () => {
    const snapshots = [snap('2026-10-30', ['x']), snap('2026-11-01', ['y']), snap('2026-11-03', ['z'])];
    expect(previousSnapshot(snapshots, NOV_3)?.artists).toEqual(['y']);
    expect(previousSnapshot([snap('2026-11-03')], NOV_3)).toBeNull();
  });

  it("replaces today's snapshot and keeps only the last 14 days", () => {
    const many = Array.from({ length: 20 }, (_, i) => snap(`2026-10-${String(i + 1).padStart(2, '0')}`));
    const updated = withSnapshot(withSnapshot(many, snap('2026-11-03', ['a'])), snap('2026-11-03', ['b']));
    expect(updated).toHaveLength(14);
    expect(updated.at(-1)).toEqual(snap('2026-11-03', ['b']));
  });
});
