import { useEffect, useState } from 'react';
import { checkAccessSetup, type SetupCheck } from './client';

/** Shown at /#requests to anyone who isn't the owner, to find out what's missing. */
export function SetupCheckView() {
  const [result, setResult] = useState<SetupCheck | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    void checkAccessSetup().then(
      (r) => live && setResult(r),
      () => live && setResult(null),
    );
    return () => {
      live = false;
    };
  }, []);

  return (
    <div className="view">
      <header className="view-header">
        <h1 className="view-title">Access requests</h1>
      </header>
      {result === undefined && <p className="empty">Checking…</p>}
      {result === null && (
        <p className="empty">Requests aren’t deployed on this site yet. Redeploy it from Vercel and try again.</p>
      )}
      {result && (
        <ul className="requests">
          <li className="request">Storage connected: {result.storage ? 'yes' : 'no (connect the Upstash store in Vercel, then redeploy)'}</li>
          <li className="request">ADMIN_SPOTIFY_IDS set: {result.adminSet ? 'yes' : 'no (add it in Vercel, then redeploy)'}</li>
          <li className="request">
            Your Spotify id is <strong>{result.yourId}</strong>
            {result.isOwner ? ' and it is listed.' : '. Put exactly this in ADMIN_SPOTIFY_IDS, then redeploy.'}
          </li>
        </ul>
      )}
    </div>
  );
}
