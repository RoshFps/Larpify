import { describe, expect, it } from 'vitest';
import { parseSyncDocument } from './shape';

const valid = {
  updatedAt: 1_700_000_000_000,
  settings: {
    enabled: true,
    idleMinutes: 10,
    source: 'artists',
    playlist: null,
    artists: [{ id: 'a1', uri: 'spotify:artist:a1', name: 'Mitski', imageUrl: 'https://i.scdn.co/image/x' }],
    quietHours: { enabled: true, start: 2, end: 8 },
  },
};

describe('parseSyncDocument', () => {
  it('accepts a well-formed document', () => {
    expect(parseSyncDocument(valid)).toEqual(valid);
  });

  it('drops fields it does not know about', () => {
    const doc = parseSyncDocument({ ...valid, settings: { ...valid.settings, volume: 1, extra: 'x' } });
    expect(doc?.settings).not.toHaveProperty('volume');
    expect(doc?.settings).not.toHaveProperty('extra');
  });

  it('rejects anything malformed rather than half-applying it', () => {
    const bad = [
      null,
      'nope',
      { ...valid, updatedAt: 'yesterday' },
      { ...valid, settings: { ...valid.settings, idleMinutes: 0 } },
      { ...valid, settings: { ...valid.settings, source: 'radio' } },
      { ...valid, settings: { ...valid.settings, quietHours: { enabled: true, start: 25, end: 8 } } },
      { ...valid, settings: { ...valid.settings, artists: [{ id: 'x', uri: 'javascript:alert(1)', name: 'x' }] } },
      { ...valid, settings: { ...valid.settings, artists: Array(6).fill(valid.settings.artists[0]) } },
    ];
    for (const value of bad) expect(parseSyncDocument(value)).toBeNull();
  });

  it('never keeps a non-https image URL', () => {
    const doc = parseSyncDocument({
      ...valid,
      settings: { ...valid.settings, artists: [{ ...valid.settings.artists[0], imageUrl: 'http://evil.test/x.png' }] },
    });
    expect(doc?.settings.artists[0]?.imageUrl).toBeNull();
  });
});
