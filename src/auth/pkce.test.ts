import { describe, expect, it } from 'vitest';
import { base64UrlEncode, codeChallenge, randomToken } from './pkce';

describe('PKCE helpers', () => {
  it('matches the RFC 7636 appendix B example', async () => {
    expect(await codeChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    );
  });

  it('produces URL-safe output without padding', () => {
    expect(base64UrlEncode(new Uint8Array([251, 255, 254]))).toBe('-__-');
  });

  it('makes verifiers within the allowed 43–128 characters', () => {
    const verifier = randomToken(64);
    expect(verifier).toMatch(/^[A-Za-z0-9_-]{43,128}$/);
    expect(randomToken(64)).not.toBe(verifier);
  });
});
