import { describe, expect, it } from 'vitest';
import { formatHour, isQuietTime } from './quietHours';

const at = (hour: number, minute = 0) => new Date(2026, 10, 3, hour, minute);

describe('isQuietTime', () => {
  const overnight = { enabled: true, start: 2, end: 8 };

  it('covers the start hour but not the end hour', () => {
    expect(isQuietTime(at(1, 59), overnight)).toBe(false);
    expect(isQuietTime(at(2), overnight)).toBe(true);
    expect(isQuietTime(at(7, 59), overnight)).toBe(true);
    expect(isQuietTime(at(8), overnight)).toBe(false);
  });

  it('wraps past midnight', () => {
    const lateNight = { enabled: true, start: 23, end: 7 };
    expect(isQuietTime(at(23, 30), lateNight)).toBe(true);
    expect(isQuietTime(at(0), lateNight)).toBe(true);
    expect(isQuietTime(at(6), lateNight)).toBe(true);
    expect(isQuietTime(at(12), lateNight)).toBe(false);
  });

  it('is never quiet when disabled or when start equals end', () => {
    expect(isQuietTime(at(3), { ...overnight, enabled: false })).toBe(false);
    expect(isQuietTime(at(3), { enabled: true, start: 3, end: 3 })).toBe(false);
  });
});

describe('formatHour', () => {
  it('uses 12-hour labels', () => {
    expect(formatHour(0)).toBe('12 AM');
    expect(formatHour(8)).toBe('8 AM');
    expect(formatHour(12)).toBe('12 PM');
    expect(formatHour(23)).toBe('11 PM');
  });
});
