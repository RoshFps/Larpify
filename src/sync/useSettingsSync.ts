import { useEffect, useRef, useState } from 'react';
import type { Settings } from '../settings/useSettings';
import { pullSettings, pushSettings, SyncUnavailable } from './client';
import { pickSynced, type SyncDocument } from './shape';

const PULL_EVERY_MS = 60_000;
const PUSH_DEBOUNCE_MS = 800;

export type SyncStatus = 'off' | 'syncing' | 'synced' | 'offline';

/**
 * Keeps synced settings in step with the server: pulls on load, every few
 * seconds and when the tab comes back into view, and pushes local edits.
 * The newest edit wins, on whichever device it was made.
 */
export function useSettingsSync(settings: Settings, applyRemote: (doc: SyncDocument) => void): SyncStatus {
  const [status, setStatus] = useState<SyncStatus>('syncing');
  const settingsRef = useRef(settings);
  // The updatedAt the server is known to have, so we don't echo back what we just pulled.
  const serverAtRef = useRef(0);
  const disabledRef = useRef(false);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    let cancelled = false;

    const pull = () => {
      if (disabledRef.current || document.visibilityState !== 'visible') return;
      pullSettings()
        .then((doc) => {
          if (cancelled) return;
          setStatus('synced');
          if (!doc) return;
          serverAtRef.current = Math.max(serverAtRef.current, doc.updatedAt);
          applyRemote(doc);
        })
        .catch((err) => {
          if (cancelled) return;
          if (err instanceof SyncUnavailable) {
            disabledRef.current = true;
            setStatus('off');
          } else {
            setStatus('offline');
          }
        });
    };

    pull();
    const id = window.setInterval(pull, PULL_EVERY_MS);
    document.addEventListener('visibilitychange', pull);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', pull);
    };
  }, [applyRemote]);

  useEffect(() => {
    if (disabledRef.current || settings.updatedAt <= serverAtRef.current) return;
    const id = window.setTimeout(() => {
      const current = settingsRef.current;
      const doc: SyncDocument = { settings: pickSynced(current), updatedAt: current.updatedAt };
      pushSettings(doc)
        .then((saved) => {
          if (saved) serverAtRef.current = Math.max(serverAtRef.current, saved.updatedAt);
          setStatus('synced');
        })
        .catch((err) => {
          if (err instanceof SyncUnavailable) {
            disabledRef.current = true;
            setStatus('off');
          } else {
            setStatus('offline');
          }
        });
    }, PUSH_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [settings.updatedAt]);

  return status;
}
