import { REDIRECT_URI, SCOPES, SPOTIFY_CLIENT_ID } from '../config';
import { readJson, remove, writeJson } from '../lib/storage';
import { codeChallenge, randomToken } from './pkce';

// Authorization Code flow with PKCE: the app never holds a client secret, so
// there is nothing in the bundle or the repo that could leak one.

const AUTHORIZE_URL = 'https://accounts.spotify.com/authorize';
const TOKEN_URL = 'https://accounts.spotify.com/api/token';

const TOKENS_KEY = 'larpify.tokens';
const VERIFIER_KEY = 'larpify.pkce.verifier';
const STATE_KEY = 'larpify.pkce.state';

/** Refresh this long before expiry so a request never goes out with a dying token. */
const EXPIRY_MARGIN_MS = 60_000;

interface Tokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

export class AuthError extends Error {
  override name = 'AuthError';
}

let tokens: Tokens | null = readJson<Tokens>(TOKENS_KEY);
let refreshInFlight: Promise<Tokens> | null = null;
const signOutListeners = new Set<() => void>();

export function isSignedIn(): boolean {
  return tokens !== null;
}

export function onSignOut(listener: () => void): () => void {
  signOutListeners.add(listener);
  return () => signOutListeners.delete(listener);
}

export async function beginLogin(): Promise<void> {
  const verifier = randomToken(64);
  const state = randomToken(16);
  // sessionStorage: these only need to survive the redirect round trip.
  writeJson(VERIFIER_KEY, verifier, sessionStorage);
  writeJson(STATE_KEY, state, sessionStorage);

  const url = new URL(AUTHORIZE_URL);
  url.search = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    scope: SCOPES.join(' '),
    code_challenge_method: 'S256',
    code_challenge: await codeChallenge(verifier),
    state,
    // Always show Spotify's consent screen, with its "Not you?" link, so a
    // friend on a shared browser can't end up silently in someone else's account.
    show_dialog: 'true',
  }).toString();
  window.location.assign(url.href);
}

let loginCompletion: Promise<boolean> | null = null;

/**
 * Finishes the redirect from Spotify if the current URL carries one.
 * Returns false when there was nothing to finish. Safe to call more than once
 * (React's StrictMode does); the authorization code can only be spent once.
 */
export function completeLoginFromUrl(): Promise<boolean> {
  loginCompletion ??= exchangeCodeFromUrl();
  return loginCompletion;
}

async function exchangeCodeFromUrl(): Promise<boolean> {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const error = params.get('error');
  if (!code && !error) return false;

  const expectedState = readJson<string>(STATE_KEY, sessionStorage);
  const verifier = readJson<string>(VERIFIER_KEY, sessionStorage);
  remove(STATE_KEY, sessionStorage);
  remove(VERIFIER_KEY, sessionStorage);
  // Drop ?code= from the address bar and history either way.
  window.history.replaceState(null, '', window.location.pathname);

  if (error) throw new AuthError(error === 'access_denied' ? 'Login was cancelled.' : `Spotify said: ${error}`);
  if (!expectedState || params.get('state') !== expectedState || !verifier) {
    throw new AuthError('Login response did not match this browser tab. Please try again.');
  }

  const response = await requestTokens({
    grant_type: 'authorization_code',
    code: code!,
    redirect_uri: REDIRECT_URI,
    code_verifier: verifier,
  });
  storeTokens(response, null);
  return true;
}

export async function getAccessToken(): Promise<string> {
  if (!tokens) throw new AuthError('Not signed in.');
  if (Date.now() < tokens.expiresAt - EXPIRY_MARGIN_MS) return tokens.accessToken;
  return (await refresh()).accessToken;
}

/** Forces a refresh, e.g. after the API rejects a token we thought was valid. */
export function refresh(): Promise<Tokens> {
  // Concurrent callers share one request; Spotify may rotate the refresh token,
  // and two parallel refreshes would race to invalidate each other.
  refreshInFlight ??= (async () => {
    if (!tokens) throw new AuthError('Not signed in.');
    try {
      const response = await requestTokens({ grant_type: 'refresh_token', refresh_token: tokens.refreshToken });
      return storeTokens(response, tokens.refreshToken);
    } catch (err) {
      if (err instanceof AuthError) signOut();
      throw err;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

/** Everything Larpify keeps for the signed-in person, cleared together on sign-out. */
const PER_USER_KEYS = [TOKENS_KEY, 'larpify.settings', 'larpify.stats', 'larpify.artistLog', 'larpify.recapSnapshots'];

export function signOut(): void {
  tokens = null;
  PER_USER_KEYS.forEach((key) => remove(key));
  signOutListeners.forEach((listener) => listener());
}

async function requestTokens(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ ...body, client_id: SPOTIFY_CLIENT_ID }),
  });
  if (res.status === 400 || res.status === 401) {
    throw new AuthError('Your Spotify session has ended. Please log in again.');
  }
  if (!res.ok) throw new Error(`Spotify token request failed (${res.status}).`);
  return (await res.json()) as TokenResponse;
}

function storeTokens(response: TokenResponse, previousRefreshToken: string | null): Tokens {
  const refreshToken = response.refresh_token ?? previousRefreshToken;
  if (!refreshToken) throw new AuthError('Spotify did not return a refresh token.');
  tokens = {
    accessToken: response.access_token,
    refreshToken,
    expiresAt: Date.now() + response.expires_in * 1000,
  };
  writeJson(TOKENS_KEY, tokens);
  return tokens;
}
