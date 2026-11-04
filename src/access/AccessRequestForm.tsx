import { useState, type FormEvent } from 'react';
import { MAX_EMAIL, MAX_NAME, parseAccessRequest } from './shape';
import { requestAccess } from './client';

/**
 * Spotify only lets accounts the app owner has listed use the app while it's
 * in development mode. This lets a friend ask to be listed.
 */
export function AccessRequestForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setState('sending');
    setError(null);
    try {
      const parsed = parseAccessRequest({ name, email }, Date.now());
      if (typeof parsed === 'string') throw new Error(parsed);
      await requestAccess(parsed.name, parsed.email, website);
      setState('sent');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.');
      setState('idle');
    }
  }

  if (state === 'sent') {
    return (
      <p className="access-form__done" role="status">
        Request sent. You’ll be able to log in once you’ve been added, usually within a day.
      </p>
    );
  }

  return (
    <form className="access-form" onSubmit={submit}>
      <label className="field">
        <span className="field__label">Your name</span>
        <input
          required
          maxLength={MAX_NAME}
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label className="field">
        <span className="field__label">The email you use for Spotify</span>
        <input
          required
          type="email"
          maxLength={MAX_EMAIL}
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      {/* Hidden from people and screen readers; bots tend to fill it in. */}
      <input
        className="access-form__trap"
        tabIndex={-1}
        aria-hidden="true"
        autoComplete="off"
        name="website"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
      />
      {error && (
        <p className="login__error" role="alert">
          {error}
        </p>
      )}
      <button className="btn btn--outline btn--block" disabled={state === 'sending'}>
        {state === 'sending' ? 'Sending…' : 'Request access'}
      </button>
      <p className="login__fineprint">Your email goes only to the person who runs this site, so they can add you in Spotify.</p>
    </form>
  );
}
