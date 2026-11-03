import { describe, expect, it } from 'vitest';
import { blendRankings, movement } from './predict';

const items = (...ids: string[]) => ids.map((id) => ({ id }));

describe('blendRankings', () => {
  it('ranks by weighted position across lists', () => {
    const result = blendRankings([
      { items: items('a', 'b', 'c'), weight: 0.5 },
      { items: items('c', 'b', 'a'), weight: 0.2 },
    ]);
    expect(result.map((r) => r.item.id)).toEqual(['a', 'b', 'c']);
    expect(result.map((r) => r.rank)).toEqual([1, 2, 3]);
  });

  it('rewards showing up in several windows', () => {
    const result = blendRankings([
      { items: items('everywhere', 'onlyHere'), weight: 0.5 },
      { items: items('x', 'everywhere'), weight: 0.3 },
    ]);
    expect(result[0]?.item.id).toBe('everywhere');
  });

  it('lets a strong recent run overtake an old favourite', () => {
    const result = blendRankings([
      { items: items('old', 'rising'), weight: 0.3 },
      { items: items('rising', 'other'), weight: 0.5 },
      { items: items('rising', 'other'), weight: 0.2 },
    ]);
    expect(result.map((r) => r.item.id)).toEqual(['rising', 'other', 'old']);
  });

  it('keeps each list\'s share of the score', () => {
    const [top] = blendRankings([
      { items: items('a'), weight: 0.3 },
      { items: items('b', 'a'), weight: 0.5 },
    ]);
    expect(top?.item.id).toBe('a');
    expect(top?.parts[0]).toBeCloseTo(0.3);
    expect(top?.parts[1]).toBeCloseTo(0.49);
    expect(top?.score).toBeCloseTo(0.79);
  });

  it('respects the limit and handles empty lists', () => {
    expect(blendRankings([{ items: items('a', 'b', 'c'), weight: 1 }], 2)).toHaveLength(2);
    expect(blendRankings([{ items: [], weight: 1 }])).toEqual([]);
  });
});

describe('movement', () => {
  it('reports places climbed or dropped', () => {
    expect(movement('a', 1, ['b', 'c', 'a'])).toBe(2);
    expect(movement('a', 3, ['a', 'b', 'c'])).toBe(-2);
    expect(movement('a', 2, ['b', 'a'])).toBe(0);
  });

  it('marks newcomers and treats a first visit as no change', () => {
    expect(movement('new', 4, ['a', 'b'])).toBeNull();
    expect(movement('a', 1, null)).toBe(0);
  });
});
