import { describe, expect, it } from 'vitest';
import type { Track } from '../api/types';
import { MAX_MIX_LENGTH, buildArtistMix, shuffled } from './artistMix';

function track(uri: string, artistIds: string[], extra: Partial<Track> = {}): Track {
  return {
    id: uri,
    uri,
    name: uri,
    duration_ms: 1000,
    artists: artistIds.map((id) => ({ id, name: id })),
    album: { name: 'album', images: [] },
    ...extra,
  };
}

const keepOrder = () => 0.999_999;

describe('buildArtistMix', () => {
  it('drops tracks that do not credit the artist', () => {
    const mix = buildArtistMix(new Map([['a', [track('t1', ['a']), track('t2', ['someone-else'])]]]), keepOrder);
    expect(mix).toEqual(['t1']);
  });

  it('interleaves artists round-robin', () => {
    const mix = buildArtistMix(
      new Map([
        ['a', [track('a1', ['a']), track('a2', ['a']), track('a3', ['a'])]],
        ['b', [track('b1', ['b'])]],
      ]),
      keepOrder,
    );
    expect(mix).toEqual(['a1', 'b1', 'a2', 'a3']);
  });

  it('removes duplicates across artists and unplayable tracks', () => {
    const collab = track('collab', ['a', 'b']);
    const mix = buildArtistMix(
      new Map([
        ['a', [collab, track('blocked', ['a'], { is_playable: false })]],
        ['b', [collab]],
      ]),
      keepOrder,
    );
    expect(mix).toEqual(['collab']);
  });

  it('caps the queue length', () => {
    const many = Array.from({ length: 150 }, (_, i) => track(`t${i}`, ['a']));
    expect(buildArtistMix(new Map([['a', many]]))).toHaveLength(MAX_MIX_LENGTH);
  });

  it('returns an empty mix when nothing matches', () => {
    expect(buildArtistMix(new Map([['a', []]]))).toEqual([]);
  });
});

describe('shuffled', () => {
  it('keeps every element and does not mutate the input', () => {
    const input = [1, 2, 3, 4, 5];
    const output = shuffled(input);
    expect([...output].sort()).toEqual(input);
    expect(input).toEqual([1, 2, 3, 4, 5]);
  });
});
