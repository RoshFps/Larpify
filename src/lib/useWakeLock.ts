import { useEffect } from 'react';

/**
 * Asks the browser not to dim or sleep the screen while `active`. Browsers
 * release the lock when the tab is hidden, so it is taken again on return.
 * Unsupported browsers simply skip it.
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;

    const acquire = () => {
      if (document.visibilityState !== 'visible') return;
      navigator.wakeLock
        .request('screen')
        .then((sentinel) => {
          if (cancelled) return void sentinel.release();
          lock = sentinel;
        })
        .catch(() => undefined);
    };

    acquire();
    document.addEventListener('visibilitychange', acquire);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', acquire);
      void lock?.release();
    };
  }, [active]);
}
