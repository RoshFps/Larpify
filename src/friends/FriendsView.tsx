import { useEffect, useMemo, useState } from 'react';
import type { UserProfile } from '../api/types';
import { useRecap, type Recap } from '../recap/useRecap';
import { FriendsError, getSharing, lookupFriend, startSharing, stopSharing } from './client';
import { compareLists, normaliseCode, type Comparison, type SharedEntry, type SharedRecap } from './shape';

const TOP = 10;

function toShared(recap: Recap, displayName: string): SharedRecap {
  const pick = (list: Recap['artists'] | Recap['tracks']): SharedEntry[] =>
    list.slice(0, TOP).map((p) => ({ id: p.item.id, name: p.item.name }));
  return { displayName, artists: pick(recap.artists), tracks: pick(recap.tracks), updatedAt: Date.now() };
}

export function FriendsView({ me }: { me: UserProfile | null }) {
  const state = useRecap();
  const recap = state.status === 'ready' ? state.recap : null;
  const name = me?.display_name?.trim() || 'A friend';

  return (
    <div className="view">
      <header className="view-header">
        <p className="eyebrow">Experiment</p>
        <h1 className="view-title">Compare with friends</h1>
        <p className="view-subtitle">
          Share your predicted top 10 with a code, and see how your taste lines up with friends who share theirs.
        </p>
      </header>

      {state.status === 'loading' && <div className="recap-skeleton skeleton" aria-busy="true" />}
      {state.status === 'error' && (
        <p className="inline-error" role="alert">
          {state.message}
        </p>
      )}
      {state.status === 'needs-permission' && (
        <p className="empty">Open Recap first and allow access to your top artists and songs.</p>
      )}
      {recap && (
        <>
          <ShareCard recap={recap} name={name} />
          <CompareCard recap={recap} />
        </>
      )}
    </div>
  );
}

function ShareCard({ recap, name }: { recap: Recap; name: string }) {
  const [sharing, setSharing] = useState<boolean | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    getSharing().then(
      (s) => {
        if (!live) return;
        setSharing(s.sharing);
        setCode(s.code);
        // Keep a friend's view of you fresh: Recap changes about once a day.
        if (s.sharing) void startSharing(toShared(recap, name)).catch(() => undefined);
      },
      (err: unknown) => live && setError(err instanceof Error ? err.message : 'Something went wrong.'),
    );
    return () => {
      live = false;
    };
  }, [recap, name]);

  const toggle = async () => {
    setBusy(true);
    setError(null);
    try {
      if (sharing) {
        await stopSharing();
        setSharing(false);
        setCode(null);
      } else {
        setCode(await startSharing(toShared(recap, name)));
        setSharing(true);
      }
    } catch (err) {
      setError(err instanceof FriendsError ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const copy = () =>
    navigator.clipboard.writeText(code ?? '').then(
      () => setCopied(true),
      () => setCopied(false),
    );

  return (
    <section className="target-card" aria-labelledby="share-title">
      <h2 id="share-title" className="section-title">
        Share my Recap
      </h2>
      <p className="setting__hint">
        Friends with your code see only the names of your predicted top 10 artists and songs. No email, no listening
        history. Turn it off any time and it's deleted.
      </p>
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      {sharing && code && (
        <p className="share-code">
          Your code <strong className="share-code__value">{code}</strong>{' '}
          <button className="btn btn--outline btn--compact" onClick={() => void copy()}>
            {copied ? 'Copied' : 'Copy code'}
          </button>
        </p>
      )}
      {sharing !== null && (
        <button className={sharing ? 'btn btn--outline' : 'btn btn--primary'} disabled={busy} onClick={() => void toggle()}>
          {sharing ? 'Stop sharing' : 'Share my Recap'}
        </button>
      )}
    </section>
  );
}

function CompareCard({ recap }: { recap: Recap }) {
  const [input, setInput] = useState('');
  const [friend, setFriend] = useState<SharedRecap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const mine = useMemo(() => toShared(recap, 'You'), [recap]);
  const artists = friend ? compareLists(mine.artists, friend.artists) : null;
  const tracks = friend ? compareLists(mine.tracks, friend.tracks) : null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const code = normaliseCode(input);
    if (!code) {
      setError('Codes are 6 letters and numbers.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setFriend(await lookupFriend(code));
    } catch (err) {
      setFriend(null);
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="target-card" aria-labelledby="compare-title">
      <h2 id="compare-title" className="section-title">
        Compare with a friend
      </h2>
      <form className="access-form" onSubmit={(e) => void submit(e)}>
        <label className="field">
          <span className="field__label">Their code</span>
          <input value={input} onChange={(e) => setInput(e.target.value)} maxLength={10} autoComplete="off" />
        </label>
        <button className="btn btn--primary" disabled={busy}>
          {busy ? 'Looking…' : 'Compare'}
        </button>
      </form>
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      {friend && artists && tracks && (
        <div className="compare" aria-live="polite">
          <p className="compare__match">
            You and <strong>{friend.displayName}</strong> match{' '}
            <strong>{Math.round((artists.matchPercent + tracks.matchPercent) / 2)}%</strong>
          </p>
          <Result title="Artists" result={artists} friend={friend.displayName} />
          <Result title="Songs" result={tracks} friend={friend.displayName} />
          <p className="setting__hint">
            Your #1s: you have {mine.artists[0]?.name ?? '—'} · {mine.tracks[0]?.name ?? '—'}; {friend.displayName} has{' '}
            {friend.artists[0]?.name ?? '—'} · {friend.tracks[0]?.name ?? '—'}.
          </p>
        </div>
      )}
    </section>
  );
}

function Result({ title, result, friend }: { title: string; result: Comparison; friend: string }) {
  return (
    <section aria-label={`${title} in common`} className="compare__block">
      <h3 className="compare__title">
        {title} · {result.matchPercent}% match
      </h3>
      {result.shared.length === 0 ? (
        <p className="setting__hint">No {title.toLowerCase()} in common.</p>
      ) : (
        <ul className="compare__list">
          {result.shared.map((s) => (
            <li key={s.name}>
              <strong>{s.name}</strong>{' '}
              <span className="setting__hint">
                you #{s.yours} · {friend} #{s.theirs}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
