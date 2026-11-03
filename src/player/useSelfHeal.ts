import { useEffect } from 'react';

const CHECK_MS = 30_000;
const MAX_DOWN_MS = 2 * 60_000;
const RELOAD_COOLDOWN_MS = 10 * 60_000;
const KEY = 'larpify.lastRecovery';

/**
 * If autopilot is on but the tab's player has been missing for a couple of
 * minutes (dropped connection, SDK crash), reload the page to start fresh.
 * A cooldown stops a permanent fault from turning into a reload loop.
 */
export function useSelfHeal(enabled: boolean, playerReady: boolean): void {
  useEffect(() => {
    if (!enabled || playerReady) return;
    const downSince = Date.now();
    const id = window.setInterval(() => {
      if (Date.now() - downSince < MAX_DOWN_MS) return;
      try {
        const last = Number(sessionStorage.getItem(KEY)) || 0;
        if (Date.now() - last < RELOAD_COOLDOWN_MS) return;
        sessionStorage.setItem(KEY, String(Date.now()));
      } catch {
        return; // Without storage we can't rate-limit, so don't risk a reload loop.
      }
      window.location.reload();
    }, CHECK_MS);
    return () => window.clearInterval(id);
  }, [enabled, playerReady]);
}
