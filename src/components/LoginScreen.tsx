import { useState } from 'react';
import { beginLogin } from '../auth/session';
import { REDIRECT_URI, SPOTIFY_CLIENT_ID } from '../config';
import { LogoMark } from './Icons';

export function LoginScreen({ error }: { error: string | null }) {
  const [redirecting, setRedirecting] = useState(false);
  const configured = SPOTIFY_CLIENT_ID.length > 0;

  return (
    <main className="login">
      <div className="login__card">
        <LogoMark size={56} className="login__logo" />
        <h1 className="login__title">Larpify</h1>
        <p className="login__tagline">Your music keeps playing on this tab while you're away.</p>

        {configured ? (
          <button
            className="btn btn--primary btn--large"
            disabled={redirecting}
            onClick={() => {
              setRedirecting(true);
              beginLogin().catch(() => setRedirecting(false));
            }}
          >
            {redirecting ? 'Opening Spotify…' : 'Log in with Spotify'}
          </button>
        ) : (
          <div className="login__setup">
            <p>
              <strong>Almost there.</strong> Add your Spotify Client ID to <code>.env.local</code> as{' '}
              <code>VITE_SPOTIFY_CLIENT_ID</code>, and add this Redirect URI in the Spotify dashboard:
            </p>
            <code className="login__uri">{REDIRECT_URI}</code>
          </div>
        )}

        {error && (
          <p className="login__error" role="alert">
            {error}
          </p>
        )}
        <p className="login__fineprint">
          Uses Spotify's official login. Larpify never sees your password, and your session stays in this browser.
          Requires Spotify Premium.
        </p>
      </div>
    </main>
  );
}
