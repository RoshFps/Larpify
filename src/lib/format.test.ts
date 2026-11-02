import { describe, expect, it } from 'vitest';
import { formatClock, formatDuration, pickImage } from './format';

describe('pickImage', () => {
  const images = [
    { url: 'large', width: 640, height: 640 },
    { url: 'medium', width: 300, height: 300 },
    { url: 'small', width: 64, height: 64 },
  ];

  it('picks the smallest image that is big enough', () => {
    expect(pickImage(images, 48)).toBe('small');
    expect(pickImage(images, 200)).toBe('medium');
  });

  it('falls back to the largest when none is big enough', () => {
    expect(pickImage(images, 1000)).toBe('large');
  });

  it('handles missing images', () => {
    expect(pickImage(null, 48)).toBeNull();
    expect(pickImage([], 48)).toBeNull();
  });
});

describe('formatting', () => {
  it('formats track clocks', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(65_400)).toBe('1:05');
  });

  it('formats listening totals', () => {
    expect(formatDuration(45 * 60_000)).toBe('45 min');
    expect(formatDuration(120 * 60_000)).toBe('2 hr');
    expect(formatDuration(135 * 60_000)).toBe('2 hr 15 min');
  });
});
