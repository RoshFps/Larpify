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

  it("replaces today's snapshot and keeps only the last 92 days", () => {
    const many = Array.from({ length: 100 }, (_, i) => snap(dayKey(new Date(2026, 6, 1).getTime() + i * 86_400_000)));
    const updated = withSnapshot(withSnapshot(many, snap('2026-11-03', ['a'])), snap('2026-11-03', ['b']));
    expect(updated).toHaveLength(92);
    expect(updated.at(-1)).toEqual(snap('2026-11-03', ['b']));
  });
});

describe('topHistory', () => {
  it('picks the #1 seen on the most days in the last 90', async () => {
    const { topHistory } = await import('./snapshots');
    const now = new Date(2026, 10, 4).getTime();
    const snaps = [
      { day: '2026-06-01', artists: [], tracks: [], topArtist: 'Old', topTrack: 'Old song' },
      { day: '2026-10-01', artists: [], tracks: [], topArtist: 'SZA', topTrack: 'Snooze' },
      { day: '2026-10-02', artists: [], tracks: [], topArtist: 'SZA', topTrack: 'Kill Bill' },
      { day: '2026-11-03', artists: [], tracks: [], topArtist: 'Mitski', topTrack: 'Kill Bill' },
      { day: '2026-11-04', artists: [], tracks: [] },
    ];
    expect(topHistory(snaps, now)).toEqual({ artist: { name: 'SZA', days: 2 }, track: { name: 'Kill Bill', days: 2 }, days: 3 });
  });
});
