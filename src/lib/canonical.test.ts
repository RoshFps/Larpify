import { describe, expect, it } from 'vitest';
import { canonicalRedirect } from './canonical';

const REDIRECT = 'https://larpify.example.app/';

describe('canonicalRedirect', () => {
  it('does nothing on the registered address', () => {
    expect(canonicalRedirect(new URL('https://larpify.example.app/'), REDIRECT)).toBeNull();
  });

  it('sends one-off deployment URLs to the registered address', () => {
    expect(canonicalRedirect(new URL('https://larpify-3v2kd2bfz-team.vercel.app/'), REDIRECT)).toBe(REDIRECT);
  });

  it('keeps the path and query string', () => {
    expect(canonicalRedirect(new URL('https://preview.vercel.app/?code=abc&state=xyz'), REDIRECT)).toBe(
      'https://larpify.example.app/?code=abc&state=xyz',
    );
  });
});
