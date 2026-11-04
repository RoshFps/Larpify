import { describe, expect, it } from 'vitest';
import { catchUp, recapWindow, zipfShare } from './catchUp';

describe('zipfShare', () => {
  it('gives #1 twice the share of #2 and nothing to unranked picks', () => {
    expect(zipfShare(1) / zipfShare(2)).toBeCloseTo(2);
    expect(zipfShare(null)).toBe(0);
    expect(zipfShare(51)).toBe(0);
  });
});

describe('recapWindow', () => {
  it('counts down to mid-November', () => {
    const w = recapWindow(new Date(2026, 10, 4, 12).getTime());
    expect(w.year).toBe(2026);
    expect(w.daysLeft).toBeCloseTo(10.5, 0);
  });
  it('plans for next year after the cutoff', () => {
    const w = recapWindow(new Date(2026, 11, 1).getTime());
    expect(w.year).toBe(2027);
    expect(w.elapsedDays).toBe(0);
    expect(w.daysLeft).toBeGreaterThan(300);
  });
});

describe('catchUp', () => {
  const june = new Date(2026, 5, 1).getTime();
  it('asks nothing of your current #1', () => {
    expect(catchUp(1, 120, june).minutesPerDay).toBe(0);
  });
  it('needs more for artists further down, most for someone new', () => {
    const second = catchUp(2, 120, june).minutesPerDay;
    const tenth = catchUp(10, 120, june).minutesPerDay;
    const unranked = catchUp(null, 120, june).minutesPerDay;
    expect(second).toBeGreaterThan(0);
    expect(tenth).toBeGreaterThan(second);
    expect(unranked).toBeGreaterThan(tenth);
  });
  it('gets harder the closer the cutoff is', () => {
    const early = catchUp(null, 120, new Date(2026, 1, 1).getTime()).minutesPerDay;
    const late = catchUp(null, 120, new Date(2026, 10, 1).getTime()).minutesPerDay;
    expect(late).toBeGreaterThan(early);
  });
});
