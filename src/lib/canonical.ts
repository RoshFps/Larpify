/**
 * Spotify only redirects back to the exact URI registered in its dashboard.
 * Hosts like Vercel also serve every build at its own one-off URL; logging in
 * from one of those fails with "redirect_uri: Not matching configuration".
 * Returns where to send the visitor instead, or null when they're already there.
 */
export function canonicalRedirect(current: URL, redirectUri: string): string | null {
  const canonical = new URL(redirectUri);
  if (current.origin === canonical.origin) return null;
  // Keep any ?code=… so a login that did land here can still finish there.
  return new URL(current.pathname + current.search, canonical).href;
}
