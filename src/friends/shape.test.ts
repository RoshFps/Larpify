import { describe, expect, it } from 'vitest';
import { compareLists, makeCode, normaliseCode, parseSharedRecap } from './shape';

const entries = (...names: string[]) => names.map((name) => ({ id: name.toLowerCase(), name }));

describe('friend codes', () => {
  it('makes 6-character codes without lookalike letters', () => {
    const code = makeCode(() => 0.999);
    expect(code).toHaveLength(6);
    expect(code).not.toMatch(/[01OI]/);
  });

  it('accepts a code however it is typed, and rejects junk', () => {
    expect(normaliseCode(' ab-c de2 ')).toBe('ABCDE2');
    expect(normaliseCode('ABC')).toBeNull();
    expect(normaliseCode('ABCDE0')).toBeNull();
  });
});

describe('parseSharedRecap', () => {
  const good = { displayName: 'Priya', artists: entries('SZA'), tracks: entries('Snooze'), updatedAt: 5 };

  it('keeps only names and ids', () => {
    const parsed = parseSharedRecap({ ...good, email: 'x@y.co', token: 'secret' }, 10);
    expect(parsed).toEqual(good);
    expect(JSON.stringify(parsed)).not.toContain('secret');
  });

  it('rejects oversized or malformed lists', () => {
    expect(parseSharedRecap({ ...good, artists: entries(...Array(11).fill('A')) }, 10)).toBeNull();
    expect(parseSharedRecap({ ...good, artists: [{ id: 1, name: 'x' }] }, 10)).toBeNull();
    expect(parseSharedRecap({ ...good, displayName: '  ' }, 10)).toBeNull();
    expect(parseSharedRecap('nope', 10)).toBeNull();
  });

  it('never trusts a clock from the future', () => {
    expect(parseSharedRecap({ ...good, updatedAt: 9_999 }, 10)?.updatedAt).toBe(10);
  });
});

describe('compareLists', () => {
  it('is 100% for identical lists and 0% with nothing in common', () => {
    const mine = entries('SZA', 'Mitski', 'Clairo');
    expect(compareLists(mine, mine).matchPercent).toBe(100);
    expect(compareLists(mine, entries('Drake', 'Adele', 'Bjork')).matchPercent).toBe(0);
  });

  it('scores a matching #1 above a matching last place', () => {
    const mine = entries('A', 'B', 'C', 'D');
    const sameTop = compareLists(mine, entries('A', 'X', 'Y', 'Z'));
    const sameBottom = compareLists(mine, entries('X', 'Y', 'Z', 'D'));
    expect(sameTop.matchPercent).toBeGreaterThan(sameBottom.matchPercent);
  });

  it('lists who you share, who is only yours, and who is only theirs', () => {
    const result = compareLists(entries('A', 'B'), entries('B', 'C'));
    expect(result.shared).toEqual([{ name: 'B', yours: 2, theirs: 1 }]);
    expect(result.onlyYours).toEqual(['A']);
    expect(result.onlyTheirs).toEqual(['C']);
  });

  it('handles an empty list without dividing by zero', () => {
    expect(compareLists([], entries('A')).matchPercent).toBe(0);
  });
});
