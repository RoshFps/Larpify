import { describe, expect, it } from 'vitest';
import { parseAccessRequest } from './shape';

describe('parseAccessRequest', () => {
  it('trims and lower-cases', () => {
    expect(parseAccessRequest({ name: '  Ana ', email: ' Ana@Mail.COM ' }, 5)).toEqual({
      name: 'Ana',
      email: 'ana@mail.com',
      requestedAt: 5,
    });
  });

  it('returns a readable message for bad input', () => {
    expect(parseAccessRequest(null, 0)).toBe('Please fill in the form.');
    expect(parseAccessRequest({ name: ' ', email: 'a@b.co' }, 0)).toBe('Please add your name.');
    expect(parseAccessRequest({ name: 'A', email: 'a@b' }, 0)).toBe('That email doesn’t look right.');
    expect(parseAccessRequest({ name: 'A', email: 'a b@c.co' }, 0)).toBe('That email doesn’t look right.');
  });
});
