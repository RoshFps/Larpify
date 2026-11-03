import { useState } from 'react';
import { removeAccessRequest } from './client';
import type { AccessRequest } from './shape';

const DASHBOARD_URL = 'https://developer.spotify.com/dashboard';

interface RequestsViewProps {
  requests: AccessRequest[];
  onRemoved: (email: string) => void;
}

/** Owner-only list of friends waiting to be added in the Spotify dashboard. */
export function RequestsView({ requests, onRemoved }: RequestsViewProps) {
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const copy = (email: string) =>
    navigator.clipboard.writeText(email).then(
      () => setCopied(email),
      () => setCopied(null),
    );

  const markAdded = (email: string) =>
    removeAccessRequest(email).then(
      () => onRemoved(email),
      (err: Error) => setError(err.message),
    );

  return (
    <div className="view">
      <header className="view-header">
        <p className="eyebrow">Only you can see this</p>
        <h1 className="view-title">Access requests</h1>
        <p className="view-subtitle">
          Spotify only lets accounts you list use the app. Copy an email, add it under{' '}
          <strong>User Management</strong> in the{' '}
          <a href={DASHBOARD_URL} target="_blank" rel="noreferrer">
            Spotify dashboard
          </a>
          , then mark it added.
        </p>
      </header>

      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      {requests.length === 0 ? (
        <p className="empty">No one is waiting. Share your Larpify link and friends can ask from the login page.</p>
      ) : (
        <ul className="requests">
          {requests.map((r) => (
            <li key={r.email} className="request">
              <div className="request__text">
                <span className="request__name">{r.name}</span>
                <span className="request__email">{r.email}</span>
                <span className="request__when">{new Date(r.requestedAt).toLocaleDateString()}</span>
              </div>
              <div className="request__actions">
                <button className="btn btn--outline" onClick={() => void copy(r.email)}>
                  {copied === r.email ? 'Copied' : 'Copy email'}
                </button>
                <button className="btn btn--primary btn--compact" onClick={() => void markAdded(r.email)}>
                  Mark added
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
